---
name: localtest
description: Build (if needed) and launch local dev server for manual testing
user_invocable: true
---

# Local Test

1. **Check for running dev server**: Run `lsof -i :8080 -t` to see if port 8080 is already in use.
   - If a server is already running, skip to step 4.

2. **Check build is current**: Run `npm run build` to ensure `dist/` is up to date. If it fails, report the error and stop.

3. **Start dev server**:
   - **Default**: Run `npm run dev` in the background.
   - **If `mobile` is in `$ARGUMENTS`**: Run `npm run dev -- --host 0.0.0.0` in the background so the server is accessible on the LAN.

4. **Open in browser**: Run `xdg-open` with the appropriate URL (see below).

5. **Report**:
   - **Default**: Tell the user the server is running at `http://localhost:8080`.
   - **If `mobile`**: Get the machine's LAN IP via `hostname -I | awk '{print $1}'` and tell the user to open `http://<LAN_IP>:8080` on their mobile/Chromebook device. Remind them both devices must be on the same network.

## Page arguments
If `$ARGUMENTS` contains a page name, open that page instead of the default:
- `editor` → `/editor.html`
- `devlog` → `/devlog.html`

## Mode arguments
- `mobile` → Bind to `0.0.0.0` and report the LAN URL for testing on another device.

Arguments can be combined, e.g. `/localtest mobile editor`.
