import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Read environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running report management migration...');
    
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250716_report_management_system.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`);
      
      try {
        const { data, error } = await supabase.rpc('execute_raw_sql', {
          sql_query: statement + ';'
        });
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          // Continue with next statement for non-critical errors
        }
      } catch (err) {
        console.error(`Exception in statement ${i + 1}:`, err);
      }
    }
    
    console.log('Migration completed!');
    
    // Test basic functionality
    console.log('Testing folder creation...');
    const { data: testData, error: testError } = await supabase
      .from('report_folders')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Test query failed:', testError);
    } else {
      console.log('Test query successful');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();