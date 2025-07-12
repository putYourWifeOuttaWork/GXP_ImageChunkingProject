// Automatic Query Optimizer
// Transparently optimizes queries to use partitioned tables when beneficial

import { ReportConfig, Filter, DataSource } from '../types/reporting/reportTypes';

export class QueryOptimizer {
  // Mapping of regular tables to their partitioned equivalents
  private static readonly PARTITION_MAP = {
    'petri_observations': 'petri_observations_partitioned',
    'gasifier_observations': 'gasifier_observations_partitioned'
  };

  // Automatically optimize a report configuration
  static optimizeReport(config: ReportConfig): ReportConfig {
    // Check if we can use partitioned tables
    const canUsePartitions = this.canUsePartitions(config);
    
    if (!canUsePartitions.eligible) {
      return config;
    }

    // Create optimized config
    const optimizedConfig = { ...config };
    
    // Replace data sources with partitioned versions
    optimizedConfig.dataSources = config.dataSources.map(ds => {
      const partitionedTable = this.PARTITION_MAP[ds.table];
      if (partitionedTable && canUsePartitions.hasRequiredFilters) {
        return {
          ...ds,
          table: partitionedTable,
          originalTable: ds.table,
          isPartitioned: true,
          performanceBoost: canUsePartitions.estimatedSpeedup
        };
      }
      return ds;
    });

    // Add performance metadata
    optimizedConfig.optimizationMetadata = {
      isOptimized: true,
      optimizationLevel: canUsePartitions.level,
      estimatedSpeedup: canUsePartitions.estimatedSpeedup,
      suggestions: canUsePartitions.suggestions
    };

    return optimizedConfig;
  }

  // Check if we can use partitioned tables
  private static canUsePartitions(config: ReportConfig): {
    eligible: boolean;
    hasRequiredFilters: boolean;
    level: 'none' | 'basic' | 'good' | 'optimal';
    estimatedSpeedup: string;
    suggestions: string[];
  } {
    const result = {
      eligible: false,
      hasRequiredFilters: false,
      level: 'none' as const,
      estimatedSpeedup: '1x',
      suggestions: [] as string[]
    };

    // Check if tables have partitioned versions
    const hasPartitionableTables = config.dataSources.some(
      ds => this.PARTITION_MAP[ds.table]
    );

    if (!hasPartitionableTables) {
      return result;
    }

    // Analyze filters
    const filters = config.filters || [];
    const hasProgramFilter = filters.some(f => f.field === 'program_id' && f.value);
    const hasSiteFilter = filters.some(f => f.field === 'site_id' && f.value);
    const hasDateFilter = filters.some(f => 
      (f.field === 'created_at' || f.field === 'date_range') && f.value
    );

    result.eligible = true;

    // Determine optimization level
    if (hasProgramFilter && hasSiteFilter && hasDateFilter) {
      result.hasRequiredFilters = true;
      result.level = 'optimal';
      result.estimatedSpeedup = '100-500x';
    } else if (hasProgramFilter && (hasSiteFilter || hasDateFilter)) {
      result.hasRequiredFilters = true;
      result.level = 'good';
      result.estimatedSpeedup = '50-100x';
    } else if (hasProgramFilter) {
      result.hasRequiredFilters = true;
      result.level = 'basic';
      result.estimatedSpeedup = '10-50x';
      
      if (!hasSiteFilter) {
        result.suggestions.push('Add site filter for 2-5x more speed');
      }
      if (!hasDateFilter) {
        result.suggestions.push('Add date range for better performance');
      }
    } else {
      result.suggestions.push('Add program filter to enable 10-50x speedup');
    }

    return result;
  }

  // Smart filter suggestions based on user behavior
  static async generateSmartFilters(
    config: ReportConfig,
    userContext?: { recentPrograms?: string[]; currentSite?: string }
  ): Promise<Filter[]> {
    const suggestions: Filter[] = [];
    const existingFilters = config.filters || [];
    
    // Don't suggest filters that already exist
    const hasFilter = (field: string) => 
      existingFilters.some(f => f.field === field);

    // Suggest program filter if missing and we have context
    if (!hasFilter('program_id') && userContext?.recentPrograms?.length) {
      suggestions.push({
        id: `suggested_program_${Date.now()}`,
        field: 'program_id',
        operator: 'equals',
        value: userContext.recentPrograms[0],
        type: 'text',
        name: 'Suggested Program',
        isSuggestion: true
      } as Filter);
    }

    // Suggest recent date filter if missing
    if (!hasFilter('created_at') && !hasFilter('date_range')) {
      suggestions.push({
        id: `suggested_date_${Date.now()}`,
        field: 'created_at',
        operator: 'greater_than',
        value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'date',
        name: 'Last 30 Days',
        isSuggestion: true
      } as Filter);
    }

    return suggestions;
  }

  // Automatically add implicit filters based on user context
  static addImplicitFilters(
    config: ReportConfig,
    userContext: { 
      defaultProgram?: string;
      defaultSite?: string;
      defaultDateRange?: number; // days
    }
  ): ReportConfig {
    const enhancedConfig = { ...config };
    const filters = [...(config.filters || [])];

    // Add implicit program filter if user has a default
    if (userContext.defaultProgram && !filters.some(f => f.field === 'program_id')) {
      filters.push({
        id: `implicit_program_${Date.now()}`,
        field: 'program_id',
        operator: 'equals',
        value: userContext.defaultProgram,
        type: 'text',
        name: 'Current Program',
        isImplicit: true,
        dataSource: config.dataSources[0]?.id
      } as Filter);
    }

    // Add implicit date range for performance
    if (userContext.defaultDateRange && !filters.some(f => f.field === 'created_at')) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - userContext.defaultDateRange);
      
      filters.push({
        id: `implicit_date_${Date.now()}`,
        field: 'created_at',
        operator: 'greater_than',
        value: startDate.toISOString(),
        type: 'date',
        name: `Last ${userContext.defaultDateRange} days`,
        isImplicit: true,
        dataSource: config.dataSources[0]?.id
      } as Filter);
    }

    enhancedConfig.filters = filters;
    return enhancedConfig;
  }
}