import React, { useState } from 'react';
import { Filter, Zap, BarChart } from 'lucide-react';
import { HierarchicalPartitionFilter } from './HierarchicalPartitionFilter';
import { PartitionOptimizationIndicator } from './PartitionOptimizationIndicator';
import { QuickPartitionAnalysis } from './QuickPartitionAnalysis';
import { useReportBuilder } from '../../../hooks/reporting/useReportBuilder';

// Simple tabs implementation
interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

const Tabs: React.FC<{ value: string; onValueChange: (value: string) => void; className?: string; children: React.ReactNode }> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList: React.FC<{ className?: string; children: React.ReactNode }> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};

const TabsTrigger: React.FC<{ value: string; className?: string; children: React.ReactNode }> = ({ children, className, value }) => {
  const context = React.useContext(TabsContext);
  if (!context) return null;
  
  const isActive = context.value === value;
  const baseClasses = "px-4 py-2 font-medium text-sm transition-colors";
  const activeClasses = isActive ? "bg-white text-gray-900 border-b-2 border-primary-600" : "text-gray-600 hover:text-gray-900";
  
  return (
    <button 
      className={`${baseClasses} ${activeClasses} ${className || ''}`} 
      onClick={() => context.onValueChange(value)}
    >
      {children}
    </button>
  );
};

const TabsContent: React.FC<{ value: string; className?: string; children: React.ReactNode }> = ({ children, className, value }) => {
  const context = React.useContext(TabsContext);
  if (!context) return null;
  
  return context.value === value ? <div className={className}>{children}</div> : null;
};

export const PartitionOptimizedView: React.FC = () => {
  const { state, addFilter, removeFilter } = useReportBuilder();
  const [activeTab, setActiveTab] = useState('hierarchical');

  const handleHierarchicalFilterChange = (filters: any) => {
    // Convert hierarchical filters to report builder filters
    const newFilters = [];
    
    if (filters.program_id) {
      newFilters.push({
        id: `filter_program_${Date.now()}`,
        field: 'program_id',
        operator: 'equals',
        value: filters.program_id,
        type: 'text',
        dataSource: state.dataSources[0]?.id || 'petri_observations_partitioned',
        name: 'Program',
        label: 'Program'
      });
    }
    
    if (filters.site_id) {
      newFilters.push({
        id: `filter_site_${Date.now()}`,
        field: 'site_id',
        operator: 'equals',
        value: filters.site_id,
        type: 'text',
        dataSource: state.dataSources[0]?.id || 'petri_observations_partitioned',
        name: 'Site',
        label: 'Site'
      });
    }
    
    if (filters.submission_id) {
      newFilters.push({
        id: `filter_submission_${Date.now()}`,
        field: 'submission_id',
        operator: 'equals',
        value: filters.submission_id,
        type: 'text',
        dataSource: state.dataSources[0]?.id || 'petri_observations_partitioned',
        name: 'Submission',
        label: 'Submission'
      });
    }
    
    if (filters.dateRange) {
      newFilters.push({
        id: `filter_date_${Date.now()}`,
        field: 'created_at',
        operator: 'between',
        value: `${filters.dateRange.start},${filters.dateRange.end}`,
        type: 'date',
        dataSource: state.dataSources[0]?.id || 'petri_observations_partitioned',
        name: 'Date Range',
        label: 'Date Range'
      });
    }
    
    // Clear existing partition-related filters
    state.filters.forEach(filter => {
      if (filter.field === 'program_id' || filter.field === 'site_id' || 
          filter.field === 'submission_id' || filter.field === 'created_at') {
        removeFilter(filter.id);
      }
    });
    
    // Add new filters
    newFilters.forEach(filter => addFilter(filter));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Partition-Optimized Analysis</h1>
        </div>
        <p className="text-gray-700">
          Leverage the power of table partitioning for ultra-fast queries. Select your analysis scope 
          hierarchically to achieve 10-100x performance improvements.
        </p>
      </div>

      {/* Optimization Indicator */}
      {state.filters && state.filters.length > 0 && (
        <PartitionOptimizationIndicator 
          reportConfig={state} 
          className="mb-6"
        />
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hierarchical" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Hierarchical Filters
          </TabsTrigger>
          <TabsTrigger value="quick" className="flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Quick Analysis
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Custom Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchical" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <HierarchicalPartitionFilter 
                onSelectionChange={handleHierarchicalFilterChange}
                onPerformanceUpdate={(level) => {
                  console.log('Performance level:', level);
                }}
              />
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">How It Works</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">1</div>
                  <div>
                    <p className="font-medium">Select a Program</p>
                    <p className="text-gray-600">Queries will use program-level partitions (10-50x faster)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">2</div>
                  <div>
                    <p className="font-medium">Optionally Select a Site</p>
                    <p className="text-gray-600">Further narrows to site partitions (50-100x faster)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs">3</div>
                  <div>
                    <p className="font-medium">Optionally Select a Submission</p>
                    <p className="text-gray-600">Ultra-precise queries (100-500x faster)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quick" className="mt-6">
          <QuickPartitionAnalysis />
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Custom Partition-Aware Builder</h3>
            <p className="text-gray-600 mb-6">
              Build custom reports with automatic partition optimization. The system will suggest 
              the best filters to add for optimal performance.
            </p>
            
            {/* This would integrate with your existing report builder */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Pro Tip:</strong> Always start by selecting a program to enable partition pruning. 
                The more specific your filters (program → site → date), the faster your queries will run.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Performance Benefits */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-3xl font-bold text-green-600">10-50x</div>
            <div className="text-sm text-gray-600 mt-1">Faster with program filter</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-3xl font-bold text-green-600">50-100x</div>
            <div className="text-sm text-gray-600 mt-1">Faster with program + site</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-3xl font-bold text-green-600">100-500x</div>
            <div className="text-sm text-gray-600 mt-1">Faster with all filters</div>
          </div>
        </div>
      </div>
    </div>
  );
};