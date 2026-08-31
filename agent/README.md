# Thamaraa Monitoring Agent

A small Windows program that captures the screen on a schedule and uploads it to
the Thamaraa CRM. Monitoring is **disclosed**: the agent asks the employee for
consent on first run.

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
2. On the employee's PC, run `thamaraa-agent.exe`. It asks for consent, the
   server URL (default `https://crm.thamaraa.com`) and the token.
3. It then runs in the background, capturing on the admin's schedule.

Config is stored per-user at `%APPDATA%\ThamaraaAgent\config.json`.

## Building the .exe

On a Windows machine with Python 3.9+:

```bat
cd agent
build.bat
```

Produces `dist\thamaraa-agent.exe` — a single file you can distribute.

## Running at startup (optional)

Drop a shortcut to the exe in the user's Startup folder
(`shell:startup`), or register a Scheduled Task set to run at logon.

## Notes / limits

- The employee can close the agent or disconnect — it is a disclosed oversight
  tool, not an enforcement mechanism.
- Screenshots may contain sensitive content (passwords, personal messages).
  They are stored on the server, viewable only by the super admin, and should
  be retained no longer than needed. Set a retention cutoff on the server.
- The token is the device's credential. Anyone with it can post screenshots as
  that device, so treat it like a password; revoke from the dashboard if leaked.
