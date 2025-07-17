import React from 'react';
import { 
  FileText, 
  BarChart3, 
  PieChart, 
  LineChart,
  Clock,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Move,
  Download
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SavedReport } from '../../types/reports';
import { Dropdown } from '../common/Dropdown';

interface ReportCardProps {
  report: SavedReport;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onExport?: () => void;
}

export function ReportCard({
  report,
  viewMode,
  onOpen,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
  onExport
}: ReportCardProps) {
  // Get icon based on report type or visualization
  const getReportIcon = () => {
    if (report.report_type === 'dashboard') {
      return <BarChart3 size={24} className="text-blue-600" />;
    }
    
    // Check first visualization type
    const firstViz = report.visualizations?.[0];
    if (firstViz) {
      switch (firstViz.visualization_type) {
        case 'pie':
        case 'donut':
          return <PieChart size={24} className="text-purple-600" />;
        case 'line':
        case 'area':
          return <LineChart size={24} className="text-green-600" />;
        case 'bar':
        case 'column':
          return <BarChart3 size={24} className="text-blue-600" />;
        default:
          return <FileText size={24} className="text-gray-600" />;
      }
    }
    
    return <FileText size={24} className="text-gray-600" />;
  };

  const menuItems = [
    { label: 'Edit', icon: Edit, onClick: onEdit },
    { label: 'Duplicate', icon: Copy, onClick: onDuplicate, disabled: !onDuplicate },
    { label: 'Move', icon: Move, onClick: onMove, disabled: !onMove },
    { label: 'Export', icon: Download, onClick: onExport, disabled: !onExport },
    { type: 'separator' as const },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const }
  ];

  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow group relative">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 bg-gray-50 rounded-lg cursor-pointer" onClick={onOpen}>
            {getReportIcon()}
          </div>
          <Dropdown
            trigger={
              <button className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical size={16} />
              </button>
            }
            items={menuItems}
            align="right"
          />
        </div>
        
        <div className="cursor-pointer" onClick={onOpen}>
          
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
            {report.report_name}
          </h3>
          
          {report.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {report.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}
              </span>
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {report.access_count || 0}
              </span>
            </div>
            
            {report.is_draft && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                Draft
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-4">
        <div 
          className="flex-1 flex items-center gap-4 cursor-pointer"
          onClick={onOpen}
        >
          <div className="p-2 bg-gray-50 rounded-lg">
            {getReportIcon()}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {report.report_name}
              </h3>
              {report.is_draft && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                  Draft
                </span>
              )}
            </div>
            
            {report.description && (
              <p className="text-sm text-gray-600 line-clamp-1">
                {report.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400">Updated</span>
              <span>{formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}</span>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400">Views</span>
              <span>{report.access_count || 0}</span>
            </div>
            
            {report.creator && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-400">Created by</span>
                <span>{report.creator.full_name || report.creator.email}</span>
              </div>
            )}
          </div>
        </div>
        
        <Dropdown
          trigger={
            <button className="p-2 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={20} />
            </button>
          }
          items={menuItems}
          align="right"
        />
      </div>
    </div>
  );
}

export default ReportCard;