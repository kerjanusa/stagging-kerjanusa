#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage:
  ./staggingdeployvercel.sh

Fungsi:
  - deploy backend dan frontend langsung ke project Vercel staging
  - tetap memakai guard dari deploy-vercel.sh
EOF
  exit 0
fi

export EXPECTED_FRONTEND_PROJECT_NAME="${EXPECTED_FRONTEND_PROJECT_NAME:-stagging-kerjanusa-frontend}"
export EXPECTED_BACKEND_PROJECT_NAME="${EXPECTED_BACKEND_PROJECT_NAME:-stagging-kerjanusa-backend}"

exec "$SCRIPT_DIR/deploy-vercel.sh" "$@"
