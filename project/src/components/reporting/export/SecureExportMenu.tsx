/**
 * SecureExportMenu - Security-first export UI component
 */

import React, { useState, useCallback } from 'react';
import { Download, FileText, AlertCircle, Check, Loader } from 'lucide-react';
import { SecureCSVExporter } from '../../../services/SecureCSVExporter';
import { ExportAuditor } from '../../../services/ExportAuditor';
import { useAuthStore } from '../../../stores/authStore';
import Button from '../../common/Button';

interface SecureExportMenuProps {
  data: any[];
  columns: {
    field: string;
    label: string;
    type?: string;
  }[];
  reportName?: string;
  onExportStart?: () => void;
  onExportComplete?: (success: boolean) => void;
}

interface ExportState {
  isExporting: boolean;
  error: string | null;
  success: boolean;
  progress: number;
}

export const SecureExportMenu: React.FC<SecureExportMenuProps> = ({
  data,
  columns,
  reportName = 'report',
  onExportStart,
  onExportComplete
}) => {
  const { user } = useAuthStore();
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    error: null,
    success: false,
    progress: 0
  });
  const [showMenu, setShowMenu] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState<string | null>(null);

  const handleExportCSV = useCallback(async () => {
    // TODO: Re-enable authentication check when auth is properly set up
    const userId = user?.id || 'anonymous';

    // Reset state
    setExportState({
      isExporting: true,
      error: null,
      success: false,
      progress: 0
    });
    setShowMenu(false);

    // Notify parent
    onExportStart?.();

    const startTime = Date.now();

    try {
      // Check for suspicious activity
      const activityCheck = await ExportAuditor.checkSuspiciousActivity(userId);
      if (activityCheck.isSuspicious) {
        setSuspiciousActivity(activityCheck.reason || 'Unusual export activity detected');
        
        // Allow export but show warning
        console.warn('Suspicious activity:', activityCheck);
      }

      // Perform secure export
      const result = await SecureCSVExporter.exportSecure(
        data,
        columns,
        `${reportName}_${new Date().toISOString().split('T')[0]}.csv`
      );

      // Log successful export
      await ExportAuditor.logExport(
        userId,
        'csv',
        result.rowCount,
        columns.length,
        result.filename,
        true,
        Date.now() - startTime,
        undefined,
        {
          reportName,
          hasFilters: data.length < 1000 // Assume filtered if small dataset
        }
      );

      // Download the file
      SecureCSVExporter.downloadCSV(result);

      // Update state
      setExportState({
        isExporting: false,
        error: null,
        success: true,
        progress: 100
      });

      // Notify parent
      onExportComplete?.(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setExportState(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      
      // Log failed export
      await ExportAuditor.logExport(
        userId,
        'csv',
        0,
        columns.length,
        '',
        false,
        Date.now() - startTime,
        errorMessage,
        { reportName }
      );

      // Update state
      setExportState({
        isExporting: false,
        error: errorMessage,
        success: false,
        progress: 0
      });

      // Notify parent
      onExportComplete?.(false);

      // Clear error after 5 seconds
      setTimeout(() => {
        setExportState(prev => ({ ...prev, error: null }));
      }, 5000);
    }
  }, [data, columns, reportName, onExportStart, onExportComplete]);

  return (
    <div className="relative">
      {/* Export Button */}
      <Button
        variant="outline"
        size="sm"
        icon={<Download size={16} />}
        onClick={() => setShowMenu(!showMenu)}
        disabled={exportState.isExporting || !data.length}
        className="relative"
      >
        {exportState.isExporting ? (
          <>
            <Loader size={16} className="animate-spin" />
            Exporting...
          </>
        ) : (
          'Export'
        )}
      </Button>

      {/* Dropdown Menu */}
      {showMenu && !exportState.isExporting && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2">
            <button
              onClick={handleExportCSV}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center space-x-2"
            >
              <FileText size={16} />
              <span>Export as CSV</span>
              <span className="ml-auto text-xs text-gray-500">Secure</span>
            </button>
            
            {/* Future export options (disabled for now) */}
            <button
              disabled
              className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed rounded flex items-center space-x-2"
            >
              <FileText size={16} />
              <span>Export as Excel</span>
              <span className="ml-auto text-xs text-gray-400">Coming soon</span>
            </button>
            
            <button
              disabled
              className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed rounded flex items-center space-x-2"
            >
              <FileText size={16} />
              <span>Export as PDF</span>
              <span className="ml-auto text-xs text-gray-400">Coming soon</span>
            </button>
          </div>
          
          {/* Data info */}
          <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
            <p className="text-xs text-gray-600">
              {data.length.toLocaleString()} rows × {columns.length} columns
            </p>
            {data.length > 10000 && (
              <p className="text-xs text-amber-600 mt-1">
                Large dataset - export may take a moment
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {exportState.success && (
        <div className="absolute right-0 mt-2 w-64 bg-green-50 border border-green-200 rounded-lg p-3 z-50">
          <div className="flex items-start space-x-2">
            <Check size={16} className="text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Export successful</p>
              <p className="text-xs text-green-700 mt-1">
                Your secure CSV file has been downloaded
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {exportState.error && (
        <div className="absolute right-0 mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 z-50">
          <div className="flex items-start space-x-2">
            <AlertCircle size={16} className="text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Export failed</p>
              <p className="text-xs text-red-700 mt-1">{exportState.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Suspicious Activity Warning */}
      {suspiciousActivity && (
        <div className="absolute right-0 mt-2 w-80 bg-amber-50 border border-amber-200 rounded-lg p-3 z-50">
          <div className="flex items-start space-x-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Export limit warning</p>
              <p className="text-xs text-amber-700 mt-1">{suspiciousActivity}</p>
              <button
                onClick={() => setSuspiciousActivity(null)}
                className="text-xs text-amber-600 underline mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};