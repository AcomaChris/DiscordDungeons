# DiscordDungeons — Agent Instructions

## Project Overview
DiscordDungeons is a Discord Activity (Embedded App) — a 3/4 view tile-based RPG played directly inside Discord. It uses n8n on a Hostinger VPS for matchmaking, game state, and server-side logic.

## Architecture
- **Runtime**: Discord Embedded App SDK (game runs as an iframe inside Discord)
- **Game client**: Phaser 3 (WebGL, Arcade Physics) — 3/4 view RPG with Tiled maps
- **Backend**: n8n (self-hosted, Docker on Hostinger VPS) for matchmaking and server logic
- **Platform**: Discord API for user identity, voice channels, social features

### Key directories
- `client/` — Game client (Discord Activity frontend)
- `client/src/map/` — TileMapManager, MapRegistry (tilemap loading pipeline)
- `client/src/entities/` — Player, RemotePlayer (game entities)
- `client/src/input/` — InputManager, TouchManager, InputActions (input system)
- `client/public/maps/` — Tiled JSON map files
- `client/public/tilesets/` — Tileset PNG images
- `scripts/` — Build/generation scripts (e.g. create-test-map.js)
- `server/src/code/` — n8n Code node files for backend logic
- `server/src/workflow-builder.js` — Assembles n8n workflow JSON from code files
- `server/deploy-workflow.js` — Deploys workflow via n8n REST API
- `tests/unit/` — Unit tests (Vitest, run in Node/jsdom)
- `tests/e2e/` — E2E gameplay tests (Playwright, run in real Chromium)
- `assets/tilesets/` — Source tileset packs (tavern etc., used with Tiled editor)

### Infrastructure (to be provisioned)
- Hostinger VPS with Docker + n8n
- Discord Developer Portal application

## Code Conventions
- JavaScript (ES modules for client, CommonJS for n8n Code nodes)
- Each n8n Code node file in `server/src/code/` is standalone and self-contained
- n8n Code nodes reference implicit globals: `$input`, `$env`, `$getWorkflowStaticData()`, `$node`, etc.

## Tilemap Layer Convention

All Tiled maps must follow this layer naming convention. TileMapManager creates layers by these exact names.

| Layer Name   | Type         | Depth             | Purpose                      |
|--------------|--------------|-------------------|------------------------------|
| Ground       | tile layer   | 0                 | Floor/terrain base           |
| GroundDecor  | tile layer   | 1                 | Rugs, cracks, floor detail   |
| Walls        | tile layer   | 2                 | Wall bases, furniture        |
| WallTops     | tile layer   | 10000             | Upper wall parts (above player) |
| Overlay      | tile layer   | 10001             | Ceiling, always-on-top decor |
| Collision    | tile layer   | Not rendered      | Invisible collision mask     |
| Objects      | object layer | Parsed, not rendered | spawn, door, chest, npc    |

Player/NPC depth = their sprite Y position (updated each frame for Y-sorting).

## Commenting Rules
- **Section headers**: Use short `// --- Section name ---` comments to mark logical blocks within a file
- **Why, not what**: Comment on *why* code exists — business rules, domain constraints, edge cases, non-obvious invariants. Never narrate what code obviously does (no `// increment i`)
- **Agent directives**: Use `// AGENT:` prefixed comments for constraints that agents must follow when modifying nearby code (e.g. `// AGENT: this must use bot token, not user token`)
- **Keep comments accurate**: Stale or wrong comments are worse than no comments. When modifying code, update or remove any comments that no longer apply
- **Inputs/outputs**: No boilerplate docblocks. Only document expected shapes when they're non-obvious from context

## Build & Deploy
```bash
# Build workflow JSON + deploy to n8n (once VPS is provisioned)
node server/src/workflow-builder.js && node server/deploy-workflow.js
```
After deploy, the activeVersionId in the n8n SQLite DB must be updated to the new versionId (shown in deploy output), then the container restarted.

## Don't Touch
- `server/.env` — contains API tokens (Discord, n8n). Never commit.
- `node_modules/` — standard gitignored deps
- Do not modify deployed n8n workflows via the n8n UI; all changes go through code files → workflow-builder → deploy

## Testing

### Unit tests (Vitest)
- All unit tests: `npm test`
- Unit only: `npm run test:unit`
- Watch mode: `npm run test:watch`

### E2E gameplay tests (Playwright)
- Run: `npm run test:e2e`
- Tests launch the game in headless Chromium via the Vite dev server (port 8081)
- `globalThis.__PHASER_GAME__` is exposed by `main.js` for test introspection
- Use e2e tests to verify runtime gameplay behavior: sprite positions, label tracking, console output, rendering issues
- When adding gameplay features or fixing rendering/physics bugs, add or update an e2e test that exercises the behavior in a real browser

### When to write which type of test
- **Unit tests**: pure logic, event bus, input snapshots, constants, config — anything that doesn't need a real Phaser instance
- **E2E tests**: rendering, physics interactions, position tracking, visual regressions, anything that needs the full game loop running in a browser

## Definition of Done
- All tests pass (`npm test` + `npm run test:e2e`)
- Code builds without errors
- Deploy succeeds (once server is provisioned)
- Feature works correctly when tested
