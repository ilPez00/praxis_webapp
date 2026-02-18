#!/bin/bash

# This script builds and runs the Praxis web application (backend and frontend).
#
# Before running:
# 1. Ensure Node.js and npm are installed.
# 2. Make sure you have your Supabase environment variables set in the .env file
#    located in the praxis_webapp/client/ directory.

# --- Validate Environment Setup ---
CLIENT_ENV_FILE="/home/gio/Praxis/praxis_webapp/client/.env"
if [ -f "$CLIENT_ENV_FILE" ] && grep -q "YOUR_SUPABASE_URL" "$CLIENT_ENV_FILE"; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "!! ERROR: Placeholder Supabase configuration found."
  echo "!! Please edit the file '$CLIENT_ENV_FILE'"
  echo "!! and replace 'YOUR_SUPABASE_URL' and 'YOUR_SUPABASE_ANON_KEY'"
  echo "!! with your actual Supabase project credentials."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  exit 1
fi


# --- Backend Setup and Start ---
echo "--- Setting up and starting Backend ---"
cd /home/gio/Praxis/praxis_webapp || { echo "Error: Could not navigate to backend directory."; exit 1; }

echo "Installing backend dependencies..."
npm install

echo "Building backend..."
npm run build || { echo "Error: Backend build failed."; exit 1; }

echo "Starting backend server in background..."
# Using `npm start` which runs `node dist/index.js`
npm start &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# --- Frontend Setup and Start ---
echo "--- Setting up and starting Frontend ---"
cd /home/gio/Praxis/praxis_webapp/client || { echo "Error: Could not navigate to frontend directory."; exit 1; }

echo "Installing frontend dependencies..."
npm install

echo "Starting frontend development server and opening browser..."
# `npm start` for React apps usually opens in a browser and watches for changes
# We'll run it in background to allow the script to explicitly open the browser.
npm start &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo "Waiting for frontend server to initialize..."
sleep 5 # Give the server some time to launch

echo "Opening client web browser..."
# Attempt to open the browser cross-platform (Linux: xdg-open, macOS: open, Windows Git Bash: start)
# Using common Linux browsers as fallbacks
xdg-open http://localhost:3000 || google-chrome http://localhost:3000 || firefox http://localhost:3000 || open http://localhost:3000 &
BROWSER_PID=$!
echo "Browser opening command executed with PID: $BROWSER_PID"

# Wait for the frontend process to finish (e.g., if user stops it manually)
wait $FRONTEND_PID

# --- Cleanup (This part might not be reached if frontend dev server runs indefinitely) ---
echo "Frontend server stopped. Stopping backend..."
kill $BACKEND_PID
echo "Backend PID $BACKEND_PID stopped."
echo "Praxis web application has been shut down."
