#!/bin/bash

# Fix sync triggers for new observation columns
# This resolves the "forecasted_expiration" and other new column errors

echo "🔧 Fixing sync triggers to handle new observation columns..."

# Get database credentials
source .env
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env"
    exit 1
fi

# Extract database info from URL
DB_URL=$(echo $VITE_SUPABASE_URL | sed 's/https:\/\///')
DB_HOST="db.${DB_URL}"
DB_NAME="postgres"
DB_PORT="5432"

echo "📡 Connecting to database: $DB_HOST"

# Run the migration
echo "🚀 Running migration 020_fix_sync_triggers_new_columns.sql..."

# Try to run with psql (requires password prompt)
echo "⚠️  Note: You will need to enter your database password"
echo "💡 Get it from: Supabase Dashboard > Settings > Database > Database password"

PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "postgres" -d "$DB_NAME" -f "migrations/020_fix_sync_triggers_new_columns.sql"

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "📝 Summary:"
    echo "   - Fixed sync_gasifier_to_partitioned() function"
    echo "   - Fixed sync_petri_to_partitioned() function"
    echo "   - Excluded new calculated columns from sync"
    echo "   - Recreated triggers on source tables"
    echo ""
    echo "🎉 You can now create new submissions without the 'forecasted_expiration' error!"
else
    echo "❌ Migration failed. Check the error messages above."
    echo "💡 If you need help, check the migration file: migrations/020_fix_sync_triggers_new_columns.sql"
fi