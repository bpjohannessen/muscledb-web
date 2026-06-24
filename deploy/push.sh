#!/usr/bin/env bash
# Usage: ./deploy/push.sh [user@host]
# Syncs the project to the server and restarts the service. Assumes the remote
# /opt/muscledb-web is owned by your login user (see README "One-time setup").
set -euo pipefail
HOST="${1:-bp@fettenajs.com}"
REMOTE="/opt/muscledb-web"

echo "Uploading to $HOST:$REMOTE ..."
rsync -az --delete \
  --exclude node_modules --exclude '.git' \
  ./ "$HOST:$REMOTE/"

echo "Restarting service ..."
ssh "$HOST" 'sudo systemctl restart muscledb-web && sleep 1 && systemctl is-active muscledb-web'
echo "Done."
