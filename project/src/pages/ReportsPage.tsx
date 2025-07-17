import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Plus, 
  Search, 
  Grid3x3, 
  List, 
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Users,
  Trash2,
  Edit,
  Copy,
  Move,
  Clock,
  Star,
  Filter
} from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuthStore } from '../stores/authStore';
import { ReportManagementService } from '../services/reportManagementService';
import type { FolderTreeNode, SavedReport } from '../types/reports';
import { formatDistanceToNow } from 'date-fns';
import CreateFolderModal from '../components/reports/CreateFolderModal';
import ShareFolderModal from '../components/reports/ShareFolderModal';
import MoveReportModal from '../components/reports/MoveReportModal';
import ReportCard from '../components/reports/ReportCard';

export function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // State
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [recentReports, setRecentReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modals
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isShareFolderModalOpen, setIsShareFolderModalOpen] = useState(false);
  const [isMoveReportModalOpen, setIsMoveReportModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderTreeNode | null>(null);
  const [selectedReportToMove, setSelectedReportToMove] = useState<SavedReport | null>(null);
  
  // Load folders on mount
  useEffect(() => {
    loadFolders();
    loadRecentReports();
  }, []);

  // Load reports when folder selection changes
  useEffect(() => {
    if (selectedFolderId) {
      loadReportsInFolder(selectedFolderId);
    }
  }, [selectedFolderId]);

  const loadFolders = async () => {
    try {
      const folderTree = await ReportManagementService.getFolderTree();
      setFolders(folderTree);
      
      // Auto-select first folder if none selected
      if (!selectedFolderId && folderTree.length > 0) {
        setSelectedFolderId(folderTree[0].folder_id);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const loadReportsInFolder = async (folderId: string) => {
    try {
      setIsLoading(true);
      const folderReports = await ReportManagementService.getReportsInFolder(folderId);
      setReports(folderReports);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentReports = async () => {
    try {
      const recent = await ReportManagementService.getRecentReports(5);
      setRecentReports(recent);
    } catch (error) {
      console.error('Error loading recent reports:', error);
    }
  };

  const toggleFolderExpanded = (folderId: string) => {
    const updateFolderTree = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
      return nodes.map(node => {
        if (node.folder_id === folderId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateFolderTree(node.children) };
        }
        return node;
      });
    };
    
    setFolders(updateFolderTree(folders));
  };

  const handleCreateFolder = (parentFolderId?: string) => {
    const parent = parentFolderId 
      ? findFolderById(folders, parentFolderId) 
      : null;
    setSelectedFolder(parent);
    setIsCreateFolderModalOpen(true);
  };

  const handleShareFolder = (folder: FolderTreeNode) => {
    setSelectedFolder(folder);
    setIsShareFolderModalOpen(true);
  };

  const findFolderById = (nodes: FolderTreeNode[], folderId: string): FolderTreeNode | null => {
    for (const node of nodes) {
      if (node.folder_id === folderId) return node;
      if (node.children) {
        const found = findFolderById(node.children, folderId);
        if (found) return found;
      }
    }
    return null;
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
          onClick={() => setSelectedFolderId(folder.folder_id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFolderExpanded(folder.folder_id);
            }}
            className="mr-1"
          >
            {folder.children && folder.children.length > 0 ? (
              folder.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <div className="w-4" />
            )}
          </button>
          
          <div 
            className="w-5 h-5 rounded mr-2 flex items-center justify-center"
            style={{ backgroundColor: folder.color }}
          >
            {folder.isExpanded ? (
              <FolderOpen size={14} className="text-white" />
            ) : (
              <Folder size={14} className="text-white" />
            )}
          </div>
          
          <span className="flex-1 text-sm font-medium">{folder.folder_name}</span>
          
          <div className="opacity-0 hover:opacity-100 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateFolder(folder.folder_id);
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="New subfolder"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShareFolder(folder);
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Share folder"
            >
              <Users size={14} />
            </button>
          </div>
        </div>
        
        {folder.isExpanded && folder.children && (
          <div>{renderFolderTree(folder.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  const filteredReports = reports.filter(report => 
    !searchQuery || 
    report.report_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Folder Tree */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Report Folders</h2>
            <Button
              size="sm"
              onClick={() => handleCreateFolder()}
              className="flex items-center gap-1"
            >
              <Plus size={16} />
              New Folder
            </Button>
          </div>
          
          {/* Recent Reports */}
          {recentReports.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Recent Reports
              </h3>
              <div className="space-y-1">
                {recentReports.map(report => (
                  <button
                    key={report.report_id}
                    onClick={() => navigate(`/reports/${report.report_id}`)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 
                             flex items-center gap-2 text-sm"
                  >
                    <Clock size={14} className="text-gray-400" />
                    <span className="truncate">{report.report_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {folders.length > 0 ? (
            renderFolderTree(folders)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Folder size={48} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No folders yet</p>
              <p className="text-xs mt-1">Create your first folder to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Content - Report List */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-4">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Grid3x3 size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                >
                  <List size={18} />
                </button>
              </div>
              
              <Button
                onClick={() => navigate('/reports/builder')}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                Create Report
              </Button>
            </div>
          </div>
        </div>

        {/* Report Grid/List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading reports...</p>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
              : 'space-y-2'
            }>
              {filteredReports.map(report => (
                <ReportCard
                  key={report.report_id}
                  report={report}
                  viewMode={viewMode}
                  onOpen={() => navigate(`/reports/${report.report_id}`)}
                  onEdit={() => navigate(`/reports/builder?edit=${report.report_id}`)}
                  onDelete={async () => {
                    if (confirm('Are you sure you want to delete this report?')) {
                      await ReportManagementService.deleteReport(report.report_id);
                      loadReportsInFolder(selectedFolderId!);
                    }
                  }}
                  onDuplicate={async () => {
                    try {
                      // Create a copy of the report
                      const originalReport = await ReportManagementService.getReport(report.report_id);
                      if (originalReport) {
                        const duplicatedReport = await ReportManagementService.saveReport({
                          folder_id: selectedFolderId!,
                          report_name: `${report.report_name} (Copy)`,
                          description: report.description ? `${report.description} (Copy)` : undefined,
                          report_type: report.report_type,
                          report_config: originalReport.report_config,
                          data_source_config: originalReport.data_source_config,
                          is_draft: false,
                          is_template: false
                        });
                        
                        // Refresh the reports list
                        loadReportsInFolder(selectedFolderId!);
                        
                        // Show success message
                        alert(`Report "${report.report_name}" duplicated successfully!`);
                      }
                    } catch (error) {
                      console.error('Error duplicating report:', error);
                      alert('Failed to duplicate report. Please try again.');
                    }
                  }}
                  onMove={() => {
                    setSelectedReportToMove(report);
                    setIsMoveReportModalOpen(true);
                  }}
                  onExport={async () => {
                    try {
                      // Get the full report configuration
                      const fullReport = await ReportManagementService.getReport(report.report_id);
                      if (fullReport) {
                        // Create a downloadable JSON file
                        const exportData = {
                          report_name: report.report_name,
                          description: report.description,
                          report_type: report.report_type,
                          created_at: report.created_at,
                          updated_at: report.updated_at,
                          configuration: fullReport.report_config,
                          data_source_config: fullReport.data_source_config
                        };
                        
                        const dataStr = JSON.stringify(exportData, null, 2);
                        const blob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        URL.revokeObjectURL(url);
                        
                        // Show success message
                        alert(`Report "${report.report_name}" exported successfully!`);
                      }
                    } catch (error) {
                      console.error('Error exporting report:', error);
                      alert('Failed to export report. Please try again.');
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No reports yet</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery 
                  ? 'No reports match your search' 
                  : 'Create your first report to get started'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate('/reports/builder')}>
                  Create Report
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isCreateFolderModalOpen && (
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onSuccess={() => {
            loadFolders();
            setIsCreateFolderModalOpen(false);
          }}
          parentFolder={selectedFolder}
        />
      )}

      {isShareFolderModalOpen && selectedFolder && (
        <ShareFolderModal
          isOpen={isShareFolderModalOpen}
          onClose={() => setIsShareFolderModalOpen(false)}
          folder={selectedFolder}
          onSuccess={() => setIsShareFolderModalOpen(false)}
        />
      )}

      {isMoveReportModalOpen && selectedReportToMove && (
        <MoveReportModal
          isOpen={isMoveReportModalOpen}
          onClose={() => {
            setIsMoveReportModalOpen(false);
            setSelectedReportToMove(null);
          }}
          report={selectedReportToMove}
          onSuccess={(newFolderId) => {
            setIsMoveReportModalOpen(false);
            setSelectedReportToMove(null);
            
            // Refresh the reports in the current folder
            loadReportsInFolder(selectedFolderId!);
            
            // Show success message
            alert(`Report moved successfully!`);
          }}
        />
      )}
    </div>
  );
}

export default ReportsPage;