#!/bin/bash

# Praxis Data Population Script
# Usage: ./populate_praxis.sh [YOUR_JWT_TOKEN] [API_URL]

TOKEN=$1
API_URL=${2:-"http://localhost:3001/api"}

if [ -z "$TOKEN" ]; then
  echo "Usage: ./populate_praxis.sh [JWT_TOKEN] [optional: API_URL]"
  echo "You can get your token from the browser localStorage or network tab."
  exit 1
fi

echo "🚀 Populating Praxis Events & Places..."

# Helper function to add an event
add_event() {
  local title=$1
  local city=$2
  local type=$3
  local date=$4
  local lat=$5
  local lng=$6
  local desc=$7

  echo "Adding Event: $title in $city..."
  curl -s -X POST "$API_URL/events" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"$title\",
      \"city\": \"$city\",
      \"type\": \"$type\",
      \"eventDate\": \"$date\",
      \"eventTime\": \"10:00:00\",
      \"latitude\": $lat,
      \"longitude\": $lng,
      \"description\": \"$desc\"
    }" > /dev/null
}

# Add a few more major European events
TODAY=$(date +%Y-%m-%d)
FUTURE_30=$(date -d "+30 days" +%Y-%m-%d)
FUTURE_60=$(date -d "+60 days" +%Y-%m-%d)

add_event "Web Summit Lisbon" "Lisbon" "Work" "$FUTURE_60" 38.722 -9.139 "Largest tech conference in Europe."
add_event "Paris Tech Founders Meetup" "Paris" "Performance" "$FUTURE_30" 48.856 2.352 "Networking for high-growth startup founders."
add_event "London Finance & AI Summit" "London" "Work" "$FUTURE_60" 51.507 -0.127 "Exploring the future of algorithmic trading."

echo "✅ Population complete!"
