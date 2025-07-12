#!/bin/bash

# Force PostgREST schema reload for Supabase

# Configuration
SUPABASE_URL="https://avjoiiqbampztgteqrph.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDQyMTgsImV4cCI6MjA2NzU4MDIxOH0.HPbW7wPr2Hb1YyiLR4WNomr54p3whemJW60fGuWc4CE"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAwNDIxOCwiZXhwIjoyMDY3NTgwMjE4fQ.2YFHASbaSHw6U--xbfWrNB9yTOGXbZjHPKDQ_KjknE4"

echo "Attempting to force PostgREST schema reload..."

# Method 1: Try to call a dummy function to trigger reload
echo "Method 1: Calling dummy function..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/pg_sleep" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"seconds": 0.1}' \
  2>/dev/null

# Method 2: Create and drop a temporary function using service key
echo "Method 2: Creating temporary function to trigger reload..."
TEMP_FUNCTION_SQL="CREATE OR REPLACE FUNCTION temp_reload_trigger_$$() RETURNS void AS \$\$ BEGIN NULL; END; \$\$ LANGUAGE plpgsql; DROP FUNCTION temp_reload_trigger_$$();"

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/execute_raw_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"${TEMP_FUNCTION_SQL}\"}" \
  2>/dev/null

# Wait a moment for the schema to reload
echo "Waiting for schema reload..."
sleep 3

# Test if get_table_columns is now available
echo "Testing get_table_columns function..."
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_table_columns" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"table_name": "gasifier_observations"}')

if echo "$RESPONSE" | grep -q "column_name"; then
    echo "✅ Success! get_table_columns is now available."
    echo "Response preview:"
    echo "$RESPONSE" | head -20
else
    echo "❌ Function still not available. Response:"
    echo "$RESPONSE"
    echo ""
    echo "Alternative: Try running this SQL in Supabase SQL Editor:"
    echo "-- Force schema reload"
    echo "CREATE OR REPLACE FUNCTION temp_reload_$$() RETURNS void AS \$\$ BEGIN NULL; END; \$\$ LANGUAGE plpgsql;"
    echo "DROP FUNCTION temp_reload_$$();"
fi