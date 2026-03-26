"""
EEG WebSocket Server - Streams brainwave data to the frontend

Requirements:
  pip install brainflow numpy websockets

Usage:
  python eeg_server.py --port COM5
  python eeg_server.py --mock  # Use mock data for testing without hardware
"""

import json
import time
import asyncio
import argparse
import numpy as np
from typing import Optional, Set

try:
    import websockets
    # Use the newer API if available, fallback to legacy
    try:
        from websockets.asyncio.server import serve
    except ImportError:
        from websockets import serve
except ImportError:
    print("Error: websockets package not found. Install with: pip install websockets")
    exit(1)

try:
    from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds
    from brainflow.data_filter import DataFilter
    BRAINFLOW_AVAILABLE = True
except ImportError:
    print("Warning: brainflow not available. Only mock mode will work.")
    BRAINFLOW_AVAILABLE = False

try:
    from brainflow.data_filter import WindowFunctions
    WINDOW = WindowFunctions.HANNING.value
except ImportError:
    WINDOW = 1  # fallback to HANNING


# Server state
class EEGServerState:
    def __init__(self):
        self.is_streaming = False
        self.session_id: Optional[str] = None
        self.trial_id: Optional[str] = None
        self.phase: Optional[str] = None
        self.connected_clients: Set = set()
        self.board = None
        self.use_mock = False
        self.serial_port = "COM5"
        self.update_interval = 1.0  # seconds
        self.window_sec = 2.0
        self.quality_channels_arg = ""


state = EEGServerState()

"""
def classify_quality(rms_uV: float, p60_rel: float) -> str:
    """Classify channel quality using the same thresholds as the frontend widget."""
    if (1.0 <= rms_uV <= 100.0) and (p60_rel < 0.3):
        return "good"
    if (100 <= rms_uV <= 150.0) and (p60_rel < 0.6):
        return "ok"
    return "poor"
"""

def classify_quality(rms_uV: float) -> str:
    """Classify channel quality using only RMS thresholds."""
    if 5.0 <= rms_uV <= 100.0:
        return "good"
    if 100.0 < rms_uV <= 150.0:
        return "ok"
    return "poor"


def quality_to_score(quality: str) -> int:
    """Convert quality label to a coarse numeric score (0-100)."""
    if quality == "good":
        return 100
    if quality == "ok":
        return 70
    return 30


def parse_quality_channels(arg: str, fallback):
    """Parse comma-separated board channel indexes for signal-quality checks."""
    if not arg.strip():
        return fallback
    parts = [p.strip() for p in arg.split(",") if p.strip()]
    return [int(p) for p in parts]


def compute_bandpowers_uV2(avg_signal_uV: np.ndarray, fs: int):
    """
    Compute band powers from averaged EEG signal.
    avg_signal_uV: 1D time-domain signal in microvolts
    Returns: dict of band powers in uV^2 and relative powers
    """
    if len(avg_signal_uV) < 16:
        return {
            "total_1_45_uV2": 1e-12,
            "delta_uV2": 0.0, "theta_uV2": 0.0, "alpha_uV2": 0.0, "beta_uV2": 0.0, "gamma_uV2": 0.0,
            "delta_rel": 0.0, "theta_rel": 0.0, "alpha_rel": 0.0, "beta_rel": 0.0, "gamma_rel": 0.0,
        }

    data_len = len(avg_signal_uV)
    nfft = DataFilter.get_nearest_power_of_two(data_len)
    if nfft >= data_len:
        nfft = nfft // 2
    nfft = max(8, nfft)
    overlap = nfft // 2

    psd, freqs = DataFilter.get_psd_welch(avg_signal_uV, nfft, overlap, fs, WINDOW)
    psd = np.asarray(psd)
    freqs = np.asarray(freqs)

    def band_power_uV2(f0, f1) -> float:
        idx = np.logical_and(freqs >= f0, freqs <= f1)
        if not np.any(idx):
            return 0.0
        val = float(np.trapz(psd[idx], freqs[idx]))
        if not np.isfinite(val):
            return 0.0
        return val

    bands = {
        "delta": (1.0, 4.0),
        "theta": (4.0, 8.0),
        "alpha": (8.0, 12.0),
        "beta": (13.0, 30.0),
        "gamma": (30.0, 45.0),
    }

    total_1_45 = band_power_uV2(1.0, 45.0)
    if not np.isfinite(total_1_45) or total_1_45 <= 0:
        total_1_45 = 1e-12

    out = {"total_1_45_uV2": total_1_45}
    for name, (f0, f1) in bands.items():
        pwr = band_power_uV2(f0, f1)
        out[f"{name}_uV2"] = pwr
        out[f"{name}_rel"] = pwr / total_1_45

    return out


def generate_mock_reading():
    """Generate realistic mock EEG data for testing without hardware."""
    # Realistic ranges based on typical EEG
    delta_abs = np.random.uniform(0.5, 5.0)
    theta_abs = np.random.uniform(1.0, 8.0)
    alpha_abs = np.random.uniform(2.0, 15.0)
    beta_abs = np.random.uniform(1.0, 12.0)
    gamma_abs = np.random.uniform(0.5, 6.0)

    total = delta_abs + theta_abs + alpha_abs + beta_abs + gamma_abs

    channel_metrics = []
    for channel_index in range(4):
        quality_roll = np.random.random()
        if quality_roll < 0.6:
            rms_uV = np.random.uniform(10.0, 80.0)
            # p60_rel = np.random.uniform(0.05, 0.25)
        elif quality_roll < 0.9:
            rms_uV = np.random.uniform(80.0, 220.0)
            # p60_rel = np.random.uniform(0.25, 0.55)
        else:
            if np.random.random() < 0.5:
                rms_uV = np.random.uniform(240.0, 420.0)
                # p60_rel = np.random.uniform(0.30, 0.55)
            else:
                rms_uV = np.random.uniform(40.0, 140.0)
                # p60_rel = np.random.uniform(0.60, 0.85)

        quality = classify_quality(float(rms_uV))
        channel_metrics.append({
            "channel_index": channel_index,
            "rms_uV": float(rms_uV),
            # "p60_rel": float(p60_rel),
            "quality": quality,
        })

    signal_quality = min(quality_to_score(ch["quality"]) for ch in channel_metrics)

    return {
        "timestamp_ms": int(time.time() * 1000),
        "source": "mock",
        "delta_abs": round(delta_abs, 6),
        "theta_abs": round(theta_abs, 6),
        "alpha_abs": round(alpha_abs, 6),
        "beta_abs": round(beta_abs, 6),
        "gamma_abs": round(gamma_abs, 6),
        "delta_rel": round(delta_abs / total, 5),
        "theta_rel": round(theta_abs / total, 5),
        "alpha_rel": round(alpha_abs / total, 5),
        "beta_rel": round(beta_abs / total, 5),
        "gamma_rel": round(gamma_abs / total, 5),
        "total_1_45_uV2": round(total, 6),
        "signal_quality": signal_quality,
        "channel_metrics": channel_metrics,
    }


def compute_channel_metrics(raw_eeg_uV: np.ndarray, fs: int, board_channel_indices=None):
    """Compute per-channel quality using the same method as signal_quality_1.py."""
    metrics = []
    if raw_eeg_uV is None or raw_eeg_uV.ndim < 2 or raw_eeg_uV.shape[1] < 16:
        return metrics

    n_ch, n_samp = raw_eeg_uV.shape
    nfft = DataFilter.get_nearest_power_of_two(n_samp)
    if nfft >= n_samp:
        nfft = nfft // 2
    nfft = max(8, nfft)
    overlap = nfft // 2

    for ci in range(n_ch):
        sig = raw_eeg_uV[ci, :]
        psd, freqs = DataFilter.get_psd_welch(sig, nfft, overlap, fs, WINDOW)
        psd = np.asarray(psd)
        freqs = np.asarray(freqs)

        def band_power(f0, f1):
            idx = np.logical_and(freqs >= f0, freqs <= f1)
            if not np.any(idx):
                return 0.0
            val = float(np.trapz(psd[idx], freqs[idx]))
            if not np.isfinite(val):
                return 0.0
            return val

        total_1_45 = band_power(1.0, 45.0)
        if total_1_45 <= 0 or not np.isfinite(total_1_45):
            total_1_45 = 1e-12

        # p60 = band_power(55.0, 65.0)
        # p60_rel = p60 / total_1_45
        rms_uV = float(np.sqrt(total_1_45))
        quality = classify_quality(rms_uV)

        metric = {
            "channel_index": ci,
            "rms_uV": rms_uV,
            # "p60_rel": p60_rel,
            "quality": quality,
        }
        if board_channel_indices is not None and ci < len(board_channel_indices):
            metric["board_channel_index"] = int(board_channel_indices[ci])
        metrics.append(metric)

    return metrics


async def read_from_board():
    """Read data from the BrainFlow board and compute band powers."""
    if state.board is None:
        return None

    board_id = BoardIds.GANGLION_BOARD.value
    fs = BoardShim.get_sampling_rate(board_id)
    eeg_ch = BoardShim.get_eeg_channels(board_id)
    timestamp_ch = BoardShim.get_timestamp_channel(board_id)

    n_win = max(8, int(round(state.window_sec * fs)))

    data = state.board.get_current_board_data(n_win)
    if data is None or not hasattr(data, "ndim") or data.ndim < 2 or data.shape[1] < int(0.8 * n_win):
        return None

    raw_eeg = data[eeg_ch, :]
    raw_ts = data[timestamp_ch, :]
    if raw_ts.size == 0:
        return None

    quality_ch = parse_quality_channels(state.quality_channels_arg, eeg_ch)
    quality_ch = [int(idx) for idx in quality_ch if 0 <= int(idx) < data.shape[0]]
    if not quality_ch:
        quality_ch = eeg_ch
    quality_data = data[quality_ch, :]

    avg_uV = np.mean(raw_eeg, axis=0)
    bands = compute_bandpowers_uV2(avg_uV, fs)
    channel_metrics = compute_channel_metrics(quality_data, fs, board_channel_indices=quality_ch)

    # Keep a single numeric score for storage/UI convenience.
    if channel_metrics:
        signal_quality = min(quality_to_score(ch["quality"]) for ch in channel_metrics)
    else:
        signal_quality = 50

    return {
        "timestamp_ms": int(time.time() * 1000),
        "source": "board",
        "bf_time": float(raw_ts[-1]),
        "delta_abs": float(bands["delta_uV2"]),
        "theta_abs": float(bands["theta_uV2"]),
        "alpha_abs": float(bands["alpha_uV2"]),
        "beta_abs": float(bands["beta_uV2"]),
        "gamma_abs": float(bands["gamma_uV2"]),
        "delta_rel": float(bands["delta_rel"]),
        "theta_rel": float(bands["theta_rel"]),
        "alpha_rel": float(bands["alpha_rel"]),
        "beta_rel": float(bands["beta_rel"]),
        "gamma_rel": float(bands["gamma_rel"]),
        "total_1_45_uV2": float(bands["total_1_45_uV2"]),
        "signal_quality": signal_quality,
        "channel_metrics": channel_metrics,
    }


async def broadcast_reading(reading: dict):
    """Broadcast a reading to all connected clients."""
    if not state.connected_clients:
        return

    message = json.dumps({
        "type": "reading",
        "data": reading,
        "session_id": state.session_id,
        "trial_id": state.trial_id,
        "phase": state.phase,
    })

    # Send to all connected clients
    disconnected = set()
    for client in state.connected_clients:
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(client)

    # Remove disconnected clients
    state.connected_clients -= disconnected


async def streaming_loop():
    """Main streaming loop that reads EEG data and broadcasts to clients."""
    print("Starting EEG streaming loop...")

    while state.is_streaming:
        try:
            if state.use_mock:
                reading = generate_mock_reading()
            else:
                reading = await read_from_board()

            if reading:
                await broadcast_reading(reading)

            await asyncio.sleep(state.update_interval)
        except Exception as e:
            print(f"Error in streaming loop: {e}")
            await asyncio.sleep(1)

    print("EEG streaming loop stopped.")


async def start_streaming():
    """Start the EEG streaming."""
    if state.is_streaming:
        return {"success": True, "message": "Already streaming"}

    if not state.use_mock and BRAINFLOW_AVAILABLE:
        try:
            board_id = BoardIds.GANGLION_BOARD.value
            params = BrainFlowInputParams()
            params.serial_port = state.serial_port

            state.board = BoardShim(board_id, params)
            state.board.prepare_session()
            state.board.start_stream()
            print(f"BrainFlow board connected on {state.serial_port}")
        except Exception as e:
            print(f"Error connecting to board: {e}")
            return {"success": False, "error": str(e)}

    state.is_streaming = True
    asyncio.create_task(streaming_loop())

    return {"success": True, "message": "Streaming started", "mock": state.use_mock}


async def stop_streaming():
    """Stop the EEG streaming."""
    state.is_streaming = False

    if state.board:
        try:
            state.board.stop_stream()
            state.board.release_session()
            print("BrainFlow board session released.")
        except Exception as e:
            print(f"Error releasing board: {e}")
        state.board = None

    return {"success": True, "message": "Streaming stopped"}


async def handle_message(websocket, message: str):
    """Handle incoming WebSocket messages from clients."""
    try:
        data = json.loads(message)
        cmd = data.get("command")

        if cmd == "start":
            result = await start_streaming()
            await websocket.send(json.dumps({"type": "response", "command": "start", **result}))

        elif cmd == "stop":
            result = await stop_streaming()
            await websocket.send(json.dumps({"type": "response", "command": "stop", **result}))

        elif cmd == "set_context":
            state.session_id = data.get("session_id")
            state.trial_id = data.get("trial_id")
            state.phase = data.get("phase")
            await websocket.send(json.dumps({
                "type": "response",
                "command": "set_context",
                "success": True,
                "session_id": state.session_id,
                "trial_id": state.trial_id,
                "phase": state.phase,
            }))

        elif cmd == "status":
            await websocket.send(json.dumps({
                "type": "response",
                "command": "status",
                "is_streaming": state.is_streaming,
                "mock_mode": state.use_mock,
                "connected_clients": len(state.connected_clients),
                "session_id": state.session_id,
                "trial_id": state.trial_id,
                "phase": state.phase,
            }))

        elif cmd == "ping":
            await websocket.send(json.dumps({"type": "pong"}))

        else:
            await websocket.send(json.dumps({
                "type": "error",
                "message": f"Unknown command: {cmd}"
            }))

    except json.JSONDecodeError:
        await websocket.send(json.dumps({
            "type": "error",
            "message": "Invalid JSON"
        }))
    except Exception as e:
        await websocket.send(json.dumps({
            "type": "error",
            "message": str(e)
        }))


async def handle_client(websocket, path=None):
    """Handle a WebSocket client connection."""
    state.connected_clients.add(websocket)
    client_id = id(websocket)
    print(f"Client connected: {client_id} (total: {len(state.connected_clients)})")

    try:
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "connected",
            "message": "Connected to EEG server",
            "mock_mode": state.use_mock,
            "is_streaming": state.is_streaming,
        }))

        async for message in websocket:
            await handle_message(websocket, message)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        state.connected_clients.discard(websocket)
        print(f"Client disconnected: {client_id} (total: {len(state.connected_clients)})")


def parse_args():
    p = argparse.ArgumentParser(description="EEG WebSocket Server for brainwave streaming")
    p.add_argument("--port", type=str, default="COM5", help="Serial port for Ganglion dongle")
    p.add_argument("--ws-port", type=int, default=8765, help="WebSocket server port (default 8765)")
    p.add_argument("--mock", action="store_true", help="Use mock data (no hardware required)")
    p.add_argument("--update-interval", type=float, default=0.1, help="Update interval in seconds (default 0.1 = 10Hz)")
    p.add_argument("--window-sec", type=float, default=2.0, help="PSD window length in seconds (default 2s)")
    p.add_argument(
        "--quality-channels",
        type=str,
        default="",
        help="Comma-separated board channel indexes for quality check. Empty uses EEG channels.",
    )
    return p.parse_args()


async def main():
    args = parse_args()

    state.serial_port = args.port
    state.use_mock = args.mock or not BRAINFLOW_AVAILABLE
    state.update_interval = args.update_interval
    state.window_sec = args.window_sec
    state.quality_channels_arg = args.quality_channels

    if state.use_mock:
        print("Running in MOCK mode (no hardware)")
    else:
        print(f"Will connect to Ganglion on {state.serial_port}")

    print(f"Starting WebSocket server on ws://localhost:{args.ws_port}")

    try:
        async with serve(handle_client, "localhost", args.ws_port):
            print(f"EEG WebSocket server running on ws://localhost:{args.ws_port}")
            print("Press Ctrl+C to stop")
            await asyncio.Future()  # Run forever
    except OSError as e:
        print(f"Failed to start WebSocket server on ws://localhost:{args.ws_port}: {e}")
        print("Tip: another process may already be using this port.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped")
