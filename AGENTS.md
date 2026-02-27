# DiscordDungeons — Agent Instructions

## Project Overview
DiscordDungeons is a Discord Activity (Embedded App) — a game played directly inside Discord. The game style (isometric dungeon crawler or 2D side platformer) is TBD. It uses n8n on a Hostinger VPS for matchmaking, game state, and server-side logic.

## Architecture
- **Runtime**: Discord Embedded App SDK (game runs as an iframe inside Discord)
- **Game client**: Web-based (HTML/CSS/JS) — game engine TBD
- **Backend**: n8n (self-hosted, Docker on Hostinger VPS) for matchmaking and server logic
- **Platform**: Discord API for user identity, voice channels, social features

### Key directories
- `client/` — Game client (Discord Activity frontend)
- `server/src/code/` — n8n Code node files for backend logic
- `server/src/workflow-builder.js` — Assembles n8n workflow JSON from code files
- `server/deploy-workflow.js` — Deploys workflow via n8n REST API
- `tests/unit/` — Unit tests

### Infrastructure (to be provisioned)
- Hostinger VPS with Docker + n8n
- Discord Developer Portal application

## Code Conventions
- JavaScript (ES modules for client, CommonJS for n8n Code nodes)
- Each n8n Code node file in `server/src/code/` is standalone and self-contained
- n8n Code nodes reference implicit globals: `$input`, `$env`, `$getWorkflowStaticData()`, `$node`, etc.

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
- All tests: `npm test` (Vitest)
- Unit only: `npm run test:unit`
- Watch mode: `npm run test:watch`

## Definition of Done
- All tests pass (`npm test`)
- Code builds without errors
- Deploy succeeds (once server is provisioned)
- Feature works correctly when tested
