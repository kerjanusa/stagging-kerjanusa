#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_usage() {
  cat <<'EOF'
Usage:
  ./staggingpushgithub.sh "pesan commit"

Fungsi:
  - commit aman hanya untuk backend/frontend dan script staging
  - push current HEAD ke branch main repo kerjanusa/stagging-kerjanusa

Environment penting:
  GIT_REMOTE_MODE=ssh|https
  GITHUB_SSH_KEY=/path/ke/private_key
  GITHUB_TOKEN=token_github
  GITHUB_USERNAME=username_github
  GIT_REMOTE_BRANCH=main
  SKIP_PUSH=1
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

DEFAULT_HTTPS_REPO_URL="https://github.com/kerjanusa/stagging-kerjanusa.git"
DEFAULT_SSH_REPO_URL="git@github.com:kerjanusa/stagging-kerjanusa.git"
REMOTE_NAME="${GIT_REMOTE_NAME:-stagging}"
REMOTE_MODE="${GIT_REMOTE_MODE:-ssh}"
DEFAULT_BRANCH="${GIT_REMOTE_BRANCH:-main}"
BACKUP_DIR="$SCRIPT_DIR/backupdeploy"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/stagging-kerjanusa-backup-$TIMESTAMP.zip"
COMMIT_MESSAGE="${*:-Sync backend/frontend ke kerjanusa/stagging-kerjanusa $TIMESTAMP}"
SSH_KEY_PATH="${GITHUB_SSH_KEY:-}"

DEFAULT_INCLUDE_PATHS=(
  backend
  frontend
  staggingpushgithub.sh
  staggingpushkerjanusatovercel.sh
  staggingdeployvercel.sh
)

if [[ -n "${GITHUB_REPO_URL:-}" ]]; then
  REPO_URL="$GITHUB_REPO_URL"
elif [[ "$REMOTE_MODE" == "https" ]]; then
  REPO_URL="$DEFAULT_HTTPS_REPO_URL"
else
  REPO_URL="$DEFAULT_SSH_REPO_URL"
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: command '$1' tidak ditemukan."
    exit 1
  fi
}

require_command git
require_command zip

if [[ "$REMOTE_MODE" == "ssh" && -z "$SSH_KEY_PATH" ]]; then
  for candidate in \
    "$HOME/.ssh/id_ed25519_reggy" \
    "$HOME/.ssh/id_ed25519_kerjanusa" \
    "$HOME/.ssh/id_ed25519" \
    "$HOME/.ssh/id_rsa"
  do
    if [[ -f "$candidate" ]]; then
      SSH_KEY_PATH="$candidate"
      break
    fi
  done
fi

echo "Repo staging target: $REPO_URL"

mkdir -p "$BACKUP_DIR"

echo "Membuat backup ZIP: $BACKUP_FILE"
zip -rq "$BACKUP_FILE" . -x "backupdeploy/*" ".git/*" ".git"

if [[ -z "$(git config user.name || true)" ]] || [[ -z "$(git config user.email || true)" ]]; then
  cat <<'EOF'
Error: Git identity belum di-set.
Jalankan dulu:
  git config --global user.name "Nama Anda"
  git config --global user.email "email@anda.com"
EOF
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: direktori ini belum berupa repository Git."
  exit 1
fi

if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  CURRENT_REMOTE="$(git remote get-url "$REMOTE_NAME")"
  if [[ "$CURRENT_REMOTE" != "$REPO_URL" ]]; then
    echo "Mengganti remote '$REMOTE_NAME' ke: $REPO_URL"
    git remote set-url "$REMOTE_NAME" "$REPO_URL"
  fi
else
  echo "Menambahkan remote '$REMOTE_NAME': $REPO_URL"
  git remote add "$REMOTE_NAME" "$REPO_URL"
fi

echo "Stage aman: hanya backend/frontend dan script staging."
git reset

for include_path in "${DEFAULT_INCLUDE_PATHS[@]}"; do
  if [[ -e "$include_path" ]]; then
    git add -A "$include_path"
  fi
done

if git diff --cached --quiet; then
  echo "Tidak ada perubahan staged untuk repo staging."
else
  echo "Membuat commit: $COMMIT_MESSAGE"
  git commit -m "$COMMIT_MESSAGE"
fi

if [[ "${SKIP_PUSH:-0}" == "1" ]]; then
  echo "SKIP_PUSH=1, push ke GitHub staging dilewati."
  echo "Backup tersimpan di: $BACKUP_FILE"
  exit 0
fi

PUSH_TARGET="$REMOTE_NAME"

if [[ "$REMOTE_MODE" == "https" && -n "${GITHUB_TOKEN:-}" ]]; then
  if [[ "$REPO_URL" =~ ^https://github\.com/(.+)$ ]]; then
    REPO_PATH="${BASH_REMATCH[1]}"
    GITHUB_USERNAME_VALUE="${GITHUB_USERNAME:-git}"
    PUSH_TARGET="https://${GITHUB_USERNAME_VALUE}:${GITHUB_TOKEN}@github.com/${REPO_PATH}"
  else
    echo "Error: format REPO_URL untuk mode https tidak dikenali: $REPO_URL"
    exit 1
  fi
elif [[ "$REMOTE_MODE" == "ssh" && -n "$SSH_KEY_PATH" ]]; then
  export GIT_SSH_COMMAND="ssh -F /dev/null -i $SSH_KEY_PATH -o IdentitiesOnly=yes"
  echo "Menggunakan SSH key: $SSH_KEY_PATH"
fi

echo "Push current HEAD ke remote '$REMOTE_NAME' branch '$DEFAULT_BRANCH'..."
if ! git push -u "$PUSH_TARGET" "HEAD:$DEFAULT_BRANCH"; then
  cat <<'EOF'
Push staging gagal karena autentikasi GitHub.

Pilih salah satu cara:
1. SSH
   ./staggingpushgithub.sh "pesan commit"

2. HTTPS + Personal Access Token (PAT)
   export GITHUB_USERNAME="kerjanusa"
   export GITHUB_TOKEN="token_github_anda"
   GIT_REMOTE_MODE=https ./staggingpushgithub.sh "pesan commit"

Jika pakai SSH, pastikan public key Anda punya akses ke repo staging.
EOF
  exit 1
fi

echo "Selesai."
echo "Remote yang dipakai: $REMOTE_NAME -> $REPO_URL"
echo "Branch tujuan repo staging: $DEFAULT_BRANCH"
echo "Backup tersimpan di: $BACKUP_FILE"
