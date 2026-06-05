"""
Requirements:
  pip install brainflow numpy
"""

import time
import argparse
import numpy as np
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds

from eeg_quality import compute_channel_metrics, quality_display_label


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


def clear_screen():
    print("\033[2J\033[H", end="")


def print_signal_quality(ch_labels, qualities):
    print("Signal Quality (RMS only)")
    print("Channel | RMS_uV | Quality")
    print("-----------------------------")
    for label, q in zip(ch_labels, qualities):
        label_text = quality_display_label(q["quality"])
        print(
            f"{label:<7} | "
            f"{q['rms_uV']:>6.1f} | "
            f"{label_text}"
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

            raw_ts = data[timestamp_ch, :]
            if raw_ts.size == 0:
                continue

            quality_data = data[quality_ch, :]
            qualities = compute_channel_metrics(quality_data, fs, board_channel_indices=quality_ch)

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
