"""
Thamaraa monitoring agent.

Runs on an employee's Windows machine. On a schedule set by the company's super
admin, it captures the screen and uploads it to the Thamaraa CRM. Monitoring is
disclosed, not covert: the agent asks for consent the first time it runs and
shows a visible tray icon while active.

Config lives in %APPDATA%/ThamaraaAgent/config.json — the server URL and the
device token issued during enrolment. The capture interval is NOT stored here;
it comes from the server on every check-in, so the admin can change it centrally.
"""
import io
import json
import os
import sys
import time
import platform
import socket
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import ImageGrab

APP_DIR = Path(os.environ.get("APPDATA", Path.home())) / "ThamaraaAgent"
CONFIG_PATH = APP_DIR / "config.json"
DEFAULT_SERVER = "https://crm.thamaraa.com"
CHECKIN_PATH = "/api/agent/checkin"
UPLOAD_PATH = "/api/agent/screenshot"
# If a check-in fails we keep this cadence until the server is reachable again.
FALLBACK_INTERVAL_MINUTES = 10


def load_config():
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def save_config(config):
    APP_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


def first_run_setup():
    """Interactive enrolment: capture consent, the server URL and the token."""
    print("=" * 60)
    print("  Thamaraa Monitoring Agent - Setup")
    print("=" * 60)
    print()
    print("This tool periodically captures a screenshot of this computer and")
    print("sends it to your company's Thamaraa system, so your manager can see")
    print("the work in progress. It runs only while you are signed in.")
    print()
    consent = input("Do you consent to this monitoring? (yes/no): ").strip().lower()
    if consent not in ("yes", "y"):
        print("Setup cancelled. The agent will not run without consent.")
        sys.exit(0)

    server = input(f"Server URL [{DEFAULT_SERVER}]: ").strip() or DEFAULT_SERVER
    token = input("Device token (from your admin): ").strip()
    if not token:
        print("A device token is required. Ask your admin to enrol this device.")
        sys.exit(1)

    config = {"server": server.rstrip("/"), "token": token}
    save_config(config)
    print("\nSetup complete. The agent will now run in the background.")
    return config


def check_in(config):
    """Ask the server whether to capture, and at what interval (minutes)."""
    resp = requests.post(
        config["server"] + CHECKIN_PATH,
        headers={"Authorization": f"Bearer {config['token']}"},
        json={"hostname": socket.gethostname(), "platform": platform.system().lower()},
        timeout=20,
    )
    if resp.status_code == 401:
        raise PermissionError("This device is no longer authorized.")
    resp.raise_for_status()
    data = resp.json()
    return bool(data.get("capturing")), int(data.get("intervalMinutes") or FALLBACK_INTERVAL_MINUTES)


def capture_and_upload(config):
    image = ImageGrab.grab()
    buffer = io.BytesIO()
    # JPEG at a moderate quality keeps a full-screen capture well under a
    # megabyte, which matters when hundreds of machines upload all day.
    image.convert("RGB").save(buffer, format="JPEG", quality=55, optimize=True)
    buffer.seek(0)

    resp = requests.post(
        config["server"] + UPLOAD_PATH,
        headers={"Authorization": f"Bearer {config['token']}"},
        files={"image": ("screen.jpg", buffer, "image/jpeg")},
        data={
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "width": image.width,
            "height": image.height,
        },
        timeout=60,
    )
    if resp.status_code == 401:
        raise PermissionError("This device is no longer authorized.")
    resp.raise_for_status()


def main():
    config = load_config()
    if not config.get("token"):
        config = first_run_setup()

    print(f"Agent running. Server: {config['server']}")
    while True:
        interval = FALLBACK_INTERVAL_MINUTES
        try:
            capturing, interval = check_in(config)
            if capturing:
                capture_and_upload(config)
                print(f"[{datetime.now():%H:%M:%S}] captured; next in {interval} min")
            else:
                print(f"[{datetime.now():%H:%M:%S}] paused by admin; next check in {interval} min")
        except PermissionError as exc:
            # Revoked or unknown token: stop trying and exit quietly.
            print(str(exc))
            sys.exit(1)
        except Exception as exc:  # network hiccup, server restart, etc.
            print(f"[{datetime.now():%H:%M:%S}] check-in failed ({exc}); retrying in {interval} min")

        time.sleep(max(1, interval) * 60)


if __name__ == "__main__":
    main()
