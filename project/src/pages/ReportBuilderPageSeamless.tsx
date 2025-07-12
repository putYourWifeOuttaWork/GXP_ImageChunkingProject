// Example of seamless partition integration
// This shows key changes to make to ReportBuilderPage.tsx

import React, { useEffect, useState } from 'react';
import { ContextualScope } from '@/components/reporting/builder/ContextualScope';
import { SmartFilterSuggestions } from '@/components/reporting/builder/SmartFilterSuggestions';
import { QueryOptimizer } from '@/services/queryOptimizer';

// ... other imports ...

export default function ReportBuilderPageSeamless() {
  const { state, addFilter, removeFilter } = useReportBuilder();
  const [userContext, setUserContext] = useState({
    defaultProgram: null,
    defaultSite: null,
    recentPrograms: []
  });

  // Handle scope changes from contextual selector
  const handleScopeChange = (scope: any) => {
    // Remove existing program/site/date filters
    const filtersToRemove = state.filters.filter(f => 
      f.field === 'program_id' || 
      f.field === 'site_id' || 
      f.field === 'created_at'
    );
    filtersToRemove.forEach(f => removeFilter(f.id));

    // Add new scope as filters (but they feel like context, not filters)
    if (scope.programId) {
      addFilter({
        id: `scope_program_${Date.now()}`,
        field: 'program_id',
        operator: 'equals',
        value: scope.programId,
        type: 'text',
        name: 'Program',
        dataSource: state.dataSources[0]?.id,
        isContextual: true // Mark as contextual, not user-added filter
      });
    }

    if (scope.siteId) {
      addFilter({
        id: `scope_site_${Date.now()}`,
        field: 'site_id',
        operator: 'equals',
        value: scope.siteId,
        type: 'text',
        name: 'Site',
        dataSource: state.dataSources[0]?.id,
        isContextual: true
      });
    }

    if (scope.dateRange) {
      addFilter({
        id: `scope_date_${Date.now()}`,
        field: 'created_at',
        operator: 'between',
        value: `${scope.dateRange.start},${scope.dateRange.end}`,
        type: 'date',
        name: 'Date Range',
        dataSource: state.dataSources[0]?.id,
        isContextual: true
      });
    }
  };

  // Automatically optimize queries before execution
  const executeOptimizedReport = async () => {
    // Apply automatic optimizations
    const optimizedConfig = QueryOptimizer.optimizeReport(state);
    
    // Add implicit filters based on user context
    const enhancedConfig = QueryOptimizer.addImplicitFilters(
      optimizedConfig,
      userContext
    );

    // Execute with optimized config
    const result = await executeReport(enhancedConfig);
    
    // Show subtle performance indicator
    if (optimizedConfig.optimizationMetadata?.isOptimized) {
      showPerformanceToast(optimizedConfig.optimizationMetadata.estimatedSpeedup);
    }
    
    return result;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with integrated scope selection */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">Report Builder</h1>
            
            {/* Seamlessly integrated scope selection */}
            <ContextualScope onScopeChange={handleScopeChange} />
          </div>
          
          <div className="flex items-center gap-4">
            <Button onClick={handleReset} variant="ghost">Reset</Button>
            <Button onClick={executeOptimizedReport} variant="primary">
              Preview Report
            </Button>
          </div>
        </div>
        
        {/* Smart suggestions inline, not intrusive */}
        <div className="mt-4">
          <SmartFilterSuggestions
            currentFilters={state.filters}
            dataSources={state.dataSources}
            onAddFilter={addFilter}
            className="max-w-2xl"
          />
        </div>
      </div>

      {/* Rest of the report builder remains unchanged */}
      <div className="p-6">
        {/* Existing step-by-step interface */}
        {currentStep === 'datasource' && (
          <DataSourceStep 
            // Automatically use partitioned tables when beneficial
            dataSources={state.dataSources.map(ds => {
              const optimized = QueryOptimizer.optimizeReport({ 
                ...state, 
                dataSources: [ds] 
              });
              return optimized.dataSources[0];
            })}
          />
        )}
        
        {/* Filters step shows only user-added filters, not contextual ones */}
        {currentStep === 'filters' && (
          <FiltersStep 
            filters={state.filters.filter(f => !f.isContextual)}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
      </div>
    </div>
  );
}

// Subtle performance indicator
function showPerformanceToast(speedup: string) {
  // Small, unobtrusive notification
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg shadow-md flex items-center gap-2';
  toast.innerHTML = `
    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
      <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
    </svg>
    Query optimized • ${speedup} faster
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}