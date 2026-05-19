#!/bin/sh
set -e

# Start llmwiki in the background if it exists
if command -v llmwiki > /dev/null 2>&1; then
  echo "llmwiki found, starting server..."
  llmwiki serve --wiki-root /wiki --port 8080 &
else
  echo "llmwiki not found, skipping."
fi

# Execute the main application
exec "$@"
