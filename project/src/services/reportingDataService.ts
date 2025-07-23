import { supabase } from '../lib/supabaseClient';
import { 
  ReportConfig, 
  DataSource, 
  AggregatedData,
  Dimension,
  Measure,
  Filter,
  RelationshipPath 
} from '../types/reporting';

export class ReportingDataService {
  // Simple in-memory cache for entity names to avoid repeated lookups
  private static entityNameCache = {
    programs: new Map<string, string>(),
    sites: new Map<string, string>(),
    submissions: new Map<string, string>()
  };

  // Helper method to apply filters with proper OR/AND logic
  private static applyFilters(query: any, filters: Filter[], actualColumns: string[]): any {
    // Filter out filters that don't belong to the current table
    const applicableFilters = filters.filter(filter => 
      actualColumns.includes(filter.field)
    );
    
    console.log('Applying filters:', applicableFilters);
    console.log('Skipping filters not in table:', filters.filter(f => !applicableFilters.includes(f)));
    
    // Group filters by field
    const filtersByField = new Map<string, Filter[]>();
    applicableFilters.forEach(filter => {
      if (filter.field && filter.operator && filter.value) {
        if (!filtersByField.has(filter.field)) {
          filtersByField.set(filter.field, []);
        }
        filtersByField.get(filter.field)!.push(filter);
      }
    });
    
    // Apply filters for each field
    filtersByField.forEach((fieldFilters, field) => {
      // Determine if we should use OR logic for this field
      const useOrLogic = fieldFilters.length > 1 && 
        fieldFilters.every(f => ['contains', 'equals'].includes(f.operator));
      
      if (useOrLogic) {
        // Build OR conditions for filters on the same field
        const orConditions = fieldFilters.map(filter => {
          console.log(`Building OR condition: ${filter.field} ${filter.operator} ${filter.value}`);
          
          switch (filter.operator) {
            case 'equals':
              return `${filter.field}.eq.${filter.value}`;
            case 'contains':
              return `${filter.field}.ilike.%${filter.value}%`;
            default:
              return null;
          }
        }).filter(c => c !== null);
        
        if (orConditions.length > 0) {
          console.log(`Applying OR logic for ${field}: ${orConditions.join(' OR ')}`);
          query = query.or(orConditions.join(','));
        }
      } else {
        // Apply filters with AND logic (existing behavior)
        fieldFilters.forEach(filter => {
          console.log(`Applying filter with AND logic: ${filter.field} ${filter.operator} ${filter.value}`);
          
          switch (filter.operator) {
            case 'equals':
              query = query.eq(filter.field, filter.value);
              break;
            case 'not_equals':
              query = query.neq(filter.field, filter.value);
              break;
            case 'contains':
              query = query.ilike(filter.field, `%${filter.value}%`);
              break;
            case 'not_contains':
              query = query.not(filter.field, 'ilike', `%${filter.value}%`);
              break;
            case 'greater_than':
              query = query.gt(filter.field, filter.value);
              break;
            case 'less_than':
              query = query.lt(filter.field, filter.value);
              break;
            case 'greater_than_or_equal':
              query = query.gte(filter.field, filter.value);
              break;
            case 'less_than_or_equal':
              query = query.lte(filter.field, filter.value);
              break;
            default:
              query = query.eq(filter.field, filter.value);
          }
        });
      }
    });
    
    return query;
  }
  
  // Debug helper to log SQL queries
  private static logQuery(query: any, operation: string): void {
    console.group(`🔍 SQL Query Debug - ${operation}`);
    console.log('Operation:', operation);
    console.log('Timestamp:', new Date().toISOString());
    
    // Try to extract query details from Supabase query builder
    if (query && typeof query === 'object') {
      // Log the URL if available (for debugging)
      if (query.url) {
        console.log('Query URL:', query.url.href || query.url);
      }
      
      // Log method and headers
      if (query.method) {
        console.log('Method:', query.method);
      }
      
      // For select queries, try to show the constructed query
      console.log('Query Object:', query);
    }
    
    console.groupEnd();
  }
  
  // Method to fetch and cache entity names
  static async fetchAndCacheEntityNames(config: ReportConfig): Promise<void> {
    try {
      console.log('fetchAndCacheEntityNames called with segments:', config.segmentBy);
      
      // Only fetch names for segments that are being used
      if (config.segmentBy && config.segmentBy.length > 0) {
        const promises = [];
        
        if (config.segmentBy.includes('program_id') && this.entityNameCache.programs.size === 0) {
          promises.push(
            supabase
              .from('pilot_programs')
              .select('program_id, name')
              .then(({ data, error }) => {
                if (!error && data) {
                  data.forEach(program => {
                    this.entityNameCache.programs.set(program.program_id, program.name);
                  });
                  console.log(`Cached ${data.length} program names`);
                }
              })
          );
        }
        
        if (config.segmentBy.includes('site_id')) {
          // Always refresh site cache to ensure we have latest data
          this.entityNameCache.sites.clear();
          
          promises.push(
            supabase
              .from('sites')
              .select('site_id, name')
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error fetching site names:', error);
                } else if (data) {
                  console.log(`Fetched ${data.length} sites from database`);
                  data.forEach((site, index) => {
                    if (index < 3) {
                      console.log(`Sample site: site_id="${site.site_id}", name="${site.name}"`);
                    }
                    this.entityNameCache.sites.set(site.site_id, site.name);
                  });
                  console.log(`Cached ${data.length} site names, cache size: ${this.entityNameCache.sites.size}`);
                }
              })
          );
        }
        
        if (config.segmentBy.includes('submission_id') && this.entityNameCache.submissions.size === 0) {
          promises.push(
            supabase
              .from('submissions')
              .select('submission_id, global_submission_id')
              .then(({ data, error }) => {
                if (!error && data) {
                  data.forEach(submission => {
                    this.entityNameCache.submissions.set(
                      submission.submission_id, 
                      submission.global_submission_id
                    );
                  });
                  console.log(`Cached ${data.length} submission IDs`);
                }
              })
          );
        }
        
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error caching entity names:', error);
      // Continue without cache if there's an error
    }
  }
  
  // Clear all cached query results
  static clearAllCaches(): void {
    try {
      // Clear entity name cache
      this.entityNameCache.programs.clear();
      this.entityNameCache.sites.clear();
      this.entityNameCache.submissions.clear();
      
      // Clear localStorage items that might contain cached data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('query') || key.includes('cache') || key.includes('report') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        console.log('Clearing cache key:', key);
        localStorage.removeItem(key);
      });
      
      // Clear session storage
      sessionStorage.clear();
      
      console.log('All query caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }
  
  // Get all actual columns from selected data source tables
  static async getTableColumns(dataSources: DataSource[]): Promise<{ [tableName: string]: Array<{ name: string; type: string; displayName: string }> }> {
    const tableColumns: { [tableName: string]: Array<{ name: string; type: string; displayName: string }> } = {};
    
    for (const dataSource of dataSources) {
      try {
        // Use RPC function to get table columns
        const { data, error } = await supabase
          .rpc('get_table_columns', { table_name: dataSource.table });
        
        if (error) {
          console.error(`Error fetching columns for ${dataSource.table}:`, error);
          // Fallback to predefined fields if RPC query fails
          tableColumns[dataSource.table] = dataSource.fields.map(field => ({
            name: field.name,
            type: field.type,
            displayName: field.displayName
          }));
          continue;
        }
        
        if (data && data.length > 0) {
          tableColumns[dataSource.table] = data.map((col: any) => ({
            name: col.column_name,
            type: this.mapPostgreSQLType(col.data_type),
            displayName: this.formatDisplayName(col.column_name)
          }));
        } else {
          // Fallback to predefined fields if no data returned
          tableColumns[dataSource.table] = dataSource.fields.map(field => ({
            name: field.name,
            type: field.type,
            displayName: field.displayName
          }));
        }
      } catch (error) {
        console.error(`Error querying schema for ${dataSource.table}:`, error);
        // Fallback to predefined fields
        tableColumns[dataSource.table] = dataSource.fields.map(field => ({
          name: field.name,
          type: field.type,
          displayName: field.displayName
        }));
      }
    }
    
    return tableColumns;
  }
  
  // Map PostgreSQL data types to our internal types
  private static mapPostgreSQLType(pgType: string): string {
    const typeMap: { [key: string]: string } = {
      'character varying': 'text',
      'text': 'text',
      'integer': 'integer',
      'bigint': 'integer',
      'numeric': 'numeric',
      'real': 'numeric',
      'double precision': 'numeric',
      'boolean': 'boolean',
      'timestamp with time zone': 'datetime',
      'timestamp without time zone': 'datetime',
      'date': 'date',
      'uuid': 'text'
    };
    
    return typeMap[pgType] || 'text';
  }
  
  // Format column names for display
  private static formatDisplayName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Execute report query and return aggregated data
  static async executeReport(config: ReportConfig): Promise<AggregatedData> {
    const startTime = Date.now();
    
    try {
      console.log('Executing report with config:', config);
      console.log('SegmentBy fields:', config.segmentBy);
      
      // Pre-fetch entity names for better performance
      await this.fetchAndCacheEntityNames(config);
      
      // IMPORTANT: Always use direct query to get raw records
      // Segmentation is visual (color coding), NOT SQL GROUP BY
      // Aggregation will be handled in frontend to preserve all data including image_urls
      
      console.log('Always using direct query for raw records with segmentation:', config.segmentBy);
      
      // Direct query path - get full records including image_url for eye icon functionality
      return await this.executeDirectQuery(config, startTime);
      
    } catch (error) {
      console.error('Error executing report:', error);
      console.log('Falling back to sample data due to error');
      return this.getSampleData(config);
    }
  }

  // Execute direct query for full records
  private static async executeDirectQuery(config: ReportConfig, startTime: number): Promise<AggregatedData> {
    console.log('Executing direct query for full records');
    
    // Use the primary data source if one is designated, otherwise use the first one
    let mainSource = config.dataSources.find(ds => ds.isPrimary) || config.dataSources[0];
    
    if (!mainSource) {
      throw new Error('No data source configured');
    }
    
    console.log('Using main source for direct query:', mainSource.name, 'Table:', mainSource.table);
    console.log('All data sources:', config.dataSources.map(ds => ({ name: ds.name, table: ds.table, isPrimary: ds.isPrimary })));

    // First, let's try to get the actual table schema to avoid column errors
    console.log('Checking table schema for:', mainSource.table);
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .rpc('get_table_columns', { table_name: mainSource.table });
      
      if (schemaData && schemaData.length > 0) {
        const availableColumns = schemaData.map((col: any) => col.column_name);
        console.log('Available columns in', mainSource.table, ':', availableColumns);
      }
    } catch (schemaError) {
      console.log('Could not fetch schema, proceeding with predefined fields');
    }

    // Detect if we need to join with related tables for measures
    const measuresBySource = new Map<string, Measure[]>();
    const dimensionsBySource = new Map<string, Dimension[]>();
    
    // Group measures by their data source
    config.measures.forEach(measure => {
      const source = measure.dataSource || mainSource.id;
      if (!measuresBySource.has(source)) {
        measuresBySource.set(source, []);
      }
      measuresBySource.get(source)!.push(measure);
    });
    
    // Group dimensions by their data source
    config.dimensions.forEach(dim => {
      const source = dim.source || mainSource.id;
      if (!dimensionsBySource.has(source)) {
        dimensionsBySource.set(source, []);
      }
      dimensionsBySource.get(source)!.push(dim);
    });
    
    // Check if we need fields from related tables
    const needsJoin = Array.from(measuresBySource.keys()).some(sourceId => sourceId !== mainSource.id) ||
                      Array.from(dimensionsBySource.keys()).some(sourceId => sourceId !== mainSource.id);
    
    if (needsJoin && config.dataSources.length > 1) {
      console.log('Detected fields from related tables. Building join query...');
      
      // Find related data sources
      const relatedSources = config.dataSources.filter(ds => ds.id !== mainSource.id);
      
      // For now, we'll handle the specific case of Sites + Petri Observations
      // This can be generalized later based on relationship configuration
      if (mainSource.table === 'sites' && relatedSources.some(rs => rs.table.includes('petri_observations'))) {
        const petriSource = relatedSources.find(rs => rs.table.includes('petri_observations'));
        
        if (petriSource) {
          console.log('Building join between sites and petri_observations');
          
          // Build aggregated query with join
          return await this.executeJoinedAggregatedQuery(config, mainSource, petriSource, startTime);
        }
      }
    }

    // Build select fields including all important metadata
    const selectFields = [];
    
    // Add dimension fields from main source only
    config.dimensions.forEach(dim => {
      if (!dim.source || dim.source === mainSource.id) {
        selectFields.push(dim.field);
      }
    });
    
    // Add measure fields from main source only
    config.measures.forEach(measure => {
      if (!measure.dataSource || measure.dataSource === mainSource.id) {
        selectFields.push(measure.field);
      }
    });
    
    // Add segment fields if any
    if (config.segmentBy && config.segmentBy.length > 0) {
      config.segmentBy.forEach(segment => {
        if (!selectFields.includes(segment)) {
          selectFields.push(segment);
        }
      });
    }
    
    // Always include key fields for drill-down and image display
    const commonKeyFields = ['submission_id', 'site_id', 'program_id', 'image_url', 'created_at'];
    const gasifierKeyFields = ['gasifier_code', 'flow_rate', 'linear_reading'];
    const petriKeyFields = ['petri_code', 'growth_index', 'placement', 'updated_at'];
    
    // Add common key fields
    commonKeyFields.forEach(field => {
      if (!selectFields.includes(field)) {
        selectFields.push(field);
      }
    });
    
    // Add table-specific key fields based on the main source
    if (mainSource.table.includes('gasifier')) {
      gasifierKeyFields.forEach(field => {
        if (!selectFields.includes(field)) {
          selectFields.push(field);
        }
      });
    } else if (mainSource.table.includes('petri')) {
      petriKeyFields.forEach(field => {
        if (!selectFields.includes(field)) {
          selectFields.push(field);
        }
      });
    }

    console.log('Direct query selecting fields:', selectFields);
    
    // Try a simple test query first to verify table access
    console.log('Testing basic table access...');
    try {
      const { data: testData, error: testError } = await supabase
        .from(mainSource.table)
        .select('*')
        .limit(1);
      
      if (testError) {
        console.error('Basic table access failed:', testError);
        throw testError;
      }
      
      if (testData && testData.length > 0) {
        console.log('Table access successful. Sample columns:', Object.keys(testData[0]));
        
        // Filter our select fields to only include columns that actually exist
        const actualColumns = Object.keys(testData[0]);
        const validSelectFields = selectFields.filter(field => actualColumns.includes(field));
        const invalidFields = selectFields.filter(field => !actualColumns.includes(field));
        
        if (invalidFields.length > 0) {
          console.warn('Removing invalid fields:', invalidFields);
        }
        
        console.log('Valid select fields:', validSelectFields);
        
        // Use only valid fields for the actual query
        if (validSelectFields.length === 0) {
          console.warn('No valid fields found, using all available columns');
          validSelectFields.push('*');
        }
        
        // Build select with nested relationships for segment names
        let selectString = validSelectFields.join(', ');
        
        // Add nested selects for segment data if segments are requested
        if (config.segmentBy && config.segmentBy.length > 0) {
          const nestedSelects: string[] = [];
          
          // Enable joins for site names when using petri_observations
          const addJoins = mainSource.table.includes('petri_observations');
          
          if (config.segmentBy.includes('program_id') && validSelectFields.includes('program_id') && addJoins) {
            nestedSelects.push('pilot_programs!inner(name)');
          }
          
          if (config.segmentBy.includes('site_id') && validSelectFields.includes('site_id') && addJoins) {
            nestedSelects.push('sites!inner(site_id,name)');
          }
          
          if (config.segmentBy.includes('submission_id') && validSelectFields.includes('submission_id') && addJoins) {
            nestedSelects.push('submissions!inner(global_submission_id)');
          }
          
          if (nestedSelects.length > 0) {
            selectString = `${selectString}, ${nestedSelects.join(', ')}`;
          }
        }
        
        console.log('Select string with nested relationships:', selectString);
        
        var query = supabase
          .from(mainSource.table)
          .select(selectString);
          
        // Store actual columns for filter validation
        var actualTableColumns = actualColumns;
      }
    } catch (testError) {
      console.error('Table test failed, falling back to sample data:', testError);
      return this.getSampleData(config);
    }
    
    if (!query) {
      // Build select with nested relationships for segment names
      let selectString = selectFields.join(', ');
      
      // Add nested selects for segment data if segments are requested
      if (config.segmentBy && config.segmentBy.length > 0) {
        const nestedSelects: string[] = [];
        
        // Enable joins for site names when using petri_observations
        const addJoins = mainSource.table.includes('petri_observations');
        
        if (config.segmentBy.includes('program_id') && selectFields.includes('program_id') && addJoins) {
          // Simplified join syntax
          nestedSelects.push('pilot_programs!inner(name)');
        }
        
        if (config.segmentBy.includes('site_id') && selectFields.includes('site_id') && addJoins) {
          // Join to get site names
          nestedSelects.push('sites!inner(site_id,name)');
        }
        
        if (config.segmentBy.includes('submission_id') && selectFields.includes('submission_id') && addJoins) {
          // Simplified join syntax
          nestedSelects.push('submissions!inner(global_submission_id)');
        }
        
        if (nestedSelects.length > 0) {
          selectString = `${selectString}, ${nestedSelects.join(', ')}`;
        }
      }
      
      console.log('Building query with nested selects:', {
        table: mainSource.table,
        selectString: selectString,
        segments: config.segmentBy
      });
      
      var query = supabase
        .from(mainSource.table)
        .select(selectString);
      var actualTableColumns: string[] = [];
    }

    // Apply filters - only those that belong to the current table
    if (config.filters && config.filters.length > 0) {
      const actualColumns = actualTableColumns || [];
      query = this.applyFilters(query, config.filters, actualColumns);
    }

    // Apply isolation filters if present
    if (config.isolationFilters && Object.keys(config.isolationFilters).length > 0) {
      console.log('Applying isolation filters:', config.isolationFilters);
      
      Object.entries(config.isolationFilters).forEach(([field, values]) => {
        if (values && values.length > 0) {
          // Use 'in' operator for multiple values
          query = query.in(field, values);
          console.log(`Applied isolation filter: ${field} IN (${values.join(', ')})`);
        }
      });
    }

    // Execute query
    console.log('Executing Supabase query...');
    console.log('Query details:', {
      table: mainSource.table,
      selectFields: selectFields,
      filters: config.filters,
      segmentBy: config.segmentBy
    });
    
    // Log the query for debugging
    this.logQuery(query, 'Direct Query');
    
    const { data, error } = await query.limit(500);
    
    if (error) {
      console.error('Direct query error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details
      });
      console.error('Failed query was selecting:', selectFields);
      console.error('From table:', mainSource.table);
      throw error;
    }

    console.log('Direct query results:', data?.length, 'records');
    console.log('Sample record:', data?.[0]);
    
    // Log detailed info about related data
    if (data && data.length > 0) {
      const sampleRow = data[0];
      console.log('Related data in first row:', {
        'has pilot_programs': !!sampleRow.pilot_programs,
        'pilot_programs': sampleRow.pilot_programs,
        'has sites': !!sampleRow.sites,
        'sites': sampleRow.sites,
        'has submissions': !!sampleRow.submissions,
        'submissions': sampleRow.submissions,
        'all keys': Object.keys(sampleRow)
      });
    }

    if (!data || data.length === 0) {
      console.log('No data returned, using sample data');
      return this.getSampleData(config);
    }
    
    // Warn if too many records
    if (data.length > 500) {
      console.warn(`⚠️ Large dataset detected: ${data.length} records returned.`);
      console.warn('Consider reducing the number of fields or adding filters to improve performance.');
      console.warn('Tip: Remove unnecessary dimensions or measures in the Data Sources step.');
    }

    // Process data into the expected format
    const processedData = data.map((row, index) => {
      // Extract segment values and their display names
      const segmentData: any = {};
      const segmentMetadata: any = {};
      
      if (config.segmentBy && config.segmentBy.length > 0) {
        config.segmentBy.forEach(segment => {
          segmentData[`segment_${segment}`] = row[segment];
          
          // Check if we have joined data from Supabase
          if (segment === 'site_id' && row.sites && row.sites.name) {
            // Use the joined site name from the query
            segmentMetadata[`${segment}_name`] = row.sites.name;
            
            // Also update cache for consistency
            if (row[segment] && row.sites.name) {
              this.entityNameCache.sites.set(row[segment], row.sites.name);
            }
          } else if (segment === 'program_id' && row.pilot_programs && row.pilot_programs.name) {
            // Use the joined program name from the query
            segmentMetadata[`${segment}_name`] = row.pilot_programs.name;
            
            // Also update cache
            if (row[segment] && row.pilot_programs.name) {
              this.entityNameCache.programs.set(row[segment], row.pilot_programs.name);
            }
          } else if (segment === 'submission_id' && row.submissions && row.submissions.global_submission_id) {
            // Use the joined submission ID from the query
            segmentMetadata[`${segment}_global`] = row.submissions.global_submission_id;
            
            // Also update cache
            if (row[segment] && row.submissions.global_submission_id) {
              this.entityNameCache.submissions.set(row[segment], row.submissions.global_submission_id);
            }
          } else {
            // Fall back to cached names
            if (segment === 'program_id') {
              const programName = this.entityNameCache.programs.get(row[segment]);
              if (programName) {
                segmentMetadata[`${segment}_name`] = programName;
              }
            } else if (segment === 'site_id') {
              const siteId = row[segment];
              const siteName = this.entityNameCache.sites.get(siteId);
              
              // Debug logging for first few rows
              if (index < 3) {
                console.log(`Processing row ${index} - site_id: ${siteId}, cached name: ${siteName}, cache size: ${this.entityNameCache.sites.size}`);
                if (this.entityNameCache.sites.size > 0 && !siteName) {
                  console.log('Available site IDs in cache:', Array.from(this.entityNameCache.sites.keys()).slice(0, 5));
                }
              }
              
              if (siteName) {
                segmentMetadata[`${segment}_name`] = siteName;
              }
            } else if (segment === 'submission_id') {
              const globalId = this.entityNameCache.submissions.get(row[segment]);
              if (globalId) {
                segmentMetadata[`${segment}_global`] = globalId;
              }
            }
          }
        });
      }
      
      return {
        dimensions: this.extractDimensions(row, config.dimensions),
        measures: this.extractMeasures(row, config.measures),
        segments: segmentData,
        segmentMetadata: segmentMetadata,
        // Include full row data for image URLs and metadata
        ...row
      };
    });

    const executionTime = Date.now() - startTime;
    console.log(`Direct query completed in ${executionTime}ms`);

    return {
      data: processedData,
      totalCount: data.length,
      filteredCount: processedData.length,
      executionTime,
      cacheHit: false,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dimensions: config.dimensions,
        measures: config.measures,
        filters: config.filters,
        segments: config.segmentBy || []
      }
    };
  }

  // Execute joined aggregated query when measures come from related tables
  private static async executeJoinedAggregatedQuery(
    config: ReportConfig, 
    mainSource: DataSource, 
    relatedSource: DataSource, 
    startTime: number
  ): Promise<AggregatedData> {
    console.log('Executing joined aggregated query');
    console.log('Main source:', mainSource.name, 'Related source:', relatedSource.name);
    
    try {
      // For Sites + Petri Observations, we'll use a raw SQL query to properly aggregate
      // This gives us more control over the join and aggregation logic
      
      // Build the SELECT clause
      const selectParts: string[] = [];
      
      // Add dimensions from main table (sites)
      config.dimensions.forEach(dim => {
        if (!dim.source || dim.source === mainSource.id) {
          selectParts.push(`s.${dim.field}`);
        }
      });
      
      // Add aggregated measures from related table (petri_observations)
      config.measures.forEach(measure => {
        if (measure.dataSource === relatedSource.id) {
          switch (measure.aggregation) {
            case 'sum':
              selectParts.push(`SUM(p.${measure.field}) as ${measure.field}_sum`);
              break;
            case 'avg':
              selectParts.push(`AVG(p.${measure.field}) as ${measure.field}_avg`);
              break;
            case 'count':
              selectParts.push(`COUNT(p.${measure.field}) as ${measure.field}_count`);
              break;
            case 'min':
              selectParts.push(`MIN(p.${measure.field}) as ${measure.field}_min`);
              break;
            case 'max':
              selectParts.push(`MAX(p.${measure.field}) as ${measure.field}_max`);
              break;
            default:
              selectParts.push(`SUM(p.${measure.field}) as ${measure.field}`);
          }
        } else if (!measure.dataSource || measure.dataSource === mainSource.id) {
          // Measures from main table
          selectParts.push(`s.${measure.field}`);
        }
      });
      
      // Build GROUP BY clause - all non-aggregated fields
      const groupByParts: string[] = [];
      config.dimensions.forEach(dim => {
        if (!dim.source || dim.source === mainSource.id) {
          groupByParts.push(`s.${dim.field}`);
        }
      });
      
      // Add any non-aggregated measures from main table
      config.measures.forEach(measure => {
        if ((!measure.dataSource || measure.dataSource === mainSource.id) && 
            !selectParts.some(part => part.includes(`s.${measure.field}`))) {
          groupByParts.push(`s.${measure.field}`);
        }
      });
      
      // Build the query
      let query = `
        SELECT ${selectParts.join(', ')}
        FROM ${mainSource.table} s
        LEFT JOIN ${relatedSource.table} p ON s.site_id = p.site_id
      `;
      
      // Add WHERE clause for filters
      const whereParts: string[] = [];
      if (config.filters && config.filters.length > 0) {
        config.filters.forEach(filter => {
          // Determine which table the filter field belongs to
          const isMainTable = mainSource.fields.some(f => f.name === filter.field);
          const tableAlias = isMainTable ? 's' : 'p';
          
          switch (filter.operator) {
            case 'equals':
              whereParts.push(`${tableAlias}.${filter.field} = '${filter.value}'`);
              break;
            case 'contains':
              whereParts.push(`${tableAlias}.${filter.field} ILIKE '%${filter.value}%'`);
              break;
            case 'greater_than':
              whereParts.push(`${tableAlias}.${filter.field} > ${filter.value}`);
              break;
            case 'less_than':
              whereParts.push(`${tableAlias}.${filter.field} < ${filter.value}`);
              break;
            // Add more operators as needed
          }
        });
      }
      
      if (whereParts.length > 0) {
        query += ` WHERE ${whereParts.join(' AND ')}`;
      }
      
      if (groupByParts.length > 0) {
        query += ` GROUP BY ${groupByParts.join(', ')}`;
      }
      
      query += ` LIMIT 500`;
      
      console.log('Executing raw SQL query:', query);
      
      // Execute the query
      const { data, error } = await supabase.rpc('execute_raw_sql', {
        query_text: query
      });
      
      if (error) {
        console.error('Join query error:', error);
        
        // Fallback to sequential queries if raw SQL fails
        return await this.executeFallbackJoinQuery(config, mainSource, relatedSource, startTime);
      }
      
      console.log('Join query results:', data?.length, 'records');
      
      // Process the results
      const processedData = data?.map((row: any) => {
        const result: any = {
          dimensions: {},
          measures: {}
        };
        
        // Extract dimensions
        config.dimensions.forEach(dim => {
          result.dimensions[dim.field] = row[dim.field];
          result[dim.field] = row[dim.field];
        });
        
        // Extract measures
        config.measures.forEach(measure => {
          if (measure.dataSource === relatedSource.id) {
            const fieldName = `${measure.field}_${measure.aggregation || 'sum'}`;
            result.measures[measure.name] = row[fieldName] || row[measure.field];
            result[measure.name] = row[fieldName] || row[measure.field];
          } else {
            result.measures[measure.name] = row[measure.field];
            result[measure.name] = row[measure.field];
          }
        });
        
        // Add metadata
        Object.keys(row).forEach(key => {
          if (!result[key]) {
            result[key] = row[key];
          }
        });
        
        return result;
      }) || [];
      
      const executionTime = Date.now() - startTime;
      
      return {
        data: processedData,
        totalCount: data?.length || 0,
        filteredCount: processedData.length,
        executionTime,
        cacheHit: false,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dimensions: config.dimensions,
          measures: config.measures,
          filters: config.filters
        }
      };
      
    } catch (error) {
      console.error('Join query failed:', error);
      return await this.executeFallbackJoinQuery(config, mainSource, relatedSource, startTime);
    }
  }
  
  // Fallback method using Supabase query builder when raw SQL is not available
  private static async executeFallbackJoinQuery(
    config: ReportConfig,
    mainSource: DataSource,
    relatedSource: DataSource,
    startTime: number
  ): Promise<AggregatedData> {
    console.log('Using fallback join strategy');
    
    try {
      // First get all sites
      let sitesQuery = supabase.from(mainSource.table).select('*');
      
      // Apply filters for sites table
      if (config.filters && config.filters.length > 0) {
        const siteFilters = config.filters.filter(f => 
          mainSource.fields.some(field => field.name === f.field)
        );
        if (siteFilters.length > 0) {
          sitesQuery = this.applyFilters(sitesQuery, siteFilters, mainSource.fields.map(f => f.name));
        }
      }
      
      const { data: sites, error: sitesError } = await sitesQuery;
      
      if (sitesError) {
        throw sitesError;
      }
      
      console.log('Fetched sites:', sites?.length);
      
      // Now fetch and aggregate petri observations for each site
      const aggregatedData: any[] = [];
      
      for (const site of sites || []) {
        let petriQuery = supabase
          .from(relatedSource.table)
          .select('*')
          .eq('site_id', site.site_id);
        
        // Apply filters for petri table
        if (config.filters && config.filters.length > 0) {
          const petriFilters = config.filters.filter(f => 
            relatedSource.fields.some(field => field.name === f.field)
          );
          if (petriFilters.length > 0) {
            petriQuery = this.applyFilters(petriQuery, petriFilters, relatedSource.fields.map(f => f.name));
          }
        }
        
        const { data: petriData, error: petriError } = await petriQuery;
        
        if (!petriError && petriData) {
          // Aggregate the petri data
          const aggregated: any = { ...site };
          
          config.measures.forEach(measure => {
            if (measure.dataSource === relatedSource.id && petriData.length > 0) {
              const values = petriData.map(p => p[measure.field]).filter(v => v !== null && v !== undefined);
              
              switch (measure.aggregation) {
                case 'sum':
                  aggregated[measure.name] = values.reduce((a, b) => a + Number(b), 0);
                  break;
                case 'avg':
                  aggregated[measure.name] = values.length > 0 
                    ? values.reduce((a, b) => a + Number(b), 0) / values.length 
                    : 0;
                  break;
                case 'count':
                  aggregated[measure.name] = values.length;
                  break;
                case 'min':
                  aggregated[measure.name] = values.length > 0 ? Math.min(...values.map(Number)) : 0;
                  break;
                case 'max':
                  aggregated[measure.name] = values.length > 0 ? Math.max(...values.map(Number)) : 0;
                  break;
                default:
                  aggregated[measure.name] = values.reduce((a, b) => a + Number(b), 0);
              }
            }
          });
          
          aggregatedData.push(aggregated);
        }
      }
      
      // Process into expected format
      const processedData = aggregatedData.map(row => {
        const result: any = {
          dimensions: {},
          measures: {}
        };
        
        config.dimensions.forEach(dim => {
          result.dimensions[dim.field] = row[dim.field];
          result[dim.field] = row[dim.field];
        });
        
        config.measures.forEach(measure => {
          result.measures[measure.name] = row[measure.name] || 0;
          result[measure.name] = row[measure.name] || 0;
        });
        
        // Include all other fields
        Object.keys(row).forEach(key => {
          if (!result[key]) {
            result[key] = row[key];
          }
        });
        
        return result;
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        data: processedData,
        totalCount: processedData.length,
        filteredCount: processedData.length,
        executionTime,
        cacheHit: false,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dimensions: config.dimensions,
          measures: config.measures,
          filters: config.filters
        }
      };
      
    } catch (error) {
      console.error('Fallback join query failed:', error);
      return this.getSampleData(config);
    }
  }

  // Execute aggregated query for charts
  private static async executeAggregatedQuery(config: ReportConfig, startTime: number): Promise<AggregatedData> {
    console.log('Executing aggregated query with segments');
    
    // CRITICAL: Always use observation tables as the main source, regardless of segments
    // Segments should never change which table we query from
    let mainSource = config.dataSources.find(ds => 
      ds.table.includes('observations') || 
      ds.id.includes('observations')
    );
    
    // If no observation table found, use the primary source
    if (!mainSource) {
      mainSource = config.dataSources.find(ds => ds.isPrimary) || config.dataSources[0];
    }
    
    if (!mainSource) {
      throw new Error('No data source configured');
    }
    
    console.log('Using main source for aggregated query:', mainSource.name, 'Table:', mainSource.table);
    console.log('Segments requested:', config.segmentBy);

    try {
      // For segmented queries, we need to query the main table and get segment info
      let query = supabase.from(mainSource.table);
      
      // Build select statement
      const selectFields: string[] = [];
      
      // Add dimension fields
      config.dimensions.forEach(dim => {
        if (!selectFields.includes(dim.field)) {
          selectFields.push(dim.field);
        }
      });
      
      // Add measure fields
      config.measures.forEach(measure => {
        if (!selectFields.includes(measure.field)) {
          selectFields.push(measure.field);
        }
      });
      
      // Add segment fields
      if (config.segmentBy) {
        config.segmentBy.forEach(segment => {
          if (!selectFields.includes(segment)) {
            selectFields.push(segment);
          }
        });
      }
      
      // Add key fields for relationships
      const keyFields = ['submission_id', 'site_id', 'program_id'];
      keyFields.forEach(field => {
        if (!selectFields.includes(field) && mainSource.fields.some(f => f.name === field)) {
          selectFields.push(field);
        }
      });
      
      console.log('Aggregated query selecting:', selectFields);
      
      // Validate fields exist in the table before selecting
      const { data: testData, error: testError } = await supabase
        .from(mainSource.table)
        .select('*')
        .limit(1);
      
      let actualColumns: string[] = [];
      if (testData && testData.length > 0) {
        actualColumns = Object.keys(testData[0]);
        console.log('Actual columns in table:', actualColumns);
        
        const validSelectFields = selectFields.filter(field => actualColumns.includes(field));
        const invalidFields = selectFields.filter(field => !actualColumns.includes(field));
        
        if (invalidFields.length > 0) {
          console.warn('Removing invalid fields from select:', invalidFields);
        }
        
        query = query.select(validSelectFields.join(', '));
      } else {
        // Fallback to original select if we can't validate
        query = query.select(selectFields.join(', '));
      }
      
      // Apply filters - only for fields in the main table
      if (config.filters && config.filters.length > 0) {
        // Use the actual columns we discovered or fall back to configured fields
        const columnsToCheck = actualColumns.length > 0 
          ? actualColumns 
          : mainSource.fields.map(f => f.name);
        
        query = this.applyFilters(query, config.filters, columnsToCheck);
      }
      
      // Log the query for debugging
      this.logQuery(query, 'Aggregated Query');
      
      const { data, error } = await query.limit(500);
      
      if (error) {
        console.error('Aggregated query error:', error);
        throw error;
      }
      
      console.log('Aggregated query results:', data?.length, 'records');
      
      // Process data
      const processedData = data?.map(row => ({
        dimensions: this.extractDimensions(row, config.dimensions),
        measures: this.extractMeasures(row, config.measures),
        ...row
      })) || [];
      
      const executionTime = Date.now() - startTime;
      
      return {
        data: processedData,
        totalCount: data?.length || 0,
        filteredCount: processedData.length,
        executionTime,
        cacheHit: false,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dimensions: config.dimensions,
          measures: config.measures,
          filters: config.filters
        }
      };
      
    } catch (error) {
      console.error('Aggregated query failed:', error);
      console.log('Falling back to sample data');
      return this.getSampleData(config);
    }
  }

  // Helper to extract dimension values
  private static extractDimensions(row: any, dimensions: any[]): any {
    const result: any = {};
    dimensions.forEach(dim => {
      result[dim.field] = row[dim.field];
    });
    return result;
  }

  // Helper to extract measure values  
  private static extractMeasures(row: any, measures: any[]): any {
    const result: any = {};
    measures.forEach(measure => {
      result[measure.field] = row[measure.field];
    });
    return result;
  }

  // Get sample data for testing
  static getSampleData(config: ReportConfig): AggregatedData {
    const executionTime = 100;
    
    // Generate sample data based on config
    const sampleData = [];
    for (let i = 0; i < 20; i++) {
      const row: any = {
        dimensions: {},
        measures: {}
      };
      
      // Add dimension values to nested structure
      config.dimensions.forEach(dim => {
        let value: any;
        if (dim.field === 'petri_code') {
          value = `P${i + 1}`;
        } else if (dim.field === 'gasifier_code') {
          value = `G${i + 1}`;
        } else if (dim.field === 'site_id') {
          value = `Site ${(i % 3) + 1}`;
        } else if (dim.field === 'created_at') {
          value = new Date(2023, 0, i + 1).toISOString().split('T')[0];
        } else {
          value = `Value ${i + 1}`;
        }
        
        // Store in both the nested structure and flat structure for compatibility
        row.dimensions[dim.field] = value;
        row[dim.name] = value;
        row[dim.field] = value; // Also store by field name for direct access
      });
      
      // Add measure values to nested structure
      config.measures.forEach(measure => {
        let value: number;
        if (measure.aggregation === 'count') {
          value = Math.floor(Math.random() * 100) + 1;
        } else if (measure.aggregation === 'sum') {
          value = Math.floor(Math.random() * 1000) + 100;
        } else if (measure.aggregation === 'avg') {
          value = Math.round((Math.random() * 100) * 100) / 100;
        } else {
          value = Math.floor(Math.random() * 50) + 1;
        }
        
        // Store using unique measure name to avoid collisions
        row.measures[measure.name] = value;
        row[measure.name] = value;
      });
      
      // Add metadata fields for image functionality and drill-down
      row.image_url = `https://example.com/images/sample_${i + 1}.jpg`;
      row.placement = `Placement ${(i % 4) + 1}`;
      row.submission_id = `sub_${1000 + i}`;
      row.site_id = `site_${(i % 3) + 1}`;
      row.program_id = `prog_${(i % 2) + 1}`;
      row.created_at = new Date(2023, 0, i + 1).toISOString();
      
      sampleData.push(row);
    }

    return {
      data: sampleData,
      totalCount: sampleData.length,
      filteredCount: sampleData.length,
      executionTime,
      cacheHit: false,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dimensions: config.dimensions,
        measures: config.measures,
        filters: config.filters
      }
    };
  }

  // Get available dimensions based on data sources
  static getAvailableDimensions(dataSources: DataSource[]): Dimension[] {
    const dimensions: Dimension[] = [];
    
    dataSources.forEach(dataSource => {
      dataSource.fields.forEach(field => {
        if (field.type === 'text' || field.type === 'date' || field.type === 'datetime') {
          dimensions.push({
            id: `${dataSource.id}_${field.name}`,
            name: field.displayName,
            field: field.name,
            dataType: field.type,
            source: dataSource.id,
            displayName: field.displayName,
            description: `${field.displayName} from ${dataSource.name}`
          });
        }
      });
    });
    
    return dimensions;
  }

  // Get available measures based on data sources
  static getAvailableMeasures(dataSources: DataSource[]): Measure[] {
    const measures: Measure[] = [];
    
    dataSources.forEach(dataSource => {
      dataSource.fields.forEach(field => {
        if (field.type === 'integer' || field.type === 'numeric') {
          // Add different aggregation types for numeric fields
          const aggregations = ['count', 'sum', 'avg', 'min', 'max'];
          aggregations.forEach(agg => {
            measures.push({
              id: `${dataSource.id}_${field.name}_${agg}`,
              name: `${field.displayName} (${agg.toUpperCase()})`,
              field: field.name,
              dataType: field.type,
              aggregation: agg as any,
              dataSource: dataSource.id,
              description: `${agg.toUpperCase()} of ${field.displayName} from ${dataSource.name}`
            });
          });
        }
      });
      
      // Add count measure for any table
      measures.push({
        id: `${dataSource.id}_count`,
        name: `Record Count`,
        field: '*',
        dataType: 'integer',
        aggregation: 'count',
        dataSource: dataSource.id,
        description: `Count of records from ${dataSource.name}`
      });
    });
    
    return measures;
  }

  // Get available filter fields
  static async getAvailableFilterFields(dataSources: DataSource[]): Promise<Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string; }>> {
    const filterFields: Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string; }> = [];
    
    dataSources.forEach(dataSource => {
      dataSource.fields.forEach(field => {
        filterFields.push({
          id: `${dataSource.id}_${field.name}`,
          name: field.name,
          displayName: field.displayName,
          dataType: field.type,
          source: dataSource.id,
          field: field.name
        });
      });
    });
    
    return filterFields;
  }

  // Get available data sources
  static getAvailableDataSources(): DataSource[] {
    return [
      {
        id: 'petri_observations_with_names',
        name: 'Petri Observations (with Site Names)',
        table: 'petri_observations_with_names',
        description: 'Petri dish observation data with human-readable site and program names',
        isPrimary: true,
        fields: [
          { name: 'petri_code', type: 'text', displayName: 'Petri Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'site_name', type: 'text', displayName: 'Site Name' },
          { name: 'site_code', type: 'text', displayName: 'Site Code' },
          { name: 'site_location', type: 'text', displayName: 'Site Location' },
          { name: 'site_type', type: 'text', displayName: 'Site Type' },
          { name: 'program_id', type: 'text', displayName: 'Program ID' },
          { name: 'program_name', type: 'text', displayName: 'Program Name' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'global_submission_id', type: 'text', displayName: 'Global Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'updated_at', type: 'datetime', displayName: 'Updated Date' },
          { name: 'growth_index', type: 'numeric', displayName: 'Growth Index' },
          { name: 'petri_growth_stage', type: 'text', displayName: 'Growth Stage' },
          { name: 'experiment_role', type: 'text', displayName: 'Experiment Role' },
          { name: 'placement', type: 'text', displayName: 'Placement' },
          { name: 'x_position', type: 'numeric', displayName: 'X Position' },
          { name: 'y_position', type: 'numeric', displayName: 'Y Position' },
          { name: 'todays_day_of_phase', type: 'numeric', displayName: 'Days in Phase' }
        ]
      },
      {
        id: 'petri_observations',
        name: 'Petri Observations',
        table: 'petri_observations_partitioned',
        description: 'Petri dish observation data',
        isPrimary: false,
        fields: [
          { name: 'petri_code', type: 'text', displayName: 'Petri Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'updated_at', type: 'datetime', displayName: 'Updated Date' },
          { name: 'growth_index', type: 'numeric', displayName: 'Growth Index' },
          { name: 'petri_growth_stage', type: 'text', displayName: 'Growth Stage' },
          { name: 'experiment_role', type: 'text', displayName: 'Experiment Role' },
          { name: 'placement', type: 'text', displayName: 'Placement' },
          { name: 'x_position', type: 'numeric', displayName: 'X Position' },
          { name: 'y_position', type: 'numeric', displayName: 'Y Position' },
          { name: 'todays_day_of_phase', type: 'numeric', displayName: 'Days in Phase' }
        ]
      },
      {
        id: 'gasifier_observations_with_names',
        name: 'Gasifier Observations (with Site Names)',
        table: 'gasifier_observations_with_names',
        description: 'Gasifier observation data with human-readable site and program names',
        isPrimary: false,
        fields: [
          { name: 'gasifier_code', type: 'text', displayName: 'Gasifier Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'site_name', type: 'text', displayName: 'Site Name' },
          { name: 'site_code', type: 'text', displayName: 'Site Code' },
          { name: 'site_location', type: 'text', displayName: 'Site Location' },
          { name: 'site_type', type: 'text', displayName: 'Site Type' },
          { name: 'program_id', type: 'text', displayName: 'Program ID' },
          { name: 'program_name', type: 'text', displayName: 'Program Name' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'global_submission_id', type: 'text', displayName: 'Global Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'chemical_type', type: 'text', displayName: 'Chemical Type' },
          { name: 'measure', type: 'numeric', displayName: 'Measure' },
          { name: 'linear_reading', type: 'numeric', displayName: 'Linear Reading' },
          { name: 'flow_rate', type: 'numeric', displayName: 'Flow Rate' },
          { name: 'placement_height', type: 'numeric', displayName: 'Placement Height' },
          { name: 'directional_placement', type: 'text', displayName: 'Directional Placement' },
          { name: 'outdoor_temperature', type: 'numeric', displayName: 'Outdoor Temperature' },
          { name: 'outdoor_humidity', type: 'numeric', displayName: 'Outdoor Humidity' }
        ]
      },
      {
        id: 'gasifier_observations',
        name: 'Gasifier Observations', 
        table: 'gasifier_observations_partitioned',
        description: 'Gasifier observation data',
        isPrimary: false,
        fields: [
          { name: 'gasifier_code', type: 'text', displayName: 'Gasifier Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'chemical_type', type: 'text', displayName: 'Chemical Type' },
          { name: 'measure', type: 'numeric', displayName: 'Measure' },
          { name: 'linear_reading', type: 'numeric', displayName: 'Linear Reading' },
          { name: 'flow_rate', type: 'numeric', displayName: 'Flow Rate' },
          { name: 'placement_height', type: 'numeric', displayName: 'Placement Height' },
          { name: 'directional_placement', type: 'text', displayName: 'Directional Placement' },
          { name: 'outdoor_temperature', type: 'numeric', displayName: 'Outdoor Temperature' },
          { name: 'outdoor_humidity', type: 'numeric', displayName: 'Outdoor Humidity' }
        ]
      },
      {
        id: 'submissions',
        name: 'Submissions',
        table: 'submissions',
        description: 'Data submission records',
        isPrimary: false,
        fields: [
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'global_submission_id', type: 'text', displayName: 'Global Submission ID' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'updated_at', type: 'datetime', displayName: 'Updated Date' },
          { name: 'status', type: 'text', displayName: 'Status' },
          { name: 'notes', type: 'text', displayName: 'Notes' }
        ]
      },
      {
        id: 'sites',
        name: 'Sites',
        table: 'sites',
        description: 'Site information and details',
        isPrimary: false,
        fields: [
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'site_code', type: 'text', displayName: 'Site Code' },
          { name: 'name', type: 'text', displayName: 'Site Name' },
          { name: 'site_type', type: 'text', displayName: 'Site Type' },
          { name: 'program_id', type: 'text', displayName: 'Program ID' },
          { name: 'location', type: 'text', displayName: 'Location' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'microbial_risk_zone', type: 'text', displayName: 'Microbial Risk Zone' },
          { name: 'length', type: 'numeric', displayName: 'Length' },
          { name: 'width', type: 'numeric', displayName: 'Width' },
          { name: 'height', type: 'numeric', displayName: 'Height' }
        ]
      },
      {
        id: 'pilot_programs',
        name: 'Pilot Programs',
        table: 'pilot_programs',
        description: 'Pilot program information',
        isPrimary: false,
        fields: [
          { name: 'program_id', type: 'text', displayName: 'Program ID' },
          { name: 'program_name', type: 'text', displayName: 'Program Name' },
          { name: 'description', type: 'text', displayName: 'Description' },
          { name: 'start_date', type: 'date', displayName: 'Start Date' },
          { name: 'end_date', type: 'date', displayName: 'End Date' },
          { name: 'status', type: 'text', displayName: 'Status' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'phase_type', type: 'text', displayName: 'Phase Type' }
        ]
      },
      {
        id: 'petri_observations_raw',
        name: 'Petri Observations (Raw)',
        table: 'petri_observations',
        description: 'Non-partitioned petri observation data',
        isPrimary: false,
        fields: [
          { name: 'petri_code', type: 'text', displayName: 'Petri Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'updated_at', type: 'datetime', displayName: 'Updated Date' },
          { name: 'growth_index', type: 'numeric', displayName: 'Growth Index' },
          { name: 'petri_growth_stage', type: 'text', displayName: 'Growth Stage' },
          { name: 'fungicide_used', type: 'text', displayName: 'Fungicide Used' },
          { name: 'placement', type: 'text', displayName: 'Placement' }
        ]
      },
      {
        id: 'gasifier_observations_raw',
        name: 'Gasifier Observations (Raw)',
        table: 'gasifier_observations',
        description: 'Non-partitioned gasifier observation data',
        isPrimary: false,
        fields: [
          { name: 'gasifier_code', type: 'text', displayName: 'Gasifier Code' },
          { name: 'site_id', type: 'text', displayName: 'Site ID' },
          { name: 'submission_id', type: 'text', displayName: 'Submission ID' },
          { name: 'created_at', type: 'datetime', displayName: 'Created Date' },
          { name: 'chemical_type', type: 'text', displayName: 'Chemical Type' },
          { name: 'measure', type: 'numeric', displayName: 'Measure' },
          { name: 'linear_reading', type: 'numeric', displayName: 'Linear Reading' },
          { name: 'flow_rate', type: 'numeric', displayName: 'Flow Rate' }
        ]
      }
    ];
  }
}