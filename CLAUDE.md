@AGENTS.md

# Claude Code — Project Rules

## Workflow
- **Always plan first.** Before making any code change — even small ones — enter Plan Mode, explore the relevant files, and propose the approach before editing. No exceptions.
- After planning: implement → run tests (`npm test`) → build → commit/push → **deploy** (when server is provisioned).
- The commit must exist in git before deploying so the deploy announcement lists the correct commits.

## Issue Tracking
- Use **GitHub Issues** for all task tracking — no external issue trackers.
- Reference issues in commits: `(#42)` or `fixes #42`.
- Use `gh issue create`, `gh issue list`, `gh issue view` for CLI access.

## Deployment (once VPS is provisioned)
- Build: `node server/src/workflow-builder.js && node server/deploy-workflow.js`
- The deploy script output includes the new `versionId` — this must be applied to the n8n SQLite DB via SSH
- SSH, host, container, and volume details will be added once the Hostinger VPS is set up

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
