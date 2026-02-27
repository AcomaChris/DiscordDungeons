#!/usr/bin/env bash
# Deploys the WebSocket relay server to the Hostinger VPS.
# Tars the server files, copies via scp, extracts on the remote, then rebuilds
# the Docker container in-place.
# The remote .env is never touched — secrets live on the VPS only.
set -e

VPS_HOST="root@srv1436289.hstgr.cloud"
VPS_PATH="/opt/discord-dungeons-ws"
SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/discord_dungeons}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"
TARBALL=$(mktemp /tmp/discord-dungeons-ws-XXXXXX.tar.gz)

echo "[deploy-ws] Packing server files..."
# Only include what the WS server needs — exclude .env and n8n-only code
tar -czf "$TARBALL" \
  -C server \
  --exclude='./src/code' \
  --exclude='./src/workflow-builder.js' \
  --exclude='./.env' \
  --exclude='./.env*' \
  --exclude='./deploy-workflow.js' \
  --exclude='./node_modules' \
  --exclude='./deploy-ws.sh' \
  .

echo "[deploy-ws] Copying to $VPS_HOST..."
scp $SSH_OPTS "$TARBALL" "$VPS_HOST:/tmp/ws-deploy.tar.gz"
rm -f "$TARBALL"

echo "[deploy-ws] Extracting (preserving remote .env)..."
# Extract but never overwrite .env — secrets live on the VPS only
ssh $SSH_OPTS "$VPS_HOST" "
  cd $VPS_PATH
  tar -xzf /tmp/ws-deploy.tar.gz --exclude='./.env' --overwrite
  rm -f /tmp/ws-deploy.tar.gz
"

echo "[deploy-ws] Rebuilding container..."
# AGENT: --build forces a fresh image build from the updated source files.
# --no-deps avoids pulling unneeded images. -d runs detached.
ssh $SSH_OPTS "$VPS_HOST" "cd $VPS_PATH && docker compose up -d --build --no-deps ws-server"

echo "[deploy-ws] Done. Container restarted with latest code."
