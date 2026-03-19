#!/bin/bash

# deploy_domains.sh - Deploy Maslow-based domain system to Supabase
# Usage: ./deploy_domains.sh

set -e

echo "🚀 Deploying Maslow Domain System to Supabase..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env with DATABASE_URL=your_supabase_postgres_url"
    exit 1
fi

# Load environment variables
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "✅ Database URL found"

# Run migration
echo "📝 Running domain migration..."
psql "$DATABASE_URL" -f migrations/2026-03-18-domain-rework-maslow.sql

echo "✅ Migration completed successfully!"

# Verify migration
echo "🔍 Verifying migration..."
psql "$DATABASE_URL" -c "SELECT domain, COUNT(*) as count FROM goal_trees GROUP BY domain ORDER BY domain;"

echo ""
echo "✨ Domain deployment complete!"
echo ""
echo "Next steps:"
echo "1. Restart the Praxis server: npm restart"
echo "2. Clear browser cache"
echo "3. Test domain selection in goal creation"
echo "4. Verify gaming trackers are available"
