#!/bin/bash

# Migration Runner Script
# This script helps run migrations against Supabase databases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $1 in
        "error")
            echo -e "${RED}[ERROR]${NC} $2"
            ;;
        "success")
            echo -e "${GREEN}[SUCCESS]${NC} $2"
            ;;
        "warning")
            echo -e "${YELLOW}[WARNING]${NC} $2"
            ;;
        *)
            echo "$2"
            ;;
    esac
}

# Check if migration file is provided
if [ $# -eq 0 ]; then
    print_status "error" "No migration file provided"
    echo "Usage: $0 <migration_file> [production|sandbox]"
    echo "Example: $0 002_create_analytics_infrastructure.sql sandbox"
    exit 1
fi

MIGRATION_FILE=$1
ENVIRONMENT=${2:-sandbox}  # Default to sandbox for safety

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    print_status "error" "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Set database URL based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "warning" "You are about to run a migration on PRODUCTION database!"
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        print_status "warning" "Migration cancelled"
        exit 0
    fi
    
    # Production database
    DATABASE_URL="postgresql://postgres:pleaseFuckingWorkNow@db.jycxolmevsvrxmeinxff.supabase.co:5432/postgres"
    DB_NAME="production"
else
    # Sandbox database (safer option)
    DATABASE_URL="postgresql://postgres:postgres@db.avjoiiqbampztgteqrph.supabase.co:5432/postgres"
    DB_NAME="sandbox"
fi

print_status "warning" "Running migration on $DB_NAME database"
print_status "warning" "Migration file: $MIGRATION_FILE"

# Create a backup point (for rollback if needed)
BACKUP_NAME="pre_migration_$(basename $MIGRATION_FILE .sql)_$(date +%Y%m%d_%H%M%S)"
print_status "warning" "Creating backup point: $BACKUP_NAME"

# Run the migration
print_status "warning" "Executing migration..."
if psql "$DATABASE_URL" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1; then
    print_status "success" "Migration completed successfully!"
    
    # Log the migration
    echo "$(date): Successfully ran $MIGRATION_FILE on $DB_NAME" >> migration_log.txt
else
    print_status "error" "Migration failed!"
    print_status "warning" "You may need to manually rollback changes"
    exit 1
fi

# Verify the migration
print_status "warning" "Verifying migration results..."

# Run basic verification based on the migration file
case "$MIGRATION_FILE" in
    *002_create_analytics_infrastructure*)
        # Check if analytics tables were created
        echo "Checking for new analytics tables..."
        psql "$DATABASE_URL" -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'effectiveness_metrics',
                'aggregate_program_stats',
                'performance_benchmarks'
            )
            ORDER BY table_name;
        "
        
        # Check if materialized view was created
        echo "Checking for materialized views..."
        psql "$DATABASE_URL" -c "
            SELECT matviewname 
            FROM pg_matviews 
            WHERE schemaname = 'public' 
            AND matviewname = 'mv_daily_metrics';
        "
        ;;
    *)
        echo "Running generic verification..."
        psql "$DATABASE_URL" -c "
            SELECT current_database(), current_user, now() as migration_time;
        "
        ;;
esac

print_status "success" "Migration and verification complete!"
echo ""
echo "Next steps:"
echo "1. Test the application to ensure everything works correctly"
echo "2. If issues occur, check migration_log.txt for details"
echo "3. For rollback instructions, see migrations/README.md"