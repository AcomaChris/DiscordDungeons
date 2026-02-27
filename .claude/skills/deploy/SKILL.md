---
name: deploy
description: Build and deploy the project
user_invocable: true
---

# Deploy Workflow

## Pre-deploy checks
1. **Run tests**: `npm test` — stop if tests fail.
2. **Run lint**: `npm run lint` — stop if lint fails.
3. **Build client**: `npm run build` — verify `dist/` output is created.
4. **Ensure committed**: All changes must be committed before deploying. If there are uncommitted changes, ask the user whether to commit first.

## Deploy WS server
5. **Deploy WS server**: `bash server/deploy-ws.sh` — rsyncs changed files to the VPS and rebuilds the Docker container. SSH key must be at `~/.ssh/discord_dungeons`.

## Deploy n8n (once n8n is set up on VPS)
6. **Build n8n workflow**: `node server/src/workflow-builder.js`
7. **Deploy to n8n**: `node server/deploy-workflow.js`
8. **Report the new versionId** from the deploy output.
9. **Remind user**: The `activeVersionId` in the n8n SQLite DB must be updated via SSH, then the container restarted.

## Status
- VPS: **provisioned** — `srv1436289.hstgr.cloud` (root@, SSH key `~/.ssh/discord_dungeons`)
- WS server: **deployed** — container `discord-dungeons-ws-ws-server-1` on port 3001
- n8n: **not yet installed** — steps 6-9 will fail until then

If `$ARGUMENTS` contains additional instructions, follow them.
