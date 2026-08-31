# Thamaraa Monitoring Agent

A small Windows program that captures the screen on a schedule and uploads it to
the CRM. Once it is running it shows the employee **nothing** — no window, no
tray icon. What keeps this a disclosed arrangement rather than covert
surveillance is the **setup screen**: it states plainly what will be captured
and will not proceed without an explicit consent tick. That screen is the only
notice the employee gets, so the company must also tell staff, in writing, that
their machines are monitored — an action taken on these captures is only
defensible if the person was actually informed.

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

## No indicator while running

By request, the running agent has no tray icon and no window. The only place its
activity is visible is `agent.log` beside the config file. Stopping it is done
from the dashboard (pause or revoke the device), not from the employee's
machine.

## Notes / limits

- There is no quit button; the employee can still end the process from Task
  Manager or disconnect from the network — it is an oversight tool, not an
  enforcement mechanism. It starts again at the next logon. Watch "last seen" on
  the dashboard to spot a device that stopped reporting.
- Screenshots may contain sensitive content (passwords, personal messages).
  They are stored on the server, viewable only by the super admin, and should
  be retained no longer than needed. The retention window is set on the
  monitoring screen and enforced by a nightly job on the server.
- The token is the device's credential. Anyone with it can post screenshots as
  that device, so treat it like a password; revoke from the dashboard if leaked.
