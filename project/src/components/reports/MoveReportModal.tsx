import React, { useState, useEffect } from 'react';
import { Move, Folder, FolderOpen, ChevronRight } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { ReportManagementService } from '../../services/reportManagementService';
import type { FolderTreeNode, SavedReport } from '../../types/reports';

interface MoveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newFolderId: string) => void;
  report: SavedReport;
}

export function MoveReportModal({
  isOpen,
  onClose,
  onSuccess,
  report
}: MoveReportModalProps) {
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const folderTree = await ReportManagementService.getFolderTree();
      setFolders(folderTree);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setIsLoadingFolders(false);
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

  const handleMove = async () => {
    if (!selectedFolderId) return;

    setIsLoading(true);
    try {
      await ReportManagementService.updateReport(report.report_id, {
        folder_id: selectedFolderId
      });
      
      onSuccess(selectedFolderId);
      onClose();
    } catch (error) {
      console.error('Error moving report:', error);
      alert('Failed to move report. Please try again.');
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
            ${folder.folder_id === report.folder_id ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => {
            if (folder.folder_id !== report.folder_id) {
              setSelectedFolderId(folder.folder_id);
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
          
          {folder.folder_id === report.folder_id && (
            <span className="text-xs text-gray-500">(Current)</span>
          )}
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
      title="Move Report"
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <Move size={16} className="text-gray-600" />
          <span className="font-medium text-gray-900">Moving:</span>
          <span className="text-gray-700">{report.report_name}</span>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Select Destination Folder
          </h3>
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
                <p className="text-sm">No folders available</p>
              </div>
            )}
          </div>
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
          onClick={handleMove}
          disabled={isLoading || !selectedFolderId || selectedFolderId === report.folder_id}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Moving...
            </>
          ) : (
            <>
              <Move size={16} />
              Move Report
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

export default MoveReportModal;