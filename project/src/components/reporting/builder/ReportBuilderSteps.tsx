import React from 'react';
import { Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isComplete: boolean;
}

interface ReportBuilderStepsProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export const ReportBuilderSteps: React.FC<ReportBuilderStepsProps> = ({
  steps,
  currentStep,
  onStepChange,
  errors,
  warnings,
}) => {
  const getStepStatus = (stepIndex: number, step: Step) => {
    const stepId = step.id;
    const hasError = Object.keys(errors).some(key => key.includes(stepId));
    const hasWarning = Object.keys(warnings).some(key => key.includes(stepId));
    
    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    if (step.isComplete) return 'complete';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  const getStepIcon = (stepIndex: number, step: Step) => {
    const status = getStepStatus(stepIndex, step);
    
    switch (status) {
      case 'complete':
        return <Check size={20} className="text-green-600" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-600" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-yellow-600" />;
      case 'active':
        return <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>;
      default:
        return step.icon;
    }
  };

  const getStepClassName = (stepIndex: number, step: Step) => {
    const status = getStepStatus(stepIndex, step);
    const baseClassName = 'flex items-start p-4 rounded-lg cursor-pointer transition-colors';
    
    switch (status) {
      case 'complete':
        return `${baseClassName} bg-green-50 border-l-4 border-green-500 hover:bg-green-100`;
      case 'error':
        return `${baseClassName} bg-red-50 border-l-4 border-red-500 hover:bg-red-100`;
      case 'warning':
        return `${baseClassName} bg-yellow-50 border-l-4 border-yellow-500 hover:bg-yellow-100`;
      case 'active':
        return `${baseClassName} bg-primary-50 border-l-4 border-primary-500 hover:bg-primary-100`;
      default:
        return `${baseClassName} bg-gray-50 border-l-4 border-gray-200 hover:bg-gray-100`;
    }
  };

  const getStepTextClassName = (stepIndex: number, step: Step) => {
    const status = getStepStatus(stepIndex, step);
    
    switch (status) {
      case 'complete':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
      case 'active':
        return 'text-primary-900';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Report Builder</h2>
        <p className="text-sm text-gray-600">
          Follow these steps to create your report
        </p>
      </div>

      {steps.map((step, index) => (
        <div
          key={step.id}
          className={getStepClassName(index, step)}
          onClick={() => onStepChange(index)}
        >
          <div className="flex-shrink-0 mr-3 mt-1">
            {getStepIcon(index, step)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-medium ${getStepTextClassName(index, step)}`}>
                {step.title}
              </h3>
              <span className="text-xs text-gray-500 ml-2">
                {index + 1}/{steps.length}
              </span>
            </div>
            
            <p className={`text-xs mt-1 ${getStepTextClassName(index, step)} opacity-80`}>
              {step.description}
            </p>
            
            {/* Show errors/warnings for this step */}
            {Object.entries(errors).map(([key, message]) => {
              if (key.includes(step.id)) {
                return (
                  <div key={key} className="mt-2 flex items-center text-xs text-red-600">
                    <AlertCircle size={12} className="mr-1" />
                    {message}
                  </div>
                );
              }
              return null;
            })}
            
            {Object.entries(warnings).map(([key, message]) => {
              if (key.includes(step.id)) {
                return (
                  <div key={key} className="mt-2 flex items-center text-xs text-yellow-600">
                    <AlertTriangle size={12} className="mr-1" />
                    {message}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      ))}

      {/* Progress bar */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};