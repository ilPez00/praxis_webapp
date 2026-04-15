#!/usr/bin/env bash
#
# Praxis bootstrap — takes a freshly cloned repo to two running dev servers.
#
# What it does:
#   1. Checks prerequisites (node >= 20, npm, matching .env files)
#   2. Installs backend + frontend deps
#   3. Verifies required env vars are present (does NOT fill them in)
#   4. Optionally runs pending DB migrations (only if DATABASE_URL is set)
#   5. Prints the two commands to start dev servers (does not daemonize)
#
# Usage:
#   ./scripts/bootstrap.sh            # full bootstrap
#   ./scripts/bootstrap.sh --check    # verify env + deps only, don't install
#
# This script is intentionally conservative: it refuses to invent secrets,
# refuses to overwrite .env files, and exits non-zero on any missing piece.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then CHECK_ONLY=1; fi

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
step()   { printf '\n\033[1;36m[bootstrap] %s\033[0m\n' "$*"; }

fail() { red "✗ $*"; exit 1; }

# ─── 1. Prereqs ──────────────────────────────────────────────────────────────
step "checking prerequisites"

command -v node >/dev/null 2>&1 || fail "node not found. Install Node 20+ (https://nodejs.org)"
command -v npm  >/dev/null 2>&1 || fail "npm not found"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  fail "node $NODE_MAJOR detected. Praxis requires Node >= 20 (package.json engines.node)."
fi
green "✓ node $(node -v)"
green "✓ npm  $(npm -v)"

# ─── 2. Env files ────────────────────────────────────────────────────────────
step "checking env files"

check_env() {
  local path="$1"; local example="$2"; local -n _required=$3
  if [[ ! -f "$path" ]]; then
    yellow "  $path is missing. Copying from $example — you MUST fill in secrets before starting."
    if [[ $CHECK_ONLY -eq 1 ]]; then fail "env file missing (re-run without --check to scaffold)"; fi
    cp "$example" "$path"
  fi
  local missing=()
  for key in "${_required[@]}"; do
    if ! grep -qE "^${key}=." "$path" || grep -qE "^${key}=(your_|eyJ\.\.\.|pk_test_\.\.\.|https://your-|https://your-dsn)" "$path"; then
      missing+=("$key")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    red "  $path is missing real values for: ${missing[*]}"
    return 1
  fi
  green "  ✓ $path"
  return 0
}

BACKEND_REQUIRED=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY)
FRONTEND_REQUIRED=(REACT_APP_SUPABASE_URL REACT_APP_SUPABASE_ANON_KEY REACT_APP_API_URL)

ENV_OK=1
check_env "$ROOT/.env"        "$ROOT/.env.example"        BACKEND_REQUIRED  || ENV_OK=0
check_env "$ROOT/client/.env" "$ROOT/client/.env.example" FRONTEND_REQUIRED || ENV_OK=0

if (( ENV_OK == 0 )); then
  yellow ""
  yellow "Fill in the missing values above, then re-run this script."
  yellow "Supabase keys:      Supabase dashboard → Settings → API"
  yellow "Service-role key:   same page, under 'service_role' — never commit this"
  yellow "Stripe keys:        Stripe dashboard → Developers → API keys"
  exit 1
fi

# ─── 3. Install deps ─────────────────────────────────────────────────────────
if (( CHECK_ONLY == 0 )); then
  step "installing backend dependencies"
  (cd "$ROOT" && npm install --no-audit --no-fund)

  step "installing frontend dependencies"
  (cd "$ROOT/client" && npm install --no-audit --no-fund)
else
  step "skipping installs (--check)"
fi

# ─── 4. Migrations ───────────────────────────────────────────────────────────
step "checking migrations"
if [[ -n "${DATABASE_URL:-}" ]]; then
  if (( CHECK_ONLY == 1 )); then
    (cd "$ROOT" && npm run migrate:status)
  else
    yellow "  DATABASE_URL set — applying pending migrations"
    (cd "$ROOT" && npm run migrate)
  fi
else
  yellow "  DATABASE_URL not set — skipping (export it to run scripts/run-migrations.ts)"
fi

# ─── 5. Next steps ───────────────────────────────────────────────────────────
step "ready"
cat <<EOF

  Start the backend (port 3001):
    npm run dev

  Start the frontend (port 3000), in a separate terminal:
    cd client && npm start

  Type-check:          cd client && npx tsc --noEmit
  Lint:                npm run lint
  Run tests:           npm test
  Check licenses:      npm run license:check
  Deploy notes:        RUNBOOK.md

EOF
