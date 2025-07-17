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

interface SaveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reportId: string) => void;
  reportConfig: ReportBuilderConfig;
  reportData?: any;
  existingReportId?: string;
  reportType?: ReportType;
}

export function SaveReportModal({
  isOpen,
  onClose,
  onSuccess,
  reportConfig,
  reportData,
  existingReportId,
  reportType = 'standard'
}: SaveReportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saveSnapshot, setSaveSnapshot] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For folder navigation
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      
      // If editing existing report, load its details
      if (existingReportId) {
        loadExistingReport();
      }
    }
  }, [isOpen, existingReportId]);

  const loadFolders = async () => {
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
    } catch (error) {
      console.error('Error creating default folders:', error);
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

  const handleSave = async () => {
    if (!reportName.trim()) {
      setError('Report name is required');
      return;
    }

    if (!selectedFolderId) {
      setError('Please select a folder');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare data source config
      const dataSourceConfig = {
        program_ids: reportConfig.dataSources.selectedPrograms,
        date_range: {
          start: reportConfig.dataSources.dateRange.startDate,
          end: reportConfig.dataSources.dateRange.endDate
        },
        filters: {
          sites: reportConfig.dataSources.selectedSites,
          aggregationLevel: reportConfig.aggregation.level,
          groupBy: reportConfig.aggregation.groupBy,
          includeArchived: reportConfig.dataSources.includeArchived
        }
      };

      let reportId: string;

      if (existingReportId) {
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
        // Save new report
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
        reportId = savedReport.report_id;
      }

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingReportId ? 'Update Report' : 'Save Report'}
      size="lg"
    >
      <div className="flex gap-6 min-h-[400px]">
        {/* Left side - Folder selection */}
        <div className="w-1/3">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Select Folder
          </h3>
          <div className="border border-gray-200 rounded-lg h-64 overflow-y-auto">
            {folders.length > 0 ? (
              <div className="p-2">
                {/* Folder tree would go here */}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Folder size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No folders available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Report details */}
        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g., Monthly Growth Analysis"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
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

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
              {error}
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
          disabled={isLoading || !reportName.trim() || !selectedFolderId}
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
              {existingReportId ? 'Update Report' : 'Save Report'}
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

export default SaveReportModal;