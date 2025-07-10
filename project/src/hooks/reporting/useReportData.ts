import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { 
  ReportConfiguration, 
  ReportSummary, 
  AggregatedData, 
  ReportExecutionContext,
  QueryResult 
} from '../../types/reporting';

// Query keys for caching
export const reportQueryKeys = {
  all: ['reports'] as const,
  lists: () => [...reportQueryKeys.all, 'list'] as const,
  list: (filters: any) => [...reportQueryKeys.lists(), filters] as const,
  details: () => [...reportQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportQueryKeys.details(), id] as const,
  data: () => [...reportQueryKeys.all, 'data'] as const,
  reportData: (id: string, context: ReportExecutionContext) => 
    [...reportQueryKeys.data(), id, context] as const,
  aggregated: (id: string, filters: any) => 
    [...reportQueryKeys.data(), id, 'aggregated', filters] as const,
};

// Hook for fetching list of reports
export const useReports = (filters?: {
  companyId?: string;
  programIds?: string[];
  category?: string;
  type?: string;
  isPublic?: boolean;
  tags?: string[];
  search?: string;
}) => {
  return useQuery({
    queryKey: reportQueryKeys.list(filters),
    queryFn: async (): Promise<ReportSummary[]> => {
      let query = supabase
        .from('custom_reports')
        .select(`
          report_id,
          name,
          description,
          created_by_user_id,
          company_id,
          program_id,
          configuration,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false });

      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.type) {
        query = query.eq('report_type', filters.type);
      }

      if (filters?.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }

      if (filters?.programIds?.length) {
        query = query.overlaps('program_ids', filters.programIds);
      }

      if (filters?.tags?.length) {
        query = query.overlaps('tags', filters.tags);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(report => ({
        id: report.report_id,
        name: report.name,
        description: report.description,
        category: report.category,
        type: report.report_type,
        chartType: report.visualization_config?.chartType || 'line',
        isPublic: report.is_public,
        isTemplate: report.is_template,
        createdByUserId: report.created_by_user_id,
        tags: report.tags || [],
        viewCount: report.view_count,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for fetching a single report configuration
export const useReport = (reportId: string) => {
  return useQuery({
    queryKey: reportQueryKeys.detail(reportId),
    queryFn: async (): Promise<ReportConfiguration> => {
      const { data, error } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('report_id', reportId)
        .single();

      if (error) throw error;

      return {
        id: data.report_id,
        name: data.name,
        description: data.description,
        category: data.category,
        type: data.report_type,
        createdByUserId: data.created_by_user_id,
        companyId: data.company_id,
        programIds: data.program_ids || [],
        isPublic: data.is_public,
        isTemplate: data.is_template,
        dataSources: data.data_sources || [],
        dimensions: data.dimensions || [],
        measures: data.measures || [],
        filters: data.filters || [],
        sorting: [], // TODO: Add sorting to schema
        chartType: data.visualization_config?.chartType || 'line',
        visualizationSettings: data.visualization_config || {},
        formatting: {}, // TODO: Add formatting to schema
        interactivity: {}, // TODO: Add interactivity to schema
        queryCacheTtl: 3600, // 1 hour default
        autoRefresh: data.auto_refresh || false,
        refreshFrequency: data.refresh_frequency || undefined,
        tags: data.tags || [],
        version: data.version,
        lastRefreshedAt: data.last_refreshed_at,
        viewCount: data.view_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
    enabled: !!reportId,
  });
};

// Hook for executing report data queries
export const useReportData = (
  reportId: string, 
  context: ReportExecutionContext,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) => {
  return useQuery({
    queryKey: reportQueryKeys.reportData(reportId, context),
    queryFn: async (): Promise<AggregatedData> => {
      // First, get the report configuration
      const { data: reportConfig, error: configError } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('report_id', reportId)
        .single();

      if (configError) throw configError;

      // Check cache first
      const cacheKey = generateCacheKey(reportId, context);
      const { data: cachedData } = await supabase
        .from('report_cache')
        .select('*')
        .eq('report_id', reportId)
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedData) {
        // Update hit count
        await supabase
          .from('report_cache')
          .update({ hit_count: cachedData.hit_count + 1 })
          .eq('cache_id', cachedData.cache_id);

        return {
          ...cachedData.result_data,
          cacheHit: true,
        };
      }

      // Execute query if not cached
      const startTime = Date.now();
      const result = await executeReportQuery(reportConfig, context);
      const executionTime = Date.now() - startTime;

      // Cache the result
      await supabase
        .from('report_cache')
        .insert({
          report_id: reportId,
          cache_key: cacheKey,
          parameters_hash: generateParametersHash(context),
          result_data: result,
          expires_at: new Date(Date.now() + (reportConfig.query_cache_ttl || 3600) * 1000).toISOString(),
        });

      return {
        ...result,
        executionTime,
        cacheHit: false,
      };
    },
    enabled: !!reportId && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval,
    staleTime: 0, // Always consider data stale to check cache
  });
};

// Hook for creating a new report
export const useCreateReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Omit<ReportConfiguration, 'id' | 'version' | 'viewCount' | 'createdAt' | 'updatedAt'>) => {
      const { data, error } = await supabase
        .from('custom_reports')
        .insert({
          name: report.name,
          description: report.description,
          created_by_user_id: report.createdByUserId,
          company_id: report.companyId,
          program_id: report.programIds?.[0] || null, // Use first program ID if available
          configuration: {
            category: report.category,
            type: report.type,
            programIds: report.programIds,
            isPublic: report.isPublic,
            isTemplate: report.isTemplate,
            dataSources: report.dataSources,
            dimensions: report.dimensions,
            measures: report.measures,
            filters: report.filters,
            chartType: report.chartType,
            visualizationSettings: report.visualizationSettings,
            queryCacheTtl: report.queryCacheTtl,
            autoRefresh: report.autoRefresh,
            refreshFrequency: report.refreshFrequency,
            tags: report.tags,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
    },
  });
};

// Hook for updating a report
export const useUpdateReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      reportId, 
      updates 
    }: { 
      reportId: string; 
      updates: Partial<ReportConfiguration> 
    }) => {
      // First get the current report to merge configuration
      const { data: currentReport, error: fetchError } = await supabase
        .from('custom_reports')
        .select('configuration')
        .eq('report_id', reportId)
        .single();

      if (fetchError) throw fetchError;

      const currentConfig = currentReport?.configuration || {};
      
      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.programIds) updateData.program_id = updates.programIds?.[0] || null;

      // Merge configuration updates
      const configUpdates: any = {};
      if (updates.category) configUpdates.category = updates.category;
      if (updates.type) configUpdates.type = updates.type;
      if (updates.isPublic !== undefined) configUpdates.isPublic = updates.isPublic;
      if (updates.isTemplate !== undefined) configUpdates.isTemplate = updates.isTemplate;
      if (updates.programIds) configUpdates.programIds = updates.programIds;
      if (updates.dataSources) configUpdates.dataSources = updates.dataSources;
      if (updates.dimensions) configUpdates.dimensions = updates.dimensions;
      if (updates.measures) configUpdates.measures = updates.measures;
      if (updates.filters) configUpdates.filters = updates.filters;
      if (updates.chartType) configUpdates.chartType = updates.chartType;
      if (updates.visualizationSettings) configUpdates.visualizationSettings = updates.visualizationSettings;
      if (updates.queryCacheTtl) configUpdates.queryCacheTtl = updates.queryCacheTtl;
      if (updates.autoRefresh !== undefined) configUpdates.autoRefresh = updates.autoRefresh;
      if (updates.refreshFrequency) configUpdates.refreshFrequency = updates.refreshFrequency;
      if (updates.tags) configUpdates.tags = updates.tags;

      if (Object.keys(configUpdates).length > 0) {
        updateData.configuration = { ...currentConfig, ...configUpdates };
      }

      const { data, error } = await supabase
        .from('custom_reports')
        .update(updateData)
        .eq('report_id', reportId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.detail(data.report_id) });
      // Clear related data cache
      queryClient.removeQueries({ queryKey: reportQueryKeys.data() });
    },
  });
};

// Hook for deleting a report
export const useDeleteReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('custom_reports')
        .delete()
        .eq('report_id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
      queryClient.removeQueries({ queryKey: reportQueryKeys.data() });
    },
  });
};

// Hook for cloning a report
export const useCloneReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      reportId, 
      newName, 
      newDescription 
    }: { 
      reportId: string; 
      newName: string; 
      newDescription?: string 
    }) => {
      // First get the original report
      const { data: originalReport, error: fetchError } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('report_id', reportId)
        .single();

      if (fetchError) throw fetchError;

      // Create the clone
      const { data, error } = await supabase
        .from('custom_reports')
        .insert({
          name: newName,
          description: newDescription || `Clone of ${originalReport.name}`,
          category: originalReport.category,
          report_type: originalReport.report_type,
          created_by_user_id: originalReport.created_by_user_id,
          company_id: originalReport.company_id,
          program_ids: originalReport.program_ids,
          is_public: false, // Clones are private by default
          is_template: originalReport.is_template,
          data_sources: originalReport.data_sources,
          dimensions: originalReport.dimensions,
          measures: originalReport.measures,
          filters: originalReport.filters,
          visualization_config: originalReport.visualization_config,
          query_cache_ttl: originalReport.query_cache_ttl,
          auto_refresh: originalReport.auto_refresh,
          refresh_frequency: originalReport.refresh_frequency,
          tags: [...(originalReport.tags || []), 'clone'],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
    },
  });
};

// Utility functions
const generateCacheKey = (reportId: string, context: ReportExecutionContext): string => {
  const keyComponents = [
    reportId,
    context.userId,
    context.companyId,
    JSON.stringify(context.programIds?.sort()),
    JSON.stringify(context.filters?.sort()),
    context.dateRange?.start,
    context.dateRange?.end,
    context.timezone,
  ];
  
  return keyComponents.filter(Boolean).join('|');
};

const generateParametersHash = (context: ReportExecutionContext): string => {
  const str = JSON.stringify(context, Object.keys(context).sort());
  return btoa(str).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
};

const executeReportQuery = async (
  reportConfig: any,
  context: ReportExecutionContext
): Promise<AggregatedData> => {
  // This is a simplified version - in a real implementation,
  // this would build complex SQL queries based on the report configuration
  
  // For now, return mock data structure
  return {
    data: [],
    metadata: {
      dimensions: [],
      measures: [],
      lastUpdated: new Date().toISOString(),
    },
    aggregations: {},
    totalCount: 0,
    filteredCount: 0,
    executionTime: 0,
    cacheHit: false,
  };
};

// Hook for incrementing view count
export const useIncrementViewCount = () => {
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.rpc('increment_report_view_count', {
        report_id: reportId
      });

      if (error) throw error;
    },
  });
};

// Hook for report analytics
export const useReportAnalytics = (reportId: string) => {
  return useQuery({
    queryKey: ['report-analytics', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_analytics')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });
};