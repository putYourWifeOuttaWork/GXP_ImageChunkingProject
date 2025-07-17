# Execute Raw SQL Safe Function Migration

## Purpose
This migration creates the `execute_raw_sql_safe` function that the reporting module uses for optimized SQL queries. Without this function, the reporting module falls back to a less efficient query builder approach.

## Benefits
- **Performance**: Direct SQL execution is much faster than the ORM-based fallback
- **Flexibility**: Allows complex queries with JOINs, aggregations, and window functions
- **Optimization**: Enables the use of database indexes and query optimization

## Migration File
`007_create_execute_raw_sql_safe_function.sql`

## How to Apply

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `007_create_execute_raw_sql_safe_function.sql`
4. Paste and run the query
5. You should see "Success. No rows returned"

### Option 2: Using psql
```bash
psql $DATABASE_URL < migrations/007_create_execute_raw_sql_safe_function.sql
```

### Option 3: Using the migration script
```bash
./migrations/run_migration.sh 007_create_execute_raw_sql_safe_function.sql
```

## Verification
After applying the migration, verify it worked:

```sql
-- Check if the function exists
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'execute_raw_sql_safe';

-- Test the function
SELECT * FROM execute_raw_sql_safe('SELECT COUNT(*) as total FROM petri_observations_partitioned LIMIT 10');
```

## Security Notes
The function includes several security measures:
1. **SQL Injection Prevention**: Checks for dangerous keywords (DROP, CREATE, etc.)
2. **SELECT Only**: Only allows SELECT queries
3. **SECURITY DEFINER**: Runs with the permissions of the function owner
4. **Error Handling**: Returns errors as JSON rather than exposing system errors

## Troubleshooting

### If you see "permission denied"
Make sure to grant execute permissions:
```sql
GRANT EXECUTE ON FUNCTION public.execute_raw_sql_safe(text) TO authenticated;
```

### If the function already exists
The migration includes `DROP FUNCTION IF EXISTS` so it's safe to run multiple times.

### If you still see 404 errors after migration
1. Check that PostgREST has reloaded its schema cache
2. You may need to wait a few minutes or restart your Supabase project
3. Try running: `NOTIFY pgrst, 'reload schema';`

## Impact on Reporting Module
With this function in place:
- Complex queries with multiple JOINs will execute directly
- Aggregations will be performed in the database
- Large datasets will load faster
- The console error about missing function will disappear

## Note
This is an optional optimization. The reporting module works without this function, but performance is better with it, especially for complex reports with multiple data sources and aggregations.