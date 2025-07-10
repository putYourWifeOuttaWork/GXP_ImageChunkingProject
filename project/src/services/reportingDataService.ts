import { supabase } from '../lib/supabaseClient';
import { 
  ReportConfig, 
  DataSource, 
  AggregatedData,
  Dimension,
  Measure,
  Filter 
} from '../types/reporting';

export class ReportingDataService {
  
  // Get all actual columns from selected data source tables
  static async getTableColumns(dataSources: DataSource[]): Promise<{ [tableName: string]: Array<{ name: string; type: string; displayName: string }> }> {
    const tableColumns: { [tableName: string]: Array<{ name: string; type: string; displayName: string }> } = {};
    
    for (const dataSource of dataSources) {
      try {
        // Query PostgreSQL information_schema to get all columns for this table
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', dataSource.table)
          .eq('table_schema', 'public')
          .order('ordinal_position');
        
        if (error) {
          console.error(`Error fetching columns for ${dataSource.table}:`, error);
          // Fallback to predefined fields if schema query fails
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
  static async getAvailableFilterFields(dataSources: DataSource[]): Promise<Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string }>> {
    const filterFields: Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string }> = [];
    
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
            
            // Add parent IDs for drill-down functionality
            const parentIds = ['submission_id', 'site_id', 'program_id', 'observation_id'];
            parentIds.forEach(id => {
              uniqueFields.add(id);
            });
            
            // Add other relevant metadata fields based on table type
            const commonMetadataFields = ['image_url', 'placement'];
            const tableSpecificFields = mainSource.table === 'petri_observations' 
              ? ['petri_code', 'fungicide_used', 'petri_growth_stage', 'x_position', 'y_position', 'growth_index', 'todays_day_of_phase', 'daysinthisprogramphase']
              : mainSource.table === 'gasifier_observations'
              ? ['gasifier_code', 'chemical_type', 'measure', 'position_x', 'position_y', 'linear_reading']
              : [];
            
            [...commonMetadataFields, ...tableSpecificFields].forEach(field => {
              uniqueFields.add(field);
            });
            
            // Convert to array and add related table fields for complete record data
            const selectFieldsArray = Array.from(uniqueFields);
            selectFieldsArray.push('submissions(global_submission_id, sites(name, pilot_programs(name)))');
            
            console.log('Debug: Direct query selecting fields:', selectFieldsArray);
            
            let query = supabase
              .from(mainSource.table)
              .select(selectFieldsArray.join(', '));
              
            // Apply simple filters
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
                    default:
                      query = query.eq(filter.field, filter.value);
                  }
                }
              });
            }
            
            const result = await query.limit(500);
            data = result.data;
            error = result.error;
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
        return this.getSampleData(config);
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

    console.log('Generated sample data:', sampleData.slice(0, 2)); // Log first 2 rows

    return {
      data: sampleData,
      totalCount: sampleSize,
      filteredCount: sampleSize,
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