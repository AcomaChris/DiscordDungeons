# DiscordDungeons — Dev Log

Running log of development sessions. Updated each session to preserve context across machines and agents.

---

## 2026-02-28 — Process: Devlog + Public Devlog Page

- Established `DEVLOG.md` as a running development log checked into the repo
- Updated `CLAUDE.md` to make devlog updates part of the standard workflow
- Purpose: preserve context across machines, sessions, and agents
- **Public devlog page**: Added `discorddungeons.com/devlog` — standalone HTML page that fetches and renders DEVLOG.md client-side with `marked`. Dark theme matching the game. Vite multi-page build (`client/devlog.html` as second entry point). Build script copies DEVLOG.md to `client/public/` before Vite runs.
- Discord Activity fully configured in Developer Portal (Activities enabled, URL mappings, OAuth2 redirect, installed to server)

## 2026-02-28 — Resolution Independence + Deploy Script

**Commits:** `12f9a1b` → `db73e96` → `ef7bf1a`

*Work done on another machine.*

- **Fixed-zoom scrollable world**: Further resolution independence improvements
- **Deploy script**: `server/deploy-ws.sh` — rsyncs server files to VPS, rebuilds Docker container
- **HiDPI rendering**: Physical-pixel rendering for crisp display on 2K+ / Retina screens

## 2026-02-27 — Cross-Device Fixes + Discord Activity

**Commits:** `d5d49e8` → `c6e5074` → `ea8ec31` → `e6ec17e`

- **Bug: multiplayer desync across screen sizes** — Players on different devices (Chromebook vs iPhone 15 portrait) saw each other on different floor planes. Root cause: floor Y was calculated from screen height, which differs per device. Network sent absolute pixel coordinates.
  - **Fix**: Introduced fixed logical world (800×600). All positions use `WORLD_WIDTH`/`WORLD_HEIGHT` constants. Camera zoom scales the world to fit any screen.
- **Bug: camera rendering broken** — After the world-coords fix, floor floated on Chrome and was invisible on mobile. Root cause: Phaser's camera zoom is applied around the viewport center, not top-left. Manual `scrollX`/`scrollY` math assumed top-left origin.
  - **Fix**: Replaced manual scroll with `camera.startFollow(player.sprite)`. Phaser handles zoom + centering correctly.
- **Discord Activity integration**: Embedded App SDK (`@discord/embedded-app-sdk`). Dual-mode: same codebase runs as web app or Discord Activity. Activity detection via URL params (`frame_id`, `instance_id`, `platform`). SDK auth flow: `authorize()` → server token exchange at `/token` → `authenticate()`. `patchUrlMappings` routes fetch/WS through Discord's CSP proxy. Channel ID used as room ID for per-voice-channel multiplayer.

## 2026-02-26 — Player Identity + Visual Polish

**Commits:** `6d9c387` → `318079b` → `65b686f` → `8dd2267`

- **Player colors**: 32-color unified palette assigned by server join order. Consistent across all clients (server sends `colorIndex` on join)
- **Mobile touch controls**: On-screen D-pad + jump button with orientation support. Hybrid input: polls keyboard + touch each frame, merges snapshots
- **Discord OAuth login**: Full flow — redirect to Discord → exchange code on server → fetch profile. Session stored in `sessionStorage`
- **Guest mode**: Enter name → play immediately, no auth required
- **Player names**: Rendered above sprites, sent via `identify` message on WS connect

## 2026-02-26 — Multiplayer + Infrastructure

**Commits:** `465859c` → `9d64f71` → `45036a2` → `336e92a`

- **Event-driven architecture**: EventBus pub/sub, decoupled from Phaser. Scenes: BootScene → MainMenuScene → GameScene
- **Multiplayer networking**: WebSocket relay server (Node.js, not authoritative). State-based sync at 10Hz. Room management by URL param
- **VPS deployment**: Docker container on Hostinger VPS (93.188.166.147). Nginx reverse proxy with TLS at `wss://ws.discorddungeons.com`
- **Custom domain**: GitHub Pages serves client at `discorddungeons.com`
- **Dead end**: Initial WS connection used `ws://` — failed silently in browsers. Fixed by proxying through nginx with TLS certs

## 2026-02-25 — Project Bootstrap

**Commits:** `3418ef0` → `6fde848` → `6703b13`

- Scaffolded project: Vite + Phaser 3, Vitest, ESLint, GitHub Actions CI
- Built initial game client: 2D side-view platformer, player sprite with keyboard movement (WASD/arrows), arcade physics with gravity + floor collision
- Set up GitHub Pages deployment (CI: lint → test → build → deploy)
