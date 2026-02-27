@AGENTS.md

# Claude Code — Project Rules

## Workflow
- **Always plan first.** Before making any code change — even small ones — enter Plan Mode, explore the relevant files, and propose the approach before editing. No exceptions.
- After planning: implement → run tests (`npm test`) → build → commit/push → **deploy** (`/deploy`).
- The commit must exist in git before deploying so the deploy announcement lists the correct commits.

## Skills (Slash Commands)
- `/commit` — run tests, lint, and commit with a conventional message
- `/deploy` — build and deploy (full deploy once VPS is provisioned)
- `/issue` — file a GitHub issue from a description or conversation

## Issue Tracking
- Use **GitHub Issues** for all task tracking — no external issue trackers.
- Reference issues in commits: `(#42)` or `fixes #42`.
- Use `gh issue create`, `gh issue list`, `gh issue view` for CLI access.
- Users can say "file an issue about X" or use `/issue` to create issues conversationally.

## Deployment

### VPS (Hostinger)
- **Host**: `srv1436289.hstgr.cloud` (IP: 93.188.166.147)
- **User**: `root` · **Port**: 22 · **SSH key**: `~/.ssh/discord_dungeons`
- **WS server path**: `/opt/discord-dungeons-ws/`
- **WS container**: `discord-dungeons-ws-ws-server-1` on port 3001

### WS Server deploy
- Script: `bash server/deploy-ws.sh`
- Rsyncs `server/src/ws/`, `Dockerfile`, `package.json`, `docker-compose.yml` to VPS; rebuilds container
- Never overwrites the remote `.env` (secrets live on VPS only)

### n8n deploy (once n8n is installed)
- Build: `node server/src/workflow-builder.js && node server/deploy-workflow.js`
- The deploy script output includes the new `versionId` — this must be applied to the n8n SQLite DB via SSH, then container restarted

## Code Style
- Keep n8n Code node files self-contained — each file in `server/src/code/` is a standalone unit
- Prefer clarity over cleverness; n8n Code nodes run inside a sandboxed JS environment
- Follow the commenting rules in AGENTS.md: section headers (`// --- Name ---`), why-comments for non-obvious logic, `// AGENT:` directives for constraints. Never add obvious narration. Always update or remove stale comments when changing code.

## Testing (before every commit)
- Run `npm test` before committing any code changes. If tests fail, fix the issue before committing — never skip tests.
- Test location: `tests/unit/` — run with `npx vitest run`

## Context Management
- Use subagents (Explore/Plan) for deep codebase research to keep the main context clean
- Use `/compact` when context gets heavy during long sessions
