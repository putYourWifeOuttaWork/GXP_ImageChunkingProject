import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avjoiiqbampztgteqrph.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2am9paXFiYW1wenRndGVxcnBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAwNDIxOCwiZXhwIjoyMDY3NTgwMjE4fQ.2YFHASbaSHw6U--xbfWrNB9yTOGXbZjHPKDQ_KjknE4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function runGeospatialMigration() {
  console.log('Running geospatial mapping migration...');
  
  try {
    // Check if tables already exist
    const { data: existingTables } = await supabase
      .from('facility_equipment')
      .select('equipment_id')
      .limit(1);
    
    if (existingTables) {
      console.log('Geospatial mapping tables already exist');
      return { success: true, message: 'Tables already exist' };
    }
  } catch (error) {
    // Tables don't exist, proceed with migration
    console.log('Creating geospatial mapping tables...');
  }
  
  console.log(`
    To complete the geospatial migration:
    1. Go to https://supabase.com/dashboard/project/avjoiiqbampztgteqrph/sql/new
    2. Copy the contents of /migrations/031_add_geospatial_mapping_tables.sql
    3. Run the SQL in the Supabase SQL editor
  `);
  
  return { 
    success: false, 
    message: 'Please run the migration manually through Supabase dashboard' 
  };
}

// Test function to verify geospatial tables were created
export async function verifyGeospatialTables() {
  try {
    // Test each table
    const tables = [
      'facility_equipment',
      'mold_growth_contours', 
      'facility_analytics'
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
    
    console.log('Geospatial table verification results:', results);
    return results;
  } catch (error) {
    console.error('Error verifying geospatial tables:', error);
    return [];
  }
}

// Function to test the geospatial functions
export async function testGeospatialFunctions() {
  try {
    console.log('Testing geospatial functions...');
    
    // Test global facilities overview
    const { data: globalData, error: globalError } = await supabase
      .rpc('get_global_facilities_overview');
    
    if (globalError) {
      console.error('get_global_facilities_overview error:', globalError);
    } else {
      console.log('✅ get_global_facilities_overview works');
    }
    
    // Test with a site ID if available
    const { data: sites } = await supabase
      .from('sites')
      .select('site_id')
      .limit(1);
    
    if (sites && sites.length > 0) {
      const siteId = sites[0].site_id;
      
      const { data: facilityData, error: facilityError } = await supabase
        .rpc('get_facility_mapping_data', { p_site_id: siteId });
      
      if (facilityError) {
        console.error('get_facility_mapping_data error:', facilityError);
      } else {
        console.log('✅ get_facility_mapping_data works');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error testing geospatial functions:', error);
    return false;
  }
}