import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, Eye, Settings, Filter, BarChart3, ArrowLeft, AlertCircle, CheckCircle, RotateCcw, Zap } from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { useReportBuilder } from '../hooks/reporting/useReportBuilder';
import { useReport } from '../hooks/reporting/useReportData';
import { DataSourcePanel } from '../components/reporting/builder/DataSourcePanel';
import { DimensionPanel } from '../components/reporting/builder/DimensionPanel';
import { MeasurePanel } from '../components/reporting/builder/MeasurePanel';
import { FilterPanel } from '../components/reporting/builder/FilterPanel';
import { VisualizationPanel } from '../components/reporting/builder/VisualizationPanel';
import { PreviewPanel } from '../components/reporting/builder/PreviewPanel';
import { DatabaseConnectionTest } from '../components/reporting/builder/DatabaseConnectionTest';
import { ConfigurationTrail } from '../components/reporting/builder/ConfigurationTrail';
import SaveReportModal from '../components/reports/SaveReportModal';

const ReportBuilderPage: React.FC = () => {
  const { reportId: urlReportId } = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();
  const queryReportId = searchParams.get('edit');
  const navigate = useNavigate();
  
  // Check both URL param and query param for report ID
  const reportId = urlReportId || queryReportId || undefined;
  const isEditing = !!reportId;
  
  // Load existing report if editing
  const { data: existingReport, isLoading: loadingReport } = useReport(reportId || '');
  
  // Report builder state
  const {
    state,
    setBasicInfo,
    addDataSource,
    updateDataSource,
    removeDataSource,
    addDimension,
    updateDimension,
    setDimensions,
    removeDimension,
    addMeasure,
    updateMeasure,
    removeMeasure,
    addFilter,
    updateFilter,
    removeFilter,
    updateFilterGroups,
    setChartType,
    setActiveStep,
    setSelectedSegments,
    setIsolationFilters,
    save,
    generatePreview,
    getAvailableDimensions,
    getAvailableMeasures,
    canSave,
    hasChanges,
    isLoading,
    loadReport,
    resetState,
    hasDuplicateDimensions,
    duplicateCount,
    consolidateDimensions,
    markAsSaved,
  } = useReportBuilder(reportId);

  // Modal states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [isSaveAs, setIsSaveAs] = useState(false);

  // Load existing report data or reset for new report
  useEffect(() => {
    if (!reportId) {
      // Creating a new report - reset state to clear any cached data
      resetState();
    } else if (existingReport && !loadingReport) {
      // Editing existing report - load the data
      loadReport(existingReport);
      setEditReportId(reportId);
    }
  }, [existingReport, loadingReport, loadReport, reportId, resetState]);

  // Handle save modal success
  const handleSaveSuccess = (savedReportId: string) => {
    console.log('Save success callback called with ID:', savedReportId);
    console.log('Is Save As?', isSaveAs);
    
    setIsSaveModalOpen(false);
    
    if (!savedReportId) {
      console.error('No report ID provided in save success callback');
      return;
    }
    
    // Reset the unsaved changes state after successful save
    markAsSaved();
    
    if (isSaveAs) {
      // For Save As, navigate to the new report in edit mode
      console.log('Navigating to new report in edit mode:', `/reports/${savedReportId}`);
      navigate(`/reports/${savedReportId}`);
    } else {
      // For regular save, stay on the same page (already saved)
      console.log('Staying on current page after save');
      // Update the edit report ID to the newly saved report ID
      setEditReportId(savedReportId);
    }
  };

  // Handle save
  const handleSave = async () => {
    // Check if report is valid before saving
    if (!state.isValid) {
      alert('Please fix the validation errors before saving the report.');
      return;
    }
    
    // Generate preview data before opening save modal
    try {
      const preview = await generatePreview();
      setPreviewData(preview);
      setIsSaveAs(false);
      setIsSaveModalOpen(true);
    } catch (error) {
      console.error('Preview generation failed:', error);
      // Still allow saving even if preview fails
      setPreviewData(null);
      setIsSaveAs(false);
      setIsSaveModalOpen(true);
    }
  };

  // Handle save as new report
  const handleSaveAs = async () => {
    // Check if report is valid before saving
    if (!state.isValid) {
      alert('Please fix the validation errors before saving the report.');
      return;
    }
    
    // For Save As, we don't need to wait for preview - just open the modal
    setIsSaveAs(true);
    setIsSaveModalOpen(true);
    
    // Generate preview data in the background (optional)
    try {
      const preview = await generatePreview();
      if (preview) {
        setPreviewData(preview);
      }
    } catch (error) {
      console.warn('Preview generation failed for Save As:', error);
      // Continue without preview data
    }
  };

  // Handle preview
  const handlePreview = () => {
    generatePreview();
    setActiveStep(6); // Navigate to preview step
  };

  // Handle back navigation
  const handleBack = () => {
    console.log('handleBack called, hasChanges:', hasChanges);
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      console.log('User confirmed:', confirmed);
      if (confirmed) {
        // User confirmed they want to leave
        console.log('Navigating to /reports');
        navigate('/reports');
      }
      return;
    }
    // No changes, safe to navigate
    console.log('No changes, navigating to /reports');
    navigate('/reports');
  };

  // Handle reset
  const handleReset = () => {
    const confirmed = window.confirm('Are you sure you want to reset all configuration? This will clear all data sources, dimensions, measures, and filters.');
    if (confirmed) {
      resetState();
    }
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
            onUpdateDataSource={updateDataSource}
            onRemoveDataSource={removeDataSource}
            onSelectDataSource={() => {}}
            selectedDataSource={state.selectedDataSource}
          />
        );
      case 2:
        return (
          <DimensionPanel
            dimensions={state.dimensions}
            onAddDimension={addDimension}
            onUpdateDimension={updateDimension}
            onReorderDimensions={setDimensions}
            onRemoveDimension={removeDimension}
            selectedDimensions={state.selectedDimensions}
            onSelectionChange={() => {}}
            dataSources={state.dataSources}
            availableDimensions={getAvailableDimensions()}
          />
        );
      case 3:
        return (
          <MeasurePanel
            measures={state.measures}
            onAddMeasure={addMeasure}
            onUpdateMeasure={updateMeasure}
            onRemoveMeasure={removeMeasure}
            selectedMeasures={state.selectedMeasures}
            onSelectionChange={() => {}}
            dataSources={state.dataSources}
            availableMeasures={getAvailableMeasures()}
          />
        );
      case 4:
        return (
          <FilterPanel
            filters={state.filters}
            filterGroups={state.filterGroups}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onUpdateFilterGroups={updateFilterGroups}
            dimensions={state.dimensions}
            measures={state.measures}
            dataSources={state.dataSources}
            selectedSegments={state.selectedSegments}
            onSegmentChange={setSelectedSegments}
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
            onIsolationFiltersChange={setIsolationFilters}
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
                icon={<RotateCcw size={16} />}
                onClick={handleReset}
                disabled={false}  // Always enabled to allow clearing stuck queries
                className={isLoading ? "text-orange-600 border-orange-300 hover:bg-orange-50" : "text-red-600 border-red-300 hover:bg-red-50"}
              >
                {isLoading ? 'Force Reset' : 'Reset'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                icon={<Eye size={16} />}
                onClick={handlePreview}
                disabled={!state.isValid}
                isLoading={isLoading}
              >
                {isLoading ? 'Loading...' : 'Preview'}
              </Button>
              
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Save size={16} />}
                    onClick={handleSaveAs}
                    disabled={!state.isValid || isLoading}
                  >
                    Save As
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save size={16} />}
                    onClick={handleSave}
                    disabled={!state.isValid || isLoading}
                    isLoading={isLoading}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save size={16} />}
                  onClick={handleSave}
                  disabled={!canSave || isLoading}
                  isLoading={isLoading}
                >
                  Create Report
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Configuration Trail */}
          <div className="lg:col-span-1">
            <ConfigurationTrail
              state={state}
              currentStep={state.activeStep}
              onStepClick={setActiveStep}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Database Connection Test (only show on data source step) */}
            {state.activeStep === 1 && <DatabaseConnectionTest />}
            
            {/* Duplicate Dimensions Notification */}
            {hasDuplicateDimensions && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-amber-800">
                      Duplicate Dimensions Detected
                    </h3>
                    <div className="mt-1 text-sm text-amber-700">
                      <p>
                        You have {duplicateCount} duplicate dimension{duplicateCount > 1 ? 's' : ''} that will be automatically consolidated when previewing or saving your report.
                      </p>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={consolidateDimensions}
                        className="bg-amber-100 px-3 py-2 rounded-md text-sm font-medium text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                      >
                        Consolidate Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Card>
              <div className="p-6">
                {renderStepContent()}
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Save Report Modal */}
      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSuccess={handleSaveSuccess}
        reportConfig={state}
        reportData={previewData}
        existingReportId={editReportId || undefined}
        reportType="standard"
        isSaveAs={isSaveAs}
      />
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