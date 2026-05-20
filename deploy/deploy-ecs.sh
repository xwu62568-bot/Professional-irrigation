#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"

SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-47.254.213.164}"
SSH_TARGET="${SSH_USER}@${SSH_HOST}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/irrigation2.0}"
REMOTE_DEPLOY_DIR="$REMOTE_ROOT/deploy"
REMOTE_EXECUTION_DIR="$REMOTE_ROOT/services/execution-service"

PACKAGE_PATH="${PACKAGE_PATH:-/tmp/irrigation-ecs-deploy.tgz}"
REMOTE_PACKAGE_PATH="${REMOTE_PACKAGE_PATH:-/tmp/irrigation-ecs-deploy.tgz}"

SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=no
)

usage() {
  cat <<'EOF'
Usage:
  deploy/deploy-ecs.sh

Optional environment overrides:
  SSH_USER=root
  SSH_HOST=47.254.213.164
  REMOTE_ROOT=/opt/irrigation2.0
  PACKAGE_PATH=/tmp/irrigation-ecs-deploy.tgz
  REMOTE_PACKAGE_PATH=/tmp/irrigation-ecs-deploy.tgz

Requirements:
  - SSH key login to the ECS host must already work.
  - Remote services/.env.production must already exist.
EOF
}

log() {
  printf '[deploy-ecs] %s\n' "$*"
}

run_remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

log "Verifying SSH key login to $SSH_TARGET"
run_remote "echo ssh-key-ok" >/dev/null

log "Packing deploy artifact to $PACKAGE_PATH"
tar --no-xattrs \
  --exclude='*/node_modules/*' \
  --exclude='web-dev/dist/*' \
  --exclude='web/dist/*' \
  --exclude='services/.env.production' \
  -czf "$PACKAGE_PATH" \
  -C "$ROOT_DIR" \
  deploy services

log "Uploading artifact to $SSH_TARGET:$REMOTE_PACKAGE_PATH"
scp "${SSH_OPTS[@]}" "$PACKAGE_PATH" "$SSH_TARGET:$REMOTE_PACKAGE_PATH"

log "Extracting artifact and rebuilding containers on ECS"
run_remote "bash -lc 'set -euo pipefail
  mkdir -p \"$REMOTE_ROOT\"
  test -f \"$REMOTE_ROOT/services/.env.production\"
  tar -xzf \"$REMOTE_PACKAGE_PATH\" -C \"$REMOTE_ROOT\"
  cd \"$REMOTE_DEPLOY_DIR\"
  docker compose -f docker-compose.aliyun.yml up -d --build
  docker compose -f docker-compose.aliyun.yml restart nginx
'"

log "Running health checks"
run_remote "bash -lc 'set -euo pipefail
  curl -fsS http://127.0.0.1/api/execution/health
  echo
  curl -fsS http://127.0.0.1/api/mqtt/health
  echo
'"

log "Resynchronizing auto-plan cron jobs"
run_remote "bash -lc 'set -euo pipefail
  cd \"$REMOTE_EXECUTION_DIR\"
  docker run --rm \
    --env-file ../.env.production \
    -v \"$REMOTE_EXECUTION_DIR\":/app/execution-service \
    -w /app/execution-service \
    node:20-bookworm-slim \
    node scripts/resync-auto-plan-jobs.mjs
'"

log "Deployment complete"
