#!/usr/bin/env bash
# Stripe CLI end-to-end webhook test.
#
# Forwards Stripe events to the local backend so you can verify subscription
# provisioning, PP credit, and idempotency without a Stripe Dashboard click.
#
# Prereqs:
#   - stripe CLI installed: https://stripe.com/docs/stripe-cli#install
#   - Authenticated: `stripe login`
#   - Backend running on :3001 with STRIPE_SECRET_KEY set (test mode)
#
# Usage:
#   bash scripts/stripe-cli-test.sh listen       # forward webhooks to backend
#   bash scripts/stripe-cli-test.sh fire-sub     # trigger a subscription event
#   bash scripts/stripe-cli-test.sh fire-pp      # trigger a PP one-time event
#
# After `listen`, copy the printed whsec_* into your .env as
# STRIPE_WEBHOOK_SECRET and restart the backend.

set -euo pipefail

PORT="${PORT:-3001}"
WEBHOOK_PATH="/api/stripe/webhook"
TARGET="http://localhost:${PORT}${WEBHOOK_PATH}"

require_cli() {
  if ! command -v stripe >/dev/null 2>&1; then
    echo "stripe CLI not found. Install: https://stripe.com/docs/stripe-cli#install" >&2
    exit 1
  fi
}

case "${1:-}" in
  listen)
    require_cli
    echo "Forwarding Stripe events → ${TARGET}"
    echo "Copy the printed whsec_* into STRIPE_WEBHOOK_SECRET in .env, then restart the backend."
    stripe listen --forward-to "${TARGET}"
    ;;
  fire-sub)
    require_cli
    echo "Triggering checkout.session.completed (subscription)..."
    stripe trigger checkout.session.completed
    ;;
  fire-pp)
    require_cli
    echo "Triggering checkout.session.completed (one-time / PP)..."
    # PP path is differentiated by metadata.purchase_type='pp' in our handler;
    # the canned trigger fixture won't set that, so this exercises the
    # subscription branch. To test PP end-to-end, complete a real checkout
    # session created by POST /api/stripe/create-pp-checkout.
    stripe trigger checkout.session.completed
    ;;
  *)
    echo "Usage: bash scripts/stripe-cli-test.sh {listen|fire-sub|fire-pp}" >&2
    exit 1
    ;;
esac
