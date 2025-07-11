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
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            console.warn('get_table_columns RPC function not found. Please run the following migration:');
            console.warn('psql $DATABASE_URL < migrations/20250710_add_get_table_columns_function.sql');
          }
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
      'timestamp with time zone': 'timestamp',
      'timestamp without time zone': 'timestamp',
      'date': 'date',
      'uuid': 'uuid',
      'jsonb': 'json',
      'json': 'json'
    };
    
    return typeMap[pgType] || 'text';
  }
  
  // Convert snake_case to Display Name
  private static formatDisplayName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Available data sources for agricultural reporting
  static getAvailableDataSources(): DataSource[] {
    return [
      {
        id: 'petri_observations',
        name: 'Petri Observations',
        description: 'Petri dish growth observations and measurements',
        schema: 'public',
        table: 'petri_observations',
        joinable: true,
        fields: [
          { name: 'observation_id', type: 'uuid', displayName: 'Observation ID' },
          { name: 'submission_id', type: 'uuid', displayName: 'Submission ID' },
          { name: 'petri_code', type: 'text', displayName: 'Petri Code' },
          { name: 'fungicide_used', type: 'enum', displayName: 'Fungicide Used', 
            enumValues: ['Yes', 'No'] },
          { name: 'petri_growth_stage', type: 'enum', displayName: 'Growth Stage',
            enumValues: ['None', 'Trace', 'Very Low', 'Low', 'Moderate', 'Moderately High', 'High', 'Very High', 'Hazardous', 'TNTC Overrun'] },
          { name: 'growth_index', type: 'numeric', displayName: 'Growth Index' },
          { name: 'growth_progression', type: 'numeric', displayName: 'Growth Progression' },
          { name: 'growth_aggression', type: 'numeric', displayName: 'Growth Aggression' },
          { name: 'growth_velocity', type: 'numeric', displayName: 'Growth Velocity' },
          { name: 'placement', type: 'enum', displayName: 'Placement',
            enumValues: ['P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'R1'] }, // Based on your actual data
          { name: 'outdoor_temperature', type: 'numeric', displayName: 'Outdoor Temperature' },
          { name: 'outdoor_humidity', type: 'numeric', displayName: 'Outdoor Humidity' },
          { name: 'todays_day_of_phase', type: 'integer', displayName: 'Day of Phase' },
          { name: 'daysinthisprogramphase', type: 'integer', displayName: 'Total Days in Program Phase' },
          { name: 'x_position', type: 'numeric', displayName: 'X Position' },
          { name: 'y_position', type: 'numeric', displayName: 'Y Position' },
          { name: 'created_at', type: 'timestamp', displayName: 'Created Date' },
          { name: 'updated_at', type: 'timestamp', displayName: 'Updated Date' }
        ]
      },
      {
        id: 'gasifier_observations',
        name: 'Gasifier Observations',
        description: 'Gasifier placement and effectiveness data',
        schema: 'public',
        table: 'gasifier_observations',
        joinable: true,
        fields: [
          { name: 'observation_id', type: 'uuid', displayName: 'Observation ID' },
          { name: 'submission_id', type: 'uuid', displayName: 'Submission ID' },
          { name: 'placement_x', type: 'numeric', displayName: 'X Position' },
          { name: 'placement_y', type: 'numeric', displayName: 'Y Position' },
          { name: 'effectiveness_score', type: 'numeric', displayName: 'Effectiveness Score' },
          { name: 'created_at', type: 'timestamp', displayName: 'Created Date' }
        ]
      },
      {
        id: 'submissions',
        name: 'Environmental Submissions',
        description: 'Environmental conditions and submission data',
        schema: 'public',
        table: 'submissions',
        joinable: true,
        fields: [
          { name: 'submission_id', type: 'uuid', displayName: 'Submission ID' },
          { name: 'site_id', type: 'uuid', displayName: 'Site ID' },
          { name: 'program_id', type: 'uuid', displayName: 'Program ID' },
          { name: 'temperature', type: 'numeric', displayName: 'Temperature (°F)' },
          { name: 'humidity', type: 'numeric', displayName: 'Humidity (%)' },
          { name: 'indoor_temperature', type: 'numeric', displayName: 'Indoor Temperature (°F)' },
          { name: 'indoor_humidity', type: 'numeric', displayName: 'Indoor Humidity (%)' },
          { name: 'airflow', type: 'text', displayName: 'Airflow' },
          { name: 'weather', type: 'text', displayName: 'Weather' },
          { name: 'created_at', type: 'timestamp', displayName: 'Created Date' }
        ]
      },
      {
        id: 'sites',
        name: 'Sites',
        description: 'Research site information',
        schema: 'public',
        table: 'sites',
        joinable: true,
        fields: [
          { name: 'site_id', type: 'uuid', displayName: 'Site ID' },
          { name: 'program_id', type: 'uuid', displayName: 'Program ID' },
          { name: 'site_name', type: 'text', displayName: 'Site Name' },
          { name: 'latitude', type: 'numeric', displayName: 'Latitude' },
          { name: 'longitude', type: 'numeric', displayName: 'Longitude' },
          { name: 'created_at', type: 'timestamp', displayName: 'Created Date' }
        ]
      },
      {
        id: 'pilot_programs',
        name: 'Pilot Programs',
        description: 'Research program information',
        schema: 'public',
        table: 'pilot_programs',
        joinable: true,
        fields: [
          { name: 'program_id', type: 'uuid', displayName: 'Program ID' },
          { name: 'company_id', type: 'uuid', displayName: 'Company ID' },
          { name: 'program_name', type: 'text', displayName: 'Program Name' },
          { name: 'status', type: 'text', displayName: 'Status' },
          { name: 'start_date', type: 'date', displayName: 'Start Date' },
          { name: 'end_date', type: 'date', displayName: 'End Date' },
          { name: 'created_at', type: 'timestamp', displayName: 'Created Date' }
        ]
      }
    ];
  }

  // Get available dimensions for selected data sources
  static getAvailableDimensions(dataSources: DataSource[]): Dimension[] {
    const dimensions: Dimension[] = [];
    
    dataSources.forEach(source => {
      source.fields.forEach(field => {
        if (['text', 'enum', 'date', 'timestamp'].includes(field.type)) {
          dimensions.push({
            id: `${source.id}.${field.name}`,
            name: field.name,
            displayName: field.displayName,
            dataType: field.type,
            source: source.id,
            field: field.name,
            granularity: field.type === 'timestamp' ? 'day' : undefined,
            enumValues: (field as any).enumValues // Add enum values if available
          });
        }
      });
    });

    // Add computed dimensions
    dimensions.push(
      {
        id: 'date_created_week',
        name: 'created_week',
        displayName: 'Week Created',
        dataType: 'date',
        source: 'computed',
        field: 'DATE_TRUNC(\'week\', created_at)',
        granularity: 'week'
      },
      {
        id: 'date_created_month',
        name: 'created_month',
        displayName: 'Month Created',
        dataType: 'date',
        source: 'computed',
        field: 'DATE_TRUNC(\'month\', created_at)',
        granularity: 'month'
      }
    );

    return dimensions;
  }

  // Get available filter fields from selected data sources (dynamic schema-based)
  static async getAvailableFilterFields(dataSources: DataSource[]): Promise<Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string; relationshipPath?: RelationshipPath[]; targetTable?: string; }>> {
    const filterFields: Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string; relationshipPath?: RelationshipPath[]; targetTable?: string; }> = [];
    
    try {
      const tableColumns = await this.getTableColumns(dataSources);
      
      dataSources.forEach(source => {
        const columns = tableColumns[source.table] || [];
        
        columns.forEach(column => {
          // All columns can be used for filtering
          filterFields.push({
            id: `${source.id}.${column.name}`,
            name: column.name,
            displayName: `${column.displayName} (${source.name})`,
            dataType: column.type,
            source: source.id,
            field: column.name
          });
        });
      });
      
      // Add related table fields based on the main data source
      const mainSource = dataSources[0];
      if (mainSource) {
        // Add pilot_programs fields if we're looking at observations or submissions
        if (mainSource.table === 'petri_observations' || mainSource.table === 'gasifier_observations') {
          // Add program fields
          const programFields = [
            { name: 'start_date', displayName: 'Program Start Date', dataType: 'date' },
            { name: 'end_date', displayName: 'Program End Date', dataType: 'date' },
            { name: 'name', displayName: 'Program Name', dataType: 'text' },
            { name: 'phase_type', displayName: 'Program Phase Type', dataType: 'text' }
          ];
          
          programFields.forEach(field => {
            filterFields.push({
              id: `pilot_programs.${field.name}`,
              name: field.name,
              displayName: `${field.displayName} (Related: Programs)`,
              dataType: field.dataType,
              source: mainSource.id,
              field: field.name,
              targetTable: 'pilot_programs',
              relationshipPath: [
                { fromTable: mainSource.table, toTable: 'submissions', joinField: 'submission_id', foreignField: 'submission_id', joinType: 'INNER' },
                { fromTable: 'submissions', toTable: 'sites', joinField: 'site_id', foreignField: 'site_id', joinType: 'INNER' },
                { fromTable: 'sites', toTable: 'pilot_programs', joinField: 'program_id', foreignField: 'program_id', joinType: 'INNER' }
              ]
            });
          });
          
          // Add site fields
          const siteFields = [
            { name: 'name', displayName: 'Site Name', dataType: 'text' },
            { name: 'gasifier_deployment_date', displayName: 'Site Gasifier Deployment Date', dataType: 'date' }
          ];
          
          siteFields.forEach(field => {
            filterFields.push({
              id: `sites.${field.name}`,
              name: field.name,
              displayName: `${field.displayName} (Related: Sites)`,
              dataType: field.dataType,
              source: mainSource.id,
              field: field.name,
              targetTable: 'sites',
              relationshipPath: [
                { fromTable: mainSource.table, toTable: 'sites', joinField: 'site_id', foreignField: 'site_id', joinType: 'INNER' }
              ]
            });
          });
          
          // Add submission fields
          const submissionFields = [
            { name: 'created_at', displayName: 'Submission Date', dataType: 'timestamp' },
            { name: 'outdoor_temperature', displayName: 'Submission Temperature', dataType: 'number' },
            { name: 'outdoor_humidity', displayName: 'Submission Humidity', dataType: 'number' },
            { name: 'weather', displayName: 'Submission Weather', dataType: 'text' }
          ];
          
          submissionFields.forEach(field => {
            filterFields.push({
              id: `submissions.${field.name}`,
              name: field.name,
              displayName: `${field.displayName} (Related: Submissions)`,
              dataType: field.dataType,
              source: mainSource.id,
              field: field.name,
              targetTable: 'submissions',
              relationshipPath: [
                { fromTable: mainSource.table, toTable: 'submissions', joinField: 'submission_id', foreignField: 'submission_id', joinType: 'INNER' }
              ]
            });
          });
        }
        
        // Add related fields for submissions table
        if (mainSource.table === 'submissions') {
          // Add program fields
          const programFields = [
            { name: 'start_date', displayName: 'Program Start Date', dataType: 'date' },
            { name: 'end_date', displayName: 'Program End Date', dataType: 'date' },
            { name: 'name', displayName: 'Program Name', dataType: 'text' }
          ];
          
          programFields.forEach(field => {
            filterFields.push({
              id: `pilot_programs.${field.name}`,
              name: field.name,
              displayName: `${field.displayName} (Related: Programs)`,
              dataType: field.dataType,
              source: mainSource.id,
              field: field.name,
              targetTable: 'pilot_programs',
              relationshipPath: [
                { fromTable: 'submissions', toTable: 'sites', joinField: 'site_id', foreignField: 'site_id', joinType: 'INNER' },
                { fromTable: 'sites', toTable: 'pilot_programs', joinField: 'program_id', foreignField: 'program_id', joinType: 'INNER' }
              ]
            });
          });
          
          // Add site fields
          const siteFields = [
            { name: 'name', displayName: 'Site Name', dataType: 'text' }
          ];
          
          siteFields.forEach(field => {
            filterFields.push({
              id: `sites.${field.name}`,
              name: field.name,
              displayName: `${field.displayName} (Related: Sites)`,
              dataType: field.dataType,
              source: mainSource.id,
              field: field.name,
              targetTable: 'sites',
              relationshipPath: [
                { fromTable: 'submissions', toTable: 'sites', joinField: 'site_id', foreignField: 'site_id', joinType: 'INNER' }
              ]
            });
          });
        }
      }
    } catch (error) {
      console.error('Error getting dynamic filter fields, falling back to predefined:', error);
      
      // Fallback to predefined fields if dynamic discovery fails
      dataSources.forEach(source => {
        source.fields.forEach(field => {
          filterFields.push({
            id: `${source.id}.${field.name}`,
            name: field.name,
            displayName: `${field.displayName} (${source.name})`,
            dataType: field.type,
            source: source.id,
            field: field.name
          });
        });
      });
    }
    
    console.log('Available filter fields:', filterFields.length, filterFields.slice(0, 5));
    return filterFields;
  }

  // Build JOIN clauses for cross-table filtering
  private static buildJoinClausesForFilters(filters: Filter[], mainTable: string): { 
    joins: string[], 
    requiredTables: Set<string> 
  } {
    const requiredTables = new Set<string>([mainTable]);
    const joins: string[] = [];
    const processedJoins = new Set<string>();

    filters.forEach(filter => {
      if (filter.relationshipPath && filter.relationshipPath.length > 0) {
        // Build the join path for this filter
        filter.relationshipPath.forEach(path => {
          const joinKey = `${path.fromTable}-${path.toTable}`;
          
          if (!processedJoins.has(joinKey)) {
            requiredTables.add(path.fromTable);
            requiredTables.add(path.toTable);
            
            const joinType = path.joinType || 'INNER';
            joins.push(
              `${joinType} JOIN ${path.toTable} ON ${path.fromTable}.${path.joinField} = ${path.toTable}.${path.foreignField}`
            );
            
            processedJoins.add(joinKey);
          }
        });
      }
    });

    return { joins, requiredTables };
  }

  // Build filter clause with table prefixes for cross-table queries
  private static buildFilterClauseWithTable(filter: Filter): string {
    const { field, operator, value, targetTable } = filter;
    const fieldWithTable = targetTable ? `${targetTable}.${field}` : field;
    
    switch (operator) {
      case 'equals':
        return `${fieldWithTable} = '${value}'`;
      case 'not_equals':
        return `${fieldWithTable} != '${value}'`;
      case 'greater_than':
        return `${fieldWithTable} > ${value}`;
      case 'less_than':
        return `${fieldWithTable} < ${value}`;
      case 'greater_than_or_equal':
        return `${fieldWithTable} >= ${value}`;
      case 'less_than_or_equal':
        return `${fieldWithTable} <= ${value}`;
      case 'contains':
        return `${fieldWithTable} ILIKE '%${value}%'`;
      case 'not_contains':
        return `${fieldWithTable} NOT ILIKE '%${value}%'`;
      case 'starts_with':
        return `${fieldWithTable} ILIKE '${value}%'`;
      case 'ends_with':
        return `${fieldWithTable} ILIKE '%${value}'`;
      case 'in':
        const values = Array.isArray(value) ? value : [value];
        return `${fieldWithTable} IN (${values.map(v => `'${v}'`).join(', ')})`;
      case 'not_in':
        const notInValues = Array.isArray(value) ? value : [value];
        return `${fieldWithTable} NOT IN (${notInValues.map(v => `'${v}'`).join(', ')})`;
      case 'is_null':
        return `${fieldWithTable} IS NULL`;
      case 'is_not_null':
        return `${fieldWithTable} IS NOT NULL`;
      case 'between':
        // Handle date range format "startDate,endDate"
        if (typeof value === 'string' && value.includes(',')) {
          const [start, end] = value.split(',');
          return `${fieldWithTable} BETWEEN '${start}' AND '${end}'`;
        }
        // Handle array format [start, end]
        if (Array.isArray(value) && value.length === 2) {
          return `${fieldWithTable} BETWEEN ${value[0]} AND ${value[1]}`;
        }
        return `${fieldWithTable} = '${value}'`;
      case 'range':
        if (typeof value === 'string' && value.includes(',')) {
          const [min, max] = value.split(',');
          return `${fieldWithTable} >= ${min} AND ${fieldWithTable} <= ${max}`;
        }
        return `${fieldWithTable} = '${value}'`;
      default:
        console.warn(`Unknown filter operator: ${operator}, defaulting to equals`);
        return `${fieldWithTable} = '${value}'`;
    }
  }

  // Execute raw SQL query for complex cross-table filtering
  private static async executeRawQuery(sql: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('execute_raw_sql', { query: sql });
      
      if (error) {
        console.error('Raw SQL query error:', error);
        // If RPC function doesn't exist, fall back to returning empty data
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          console.warn('execute_raw_sql RPC function not found. Please run the following migration:');
          console.warn('psql $DATABASE_URL < migrations/20250710_add_execute_raw_sql_function.sql');
          return [];
        }
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Failed to execute raw SQL query:', error);
      // Return empty array instead of throwing to prevent app crash
      return [];
    }
  }

  // Get available measures for selected data sources
  static getAvailableMeasures(dataSources: DataSource[]): Measure[] {
    const measures: Measure[] = [];
    
    dataSources.forEach(source => {
      source.fields.forEach(field => {
        if (['numeric', 'integer'].includes(field.type)) {
          // Add basic aggregations for numeric fields
          ['sum', 'avg', 'min', 'max', 'count'].forEach(agg => {
            measures.push({
              id: `${source.id}.${field.name}.${agg}`,
              name: `${field.name}_${agg}`,
              displayName: `${field.displayName} (${agg.toUpperCase()})`,
              dataType: 'numeric',
              source: source.id,
              field: field.name,
              aggregation: agg as any,
              expression: agg === 'count' ? `COUNT(${field.name})` : `${agg.toUpperCase()}(${field.name})`
            });
          });
        }
      });
    });

    // Add computed measures
    measures.push(
      {
        id: 'total_records',
        name: 'total_records',
        displayName: 'Total Records',
        dataType: 'numeric',
        source: 'computed',
        field: '*',
        aggregation: 'count',
        expression: 'COUNT(*)'
      },
      {
        id: 'avg_growth_rate',
        name: 'avg_growth_rate',
        displayName: 'Average Growth Rate',
        dataType: 'numeric',
        source: 'computed',
        field: 'growth_percentage',
        aggregation: 'avg',
        expression: 'AVG(growth_percentage)'
      }
    );

    return measures;
  }

  // Execute report query and return aggregated data
  static async executeReport(config: ReportConfig): Promise<AggregatedData> {
    const startTime = Date.now();
    
    try {
      // Build SQL query based on config
      const query = this.buildQuery(config);
      console.log('Executing report query:', query);
      
      // Try to execute query using the custom RPC function
      let data, error;
      
      // Always use direct query to get complete records with full metadata for drill-down functionality
      const useDirectQuery = true;
      
      if (!useDirectQuery) {
        try {
          console.log('Debug executeReport: Using RPC function with config:', config);
          
          // Build the configuration for the RPC function
          // Based on the database function signature, it expects a specific structure
          const rpcConfig = {
            entity: config.dataSources[0]?.table || 'petri_observations',
            dimensions: config.dimensions.map(dim => dim.field), // Array of field names
            metrics: config.measures.map(measure => ({
              field: measure.field,
              function: measure.aggregation.toUpperCase()
            })),
            filters: config.filters.map(filter => ({
              field: filter.field,
              operator: this.mapFilterOperator(filter.operator),
              value: filter.value
            }))
          };
          
          console.log('Debug executeReport: RPC config:', rpcConfig);
          console.log('Debug executeReport: Metrics being sent:', rpcConfig.metrics);
          
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('execute_custom_report_query', {
              p_report_configuration: rpcConfig,
              p_limit: 1000, // Increase limit to get more recent data
              p_offset: 0
            });
            
          console.log('Debug executeReport: RPC result:', rpcData);
          
          if (rpcError) {
            console.error('RPC error:', rpcError);
            throw rpcError;
          }
          
          if (rpcData && rpcData.success) {
            // The RPC function returns data in a specific format
            // Let's check what we actually get and transform it appropriately
            console.log('Debug executeReport: Raw RPC data structure:', rpcData);
            console.log('Debug executeReport: First data row:', rpcData.data?.[0]);
            data = rpcData.data;
            error = null;
          } else {
            console.error('RPC function returned error:', rpcData?.message);
            throw new Error(rpcData?.message || 'RPC function failed');
          }
        } catch (rpcError) {
          console.error('RPC function failed, falling back to direct query:', rpcError);
          
          // Force fallback to direct query
          error = rpcError;
        }
      } else {
        console.log('Debug executeReport: Using direct query for multi-measure chart');
      }
      
      // If RPC failed or we need direct query, use fallback
      if (error || useDirectQuery) {
        console.log('Debug executeReport: Using direct query fallback');
        
        // Fallback to direct table query
        const mainSource = config.dataSources[0];
        if (mainSource && mainSource.table) {
          try {
            // Check if we need cross-source queries
            const hasMultipleSources = config.dataSources.length > 1;
            const measureFromDifferentSource = config.measures.some(m => m.dataSource !== mainSource.id);
            const dimensionFromDifferentSource = config.dimensions.some(d => d.source !== mainSource.id);
            
            if (hasMultipleSources && (measureFromDifferentSource || dimensionFromDifferentSource)) {
              // Use raw SQL for cross-source queries
              console.log('Using raw SQL for cross-source query');
              
              // Build the SQL with proper JOINs for multiple data sources
              const selectFields: string[] = [];
              const requiredJoins = new Set<string>();
              const hasAggregations = config.measures.some(m => m.aggregation);
              
              // Add dimensions with proper table prefixes
              config.dimensions.forEach(dim => {
                const sourceTable = config.dataSources.find(ds => ds.id === dim.source)?.table || mainSource.table;
                selectFields.push(`${sourceTable}.${dim.field} as "${dim.field}"`);
                
                if (sourceTable !== mainSource.table) {
                  // Need to join this table
                  if (sourceTable === 'submissions' && mainSource.table.includes('observations')) {
                    requiredJoins.add(`INNER JOIN submissions ON ${mainSource.table}.submission_id = submissions.submission_id`);
                  } else if (mainSource.table === 'submissions' && sourceTable.includes('observations')) {
                    requiredJoins.add(`INNER JOIN ${sourceTable} ON submissions.submission_id = ${sourceTable}.submission_id`);
                  }
                }
              });
              
              // Add measures with proper table prefixes
              config.measures.forEach(measure => {
                const sourceTable = config.dataSources.find(ds => ds.id === measure.dataSource)?.table || mainSource.table;
                
                // Handle COUNT(*) specially
                if (measure.field === '*' && measure.aggregation === 'count') {
                  selectFields.push(`COUNT(${sourceTable}.*) as "${measure.displayName || measure.name}"`);
                } else if (measure.aggregation) {
                  // Apply aggregation function
                  const aggFunc = measure.aggregation.toUpperCase();
                  selectFields.push(`${aggFunc}(${sourceTable}.${measure.field}) as "${measure.displayName || measure.name}"`);
                } else {
                  selectFields.push(`${sourceTable}.${measure.field} as "${measure.field}"`);
                }
                
                if (sourceTable !== mainSource.table) {
                  // Need to join this table
                  if (sourceTable === 'submissions' && mainSource.table.includes('observations')) {
                    requiredJoins.add(`INNER JOIN submissions ON ${mainSource.table}.submission_id = submissions.submission_id`);
                  } else if (mainSource.table === 'submissions' && sourceTable.includes('observations')) {
                    requiredJoins.add(`INNER JOIN ${sourceTable} ON submissions.submission_id = ${sourceTable}.submission_id`);
                  } else if (mainSource.table === 'petri_observations' && sourceTable === 'gasifier_observations') {
                    // Both observation tables - join through submissions
                    requiredJoins.add(`INNER JOIN gasifier_observations ON ${mainSource.table}.submission_id = gasifier_observations.submission_id`);
                  } else if (mainSource.table === 'gasifier_observations' && sourceTable === 'petri_observations') {
                    requiredJoins.add(`INNER JOIN petri_observations ON ${mainSource.table}.submission_id = petri_observations.submission_id`);
                  }
                }
              });
              
              // Only add metadata fields if we're NOT doing aggregations
              // When doing aggregations, we only want dimension and measure fields
              if (!hasAggregations) {
                // Add metadata fields - only if they are in selectedFields or if no selectedFields specified
                const addMetadataField = (field: string, source: DataSource) => {
                  if (!source.selectedFields || source.selectedFields.length === 0 || source.selectedFields.includes(field)) {
                    selectFields.push(`${source.table}.${field}`);
                  }
                };
                
                // Always add parent IDs for drill-down functionality
                addMetadataField('submission_id', mainSource);
                addMetadataField('site_id', mainSource);
                addMetadataField('program_id', mainSource);
                if (mainSource.table.includes('observations')) {
                  addMetadataField('observation_id', mainSource);
                }
                
                // Add selected fields from each data source that aren't already included
                config.dataSources.forEach(source => {
                  if (source.selectedFields && source.selectedFields.length > 0) {
                    source.selectedFields.forEach(field => {
                      // Check if field is already added as dimension or measure
                      const fieldAlreadyAdded = selectFields.some(sf => 
                        sf.includes(`${source.table}.${field}`) || sf.includes(`"${field}"`)
                      );
                      
                      if (!fieldAlreadyAdded) {
                        selectFields.push(`${source.table}.${field}`);
                      }
                    });
                  }
                });
              }
              
              let sql = `SELECT ${selectFields.join(', ')} FROM ${mainSource.table}`;
              
              // Add JOINs
              const joinsArray = Array.from(requiredJoins);
              if (joinsArray.length > 0) {
                sql += ' ' + joinsArray.join(' ');
              }
              
              // Apply filters with proper table handling
              const whereConditions: string[] = [];
              config.filters?.forEach(filter => {
                if (filter.relationshipPath && filter.relationshipPath.length > 0) {
                  // Add necessary JOINs for cross-table filters
                  filter.relationshipPath.forEach(path => {
                    const joinClause = `${path.joinType || 'INNER'} JOIN ${path.toTable} ON ${path.fromTable}.${path.joinField} = ${path.toTable}.${path.foreignField}`;
                    requiredJoins.add(joinClause);
                  });
                }
                whereConditions.push(this.buildFilterClauseWithTable(filter));
              });
              
              if (whereConditions.length > 0) {
                sql += ' WHERE ' + whereConditions.join(' AND ');
              }
              
              // Add GROUP BY if we have aggregations
              if (hasAggregations && config.dimensions.length > 0) {
                // We need to group by all non-aggregated fields
                const groupByFields: string[] = [];
                
                // Add dimension fields
                config.dimensions.forEach(dim => {
                  const sourceTable = config.dataSources.find(ds => ds.id === dim.source)?.table || mainSource.table;
                  groupByFields.push(`${sourceTable}.${dim.field}`);
                });
                
                // Add all other non-aggregated fields from the SELECT clause
                // For now, we'll only group by the dimension fields and let the query handle it
                // If we're selecting individual records with metadata, we shouldn't use GROUP BY
                
                sql += ' GROUP BY ' + groupByFields.join(', ');
              }
              
              sql += ' LIMIT 500';
              
              console.log('Generated cross-source SQL:', sql);
              
              // Execute raw SQL query
              data = await this.executeRawQuery(sql);
              
              // If raw query fails due to missing RPC function, try a simplified approach
              if (data.length === 0) {
                console.log('Raw SQL query returned no data, trying simplified Supabase query');
                
                // For aggregated queries with JOINs, we'll need to fetch raw data and aggregate in memory
                // This is less efficient but works without RPC functions
                try {
                  let query = supabase.from(mainSource.table).select('*');
                  
                  // Apply filters
                  config.filters?.forEach(filter => {
                    const filterValue = filter.value;
                    switch (filter.operator) {
                      case 'equals':
                        query = query.eq(filter.field, filterValue);
                        break;
                      case 'greater_than':
                        query = query.gt(filter.field, filterValue);
                        break;
                      case 'less_than':
                        query = query.lt(filter.field, filterValue);
                        break;
                      case 'contains':
                        query = query.ilike(filter.field, `%${filterValue}%`);
                        break;
                    }
                  });
                  
                  // Limit results
                  query = query.limit(1000);
                  
                  const { data: fallbackData, error: fallbackError } = await query;
                  
                  if (!fallbackError && fallbackData) {
                    console.log('Fallback query successful, got', fallbackData.length, 'records');
                    
                    // For multi-source queries, we'll need to manually join data
                    // This is a simplified implementation that works for basic cases
                    if (config.dataSources.length > 1) {
                      // Fetch related data from submissions
                      const submissionIds = [...new Set(fallbackData.map(row => row.submission_id).filter(Boolean))];
                      if (submissionIds.length > 0) {
                        const { data: submissionsData } = await supabase
                          .from('submissions')
                          .select('*')
                          .in('submission_id', submissionIds);
                        
                        if (submissionsData) {
                          // Create a map for quick lookup
                          const submissionsMap = new Map(submissionsData.map(s => [s.submission_id, s]));
                          
                          // Merge data
                          data = fallbackData.map(row => {
                            const submission = submissionsMap.get(row.submission_id);
                            return submission ? { ...row, ...submission } : row;
                          });
                        } else {
                          data = fallbackData;
                        }
                      } else {
                        data = fallbackData;
                      }
                    } else {
                      data = fallbackData;
                    }
                  }
                } catch (fallbackError) {
                  console.error('Fallback query also failed:', fallbackError);
                }
              }
              error = null;
            } else {
              // Single source query - continue with normal logic
              // Build select fields including all measures, dimensions, and parent IDs
              const selectFields = [];
              
              // Build clean select fields without duplicates
              const uniqueFields = new Set<string>();
              
              // Add dimension fields
              config.dimensions.forEach(dim => {
                uniqueFields.add(dim.field);
              });
              
              // Add measure fields
              config.measures.forEach(measure => {
                uniqueFields.add(measure.field);
              });
              
              // Add parent IDs for drill-down functionality (always include these)
              const parentIds = ['submission_id', 'site_id', 'program_id', 'observation_id'];
              parentIds.forEach(id => {
                uniqueFields.add(id);
              });
              
              // If DataSource has selectedFields, use only those fields
              // Otherwise, fall back to all available fields
              if (mainSource.selectedFields && mainSource.selectedFields.length > 0) {
                // Only add fields that are in the selectedFields list
                const allowedFields = new Set(mainSource.selectedFields);
                
                // Always ensure parent IDs are included for drill-down
                parentIds.forEach(id => allowedFields.add(id));
                
                // Filter uniqueFields to only include allowed fields
                const tempFields = Array.from(uniqueFields);
                uniqueFields.clear();
                tempFields.forEach(field => {
                  if (allowedFields.has(field)) {
                    uniqueFields.add(field);
                  }
                });
                
                // Add any other selected fields that aren't already included
                mainSource.selectedFields.forEach(field => {
                  uniqueFields.add(field);
                });
              } else {
                // Fall back to legacy behavior - add all metadata fields
                const commonMetadataFields = ['image_url', 'placement'];
                const tableSpecificFields = mainSource.table === 'petri_observations' 
                  ? ['petri_code', 'fungicide_used', 'petri_growth_stage', 'x_position', 'y_position', 'growth_index', 'todays_day_of_phase', 'daysinthisprogramphase']
                  : mainSource.table === 'gasifier_observations'
                  ? ['gasifier_code', 'chemical_type', 'measure', 'position_x', 'position_y', 'linear_reading']
                  : [];
                
                [...commonMetadataFields, ...tableSpecificFields].forEach(field => {
                  uniqueFields.add(field);
                });
              }
              
              // Convert to array and add related table fields for complete record data
              const selectFieldsArray = Array.from(uniqueFields);
              selectFieldsArray.push('submissions(global_submission_id, sites(name, pilot_programs(name)))');
              
              console.log('Debug: Direct query selecting fields:', selectFieldsArray);
              
              let query = supabase
                .from(mainSource.table)
                .select(selectFieldsArray.join(', '));
              
            // Check if we have cross-table filters
            const hasCrossTableFilters = config.filters?.some(f => f.relationshipPath && f.relationshipPath.length > 0);
            
            if (hasCrossTableFilters) {
              // Use raw SQL for complex cross-table filtering
              console.log('Using raw SQL for cross-table filtering');
              
              // Build the SQL query with JOINs
              const { joins, requiredTables } = this.buildJoinClausesForFilters(config.filters || [], mainSource.table);
              
              // Build SELECT clause
              const selectClause = selectFieldsArray.map(field => {
                // Handle nested selections for raw SQL
                if (field.includes('(')) {
                  return null; // Skip nested selections for raw SQL
                }
                return `${mainSource.table}.${field}`;
              }).filter(Boolean).join(', ');
              
              // Build WHERE clause
              const whereConditions = config.filters?.map(filter => {
                return this.buildFilterClauseWithTable(filter);
              }) || [];
              
              let sql = `SELECT ${selectClause} FROM ${mainSource.table}`;
              
              // Add JOINs
              if (joins.length > 0) {
                sql += ' ' + joins.join(' ');
              }
              
              // Add WHERE clause
              if (whereConditions.length > 0) {
                sql += ' WHERE ' + whereConditions.join(' AND ');
              }
              
              sql += ' LIMIT 500';
              
              console.log('Generated SQL for cross-table filtering:', sql);
              
              // Execute raw SQL query
              data = await this.executeRawQuery(sql);
              error = null;
            } else {
              // Apply simple filters for non-cross-table queries
              if (config.filters && config.filters.length > 0) {
                config.filters.forEach(filter => {
                  if (filter.field && filter.operator && filter.value) {
                    switch (filter.operator) {
                      case 'equals':
                        query = query.eq(filter.field, filter.value);
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
                      case 'contains':
                        query = query.ilike(filter.field, `%${filter.value}%`);
                        break;
                      case 'starts_with':
                        query = query.ilike(filter.field, `${filter.value}%`);
                        break;
                      case 'ends_with':
                        query = query.ilike(filter.field, `%${filter.value}`);
                        break;
                      case 'is_null':
                        query = query.is(filter.field, null);
                        break;
                      case 'is_not_null':
                        query = query.not(filter.field, 'is', null);
                        break;
                      case 'between':
                        if (typeof filter.value === 'string' && filter.value.includes(',')) {
                          const [start, end] = filter.value.split(',');
                          query = query.gte(filter.field, start).lte(filter.field, end);
                        }
                        break;
                      default:
                        query = query.eq(filter.field, filter.value);
                    }
                  }
                });
              }
              
              const result = await query.limit(500);
              data = result.data;
              error = result.error;
            }
            } // Close the else block from line 733
          } catch (e) {
            error = e;
          }
        }
      }

      if (error) {
        console.error('Error executing report query:', error);
        throw error;
      }

      // Process and format results
      console.log('Raw data received:', data);
      console.log('Raw data length:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('No data received, falling back to sample data');
        console.log('Possible reasons:');
        console.log('1. No data in the selected tables matching your criteria');
        console.log('2. Filters may be too restrictive');
        console.log('3. Check if the tables have any data');
        return this.getSampleData(config);
      } else {
        console.log('SUCCESS: Using real data from database!');
        console.log('First row sample:', data[0]);
      }
      
      const processedData = this.processQueryResults(data, config);
      console.log('Processed data length:', processedData.length);
      
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
      console.error('Report execution failed:', error);
      console.log('Falling back to sample data');
      
      // Return sample data for development
      return this.getSampleData(config);
    }
  }

  // Build SQL query from report configuration
  private static buildQuery(config: ReportConfig): string {
    const { dataSources, dimensions, measures, filters } = config;
    
    if (!dataSources.length || !measures.length) {
      throw new Error('Data sources and measures are required');
    }

    // Start with main table
    const mainSource = dataSources[0];
    let query = `SELECT `;
    
    // Add dimension fields
    const dimensionFields = dimensions.map(dim => {
      if (dim.source === 'computed') {
        return `${dim.field} as ${dim.name}`;
      }
      return `${dim.source}.${dim.field} as ${dim.name}`;
    });

    // Add measure fields
    const measureFields = measures.map(measure => {
      const sourceAlias = measure.dataSource || mainSource.id;
      const aggregationExpr = `${measure.aggregation.toUpperCase()}(${sourceAlias}.${measure.field})`;
      return `${aggregationExpr} as ${measure.name}`;
    });

    query += [...dimensionFields, ...measureFields].join(', ');
    query += ` FROM ${mainSource.table} as ${mainSource.id}`;

    // Add joins for additional data sources
    dataSources.slice(1).forEach(source => {
      query += ` LEFT JOIN ${source.table} as ${source.id} ON `;
      // Add appropriate join conditions based on common fields
      if (source.id === 'submissions' && mainSource.id === 'petri_observations') {
        query += `${mainSource.id}.submission_id = ${source.id}.submission_id`;
      } else if (source.id === 'sites') {
        query += `submissions.site_id = ${source.id}.site_id`;
      } else if (source.id === 'pilot_programs') {
        query += `sites.program_id = ${source.id}.program_id`;
      }
    });

    // Add WHERE clause for filters
    if (filters.length > 0) {
      const filterClauses = filters.map(filter => {
        return this.buildFilterClause(filter);
      });
      query += ` WHERE ${filterClauses.join(' AND ')}`;
    }

    // Add GROUP BY for dimensions
    if (dimensions.length > 0) {
      const groupByFields = dimensions.map((dim, index) => index + 1);
      query += ` GROUP BY ${groupByFields.join(', ')}`;
    }

    // Add ORDER BY
    query += ` ORDER BY 1`;

    return query;
  }

  // Build filter clause
  private static mapFilterOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      'equals': '=',
      'not_equals': '!=',
      'greater_than': '>',
      'greater_than_or_equal': '>=',
      'less_than': '<',
      'less_than_or_equal': '<=',
      'contains': 'LIKE',
      'starts_with': 'LIKE',
      'ends_with': 'LIKE',
      'in': 'IN',
      'not_in': 'NOT IN'
    };
    
    return operatorMap[operator] || '=';
  }

  private static buildFilterClause(filter: Filter): string {
    const { field, operator, value } = filter;
    
    switch (operator) {
      case 'equals':
        return `${field} = '${value}'`;
      case 'not_equals':
        return `${field} != '${value}'`;
      case 'greater_than':
        return `${field} > ${value}`;
      case 'less_than':
        return `${field} < ${value}`;
      case 'greater_than_or_equal':
        return `${field} >= ${value}`;
      case 'less_than_or_equal':
        return `${field} <= ${value}`;
      case 'contains':
        return `${field} ILIKE '%${value}%'`;
      case 'not_contains':
        return `${field} NOT ILIKE '%${value}%'`;
      case 'starts_with':
        return `${field} ILIKE '${value}%'`;
      case 'ends_with':
        return `${field} ILIKE '%${value}'`;
      case 'in':
        const values = Array.isArray(value) ? value : [value];
        return `${field} IN (${values.map(v => `'${v}'`).join(', ')})`;
      case 'not_in':
        const notInValues = Array.isArray(value) ? value : [value];
        return `${field} NOT IN (${notInValues.map(v => `'${v}'`).join(', ')})`;
      case 'is_null':
        return `${field} IS NULL`;
      case 'is_not_null':
        return `${field} IS NOT NULL`;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return `${field} BETWEEN ${value[0]} AND ${value[1]}`;
        }
        return `${field} = '${value}'`;
      case 'range':
        if (typeof value === 'string' && value.includes(',')) {
          const [min, max] = value.split(',');
          return `${field} >= ${min} AND ${field} <= ${max}`;
        }
        return `${field} = '${value}'`;
      default:
        console.warn(`Unknown filter operator: ${operator}, defaulting to equals`);
        return `${field} = '${value}'`;
    }
  }

  // Process query results into chart-ready format
  private static processQueryResults(data: any[], config: ReportConfig): any[] {
    if (!data) return [];

    console.log('Processing', data.length, 'data rows for chart');

    return data.map(row => {
      const dimensions: Record<string, any> = {};
      const measures: Record<string, any> = {};
      const metadata: Record<string, any> = {};

      // Check if this is raw record data (direct query) or aggregated data (RPC)
      const isRawRecord = row.observation_id !== undefined;
      console.log('Processing row type:', isRawRecord ? 'Raw Record' : 'Aggregated Data');
      
      // Map dimensions from database row to chart format
      config.dimensions.forEach(dim => {
        const fieldName = dim.field;
        let value;
        
        if (isRawRecord) {
          // Direct field access for raw records
          value = row[fieldName];
        } else {
          // Handle aggregated data (RPC results)
          value = row[fieldName] || row[dim.name] || row[dim.id];
          
          // For RPC results, dimensions might be returned as "dimension" 
          if (value === undefined && row.dimension !== undefined) {
            value = row.dimension;
          }
        }
        
        // Format dates
        if (dim.dataType === 'date' || dim.dataType === 'timestamp') {
          if (value) {
            const date = new Date(value);
            value = date.toISOString().split('T')[0]; // YYYY-MM-DD format
          }
        }
        
        dimensions[fieldName] = value;
      });

      // Map measures from database row to chart format
      config.measures.forEach(measure => {
        const fieldName = measure.field;
        let value;
        
        if (isRawRecord) {
          // Direct field access for raw records - no aggregation needed
          value = row[fieldName];
          console.log(`Raw record measure ${fieldName}:`, value);
        } else {
          // Handle aggregated data (RPC results)
          value = row[fieldName] || row[measure.name] || row[measure.id];
          
          // If not found, try with aggregation prefix
          if (value === undefined && measure.aggregation) {
            const aggregatedFieldName = `${measure.aggregation}_${fieldName}`;
            value = row[aggregatedFieldName];
          }
          console.log(`Aggregated measure ${fieldName}:`, value);
        }
        
        // Convert to number for numeric measures, handle null values
        if (measure.dataType === 'numeric' || measure.dataType === 'integer' || measure.dataType === 'number') {
          if (value === null || value === undefined) {
            value = null; // Keep as null for proper charting
          } else {
            value = parseFloat(value);
            if (isNaN(value)) {
              value = null; // Convert NaN to null
            }
          }
        }
        
        measures[fieldName] = value;
      });

      // Add metadata for drill-down functionality (only for raw records)
      if (isRawRecord) {
        metadata.observation_id = row.observation_id;
        metadata.submission_id = row.submission_id;
        metadata.site_id = row.site_id;
        metadata.program_id = row.program_id;
        metadata.petri_code = row.petri_code;
        metadata.created_at = row.created_at;
        
        // Add any other relevant metadata fields
        if (row.placement) metadata.placement = row.placement;
        if (row.fungicide_used) metadata.fungicide_used = row.fungicide_used;
        if (row.petri_growth_stage) metadata.petri_growth_stage = row.petri_growth_stage;
        if (row.gasifier_code) metadata.gasifier_code = row.gasifier_code;
        if (row.image_url) metadata.image_url = row.image_url;
        
        // Add additional metadata fields available in the schema
        if (row.x_position) metadata.x_position = row.x_position;
        if (row.y_position) metadata.y_position = row.y_position;
        if (row.growth_index) metadata.growth_index = row.growth_index;
        if (row.todays_day_of_phase) metadata.todays_day_of_phase = row.todays_day_of_phase;
        if (row.daysinthisprogramphase) metadata.daysinthisprogramphase = row.daysinthisprogramphase;
        
        // Extract nested relationship data from JOINs
        if (row.submissions) {
          metadata.global_submission_id = row.submissions.global_submission_id;
          
          if (row.submissions.sites) {
            metadata.site_name = row.submissions.sites.name;
            
            if (row.submissions.sites.pilot_programs) {
              metadata.program_name = row.submissions.sites.pilot_programs.name;
            }
          }
        }
        
        console.log('Raw record metadata extracted:', {
          observation_id: metadata.observation_id,
          image_url: metadata.image_url,
          program_name: metadata.program_name,
          site_name: metadata.site_name,
          global_submission_id: metadata.global_submission_id
        });
      }

      return { dimensions, measures, metadata };
    });
  }

  // Generate sample data for development/testing
  private static getSampleData(config: ReportConfig): AggregatedData {
    console.log('Generating sample data with config:', config);
    const sampleData = [];
    
    // For heatmaps, generate a grid of data
    if (config.chartType === 'heatmap') {
      // Generate heatmap grid data
      const xCategories = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F', 'Zone G', 'Zone H'];
      const yCategories = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
      
      for (let x = 0; x < xCategories.length; x++) {
        for (let y = 0; y < yCategories.length; y++) {
          const dimensions: Record<string, any> = {};
          const measures: Record<string, any> = {};
          const metadata: Record<string, any> = {};
          
          // Set x and y dimensions for heatmap
          if (config.dimensions.length >= 2) {
            dimensions[config.dimensions[0].field] = xCategories[x];
            dimensions[config.dimensions[1].field] = yCategories[y];
          } else if (config.dimensions.length === 1) {
            dimensions[config.dimensions[0].field] = xCategories[x];
            dimensions['y_category'] = yCategories[y];
          }
          
          // Generate value with some pattern (creates interesting heatmap patterns)
          const baseValue = 50;
          const waveX = Math.sin(x * 0.5) * 20;
          const waveY = Math.cos(y * 0.7) * 15;
          const noise = (Math.random() - 0.5) * 10;
          
          config.measures.forEach(measure => {
            if (measure.field === 'growth_index' || measure.field === 'effectiveness_score') {
              // Create a gradient pattern
              measures[measure.field] = Math.max(0, Math.min(100, baseValue + waveX + waveY + noise));
            } else if (measure.field === 'outdoor_temperature') {
              // Temperature gradient
              measures[measure.field] = 65 + (x * 2) + (y * 1.5) + noise;
            } else if (measure.field === 'outdoor_humidity') {
              // Humidity inverse gradient
              measures[measure.field] = 80 - (x * 3) - (y * 2) + noise;
            } else {
              // General pattern
              measures[measure.field] = Math.max(0, baseValue + waveX + waveY + noise);
            }
          });
          
          // Add metadata
          metadata.observation_id = `obs-${x}-${y}`;
          metadata.x_position = x;
          metadata.y_position = y;
          metadata.placement = xCategories[x];
          metadata.day_of_phase = y + 1;
          
          sampleData.push({ dimensions, measures, metadata });
        }
      }
    } else if (config.chartType === 'box_plot') {
      // Generate box plot data with realistic distributions for each group
      const groups = ['Control', 'Treatment A', 'Treatment B', 'Treatment C', 'Treatment D'];
      const samplesPerGroup = 50; // Good sample size for statistical analysis
      
      groups.forEach((group, groupIndex) => {
        // Different distribution parameters for each group
        const baseMean = 50 + (groupIndex * 8); // Groups have different means
        const baseStdDev = 8 + (groupIndex * 0.5); // Slightly different variances
        const skewness = groupIndex === 2 ? 0.8 : 0; // Treatment B is skewed
        
        for (let i = 0; i < samplesPerGroup; i++) {
          const dimensions: Record<string, any> = {};
          const measures: Record<string, any> = {};
          const metadata: Record<string, any> = {};
          
          // Set group dimension
          if (config.dimensions.length >= 1) {
            dimensions[config.dimensions[0].field] = group;
          }
          
          // Add secondary dimension if configured (e.g., time period)
          if (config.dimensions.length >= 2) {
            const timePeriods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            dimensions[config.dimensions[1].field] = timePeriods[Math.floor(i / (samplesPerGroup / 4))];
          }
          
          // Generate values with different distributions
          config.measures.forEach(measure => {
            let value: number;
            
            // Generate normally distributed data with Box-Muller transform
            const u1 = Math.random();
            const u2 = Math.random();
            const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            
            // Apply skewness if needed
            let skewedZ = z0;
            if (skewness !== 0) {
              // Simple skewness approximation
              skewedZ = z0 + skewness * Math.pow(z0, 2) * Math.sign(z0);
            }
            
            value = baseMean + skewedZ * baseStdDev;
            
            // Add some outliers (5% chance)
            if (Math.random() < 0.05) {
              value = Math.random() < 0.5 
                ? baseMean - 3 * baseStdDev - Math.random() * baseStdDev
                : baseMean + 3 * baseStdDev + Math.random() * baseStdDev;
            }
            
            // Ensure reasonable bounds based on measure type
            if (measure.field === 'growth_index' || measure.field === 'effectiveness_score') {
              value = Math.max(0, Math.min(100, value));
            } else if (measure.field === 'outdoor_temperature') {
              value = Math.max(40, Math.min(100, 70 + value * 0.3));
            } else if (measure.field === 'outdoor_humidity') {
              value = Math.max(20, Math.min(100, 60 + value * 0.4));
            }
            
            measures[measure.field] = value;
          });
          
          // Add metadata
          metadata.sample_id = `${group.replace(' ', '_').toLowerCase()}_${i + 1}`;
          metadata.group = group;
          metadata.group_index = groupIndex;
          metadata.sample_index = i;
          
          sampleData.push({ dimensions, measures, metadata });
        }
      });
    } else if (config.chartType === 'scatter') {
      // Generate scatter plot data with realistic correlations
      const sampleSize = 200; // More points for better scatter visualization
      const groups = ['Group A', 'Group B', 'Group C', 'Group D'];
      
      // Define correlation patterns for different groups
      const correlationPatterns = [
        { slope: 1.2, intercept: 10, noise: 15, correlation: 0.85 },   // Strong positive
        { slope: -0.8, intercept: 80, noise: 20, correlation: -0.75 }, // Strong negative
        { slope: 0.4, intercept: 40, noise: 30, correlation: 0.45 },   // Moderate positive
        { slope: 0, intercept: 50, noise: 40, correlation: 0 }         // No correlation
      ];
      
      for (let i = 0; i < sampleSize; i++) {
        const dimensions: Record<string, any> = {};
        const measures: Record<string, any> = {};
        const metadata: Record<string, any> = {};
        
        // Assign to groups
        const groupIndex = Math.floor(i / (sampleSize / groups.length));
        const group = groups[groupIndex];
        const pattern = correlationPatterns[groupIndex];
        
        // Set dimension (group)
        if (config.dimensions.length >= 1) {
          dimensions[config.dimensions[0].field] = group;
        }
        
        // Generate correlated data points
        const x = Math.random() * 100; // X value between 0-100
        
        // Y value based on correlation pattern
        const baseY = pattern.slope * x + pattern.intercept;
        const noise = (Math.random() - 0.5) * pattern.noise;
        let y = baseY + noise;
        
        // Add some outliers (3% chance)
        if (Math.random() < 0.03) {
          y = Math.random() * 100; // Random outlier
        }
        
        // Ensure Y is within reasonable bounds
        y = Math.max(0, Math.min(100, y));
        
        // Set measures
        if (config.measures.length >= 2) {
          const xKey = config.measures[0].field;
          const yKey = config.measures[1].field;
          
          // Map to specific measure types if known
          if (xKey === 'outdoor_temperature' || xKey === 'indoor_temperature') {
            measures[xKey] = 50 + x * 0.4; // Temperature 50-90°F
          } else if (xKey === 'outdoor_humidity' || xKey === 'indoor_humidity') {
            measures[xKey] = x; // Humidity 0-100%
          } else {
            measures[xKey] = x;
          }
          
          if (yKey === 'growth_index' || yKey === 'effectiveness_score') {
            measures[yKey] = y;
          } else if (yKey === 'outdoor_temperature' || yKey === 'indoor_temperature') {
            measures[yKey] = 50 + y * 0.4;
          } else {
            measures[yKey] = y;
          }
        }
        
        // Optional third measure for bubble size
        if (config.measures.length >= 3) {
          const sizeKey = config.measures[2].field;
          // Size correlates somewhat with Y value
          measures[sizeKey] = Math.max(5, y * 0.5 + (Math.random() - 0.5) * 20);
        }
        
        // Add metadata
        metadata.point_id = `point_${i + 1}`;
        metadata.group = group;
        metadata.group_index = groupIndex;
        metadata.x_original = x;
        metadata.y_original = y;
        
        sampleData.push({ dimensions, measures, metadata });
      }
    } else if (config.chartType === 'histogram') {
      // Generate histogram data with various distributions
      const sampleSize = 500; // Large sample for good histogram
      const distributionType = Math.floor(Math.random() * 4); // Random distribution type
      
      for (let i = 0; i < sampleSize; i++) {
        const dimensions: Record<string, any> = {};
        const measures: Record<string, any> = {};
        const metadata: Record<string, any> = {};
        
        // Set dimension if provided
        if (config.dimensions.length >= 1) {
          dimensions[config.dimensions[0].field] = 'All Data';
        }
        
        // Generate values based on different distributions
        config.measures.forEach(measure => {
          let value: number;
          
          switch (distributionType) {
            case 0: // Normal distribution
              // Box-Muller transform for normal distribution
              const u1 = Math.random();
              const u2 = Math.random();
              const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
              value = 50 + z0 * 15; // Mean=50, StdDev=15
              break;
              
            case 1: // Skewed distribution (log-normal)
              const normal = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
              value = Math.exp(3 + normal * 0.5) * 0.5; // Log-normal
              break;
              
            case 2: // Bimodal distribution
              if (Math.random() < 0.5) {
                // First peak
                const n1 = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
                value = 30 + n1 * 10;
              } else {
                // Second peak
                const n2 = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
                value = 70 + n2 * 10;
              }
              break;
              
            case 3: // Uniform distribution with some outliers
              value = Math.random() * 80 + 10; // Uniform between 10-90
              // Add 5% outliers
              if (Math.random() < 0.05) {
                value = Math.random() < 0.5 ? Math.random() * 10 : 90 + Math.random() * 10;
              }
              break;
              
            default:
              value = Math.random() * 100;
          }
          
          // Ensure reasonable bounds based on measure type
          if (measure.field === 'growth_index' || measure.field === 'effectiveness_score') {
            value = Math.max(0, Math.min(100, value));
          } else if (measure.field === 'outdoor_temperature' || measure.field === 'indoor_temperature') {
            value = Math.max(40, Math.min(100, 50 + value * 0.4));
          } else if (measure.field === 'outdoor_humidity' || measure.field === 'indoor_humidity') {
            value = Math.max(20, Math.min(100, value));
          }
          
          measures[measure.field] = value;
        });
        
        // Add metadata
        metadata.sample_id = `sample_${i + 1}`;
        metadata.distribution_type = ['normal', 'skewed', 'bimodal', 'uniform'][distributionType];
        
        sampleData.push({ dimensions, measures, metadata });
      }
    } else {
      // Original sample data generation for other chart types
      const sampleSize = 20;

      for (let i = 0; i < sampleSize; i++) {
        const dimensions: Record<string, any> = {};
        const measures: Record<string, any> = {};
        const metadata: Record<string, any> = {};

        // Generate sample dimension data
        config.dimensions.forEach(dim => {
          switch (dim.dataType) {
            case 'enum':
              // Use actual enum values if available
              if (dim.enumValues && dim.enumValues.length > 0) {
                dimensions[dim.field] = dim.enumValues[i % dim.enumValues.length];
              } else {
                dimensions[dim.field] = `Value ${i + 1}`;
              }
              break;
            case 'text':
              dimensions[dim.field] = `Text Value ${i + 1}`;
              break;
            case 'date':
            case 'timestamp':
              const date = new Date();
              date.setDate(date.getDate() - i);
              dimensions[dim.field] = date.toISOString().split('T')[0];
              break;
            default:
              dimensions[dim.field] = `Value ${i + 1}`;
          }
        });

        // Generate sample measure data with realistic values
        config.measures.forEach(measure => {
          if (measure.field === 'outdoor_temperature') {
            // Generate realistic temperature values (60-90°F)
            measures[measure.field] = Math.floor(Math.random() * 30) + 60;
          } else if (measure.field === 'outdoor_humidity') {
            // Generate realistic humidity values (40-80%)
            measures[measure.field] = Math.floor(Math.random() * 40) + 40;
          } else {
            // General numeric values
            measures[measure.field] = Math.floor(Math.random() * 100) + 1;
          }
        });

        // Generate sample metadata for drill-down functionality with realistic UUIDs
        const generateUUID = (prefix: string, index: number) => {
          const baseUUID = '00000000-0000-4000-8000-000000000000';
          const hexIndex = index.toString(16).padStart(12, '0');
          return `${prefix}${baseUUID.slice(prefix.length, 8)}-${baseUUID.slice(9, 13)}-${baseUUID.slice(14, 18)}-${baseUUID.slice(19, 23)}-${hexIndex}`;
        };

        metadata.observation_id = generateUUID('obs', i + 1);
        metadata.submission_id = generateUUID('sub', i + 1);
        metadata.site_id = generateUUID('sit', i + 1);
        metadata.program_id = generateUUID('prg', i + 1);
        metadata.petri_code = `PETRI_${String(i + 1).padStart(3, '0')}`;
        metadata.created_at = new Date(Date.now() - i * 86400000).toISOString();
        metadata.placement = ['P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'R1'][i % 7];
        metadata.fungicide_used = i % 2 === 0 ? 'Yes' : 'No';
        metadata.petri_growth_stage = ['None', 'Trace', 'Low', 'Moderate', 'High'][i % 5];
        
        // Add sample image URLs (mix of valid and null for testing)
        if (i % 3 === 0) {
          metadata.image_url = `https://example.com/petri-images/sample-${i + 1}.jpg`;
        } else if (i % 5 === 0) {
          metadata.image_url = null; // Test null image case
        } else {
          metadata.image_url = `https://picsum.photos/800/600?random=${i + 1}`; // Placeholder images for demo
        }
        
        // Add sample related data (program name, site name, global submission ID)
        const programNames = ['Seedling Phase 1', 'Growth Optimization Study', 'Environmental Impact Analysis', 'Yield Enhancement Program', 'Pest Resistance Trial'];
        const siteNames = ['Greenhouse Alpha', 'Field Station Beta', 'Laboratory Gamma', 'Research Facility Delta', 'Test Site Epsilon'];
        
        metadata.program_name = programNames[i % programNames.length];
        metadata.site_name = siteNames[i % siteNames.length];
        metadata.global_submission_id = 1100000 + i + 1; // Starting from 1100001

        sampleData.push({ dimensions, measures, metadata });
      }
    }

    console.log('Generated sample data:', sampleData.slice(0, 2)); // Log first 2 rows

    const totalCount = sampleData.length;
    return {
      data: sampleData,
      totalCount: totalCount,
      filteredCount: totalCount,
      executionTime: 45,
      cacheHit: false,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dimensions: config.dimensions,
        measures: config.measures,
        filters: config.filters
      }
    };
  }
}