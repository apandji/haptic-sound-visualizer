#!/usr/bin/env python3
"""
Run eeg_server.py and server.py together with one command.

Examples:
  python run_servers.py --mock
  python run_servers.py --port COM5
  python run_servers.py --port /dev/tty.usbserial-XXXX
"""

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def parse_args():
    parser = argparse.ArgumentParser(description="Start both EEG and HTTP servers.")
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="Python executable to use for child processes (default: current interpreter).",
    )
    parser.add_argument("--mock", action="store_true", help="Run eeg_server.py in mock mode.")
    parser.add_argument(
        "--port",
        dest="device_port",
        help="Serial port for eeg_server.py (for example COM5 or /dev/tty.usbserial-XXXX).",
    )
    parser.add_argument("--ws-port", type=int, help="WebSocket port for eeg_server.py.")
    parser.add_argument("--update-interval", type=float, help="EEG update interval in seconds.")
    parser.add_argument("--window-sec", type=float, help="EEG PSD window length in seconds.")
    parser.add_argument(
        "--quality-channels",
        help="Comma-separated board channel indexes for quality checks.",
    )
    parser.add_argument(
        "--eeg-start-delay",
        type=float,
        default=0.6,
        help="Seconds to wait before starting server.py (default: 0.6).",
    )
    return parser.parse_args()


def build_eeg_command(args):
    command = [args.python, str(ROOT / "eeg_server.py")]

    if args.mock:
        command.append("--mock")
    if args.device_port:
        command.extend(["--port", args.device_port])
    if args.ws_port is not None:
        command.extend(["--ws-port", str(args.ws_port)])
    if args.update_interval is not None:
        command.extend(["--update-interval", str(args.update_interval)])
    if args.window_sec is not None:
        command.extend(["--window-sec", str(args.window_sec)])
    if args.quality_channels:
        command.extend(["--quality-channels", args.quality_channels])

    return command


def start_process(command, name):
    popen_kwargs = {"cwd": str(ROOT)}

    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    process = subprocess.Popen(command, **popen_kwargs)
    print(f"[run_servers] Started {name} (pid={process.pid})")
    return process


def stop_process(process, name):
    if process is None or process.poll() is not None:
        return

    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            process.send_signal(signal.SIGINT)
        process.wait(timeout=3)
        print(f"[run_servers] Stopped {name}")
        return
    except Exception:
        pass

    try:
        process.terminate()
        process.wait(timeout=3)
        print(f"[run_servers] Terminated {name}")
        return
    except Exception:
        pass

    process.kill()
    process.wait(timeout=3)
    print(f"[run_servers] Killed {name}")


def main():
    args = parse_args()

    eeg_command = build_eeg_command(args)
    http_command = [args.python, str(ROOT / "server.py")]

    print("[run_servers] Launching services...")
    print(f"[run_servers] EEG command: {' '.join(eeg_command)}")
    print(f"[run_servers] HTTP command: {' '.join(http_command)}")

    eeg_process = None
    http_process = None
    exit_code = 0

    try:
        eeg_process = start_process(eeg_command, "eeg_server.py")

        if args.eeg_start_delay > 0:
            time.sleep(args.eeg_start_delay)

        http_process = start_process(http_command, "server.py")

        while True:
            eeg_code = eeg_process.poll()
            http_code = http_process.poll()

            if eeg_code is not None:
                print(f"[run_servers] eeg_server.py exited with code {eeg_code}. Shutting down.")
                exit_code = eeg_code
                break

            if http_code is not None:
                print(f"[run_servers] server.py exited with code {http_code}. Shutting down.")
                exit_code = http_code
                break

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n[run_servers] Ctrl+C received. Stopping both servers...")
    finally:
        stop_process(http_process, "server.py")
        stop_process(eeg_process, "eeg_server.py")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
