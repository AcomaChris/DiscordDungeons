# DiscordDungeons — Dev Log

Running log of development sessions. Updated each session to preserve context across machines and agents.

---

## 2026-03-01 — Ability System, Jump, Modifiers, Debug Panel Refactor

**Commits:** `36df948` → `bcc9731`

Built out the full ability system from scratch and iterated on the debug panel to make it a proper development tool.

- **Ability system** (`36df948`): Data-driven abilities with `AbilityDefs` registry and `AbilityManager` (equip/unequip, active/passive types, input-driven activation, network serialization via `getState`/`applyState`). Sprint is now the first active ability — holding SHIFT activates movement's `sprintSpeed`. Debug panel wired up for live param editing.
- **Jump ability** (`f05f952`): SPACE triggers a visual hop tween (Y offset, not physics). Height and duration scale from `heightPower` param. Originally had aggressive caps (`Math.min(height, 24)` and `Math.min(duration, 600)`) that made param changes nearly invisible — removed both caps so future magic items can create dramatic effects.
- **Modifier system** (`d45a93e`): Dynamic buff/debuff stacking for all ability params. Modifiers are `{ id, param, op ('add'|'mul'), value, source }` — resolution order: `(base + additives) × multiplicatives`. `getParam()` transparently resolves through modifiers (zero changes needed in Player.js). Source-based clearing for equipment/environment effects. Full network serialization with backward compat. Debug panel shows resolved values (green) and modifier breakdowns (yellow). Filed issue #3 for float ability (needs physics-based jump).
- **Debug panel equipped-only view** (`bcc9731`): Replaced "show all abilities with checkboxes" with equipped-only display + X remove buttons + categorized Add menu. Abilities grouped by theme category (Movement/Combat/Magic/Utility). Much cleaner UX for when we have dozens of abilities.
- **SSH key fix**: Deploy script, CLAUDE.md, and deploy skill all referenced `~/.ssh/discord_dungeons` but the actual key is `discord_dungeons_vps`. Updated all three to match.

---

## 2026-02-28 — Bug Reporter, Player Debug Panel, Network Smoothing

**Commits:** `61143b9` → `fdb4850`

Major quality-of-life session: in-game bug reporting, live debug tools, and smooth multiplayer movement.

- **In-game bug reporter** (`61143b9`): Settings cog with "File Issue" menu item. Opens dialog to file GitHub issues with title, description, priority, and optional screenshot (captured from canvas). Server proxies to GitHub API with screenshot upload via Contents API. Reports include Discord username, platform, device, resolution, build version/commit.
- **Input context manager** (`b99e026` → `7a1f6af`): `acquireInputFocus()`/`releaseInputFocus()` system to suppress game input during UI overlays. Event-driven via EventBus — InputManager subscribes and disables keyboard immediately. Fixed Phaser `addKey()` captures eating WASD/Space in form fields by calling `clearCaptures()` when UI acquires focus.
- **Docker token fix** (`16bbc3e`): `docker-compose.yml` wasn't passing `GITHUB_API_TOKEN` to the container — bug reporter always got "token not configured". Added env var passthrough.
- **Collision body fix** (`f38a0ce` → `3f0066a`): Issue #2 — player could get too close to walls vertically. First attempt increased body height but didn't account for Phaser's `body.setSize()` working in **unscaled texture space** (values multiplied by `sprite.scaleX/Y` internally). Fixed by passing `dimension * TEXTURE_SCALE` so the final body matches intended world-pixel size.
- **Player Debug panel** (`7997785` → `9bb9030`): New "Player Debug" item in cog menu. Left-anchored side panel (game stays visible) with live controls for collision body W/H, RGB color (full texture regeneration via extracted `PlayerTextureGenerator`), and player name. Read-only position display updates per frame. Color picker uses native `<input type="color">` with bidirectional R/G/B sync. All changes replicate to other players — color via state payload, name via `identify` message.
- **Smooth remote player interpolation** (`fdb4850`): Remote players appeared to "mini-teleport" between positions. Root cause: fixed `LERP_FACTOR = 0.3` per frame reached the target in ~5 frames, then sat idle until the next 10Hz update. Replaced with time-based linear interpolation over `INTERP_DURATION = 100ms` (matching server broadcast rate). Movement now spreads evenly across the full update interval. Also frame-rate independent.

## 2026-02-28 — Wall Depth Sorting, Collision Fix, Build Status UX

**Commits:** `a12a26d` → `887f301`

Bug fixes and polish pass on the tilemap system, plus build status indicator improvements.

- **Wall/player layer overlapping fix**: Tile layers have a single depth for all tiles, which breaks 3/4 view depth sorting. Converted Walls and WallTops tile layers to individual Y-sorted sprites (depth = tile bottom Y). Walls south of the player now correctly occlude; walls north render behind. TileMapManager loads tilesets as spritesheets (`load.spritesheet` with `tileSize`) to get per-tile frames.
- **Collision body fix**: Player's feet-only hitbox was 12px wide (narrower than the character), letting the sprite visually sink into wall tiles horizontally. Widened to full sprite width while keeping the 8px-tall feet-only height for 3/4 view vertical overlap.
- **Build status indicator**: New floating DOM widget on game + devlog pages. Polls `/version.json` (5s) and GitHub Actions API (2min) to show deployment state as a colored dot — green (current), yellow (stale), flashing yellow (building), red (failed), gray (unknown). Click opens overlay panel with current status and color legend.
- **Camera centering fixes**: Series of fixes for camera centering on HiDPI screens — removed manual `applyDPR` scaling that conflicted with Phaser's camera follow, fixed vertical centering when map is smaller than viewport.
- **Tavern tileset assets**: Checked in Craftpix free tavern tileset (PNGs, TMX maps, license). Source files (.aseprite, .psd) kept local only.
- **Legacy cleanup**: Removed dead constants from platformer era, updated docs for tilemap architecture.

## 2026-02-28 — Tilemap System: Phase 1 MVP

**Commits:** `b5bbb36` → `3f55431`

Major architectural shift from side-scrolling platformer to 3/4 view tile-based RPG.

- **4-directional input**: Replaced left/right/jump with WASD/arrows D-pad (up/down/left/right + interact). Touch controls updated to D-pad layout. Diagonal movement normalized to same speed.
- **RPG constants**: TILE_SIZE=16, CHAR_WIDTH=16, CHAR_HEIGHT=24, MOVE_SPEED=80 px/s, CAMERA_ZOOM=3. Gravity disabled (y: 0).
- **4-direction textures**: BootScene generates up/down/left/right textures per player color. Down=centered eye, up=no eye (back of head).
- **Tilemap pipeline**: TileMapManager loads Tiled JSON maps with standard layer convention (Ground/GroundDecor/Walls/WallTops/Overlay/Collision/Objects). MapRegistry for map metadata lookup. Invisible collision layer blocks movement.
- **Test map generator**: `scripts/create-test-map.js` generates a 30×20 test map (floor, walls, wall tops, border collision, spawn point) without needing Tiled GUI.
- **Player rebuild**: Feet-only hitbox (12×8 at sprite bottom) for natural 3/4 view overlap. Y-sorted depth (sprite.y). Simplified network state (x, y, facing — no velocity).
- **GameScene rebuild**: Loads tilemap via TileMapManager, physics bounds from map, camera follow with zoom×DPR, depth sorting for all entities.
- **Dead code cleanup**: Removed JUMP_VELOCITY, WORLD_WIDTH/HEIGHT, FLOOR_HEIGHT, floor texture generation.

Next: Phase 2 (elevation/jump), real tavern map import via Tiled, tile animations.

## 2026-02-28 — Build Info Display + Versioning SOP (v0.2.0)

- **Build info on main menu**: Version, git commit hash, and build date shown at the bottom of MainMenuScene. Injected at build time via Vite `define` — no runtime API calls.
- **Versioning SOP**: Semver in `package.json` is source of truth. Bump on feature/fix commits, skip for chore/docs. Added to CLAUDE.md.
- **Version bump to 0.2.0**: Milestone — multiplayer, auth, mobile, Discord Activity, devlog, public devlog page all in place.
- ESLint globals added for `__APP_VERSION__`, `__GIT_COMMIT__`, `__BUILD_TIME__` in client code.

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
