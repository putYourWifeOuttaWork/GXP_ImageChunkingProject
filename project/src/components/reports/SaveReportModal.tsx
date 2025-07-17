// Backup of SaveReportModal.tsx with working structure
import React, { useState, useEffect } from 'react';
import { Save, Folder, ChevronRight, FileText, FolderOpen, Plus } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import TextArea from '../common/TextArea';
import { Toggle } from '../common/Toggle';
import { ReportManagementService } from '../../services/reportManagementService';
import { reportingDataService } from '../../services/reportingDataService';
import type { FolderTreeNode, ReportType, CreateFolderRequest } from '../../types/reports';
import type { ReportBuilderConfig } from '../../types/reporting';
import CreateFolderModal from './CreateFolderModal';

interface SaveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reportId: string) => void;
  reportConfig: ReportBuilderConfig;
  reportData?: any;
  existingReportId?: string;
  reportType?: ReportType;
  isSaveAs?: boolean;
}

export function SaveReportModal({
  isOpen,
  onClose,
  onSuccess,
  reportConfig,
  reportData,
  existingReportId,
  reportType = 'standard',
  isSaveAs = false
}: SaveReportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saveSnapshot, setSaveSnapshot] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // For folder navigation
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      
      // If editing existing report AND not Save As, load its details
      if (existingReportId && !isSaveAs) {
        loadExistingReport();
      } else {
        // For new reports or Save As, auto-populate from report config
        // The state from useReportBuilder has name/description at root level
        if (reportConfig?.name) {
          // For Save As, append "Copy" to the name
          const baseName = reportConfig.name;
          setReportName(isSaveAs ? `${baseName} (Copy)` : baseName);
          setDescription(reportConfig.description || '');
        } else if (reportConfig?.basicInfo) {
          // Legacy format support
          const baseName = reportConfig.basicInfo.reportName || '';
          setReportName(isSaveAs && baseName ? `${baseName} (Copy)` : baseName);
          setDescription(reportConfig.basicInfo.description || '');
        }
      }
    }
  }, [isOpen, existingReportId, reportConfig, isSaveAs]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    setError(null);
    try {
      const folderTree = await ReportManagementService.getFolderTree();
      
      // If no folders exist, create default folders
      if (folderTree.length === 0) {
        await createDefaultFolders();
        const updatedFolders = await ReportManagementService.getFolderTree();
        setFolders(updatedFolders);
        if (updatedFolders.length > 0) {
          setSelectedFolderId(updatedFolders[0].folder_id);
        }
      } else {
        setFolders(folderTree);
        // Auto-select first folder if none selected
        if (!selectedFolderId && folderTree.length > 0) {
          setSelectedFolderId(folderTree[0].folder_id);
        }
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      setError('Failed to load folders. Please try again.');
    } finally {
      setIsLoadingFolders(false);
    }
  };
  
  const createDefaultFolders = async () => {
    try {
      await ReportManagementService.createFolder({
        folder_name: 'My Reports',
        parent_folder_id: null,
        description: 'Personal reports',
        color: '#3B82F6',
        icon: 'user'
      });
      
      await ReportManagementService.createFolder({
        folder_name: 'Shared Reports',
        parent_folder_id: null,
        description: 'Reports shared with the team',
        color: '#10B981',
        icon: 'users'
      });
    } catch (error: any) {
      console.error('Error creating default folders:', error);
      
      // If we get a 403 error (RLS policy), try to run migration
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        console.log('RLS policy error detected, attempting to run migration...');
        
        try {
          const { runFullMigration } = await import('../../utils/runReportMigration');
          const migrationSuccess = await runFullMigration();
          
          if (migrationSuccess) {
            console.log('Migration completed, retrying folder creation...');
            // Retry folder creation after migration
            await ReportManagementService.createFolder({
              folder_name: 'My Reports',
              parent_folder_id: null,
              description: 'Personal reports',
              color: '#3B82F6',
              icon: 'user'
            });
            
            await ReportManagementService.createFolder({
              folder_name: 'Shared Reports',
              parent_folder_id: null,
              description: 'Reports shared with the team',
              color: '#10B981',
              icon: 'users'
            });
          } else {
            throw new Error('Migration failed');
          }
        } catch (migrationError) {
          console.error('Migration error:', migrationError);
          throw new Error('Database setup required. Please contact support.');
        }
      } else {
        throw error;
      }
    }
  };

  const loadExistingReport = async () => {
    if (!existingReportId) return;
    
    try {
      const report = await ReportManagementService.getReport(existingReportId);
      if (report) {
        setReportName(report.report_name);
        setDescription(report.description || '');
        setSelectedFolderId(report.folder_id);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  const toggleFolderExpanded = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const validateForm = () => {
    if (!reportName.trim()) {
      setValidationError('Report name is required');
      return false;
    }
    if (!selectedFolderId) {
      setValidationError('Please select a folder');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleCreateFolder = async (folderId: string) => {
    setShowCreateFolder(false);
    // Reload folders to include the new one
    await loadFolders();
    // Auto-select the newly created folder
    setSelectedFolderId(folderId);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Log the reportConfig to debug
      console.log('SaveReportModal - reportConfig:', reportConfig);
      
      // The reportConfig is the full state from useReportBuilder
      // It contains all the necessary fields at the root level
      const dataSourceConfig = {
        dataSources: reportConfig.dataSources || [],
        dimensions: reportConfig.dimensions || [],
        measures: reportConfig.measures || [],
        filters: reportConfig.filters || [],
        selectedSegments: reportConfig.selectedSegments || [],
        visualization: reportConfig.visualizationSettings || {},
        chartType: reportConfig.chartType || 'line'
      };

      let reportId: string;

      // If Save As is true, always create a new report
      if (existingReportId && !isSaveAs) {
        // Update existing report
        const updatedReport = await ReportManagementService.updateReport(existingReportId, {
          report_name: reportName.trim(),
          description: description.trim() || undefined,
          report_config: reportConfig,
          data_source_config: dataSourceConfig,
          is_template: saveAsTemplate
        });
        reportId = updatedReport.report_id;
      } else {
        // Save new report (for new reports or Save As)
        console.log('Saving new report with config:', {
          folder_id: selectedFolderId,
          report_name: reportName.trim(),
          is_save_as: isSaveAs
        });
        
        const savedReport = await ReportManagementService.saveReport({
          folder_id: selectedFolderId,
          report_name: reportName.trim(),
          description: description.trim() || undefined,
          report_type: reportType,
          report_config: reportConfig,
          data_source_config: dataSourceConfig,
          is_draft: false,
          is_template: saveAsTemplate
        });
        
        console.log('Saved report result:', savedReport);
        reportId = savedReport.report_id;
        console.log('Extracted report ID:', reportId);
      }

      console.log('About to call onSuccess with reportId:', reportId);
      onSuccess(reportId);
      
      // Reset form
      setReportName('');
      setDescription('');
      setSaveAsTemplate(false);
    } catch (error: any) {
      console.error('Error saving report:', error);
      setError(error.message || 'Failed to save report');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFolderTree = (nodes: FolderTreeNode[], level: number = 0) => {
    return nodes.map(folder => (
      <div key={folder.folder_id}>
        <div
          className={`
            flex items-center px-3 py-2 rounded-lg cursor-pointer
            hover:bg-gray-50 transition-colors
            ${selectedFolderId === folder.folder_id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
          `}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => {
            setSelectedFolderId(folder.folder_id);
            if (validationError && folder.folder_id) {
              setValidationError(null);
            }
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFolderExpanded(folder.folder_id);
            }}
            className="mr-1"
          >
            {folder.children && folder.children.length > 0 ? (
              expandedFolders.has(folder.folder_id) ? 
                <ChevronRight size={16} className="rotate-90 transition-transform" /> : 
                <ChevronRight size={16} className="transition-transform" />
            ) : (
              <div className="w-4" />
            )}
          </button>
          
          <div 
            className="w-5 h-5 rounded mr-2 flex items-center justify-center"
            style={{ backgroundColor: folder.color }}
          >
            {expandedFolders.has(folder.folder_id) ? (
              <FolderOpen size={14} className="text-white" />
            ) : (
              <Folder size={14} className="text-white" />
            )}
          </div>
          
          <span className="flex-1 text-sm font-medium">{folder.folder_name}</span>
        </div>
        
        {expandedFolders.has(folder.folder_id) && folder.children && (
          <div>{renderFolderTree(folder.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSaveAs ? 'Save As New Report' : (existingReportId ? 'Update Report' : 'Save Report')}
      size="lg"
    >
      <div className="flex gap-6 min-h-[400px]">
        {/* Left side - Folder selection */}
        <div className="w-1/3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Select Folder
            </h3>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="text-primary hover:text-primary-dark flex items-center gap-1 text-sm font-medium"
              disabled={isLoadingFolders}
            >
              <Plus size={14} />
              New
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg h-64 overflow-y-auto">
            {isLoadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-gray-500">Loading folders...</span>
              </div>
            ) : folders.length > 0 ? (
              <div className="p-2">
                {renderFolderTree(folders)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Folder size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm mb-2">No folders available</p>
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="text-primary hover:text-primary-dark text-sm underline"
                >
                  Create your first folder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Report details */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Report Name <span className="text-red-500">*</span>
              </label>
              {reportConfig?.name && !reportName && (
                <span className="text-xs text-gray-500">(from report configuration)</span>
              )}
            </div>
            <Input
              type="text"
              value={reportName}
              onChange={(e) => {
                setReportName(e.target.value);
                if (validationError && e.target.value.trim()) {
                  setValidationError(null);
                }
              }}
              placeholder="e.g., Monthly Growth Analysis"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              {reportConfig?.description && !description && (
                <span className="text-xs text-gray-500">(from report configuration)</span>
              )}
            </div>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this report"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3">
                <label className="text-sm font-medium text-gray-700">
                  Save data snapshot
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Save the current data with the report for faster loading
                </p>
              </div>
              <Toggle
                checked={saveSnapshot}
                onChange={setSaveSnapshot}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3">
                <label className="text-sm font-medium text-gray-700">
                  Save as template
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allow this report to be used as a starting point for new reports
                </p>
              </div>
              <Toggle
                checked={saveAsTemplate}
                onChange={setSaveAsTemplate}
              />
            </div>
          </div>

          {(error || validationError) && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
              {error || validationError}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isLoading || isLoadingFolders || !reportName.trim() || !selectedFolderId}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              {isSaveAs ? 'Save As New Report' : (existingReportId ? 'Update Report' : 'Save Report')}
            </>
          )}
        </Button>
      </div>
      
      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSuccess={handleCreateFolder}
      />
    </Modal>
  );
}

export default SaveReportModal;