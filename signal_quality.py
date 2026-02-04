"""
Requirements:
  pip install brainflow numpy
"""

import time
import argparse
import numpy as np
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds
from brainflow.data_filter import DataFilter

try:
    from brainflow.data_filter import WindowFunctions
    WINDOW = WindowFunctions.HANNING.value
except ImportError:
    WINDOW = 1  # fallback to HANNING


def parse_args():
    p = argparse.ArgumentParser(description="Ganglion signal quality + bandpower table UI (1s updates).")
    p.add_argument("--port", type=str, default="COM5", help="Serial port for Ganglion dongle (e.g., COM5).")
    p.add_argument("--duration_sec", type=float, default=0.0, help="0 = run until Ctrl+C.")
    p.add_argument("--update_sec", type=float, default=1.0, help="Update UI every N seconds (default 1s).")
    p.add_argument("--window_sec", type=float, default=2.0, help="PSD window length in seconds (default 2s).")
    p.add_argument("--max_rows", type=int, default=12, help="How many recent rows to display.")
    p.add_argument(
        "--quality_channels",
        type=str,
        default="",
        help="Comma-separated channel indexes for quality check. Empty uses EEG channels.",
    )
    return p.parse_args()


def compute_channel_quality(raw_eeg_uV, fs):
    n_ch, n_samp = raw_eeg_uV.shape
    qualities = []

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

        p60 = band_power(55.0, 65.0)
        p60_rel = p60 / total_1_45
        rms_uV = float(np.sqrt(total_1_45))

        if (3.0 <= rms_uV <= 100.0) and (p60_rel < 0.3):
            quality = "good"
        elif (0.5 <= rms_uV <= 300.0) and (p60_rel < 0.6):
            quality = "ok"
        else:
            quality = "poor"

        qualities.append({
            "rms_uV": rms_uV,
            "p60_rel": p60_rel,
            "quality": quality,
        })

    return qualities


def clear_screen():
    print("\033[2J\033[H", end="")


def print_signal_quality(ch_labels, qualities):
    print("Signal Quality")
    print("Channel | RMS_uV | 60Hz_rel | Quality")
    print("--------------------------------------")
    for label, q in zip(ch_labels, qualities):
        print(
            f"{label:<7} | "
            f"{q['rms_uV']:>6.1f} | "
            f"{q['p60_rel']:>7.2f} | "
            f"{q['quality']}"
        )


def parse_quality_channels(arg, fallback):
    if not arg.strip():
        return fallback
    parts = [p.strip() for p in arg.split(",") if p.strip()]
    return [int(p) for p in parts]


def main():
    args = parse_args()

    board_id = BoardIds.GANGLION_BOARD.value
    params = BrainFlowInputParams()
    params.serial_port = args.port

    board = BoardShim(board_id, params)

    try:
        board.prepare_session()
        board.start_stream()

        fs = BoardShim.get_sampling_rate(board_id)
        eeg_ch = BoardShim.get_eeg_channels(board_id)
        timestamp_ch = BoardShim.get_timestamp_channel(board_id)

        quality_ch = parse_quality_channels(args.quality_channels, eeg_ch)
        quality_labels = [f"CH{idx + 1}" for idx in range(len(quality_ch))]

        n_win = max(8, int(round(args.window_sec * fs)))
        start_time = time.time()

        while True:
            if args.duration_sec > 0 and (time.time() - start_time) >= args.duration_sec:
                break

            time.sleep(args.update_sec)

            data = board.get_current_board_data(n_win)
            if data is None or not hasattr(data, "ndim") or data.ndim < 2 or data.shape[1] < int(0.8 * n_win):
                continue

            raw_eeg = data[eeg_ch, :]
            raw_ts = data[timestamp_ch, :]
            if raw_ts.size == 0:
                continue

            quality_data = data[quality_ch, :]
            qualities = compute_channel_quality(quality_data, fs)

            clear_screen()
            print_signal_quality(quality_labels, qualities)

    except KeyboardInterrupt:
        print("\nStopped manually.")
    except Exception:
        import traceback
        traceback.print_exc()
    finally:
        if board.is_prepared():
            board.stop_stream()
            board.release_session()
            print("Board session released.")


if __name__ == "__main__":
    main()
