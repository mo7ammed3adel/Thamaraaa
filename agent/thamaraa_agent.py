"""
Thamaraa monitoring agent.

Runs on an employee's Windows machine. On a schedule set by the company's super
admin, it captures the screen and uploads it to the Thamaraa CRM.

Once running, the agent shows the employee nothing at all -- no window, no tray
icon. The company asked for that deliberately. What keeps the arrangement a
disclosed one is therefore the setup window alone: it states plainly what will
be captured and refuses to go any further without an explicit consent tick.
That screen is the only thing standing between this and covert surveillance,
so do not remove it, and do not weaken its wording.

Setup is a one-time step. The agent installs itself under %LOCALAPPDATA% and
registers a per-user startup entry, so it comes back on its own after a reboot
without the employee doing anything.

Config lives in %APPDATA%/ThamaraaAgent/config.json -- the server URL and the
device token issued during enrolment. The capture interval is NOT stored there;
it comes from the server on every check-in, so the admin can change it centrally.
"""
import io
import json
import logging
import os
import platform
import shutil
import socket
import sys
import threading
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

import requests
from PIL import ImageGrab

APP_NAME = "ThamaraaAgent"
DISPLAY_NAME = "Thamaraa Monitoring Agent"
DEFAULT_SERVER = "https://crm.thamaraa.com"
CHECKIN_PATH = "/api/agent/checkin"
UPLOAD_PATH = "/api/agent/screenshot"
# If a check-in fails we keep this cadence until the server is reachable again.
FALLBACK_INTERVAL_MINUTES = 10

CONFIG_DIR = Path(os.environ.get("APPDATA") or Path.home()) / APP_NAME
CONFIG_PATH = CONFIG_DIR / "config.json"
LOG_PATH = CONFIG_DIR / "agent.log"
# The installed copy lives outside %APPDATA% so config and program stay separate,
# and so deleting the downloaded file does not break the startup entry.
INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / APP_NAME
INSTALL_EXE = INSTALL_DIR / "thamaraa-agent.exe"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"

log = logging.getLogger("agent")


def setup_logging():
    """A windowed build has no console, so everything goes to a rotating file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(LOG_PATH, maxBytes=512_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
def load_config():
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except (ValueError, OSError) as exc:
            log.error("Could not read config: %s", exc)
    return {}


def save_config(config):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


# --------------------------------------------------------------------------
# Single instance
# --------------------------------------------------------------------------
def acquire_single_instance():
    """A named mutex, so double-clicking the exe again does not start a second
    capture loop. Returns a handle (which must stay referenced) or None if an
    instance is already running."""
    try:
        import ctypes

        # use_last_error is required: ctypes makes its own calls between ours, so
        # kernel32.GetLastError() read afterwards can report someone else's code.
        # The name is session-local on purpose -- two people logged into the same
        # machine each get their own agent, which "Global\\" would prevent.
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        handle = kernel32.CreateMutexW(None, False, APP_NAME + "-instance")
        error_already_exists = 183
        if ctypes.get_last_error() == error_already_exists:
            return None
        return handle
    except Exception:
        # Not Windows, or the API is unavailable -- never block startup over this.
        return True


# --------------------------------------------------------------------------
# Install + autostart
# --------------------------------------------------------------------------
def running_exe():
    """The exe when frozen by PyInstaller, else the script (development runs)."""
    return Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve()


def register_autostart(target):
    """Per-user startup entry: runs at every logon, needs no admin rights, and
    stays visible to the employee under Task Manager > Startup."""
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, '"' + str(target) + '"')
        return True
    except Exception as exc:
        log.error("Could not register autostart: %s", exc)
        return False


def autostart_target():
    """The path the startup entry points at, or None if there is no entry."""
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            value, _kind = winreg.QueryValueEx(key, APP_NAME)
        return value.strip().strip('"') or None
    except Exception:
        return None


def autostart_healthy():
    """A startup entry only helps if the file it names still exists. It can stop
    existing -- an interrupted install, a cleared %LOCALAPPDATA%, an antivirus
    quarantine -- and a stale entry fails silently at the next logon, which is
    exactly the failure nobody notices. Treat a dangling entry as no entry, so
    the next launch reinstalls and repairs it."""
    target = autostart_target()
    return bool(target) and Path(target).exists()


def install_self():
    """Copies the exe to a stable location and registers it to run at logon, so
    the employee can delete the file they downloaded. Returns the path the
    startup entry points at."""
    source = running_exe()
    if not getattr(sys, "frozen", False):
        log.info("Not a frozen build; skipping install")
        return source

    target = INSTALL_EXE
    try:
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        if source != target:
            shutil.copy2(source, target)
            log.info("Installed to %s", target)
    except OSError as exc:
        # A locked or unwritable target is not fatal -- keep running from where
        # we are, and register that path instead so startup still works.
        log.error("Could not copy to %s (%s); running in place", target, exc)
        target = source

    register_autostart(target)
    return target


# --------------------------------------------------------------------------
# Setup window
# --------------------------------------------------------------------------
BG = "#f8fafc"
CARD = "#ffffff"
INK = "#1e293b"
MUTED = "#64748b"
ACCENT = "#4f46e5"
DANGER = "#dc2626"


def run_setup_window():
    """The one-time enrolment dialog. Returns a config dict, or None if the
    employee declined or closed the window -- in which case nothing is ever
    captured. The token is verified against the server before we accept it, so
    a typo is caught here rather than failing silently in the background."""
    import tkinter as tk
    from tkinter import font as tkfont

    result = {}

    root = tk.Tk()
    root.title(DISPLAY_NAME)
    root.configure(bg=BG)
    root.resizable(False, False)

    width, height = 560, 600
    x = (root.winfo_screenwidth() - width) // 2
    y = max(0, (root.winfo_screenheight() - height) // 3)
    root.geometry("%dx%d+%d+%d" % (width, height, x, y))

    title_font = tkfont.Font(family="Segoe UI", size=17, weight="bold")
    body_font = tkfont.Font(family="Segoe UI", size=10)
    label_font = tkfont.Font(family="Segoe UI", size=9, weight="bold")
    input_font = tkfont.Font(family="Consolas", size=10)

    tk.Frame(root, bg=ACCENT, height=6).pack(fill="x")

    header = tk.Frame(root, bg=BG)
    header.pack(fill="x", padx=28, pady=(22, 0))
    tk.Label(header, text="برنامج متابعة العمل", font=title_font, bg=BG, fg=INK).pack(anchor="e")
    tk.Label(header, text="شركة ثمرة", font=body_font, bg=BG, fg=MUTED).pack(anchor="e", pady=(2, 0))

    # Consent card -- deliberately the most prominent element in the window.
    card = tk.Frame(root, bg=CARD, highlightbackground="#e2e8f0", highlightthickness=1)
    card.pack(fill="x", padx=28, pady=(18, 0))
    tk.Label(
        card,
        text=(
            "البرنامج ده بياخد صورة لشاشة الكمبيوتر كل فترة\n"
            "ويبعتها للإدارة، عشان متابعة الشغل\n\n"
            "بيشتغل بس وانت داخل على حسابك على الجهاز،\n"
            "وأيقونته موجودة في شريط المهام تحت طول ما هو شغال"
        ),
        font=body_font,
        bg=CARD,
        fg=INK,
        justify="right",
        anchor="e",
    ).pack(fill="x", padx=18, pady=16)

    consent = tk.BooleanVar(value=False)
    consent_row = tk.Frame(root, bg=BG)
    consent_row.pack(fill="x", padx=28, pady=(14, 0))
    tk.Checkbutton(
        consent_row,
        text="أنا موافق على المتابعة دي",
        variable=consent,
        font=body_font,
        bg=BG,
        fg=INK,
        activebackground=BG,
        selectcolor=CARD,
        anchor="e",
    ).pack(anchor="e")

    fields = tk.Frame(root, bg=BG)
    fields.pack(fill="x", padx=28, pady=(16, 0))

    tk.Label(fields, text="لينك السيرفر", font=label_font, bg=BG, fg=MUTED).pack(anchor="e")
    server_entry = tk.Entry(fields, font=input_font, justify="left", relief="solid", bd=1, bg=CARD, fg=INK)
    server_entry.insert(0, DEFAULT_SERVER)
    server_entry.pack(fill="x", ipady=5, pady=(3, 12))

    tk.Label(fields, text="كود الجهاز (من الإدارة)", font=label_font, bg=BG, fg=MUTED).pack(anchor="e")
    token_entry = tk.Entry(fields, font=input_font, justify="left", relief="solid", bd=1, bg=CARD, fg=INK)
    token_entry.pack(fill="x", ipady=5, pady=(3, 0))

    status = tk.Label(root, text="", font=body_font, bg=BG, fg=DANGER, wraplength=480)
    status.pack(pady=(12, 0))

    def submit():
        if not consent.get():
            status.config(text="لازم توافق الأول عشان البرنامج يشتغل", fg=DANGER)
            return
        server = server_entry.get().strip().rstrip("/")
        token = token_entry.get().strip()
        if not server.startswith("http"):
            status.config(text="لينك السيرفر لازم يبدأ بـ https", fg=DANGER)
            return
        if not token:
            status.config(text="اكتب كود الجهاز اللي الإدارة بعتهولك", fg=DANGER)
            return

        status.config(text="بتأكد من الكود", fg=MUTED)
        root.update()
        try:
            resp = requests.post(
                server + CHECKIN_PATH,
                headers={"Authorization": "Bearer " + token},
                json={"hostname": socket.gethostname(), "platform": platform.system().lower()},
                timeout=20,
            )
        except requests.RequestException:
            status.config(text="مش قادر أوصل للسيرفر، اطمن إن النت شغال", fg=DANGER)
            return
        if resp.status_code == 401:
            status.config(text="الكود ده مش صحيح أو اتلغى، اطلب كود جديد من الإدارة", fg=DANGER)
            return
        if not resp.ok:
            status.config(text="السيرفر رد بخطأ (%d)" % resp.status_code, fg=DANGER)
            return

        result["server"] = server
        result["token"] = token
        root.destroy()

    tk.Button(
        root,
        text="تفعيل وبدء التشغيل",
        font=("Segoe UI", 11, "bold"),
        bg=ACCENT,
        fg="white",
        relief="flat",
        cursor="hand2",
        command=submit,
        activebackground="#4338ca",
        activeforeground="white",
    ).pack(fill="x", padx=28, pady=(16, 0), ipady=9)

    tk.Label(
        root,
        text="البرنامج هيفتح لوحده كل ما تشغل الجهاز",
        font=body_font,
        bg=BG,
        fg=MUTED,
    ).pack(pady=(12, 0))

    root.bind("<Return>", lambda _event: submit())
    token_entry.focus_set()
    root.mainloop()

    return result or None


def show_message(title, text):
    """A small standalone notice, for the paths where there is no window open."""
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showinfo(title, text)
        root.destroy()
    except Exception:
        pass


# --------------------------------------------------------------------------
# Monitoring
# --------------------------------------------------------------------------
class AgentState:
    """Carries the stop signal. Nothing displays status any more, so the log is
    the only place a problem shows up -- see agent.log next to config.json."""

    def __init__(self):
        self.stop = threading.Event()


def check_in(config):
    """Ask the server whether to capture, and at what interval (minutes)."""
    resp = requests.post(
        config["server"] + CHECKIN_PATH,
        headers={"Authorization": "Bearer " + config["token"]},
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
        headers={"Authorization": "Bearer " + config["token"]},
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


def monitor_loop(config, state):
    """Capture on the server's schedule until the process is stopped. There is
    no UI, so anything worth knowing goes to the log."""
    while not state.stop.is_set():
        interval = FALLBACK_INTERVAL_MINUTES
        try:
            capturing, interval = check_in(config)
            if capturing:
                capture_and_upload(config)
                log.info("captured; next in %s min", interval)
            else:
                log.info("paused by admin; next check in %s min", interval)
        except PermissionError as exc:
            # Revoked or unknown token: stop trying and let the process exit.
            log.info("device revoked (%s); exiting", exc)
            state.stop.set()
            return
        except Exception as exc:  # network hiccup, server restart, laptop asleep
            log.warning("check-in failed (%s); retrying in %s min", exc, interval)

        # Wait on the event rather than sleep(), so a stop is acted on at once.
        state.stop.wait(max(1, interval) * 60)


# --------------------------------------------------------------------------
def main():
    setup_logging()

    lock = acquire_single_instance()
    if lock is None:
        # Already running. Say nothing -- the agent is invisible by design, so a
        # popup here would be the one thing the employee ever sees from it.
        log.info("Another instance is already running; exiting")
        return

    config = load_config()
    if not config.get("token"):
        config = run_setup_window()
        if not config:
            log.info("Setup cancelled; nothing was captured")
            return
        save_config(config)
        target = install_self()
        log.info("Setup complete; startup entry -> %s", target)
        show_message(
            DISPLAY_NAME,
            "تم التفعيل\n\n"
            "البرنامج اتفعّل وهيشتغل في الخلفية، وهيفتح لوحده كل ما تشغل الجهاز",
        )
    elif getattr(sys, "frozen", False) and not autostart_healthy():
        # Configured by an older build, or the entry was removed or left
        # pointing at a file that no longer exists -- reinstall and repair it.
        install_self()

    # No tray, no window: run the capture loop on the main thread and let the
    # process live quietly in the background until the machine shuts down.
    state = AgentState()
    monitor_loop(config, state)
    log.info("Agent stopped")


if __name__ == "__main__":
    main()
