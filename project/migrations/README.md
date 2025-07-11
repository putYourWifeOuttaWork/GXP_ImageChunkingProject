# Database Migrations

This directory contains SQL migration files that need to be applied to your Supabase database.

## Required Migrations for Reporting Features

The reporting system requires two RPC (Remote Procedure Call) functions to be created in your database:

1. **`get_table_columns`** - Dynamically discovers available columns in tables
2. **`execute_raw_sql`** - Executes complex cross-table queries for advanced filtering

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of each migration file and execute them in order:
   - First: `20250710_add_get_table_columns_function.sql`
   - Second: `20250710_add_execute_raw_sql_function.sql`

### Option 2: Using psql Command Line

```bash
# Replace with your actual database URL
export DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"

# Apply migrations
psql $DATABASE_URL < migrations/20250710_add_get_table_columns_function.sql
psql $DATABASE_URL < migrations/20250710_add_execute_raw_sql_function.sql
```

### Option 3: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Verifying Migrations

After applying the migrations, you can verify they were created successfully:

```sql
-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_table_columns', 'execute_raw_sql');
```

## Troubleshooting

If you see errors like:
- "404: execute_raw_sql RPC function not found"
- "404: get_table_columns RPC function not found"

This means the migration files haven't been applied to your database yet. Follow the steps above to apply them.

## Security Notes

Both functions include security measures:
- `SECURITY DEFINER` ensures they run with appropriate privileges
- `execute_raw_sql` includes SQL injection prevention
- Both functions are granted to authenticated users only