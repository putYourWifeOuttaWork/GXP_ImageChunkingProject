# Supabase Database Credentials

## Production Database
- **Supabase URL**: `https://jycxolmevsvrxmeinxff.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5Y3hvbG1ldnN2cnhtZWlueGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMzE0MzYsImV4cCI6MjA2NjcwNzQzNn0.0msVw5lkmycrU1p1qFiUTv7Q6AB-IIdpZejYbekW4sk`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5Y3hvbG1ldnN2cnhtZWlueGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTEzMTQzNiwiZXhwIjoyMDY2NzA3NDM2fQ.RSZ2H5dccCwE1C58hq-DqKehHcnoaRBO0AhPQZ54gAI`
- **Database Password**: `pleaseFuckingWorkNow`

## Sandbox Database
- **Supabase URL**: `https://avjoiiqbampztgteqrph.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDQyMTgsImV4cCI6MjA2NzU4MDIxOH0.HPbW7wPr2Hb1YyiLR4WNomr54p3whemJW60fGuWc4CE`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAwNDIxOCwiZXhwIjoyMDY3NTgwMjE4fQ.2YFHASbaSHw6U--xbfWrNB9yTOGXbZjHPKDQ_KjknE4`
- **Database Password**: `postgres`
- **Status**: Created with 15 tables from production schema
- **Current Operation**: `/refreshsb` - Data and functions/logic dump

## Database Operations
- `/releasesb` - Deploy schema/logic only to production
- `/refreshsb` - Refresh development with production data (current operation)
- `/createsb` - Create new sandbox from production (everything)

## Notes
- Sandbox already has production schema (15 tables)
- Need to dump data only from production to sandbox
- Need to dump functions/logic from production to sandbox
- Pilot_program_history table should be excluded from data dumps (outdated)