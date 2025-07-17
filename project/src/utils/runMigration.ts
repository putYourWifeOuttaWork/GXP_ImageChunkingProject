// Temporary utility to run the report management migration
// This should be run once to set up the database schema

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avjoiiqbampztgteqrph.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAwNDIxOCwiZXhwIjoyMDY3NTgwMjE4fQ.2YFHASbaSHw6U--xbfWrNB9yTOGXbZjHPKDQ_KjknE4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function runReportManagementMigration() {
  console.log('Running report management migration...');
  
  try {
    // Check if tables already exist
    const { data: existingTables } = await supabase
      .from('report_folders')
      .select('folder_id')
      .limit(1);
    
    if (existingTables) {
      console.log('Report management tables already exist');
      return { success: true, message: 'Tables already exist' };
    }
  } catch (error) {
    // Tables don't exist, proceed with migration
    console.log('Creating report management tables...');
  }
  
  // For now, we'll need to run the migration manually through Supabase dashboard
  // or use their CLI tools
  
  console.log(`
    To complete the migration:
    1. Go to https://supabase.com/dashboard/project/avjoiiqbampztgteqrph/sql/new
    2. Copy the contents of /supabase/migrations/20250716_report_management_schema.sql
    3. Run the SQL in the Supabase SQL editor
  `);
  
  return { 
    success: false, 
    message: 'Please run the migration manually through Supabase dashboard' 
  };
}

// Test function to verify tables were created
export async function verifyReportTables() {
  try {
    // Test each table
    const tables = [
      'report_folders',
      'report_folder_permissions',
      'saved_reports',
      'report_data_snapshots',
      'report_visualizations',
      'report_version_history',
      'report_subscriptions',
      'report_access_logs'
    ];
    
    const results = await Promise.all(
      tables.map(async (table) => {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          return { table, exists: !error, count };
        } catch (err) {
          return { table, exists: false, error: err };
        }
      })
    );
    
    console.log('Table verification results:', results);
    return results;
  } catch (error) {
    console.error('Error verifying tables:', error);
    return [];
  }
}