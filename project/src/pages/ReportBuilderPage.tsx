import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Save, Eye, Settings, Filter, BarChart3, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { useReportBuilder } from '../hooks/reporting/useReportBuilder';
import { useReport } from '../hooks/reporting/useReportData';
import { ReportBuilderSteps } from '../components/reporting/builder/ReportBuilderSteps';
import { DataSourcePanel } from '../components/reporting/builder/DataSourcePanel';
import { DimensionPanel } from '../components/reporting/builder/DimensionPanel';
import { MeasurePanel } from '../components/reporting/builder/MeasurePanel';
import { FilterPanel } from '../components/reporting/builder/FilterPanel';
import { VisualizationPanel } from '../components/reporting/builder/VisualizationPanel';
import { PreviewPanel } from '../components/reporting/builder/PreviewPanel';

const ReportBuilderPage: React.FC = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const isEditing = !!reportId;
  
  // Load existing report if editing
  const { data: existingReport, isLoading: loadingReport } = useReport(reportId || '');
  
  // Report builder state
  const {
    state,
    setBasicInfo,
    addDataSource,
    addDimension,
    addMeasure,
    addFilter,
    setChartType,
    setActiveStep,
    save,
    generatePreview,
    canSave,
    hasChanges,
    isLoading,
    loadReport,
  } = useReportBuilder(reportId);

  // Load existing report data
  useEffect(() => {
    if (existingReport && !loadingReport) {
      loadReport(existingReport);
    }
  }, [existingReport, loadingReport, loadReport]);

  // Handle save
  const handleSave = async () => {
    try {
      await save();
      // Show success message
      console.log('Report saved successfully');
    } catch (error) {
      console.error('Error saving report:', error);
    }
  };

  // Handle preview
  const handlePreview = () => {
    generatePreview();
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate('/reports');
  };

  // Step configuration
  const steps = [
    {
      id: 'basic',
      title: 'Basic Information',
      description: 'Set up report name and description',
      icon: <Settings size={20} />,
      isComplete: !!state.name,
    },
    {
      id: 'datasource',
      title: 'Data Sources',
      description: 'Select your data sources',
      icon: <BarChart3 size={20} />,
      isComplete: state.dataSources.length > 0,
    },
    {
      id: 'dimensions',
      title: 'Dimensions',
      description: 'Choose dimensions for analysis',
      icon: <Filter size={20} />,
      isComplete: state.dimensions.length > 0,
    },
    {
      id: 'measures',
      title: 'Measures',
      description: 'Select measures to analyze',
      icon: <BarChart3 size={20} />,
      isComplete: state.measures.length > 0,
    },
    {
      id: 'filters',
      title: 'Filters',
      description: 'Add filters to refine data',
      icon: <Filter size={20} />,
      isComplete: true, // Optional step
    },
    {
      id: 'visualization',
      title: 'Visualization',
      description: 'Configure chart appearance',
      icon: <Eye size={20} />,
      isComplete: !!state.chartType,
    },
    {
      id: 'preview',
      title: 'Preview',
      description: 'Review and test your report',
      icon: <Eye size={20} />,
      isComplete: false,
    },
  ];

  // Render step content
  const renderStepContent = () => {
    switch (state.activeStep) {
      case 0:
        return (
          <BasicInfoStep 
            name={state.name}
            description={state.description}
            category={state.category}
            type={state.type}
            onUpdate={setBasicInfo}
            errors={state.errors}
          />
        );
      case 1:
        return (
          <DataSourcePanel
            dataSources={state.dataSources}
            onAddDataSource={addDataSource}
            onSelectDataSource={() => {}}
            selectedDataSource={state.selectedDataSource}
          />
        );
      case 2:
        return (
          <DimensionPanel
            dimensions={state.dimensions}
            onAddDimension={addDimension}
            selectedDimensions={state.selectedDimensions}
            onSelectionChange={() => {}}
            dataSources={state.dataSources}
          />
        );
      case 3:
        return (
          <MeasurePanel
            measures={state.measures}
            onAddMeasure={addMeasure}
            selectedMeasures={state.selectedMeasures}
            onSelectionChange={() => {}}
            dataSources={state.dataSources}
          />
        );
      case 4:
        return (
          <FilterPanel
            filters={state.filters}
            onAddFilter={addFilter}
            dimensions={state.dimensions}
            measures={state.measures}
            dataSources={state.dataSources}
          />
        );
      case 5:
        return (
          <VisualizationPanel
            chartType={state.chartType}
            onChartTypeChange={setChartType}
            visualizationSettings={state.visualizationSettings}
            onSettingsChange={() => {}}
            dimensions={state.dimensions}
            measures={state.measures}
          />
        );
      case 6:
        return (
          <PreviewPanel
            previewData={state.previewData}
            isLoading={isLoading}
            onGeneratePreview={handlePreview}
            reportConfig={state}
          />
        );
      default:
        return null;
    }
  };

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={handleBack}
                className="mr-4"
              >
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Report' : 'Create New Report'}
              </h1>
              {hasChanges && (
                <span className="ml-2 inline-flex items-center text-sm text-amber-600">
                  <AlertCircle size={16} className="mr-1" />
                  Unsaved changes
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {state.isValid && (
                <span className="inline-flex items-center text-sm text-green-600">
                  <CheckCircle size={16} className="mr-1" />
                  Valid configuration
                </span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                icon={<Eye size={16} />}
                onClick={handlePreview}
                disabled={!state.isValid || isLoading}
              >
                Preview
              </Button>
              
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={16} />}
                onClick={handleSave}
                disabled={!canSave || isLoading}
                loading={isLoading}
              >
                {isEditing ? 'Save Changes' : 'Create Report'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <ReportBuilderSteps
              steps={steps}
              currentStep={state.activeStep}
              onStepChange={setActiveStep}
              errors={state.errors}
              warnings={state.warnings}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <div className="p-6">
                {renderStepContent()}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Basic Info Step Component
const BasicInfoStep: React.FC<{
  name: string;
  description: string;
  category: string;
  type: string;
  onUpdate: (updates: any) => void;
  errors: Record<string, string>;
}> = ({ name, description, category, type, onUpdate, errors }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        <p className="text-sm text-gray-600 mb-6">
          Provide basic information about your report to help organize and identify it.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Report Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter report name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Describe the purpose of this report"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => onUpdate({ category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="analytics">Analytics</option>
              <option value="operational">Operational</option>
              <option value="compliance">Compliance</option>
              <option value="research">Research</option>
              <option value="executive">Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => onUpdate({ type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="chart">Chart</option>
              <option value="table">Table</option>
              <option value="dashboard">Dashboard</option>
              <option value="export">Export</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilderPage;