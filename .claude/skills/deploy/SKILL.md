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

## Deploy (once VPS is provisioned)
5. **Build n8n workflow**: `node server/src/workflow-builder.js`
6. **Deploy to n8n**: `node server/deploy-workflow.js`
7. **Report the new versionId** from the deploy output.
8. **Remind user**: The `activeVersionId` in the n8n SQLite DB must be updated via SSH, then the container restarted.

## Status
The Hostinger VPS is not yet provisioned. Steps 5-8 will fail until then. For now, the deploy workflow only runs steps 1-4 (test, lint, build).

If `$ARGUMENTS` contains additional instructions, follow them.
