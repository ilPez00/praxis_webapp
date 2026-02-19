#!/usr/bin/env bash
# ============================================================
#  run_praxis.sh — Start Praxis backend + frontend locally
#
#  Usage:
#    chmod +x run_praxis.sh   # one-time
#    ./run_praxis.sh
#
#  Stops both servers with Ctrl+C.
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CLIENT="$ROOT/client"
LOG_DIR="$ROOT/.logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'

info()  { echo -e "${CYAN}[praxis]${RESET} $*"; }
ok()    { echo -e "${GREEN}[praxis]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[praxis]${RESET} $*"; }
error() { echo -e "${RED}[praxis]${RESET} $*"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  ██████╗ ██████╗  █████╗ ██╗  ██╗██╗███████╗${RESET}"
echo -e "${CYAN}  ██╔══██╗██╔══██╗██╔══██╗╚██╗██╔╝██║██╔════╝${RESET}"
echo -e "${CYAN}  ██████╔╝██████╔╝███████║ ╚███╔╝ ██║███████╗${RESET}"
echo -e "${CYAN}  ██╔═══╝ ██╔══██╗██╔══██║ ██╔██╗ ██║╚════██║${RESET}"
echo -e "${CYAN}  ██║     ██║  ██║██║  ██║██╔╝ ██╗██║███████║${RESET}"
echo -e "${CYAN}  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝${RESET}"
echo ""
echo -e "  Goal-aligned matching · Real-time accountability"
echo -e "  Backend :3001  ·  Frontend :3000"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
info "Checking prerequisites..."

MISSING_HARD=0
MISSING_SOFT=0

check_var() {
  local var="$1" required="$2" file="$3"
  if [ -z "${!var:-}" ]; then
    if [ "$required" = "hard" ]; then
      error "  MISSING (required): $var  →  Set in $file"
      MISSING_HARD=$((MISSING_HARD+1))
    else
      warn "  MISSING (optional): $var  →  Set in $file"
      MISSING_SOFT=$((MISSING_SOFT+1))
    fi
  else
    ok "  $var ✓"
  fi
}

# Load backend env
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env"; set +a
else
  error ".env not found in project root."
  error "  Run: cp .env.example .env  then fill in the values."
  exit 1
fi

echo ""
info "Backend environment variables:"
check_var "SUPABASE_URL"              hard "$ROOT/.env"
check_var "SUPABASE_PUBLISHABLE_KEY"  hard "$ROOT/.env"
check_var "STRIPE_SECRET_KEY"         soft "$ROOT/.env"
check_var "GEMINI_API_KEY"            soft "$ROOT/.env"
check_var "CLIENT_URL"               soft "$ROOT/.env"

echo ""
info "Frontend environment variables:"
if [ -f "$CLIENT/.env" ]; then
  set -a; source "$CLIENT/.env"; set +a
else
  warn "client/.env not found — using defaults. Copy client/.env.example to client/.env."
fi
check_var "REACT_APP_SUPABASE_URL"    hard "$CLIENT/.env"
check_var "REACT_APP_SUPABASE_ANON_KEY" hard "$CLIENT/.env"

echo ""

if [ "$MISSING_HARD" -gt 0 ]; then
  error "$MISSING_HARD required variable(s) missing. Fix them and re-run."
  error ""
  error "See manual_actions.txt → STEP 2 for where to find each value."
  exit 1
fi

if [ "$MISSING_SOFT" -gt 0 ]; then
  warn "$MISSING_SOFT optional variable(s) missing."
  warn "The app will start but some features will be degraded:"
  warn "  - GEMINI_API_KEY missing → matching uses domain-overlap fallback (no AI)"
  warn "  - STRIPE_SECRET_KEY missing → payments will fail"
  echo ""
fi

# ── Kill any existing processes on ports 3000/3001 ────────────────────────────
info "Freeing ports 3001 and 3000..."
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null && warn "  Killed existing process on :3001" || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null && warn "  Killed existing process on :3000" || true
sleep 0.5

# ── Create log directory ──────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Start backend ─────────────────────────────────────────────────────────────
info "Starting backend (Express + TypeScript)..."
cd "$ROOT"
npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Give it 4 seconds to start or fail
sleep 4
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  error "Backend failed to start. Last 20 lines of $BACKEND_LOG:"
  echo "──────────────────────────────────"
  tail -20 "$BACKEND_LOG"
  echo "──────────────────────────────────"
  exit 1
fi
ok "Backend started (PID $BACKEND_PID) → http://localhost:3001"
info "  Log: $BACKEND_LOG"

# ── Start frontend ────────────────────────────────────────────────────────────
info "Starting frontend (React)..."
cd "$CLIENT"
BROWSER=none npm start > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# Give React a few seconds to begin compilation
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  error "Frontend failed to start. Last 20 lines of $FRONTEND_LOG:"
  tail -20 "$FRONTEND_LOG"
  exit 1
fi
ok "Frontend started (PID $FRONTEND_PID) → http://localhost:3000"
info "  Log: $FRONTEND_LOG"

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}  Praxis is starting up!${RESET}"
echo -e "  ${GREEN}  Frontend (React) → http://localhost:3000${RESET}"
echo -e "  ${GREEN}  Backend  (API)   → http://localhost:3001${RESET}"
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  React may take 30–60 seconds to compile on first run."
echo -e "  Tail live logs:"
echo -e "    Backend:  ${CYAN}tail -f $BACKEND_LOG${RESET}"
echo -e "    Frontend: ${CYAN}tail -f $FRONTEND_LOG${RESET}"
echo ""
echo -e "  Press ${RED}Ctrl+C${RESET} to stop both servers."
echo ""

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  info "Stopping servers..."
  kill $BACKEND_PID  2>/dev/null && ok "  Backend stopped"  || true
  kill $FRONTEND_PID 2>/dev/null && ok "  Frontend stopped" || true
  # Also kill any child processes
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  ok "Done. Goodbye."
}
trap cleanup EXIT INT TERM

# ── Wait (tail backend log to keep terminal useful) ───────────────────────────
wait $BACKEND_PID 2>/dev/null || true
