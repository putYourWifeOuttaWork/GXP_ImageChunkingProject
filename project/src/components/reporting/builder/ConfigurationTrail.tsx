import React from 'react';
import { Check, ChevronRight, Database, Filter, BarChart, Eye, Settings, FileText } from 'lucide-react';
import { ReportBuilderState } from '../../../hooks/reporting/useReportBuilder';

interface ConfigurationTrailProps {
  state: ReportBuilderState;
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export const ConfigurationTrail: React.FC<ConfigurationTrailProps> = ({
  state,
  currentStep,
  onStepClick,
  className = ''
}) => {
  const getStepIcon = (step: number) => {
    switch (step) {
      case 0: return <FileText className="w-4 h-4" />;
      case 1: return <Database className="w-4 h-4" />;
      case 2: return <Filter className="w-4 h-4" />;
      case 3: return <BarChart className="w-4 h-4" />;
      case 4: return <Filter className="w-4 h-4" />;
      case 5: return <Eye className="w-4 h-4" />;
      case 6: return <Eye className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const steps = [
    {
      id: 0,
      title: 'Basic Info',
      description: 'Set up report name and description',
      isComplete: !!state.name,
      summary: state.name ? (
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-900">{state.name}</div>
          {state.description && (
            <div className="text-gray-500 truncate">{state.description}</div>
          )}
        </div>
      ) : null
    },
    {
      id: 1,
      title: 'Data Sources',
      description: 'Select tables to include in your report',
      isComplete: state.dataSources.length > 0,
      summary: state.dataSources.length > 0 ? (
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-900">
            {state.dataSources.length} source{state.dataSources.length > 1 ? 's' : ''}
          </div>
          {state.dataSources.map((ds, idx) => (
            <div key={ds.id} className="text-gray-500">
              • {ds.name} {ds.isPrimary && <span className="text-blue-600">(Primary)</span>}
            </div>
          ))}
        </div>
      ) : null
    },
    {
      id: 2,
      title: 'Dimensions',
      description: 'Choose fields to group and categorize your data',
      isComplete: state.dimensions.length > 0,
      summary: state.dimensions.length > 0 ? (
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-900">
            {state.dimensions.length} dimension{state.dimensions.length > 1 ? 's' : ''}
          </div>
          {state.dimensions.slice(0, 3).map((dim, idx) => (
            <div key={dim.id} className="text-gray-500">
              • {dim.displayName || dim.name}
            </div>
          ))}
          {state.dimensions.length > 3 && (
            <div className="text-gray-400">+{state.dimensions.length - 3} more</div>
          )}
        </div>
      ) : null
    },
    {
      id: 3,
      title: 'Measures',
      description: 'Select numeric values to analyze and aggregate',
      isComplete: state.measures.length > 0,
      summary: state.measures.length > 0 ? (
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-900">
            {state.measures.length} measure{state.measures.length > 1 ? 's' : ''}
          </div>
          {state.measures.slice(0, 3).map((measure, idx) => (
            <div key={measure.id} className="text-gray-500">
              • {measure.displayName || measure.name}
            </div>
          ))}
          {state.measures.length > 3 && (
            <div className="text-gray-400">+{state.measures.length - 3} more</div>
          )}
        </div>
      ) : null
    },
    {
      id: 4,
      title: 'Filters',
      description: 'Add conditions to refine your data',
      isComplete: true, // Optional step
      summary: (
        <div className="text-xs text-gray-600">
          {state.selectedSegments.length > 0 && (
            <div className="mb-1">
              <div className="font-medium text-gray-900">Segments:</div>
              {state.selectedSegments.map(seg => (
                <div key={seg} className="text-gray-500">
                  • {seg === 'program_id' ? 'Programs' : 
                     seg === 'site_id' ? 'Sites' :
                     seg === 'submission_id' ? 'Submissions' : seg}
                </div>
              ))}
            </div>
          )}
          {state.filters.length > 0 ? (
            <>
              <div className="font-medium text-gray-900">
                {state.filters.length} filter{state.filters.length > 1 ? 's' : ''}
              </div>
              {state.filters.slice(0, 2).map((filter, idx) => (
                <div key={filter.id} className="text-gray-500">
                  • {filter.label || filter.name}
                </div>
              ))}
              {state.filters.length > 2 && (
                <div className="text-gray-400">+{state.filters.length - 2} more</div>
              )}
            </>
          ) : (
            <div className="text-gray-400">No filters</div>
          )}
        </div>
      )
    },
    {
      id: 5,
      title: 'Visualization',
      description: 'Configure how your data will be displayed',
      isComplete: !!state.chartType,
      summary: state.chartType ? (
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-900">
            {state.chartType.charAt(0).toUpperCase() + state.chartType.slice(1)} Chart
          </div>
        </div>
      ) : null
    },
    {
      id: 6,
      title: 'Preview',
      description: 'Review and test your report before saving',
      isComplete: false,
      summary: null
    }
  ];

  return (
    <div className={`bg-gray-50 p-4 rounded-lg ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-4">Configuration Summary</h3>
      
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isPast = currentStep > step.id;
          const isFuture = currentStep < step.id;
          
          return (
            <div
              key={step.id}
              className={`
                relative pl-8 pb-3 border-l-2 last:border-l-0
                ${isActive ? 'border-blue-500' : isPast ? 'border-green-500' : 'border-gray-300'}
              `}
            >
              {/* Step indicator */}
              <div
                className={`
                  absolute -left-[9px] w-4 h-4 rounded-full flex items-center justify-center
                  ${isActive ? 'bg-blue-500' : isPast ? 'bg-green-500' : 'bg-gray-300'}
                `}
              >
                {isPast ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>

              {/* Step content */}
              <div
                className={`
                  -mt-1 cursor-pointer transition-colors group relative
                  ${isActive ? 'text-blue-600' : ''}
                `}
                onClick={() => onStepClick?.(step.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getStepIcon(step.id)}
                  <span className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                    {step.title}
                  </span>
                  {step.isComplete && !isActive && (
                    <Check className="w-3 h-3 text-green-500" />
                  )}
                </div>
                
                {/* Tooltip */}
                <div className="absolute left-full top-0 ml-2 z-50 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  {step.description}
                  <div className="absolute -left-1 top-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                </div>
                
                {step.summary && (
                  <div className="ml-6">
                    {step.summary}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation status */}
      {state.errors && Object.keys(state.errors).length > 0 && (
        <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          <div className="font-medium">Validation Issues:</div>
          {Object.entries(state.errors).map(([key, error]) => (
            <div key={key}>• {error}</div>
          ))}
        </div>
      )}

      {state.warnings && Object.keys(state.warnings).length > 0 && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-600">
          <div className="font-medium">Suggestions:</div>
          {Object.entries(state.warnings).map(([key, warning]) => (
            <div key={key}>• {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
};