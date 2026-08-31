# Thamaraa Monitoring Agent

A small Windows program that captures the screen on a schedule and uploads it to
the Thamaraa CRM. Monitoring is **disclosed**: a setup window asks the employee
for consent before anything is captured, and a tray icon stays registered for as
long as the agent runs.

Setup happens once. The agent copies itself to `%LOCALAPPDATA%\ThamaraaAgent`
and adds a per-user startup entry, so it starts again by itself after a reboot
with nothing for the employee to do.

## How it fits together

```
Agent (employee PC)                 CRM (server)
  ── POST /api/agent/checkin ──►     returns { capturing, intervalMinutes }
  ── POST /api/agent/screenshot ►    stores the JPEG + a Screenshot row
                                     super admin reviews at /dashboard/monitoring
```

The interval is **not** set on the device — it comes from the server on every
check-in, so the super admin changes it centrally for everyone. Pausing or
revoking a device from the dashboard takes effect on its next check-in.

## Enrolling a device

1. Super admin → **Device Monitoring** → **تسجيل جهاز جديد** → pick the employee
   → copy the one-time device token.
2. On the employee's PC, run `thamaraa-agent.exe`. A setup window opens asking
   for consent, the server URL (default `https://crm.thamaraa.com`) and the
   token. The token is checked against the server before it is accepted, so a
   wrong or revoked one is rejected there and then rather than failing silently.
3. It installs itself and runs in the background from then on.

Config is stored per-user at `%APPDATA%\ThamaraaAgent\config.json`, and the
agent logs to `agent.log` beside it. The installed copy lives in
`%LOCALAPPDATA%\ThamaraaAgent`, so the downloaded file can be deleted.

Only one instance runs at a time; launching it again just says so.

## Building the .exe

On a Windows machine with Python 3.9+:

```bat
cd agent
build.bat
```

Produces `dist\thamaraa-agent.exe` — a single file you can distribute.

## Running at startup

Handled automatically: setup writes
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\ThamaraaAgent`
pointing at the installed copy. The employee can see it under
Task Manager → Startup, which is part of keeping the monitoring disclosed.

If that entry is ever left pointing at a file that no longer exists -- an
interrupted install, a cleared `%LOCALAPPDATA%`, an antivirus quarantine -- the
next launch notices and repairs it. A dangling entry would otherwise fail
silently at logon, which is the failure nobody notices.

## Where the tray icon shows up

Windows puts a new tray icon in the hidden overflow (the `^` chevron) rather
than pinning it to the taskbar. That is Windows' choice, not a setting in this
program: the icon is always registered, and the employee can drag it out of the
overflow to pin it.

## Notes / limits

- The employee can quit the agent from the tray, or disconnect — it is a
  disclosed oversight tool, not an enforcement mechanism. It does start again at
  the next logon. Watch "last seen" on the dashboard to spot a device that
  stopped reporting.
- Screenshots may contain sensitive content (passwords, personal messages).
  They are stored on the server, viewable only by the super admin, and should
  be retained no longer than needed. The retention window is set on the
  monitoring screen and enforced by a nightly job on the server.
- The token is the device's credential. Anyone with it can post screenshots as
  that device, so treat it like a password; revoke from the dashboard if leaked.
