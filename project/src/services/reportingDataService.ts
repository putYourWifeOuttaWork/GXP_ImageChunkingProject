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
  
  // Clear all cached query results
  static clearAllCaches(): void {
    try {
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

    // Build select fields including all important metadata
    const selectFields = [];
    
    // Add dimension fields
    config.dimensions.forEach(dim => {
      selectFields.push(dim.field);
    });
    
    // Add measure fields  
    config.measures.forEach(measure => {
      selectFields.push(measure.field);
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
          
          if (config.segmentBy.includes('program_id') && validSelectFields.includes('program_id')) {
            nestedSelects.push('pilot_programs!program_id(program_id,name,start_date,end_date)');
          }
          
          if (config.segmentBy.includes('site_id') && validSelectFields.includes('site_id')) {
            nestedSelects.push('sites!site_id(site_id,name,site_code)');
          }
          
          if (config.segmentBy.includes('submission_id') && validSelectFields.includes('submission_id')) {
            nestedSelects.push('submissions!submission_id(submission_id,global_submission_id)');
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
        
        if (config.segmentBy.includes('program_id') && selectFields.includes('program_id')) {
          nestedSelects.push('pilot_programs!program_id(program_id,name,start_date,end_date)');
        }
        
        if (config.segmentBy.includes('site_id') && selectFields.includes('site_id')) {
          nestedSelects.push('sites!site_id(site_id,name,site_code)');
        }
        
        if (config.segmentBy.includes('submission_id') && selectFields.includes('submission_id')) {
          nestedSelects.push('submissions!submission_id(submission_id,global_submission_id)');
        }
        
        if (nestedSelects.length > 0) {
          selectString = `${selectString}, ${nestedSelects.join(', ')}`;
        }
      }
      
      var query = supabase
        .from(mainSource.table)
        .select(selectString);
      var actualTableColumns: string[] = [];
    }

    // Apply filters - only those that belong to the current table
    if (config.filters && config.filters.length > 0) {
      // Filter out filters that don't belong to the current table
      // Only use actual table columns, not configured fields
      const actualColumns = actualTableColumns || [];
      const applicableFilters = config.filters.filter(filter => 
        actualColumns.includes(filter.field)
      );
      
      console.log('Applying filters:', applicableFilters);
      console.log('Skipping filters not in table:', config.filters.filter(f => !applicableFilters.includes(f)));
      
      applicableFilters.forEach(filter => {
        if (filter.field && filter.operator && filter.value) {
          console.log(`Applying filter: ${filter.field} ${filter.operator} ${filter.value}`);
          
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
            default:
              query = query.eq(filter.field, filter.value);
          }
        }
      });
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
    const processedData = data.map(row => {
      // Extract segment values and their display names
      const segmentData: any = {};
      const segmentMetadata: any = {};
      
      if (config.segmentBy && config.segmentBy.length > 0) {
        config.segmentBy.forEach(segment => {
          segmentData[`segment_${segment}`] = row[segment];
          
          // Extract nested relationship data for display names
          if (segment === 'program_id' && row.pilot_programs) {
            segmentMetadata[`${segment}_name`] = row.pilot_programs.name;
            segmentMetadata[`${segment}_start_date`] = row.pilot_programs.start_date;
            segmentMetadata[`${segment}_end_date`] = row.pilot_programs.end_date;
          } else if (segment === 'site_id' && row.sites) {
            segmentMetadata[`${segment}_name`] = row.sites.name;
            segmentMetadata[`${segment}_code`] = row.sites.site_code;
          } else if (segment === 'submission_id' && row.submissions) {
            segmentMetadata[`${segment}_global`] = row.submissions.global_submission_id;
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
        const applicableFilters = config.filters.filter(filter => {
          // Check if field exists in actual table columns
          const fieldExists = actualColumns.length > 0 
            ? actualColumns.includes(filter.field)
            : mainSource.fields.some(f => f.name === filter.field);
          
          if (!fieldExists) {
            console.warn(`Filter field '${filter.field}' not found in table '${mainSource.table}', skipping`);
          }
          
          return fieldExists;
        });
        
        console.log('Applying filters to aggregated query:', applicableFilters);
        console.log('Skipped filters:', config.filters.filter(f => !applicableFilters.includes(f)));
        
        applicableFilters.forEach(filter => {
          if (filter.field && filter.operator && filter.value) {
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
            }
          }
        });
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
        
        // Store in both the nested structure and flat structure for compatibility
        row.measures[measure.field] = value;
        row[measure.name] = value;
        row[measure.field] = value; // Also store by field name for direct access
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
        id: 'petri_observations',
        name: 'Petri Observations',
        table: 'petri_observations_partitioned',
        description: 'Petri dish observation data',
        isPrimary: true,
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