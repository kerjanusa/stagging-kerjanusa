#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage:
  ./staggingpushkerjanusatovercel.sh "pesan commit"

Fungsi:
  - push aman ke repo kerjanusa/stagging-kerjanusa
  - lanjut verifikasi endpoint frontend/backend Vercel staging
EOF
  exit 0
fi

export PUSH_SCRIPT="${PUSH_SCRIPT:-$SCRIPT_DIR/staggingpushgithub.sh}"
export FRONTEND_PROJECT_NAME="${FRONTEND_PROJECT_NAME:-stagging-kerjanusa-frontend}"
export BACKEND_PROJECT_NAME="${BACKEND_PROJECT_NAME:-stagging-kerjanusa-backend}"
export FRONTEND_URL="${FRONTEND_URL:-https://stagging-kerjanusa.vercel.app}"
export FRONTEND_CHECK_URL="${FRONTEND_CHECK_URL:-$FRONTEND_URL/login}"
export BACKEND_URL="${BACKEND_URL:-https://stagging-kerjanusa-backend.vercel.app}"
export BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-$BACKEND_URL/api/health}"
export BACKEND_JOBS_URL="${BACKEND_JOBS_URL:-$BACKEND_URL/api/jobs}"

exec "$SCRIPT_DIR/scriptpushkerjanusatovercel.sh" "$@"
