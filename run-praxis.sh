#!/bin/bash

# This script starts the Praxis web application.
# It launches both the backend server and the frontend client.

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Starting backend server..."
(cd "$SCRIPT_DIR" && npm run dev) &
BACKEND_PID=$!

echo "Starting frontend client..."
(cd "$SCRIPT_DIR/client" && npm start) &
FRONTEND_PID=$!

# Give the servers a moment to start up
echo "Waiting for servers to initialize..."
sleep 10

# It's common for react-scripts to automatically open a browser window.
# This line is a fallback to ensure the page opens.
# xdg-open is for Linux. Use 'open' on macOS.
echo "Opening web browser..."
xdg-open http://localhost:3000

echo "Praxis is running."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C in the terminal to stop the servers."

# Keep the script alive to monitor the processes
wait $BACKEND_PID
wait $FRONTEND_PID
