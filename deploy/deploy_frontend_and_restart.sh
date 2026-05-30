#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-ultron-controller}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "==> Ultron deploy script"
echo "    root: $ROOT_DIR"
echo "    service: $SERVICE_NAME"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed or not in PATH."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "Error: systemctl is not available on this host."
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Error: frontend directory not found at $FRONTEND_DIR"
  exit 1
fi

echo "==> Pulling latest changes..."
cd "$ROOT_DIR"
git pull --ff-only

echo "==> Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

echo "==> Restarting service: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "==> Service status"
sudo systemctl status "$SERVICE_NAME" --no-pager --lines=20

echo "==> Done."
