import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://avjoiiqbampztgteqrph.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAwNDIxOCwiZXhwIjoyMDY3NTgwMjE4fQ.2YFHASbaSHw6U--xbfWrNB9yTOGXbZjHPKDQ_KjknE4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20250716_report_management_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Starting migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);
      return;
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error running migration:', err);
  }
}

runMigration();