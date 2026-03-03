@AGENTS.md

# Claude Code — Project Rules

## Workflow
- **Always plan first.** Before making any code change — even small ones — enter Plan Mode, explore the relevant files, and propose the approach before editing. No exceptions.
- After planning: implement → run tests (`npm test`) → build → commit/push → **deploy** (`/deploy`).
- The commit must exist in git before deploying so the deploy announcement lists the correct commits.

## Dev Log (`DEVLOG.md`)
- **Update every session.** At the end of each working session (or before committing), add an entry to `DEVLOG.md` covering what was done.
- **Format**: Date heading, commit range, bullet points covering: what changed, why, any dead ends or key decisions. **Newest entries at the top** (reverse chronological).
- **Keep it brief.** 3–6 bullets per session. Focus on decisions, gotchas, and context that helps the next session — not play-by-play narration.
- **Commit messages should be descriptive.** Include the *why*, not just the *what*. Reference issues when applicable. The devlog and git log work together — commits are the detailed record, the devlog is the narrative thread.

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
- **User**: `root` · **Port**: 22 · **SSH key**: `~/.ssh/discord_dungeons_vps`
- **WS server path**: `/opt/discord-dungeons-ws/`
- **WS container**: `discord-dungeons-ws-ws-server-1` on port 3001

### WS Server deploy
- Script: `bash server/deploy-ws.sh`
- Rsyncs `server/src/ws/`, `Dockerfile`, `package.json`, `docker-compose.yml` to VPS; rebuilds container
- Never overwrites the remote `.env` (secrets live on VPS only)

### n8n deploy (once n8n is installed)
- Build: `node server/src/workflow-builder.js && node server/deploy-workflow.js`
- The deploy script output includes the new `versionId` — this must be applied to the n8n SQLite DB via SSH, then container restarted

## Versioning (SemVer: MAJOR.MINOR.PATCH)
- Version lives in `package.json`. Format: `MAJOR.MINOR.PATCH`
  - **MAJOR** — reserved for full public releases and breaking changes (stay at `0` until v1 launch)
  - **MINOR** — new features or significant functionality (e.g., tilemap system, multiplayer)
  - **PATCH** — bug fixes, small tweaks, incremental improvements
- **Bump on every commit** that changes code: `feat:` → bump MINOR (reset PATCH to 0), `fix:` → bump PATCH. Don't bump for `chore:`/`docs:`-only commits.
- The build injects version, git commit hash, and timestamp automatically via Vite `define` — no manual steps needed.

## Code Style
- Keep n8n Code node files self-contained — each file in `server/src/code/` is a standalone unit
- Prefer clarity over cleverness; n8n Code nodes run inside a sandboxed JS environment
- Follow the commenting rules in AGENTS.md: section headers (`// --- Name ---`), why-comments for non-obvious logic, `// AGENT:` directives for constraints. Never add obvious narration. Always update or remove stale comments when changing code.

## Testing (before every commit)
- Run `npm test` before committing any code changes. If tests fail, fix the issue before committing — never skip tests.
- Run `npm run test:e2e` for gameplay/rendering changes to verify behavior in a real browser.
- **Unit tests** (`tests/unit/`): pure logic, events, input, config. Run with `npx vitest run`.
- **E2E tests** (`tests/e2e/`): gameplay, physics, positions, rendering. Run with `npx playwright test`.
- When fixing a gameplay or rendering bug, add an e2e test that reproduces the issue and verifies the fix.

## Parallel Work (Subagents)
- **Default to parallel subagents** for multi-file or multi-task work. Spawn agents concurrently whenever tasks are independent.
- **Isolated worktrees** (`isolation: "worktree"`) for agents that write code — each gets its own branch, preventing file collisions. Merge results back after.
- **Shared directory** (no isolation) is fine for read-only research (Explore agents, Plan agents).
- **When to parallelize**: independent file changes, research + implementation simultaneously, multiple bug fixes in different subsystems, exploration of multiple approaches.
- **When NOT to parallelize**: changes that touch the same files, tasks where one depends on the output of another.
- Keep the main thread as an orchestrator — delegate heavy work to subagents, synthesize results, handle commits/deploys.

## Context Management
- Use subagents (Explore/Plan) for deep codebase research to keep the main context clean
- Use `/compact` when context gets heavy during long sessions
