#!/usr/bin/env bash
# kill_praxis.sh — kill all Praxis processes and free ports 3000 + 3001

echo "==> Killing Praxis processes by name..."

for name in nodemon ts-node react-scripts; do
  if pkill -f "$name" 2>/dev/null; then
    echo "    killed: $name"
  fi
done

sleep 0.5

echo "==> Force-killing anything on port 3000..."
PIDS_3000=$(lsof -ti:3000 2>/dev/null)
if [ -n "$PIDS_3000" ]; then
  echo "$PIDS_3000" | xargs kill -9 2>/dev/null
  echo "    killed PIDs: $PIDS_3000"
else
  echo "    port 3000 already free"
fi

echo "==> Force-killing anything on port 3001..."
PIDS_3001=$(lsof -ti:3001 2>/dev/null)
if [ -n "$PIDS_3001" ]; then
  echo "$PIDS_3001" | xargs kill -9 2>/dev/null
  echo "    killed PIDs: $PIDS_3001"
else
  echo "    port 3001 already free"
fi

echo "==> Done."
