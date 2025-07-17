/**
 * ExportAuditor - Tracks and monitors all export activities for security
 */

import { supabase } from '../lib/supabaseClient';

interface ExportAuditLog {
  user_id: string;
  action: 'export';
  export_type: 'csv' | 'excel' | 'pdf' | 'png' | 'svg';
  row_count: number;
  column_count: number;
  filename: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  duration_ms: number;
  metadata?: Record<string, any>;
}

interface SuspiciousActivityResult {
  isSuspicious: boolean;
  reason?: string;
  exportCount?: number;
  recommendations?: string[];
}

export class ExportAuditor {
  // Suspicious activity thresholds
  private static readonly HOURLY_EXPORT_LIMIT = 10;
  private static readonly DAILY_EXPORT_LIMIT = 50;
  private static readonly LARGE_EXPORT_THRESHOLD = 10000; // rows
  
  /**
   * Log an export activity
   */
  static async logExport(
    userId: string,
    exportType: 'csv' | 'excel' | 'pdf' | 'png' | 'svg',
    rowCount: number,
    columnCount: number,
    filename: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const auditEntry: ExportAuditLog = {
        user_id: userId,
        action: 'export',
        export_type: exportType,
        row_count: rowCount,
        column_count: columnCount,
        filename,
        success,
        duration_ms: durationMs,
        error_message: errorMessage,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
      };
      
      // Get client info if available
      if (typeof window !== 'undefined') {
        auditEntry.user_agent = navigator.userAgent;
        // Note: Getting real IP requires server-side implementation
      }
      
      // TODO: Create audit_logs table in migration
      // For now, just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[ExportAudit]', auditEntry);
      }
      
      // Uncomment when audit_logs table is created:
      // const { error } = await supabase
      //   .from('audit_logs')
      //   .insert(auditEntry);
      // 
      // if (error) {
      //   console.error('Failed to log export audit:', error);
      //   // Don't throw - logging failure shouldn't break export
      // }
      
      // Check for suspicious activity in background
      this.checkSuspiciousActivityBackground(userId);
    } catch (error) {
      console.error('Export audit error:', error);
      // Don't throw - logging failure shouldn't break export
    }
  }
  
  /**
   * Check for suspicious export activity
   */
  static async checkSuspiciousActivity(userId: string): Promise<SuspiciousActivityResult> {
    try {
      // TODO: Implement when audit_logs table is created
      // For now, return no suspicious activity
      return { isSuspicious: false };
      
      /* Uncomment when audit_logs table is created:
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);
      
      // Get recent export activity
      const { data: hourlyExports, error: hourlyError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action', 'export')
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (hourlyError) {
        console.error('Failed to check hourly exports:', hourlyError);
        return { isSuspicious: false };
      }
      
      // Check hourly limit
      if (hourlyExports && hourlyExports.length >= this.HOURLY_EXPORT_LIMIT) {
        return {
          isSuspicious: true,
          reason: `Exceeded hourly export limit (${this.HOURLY_EXPORT_LIMIT} exports/hour)`,
          exportCount: hourlyExports.length,
          recommendations: [
            'Consider batching your exports',
            'Use filters to reduce data size',
            'Contact support if you need higher limits'
          ]
        };
      }
      
      // Check daily limit
      const { data: dailyExports, error: dailyError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action', 'export')
        .gte('created_at', oneDayAgo.toISOString());
      
      if (dailyError) {
        console.error('Failed to check daily exports:', dailyError);
        return { isSuspicious: false };
      }
      
      if (dailyExports && dailyExports.length >= this.DAILY_EXPORT_LIMIT) {
        return {
          isSuspicious: true,
          reason: `Exceeded daily export limit (${this.DAILY_EXPORT_LIMIT} exports/day)`,
          exportCount: dailyExports.length,
          recommendations: [
            'Schedule exports during off-peak hours',
            'Consider using our API for automated exports',
            'Contact support for enterprise limits'
          ]
        };
      }
      
      // Check for rapid successive exports (potential data scraping)
      if (hourlyExports && hourlyExports.length > 3) {
        const timestamps = hourlyExports.map(e => new Date(e.created_at).getTime());
        const intervals = [];
        
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i-1] - timestamps[i]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // If average interval is less than 30 seconds, flag as suspicious
        if (avgInterval < 30000) {
          return {
            isSuspicious: true,
            reason: 'Rapid successive exports detected',
            exportCount: hourlyExports.length,
            recommendations: [
              'Please allow time between exports',
              'Consider combining multiple exports',
              'Use our bulk export feature'
            ]
          };
        }
      }
      
      // Check for large exports
      const largeExports = hourlyExports?.filter(e => 
        e.row_count > this.LARGE_EXPORT_THRESHOLD
      ) || [];
      
      if (largeExports.length > 2) {
        return {
          isSuspicious: true,
          reason: 'Multiple large exports detected',
          exportCount: largeExports.length,
          recommendations: [
            'Consider filtering data before export',
            'Use pagination for large datasets',
            'Contact support for bulk export options'
          ]
        };
      }
      
      return { isSuspicious: false };
      */
    } catch (error) {
      console.error('Suspicious activity check error:', error);
      return { isSuspicious: false };
    }
  }
  
  /**
   * Check suspicious activity in background (non-blocking)
   */
  private static checkSuspiciousActivityBackground(userId: string): void {
    this.checkSuspiciousActivity(userId)
      .then(result => {
        if (result.isSuspicious) {
          console.warn('Suspicious export activity detected:', result);
          // Could trigger alerts, notifications, or temporary restrictions
        }
      })
      .catch(error => {
        console.error('Background activity check failed:', error);
      });
  }
  
  /**
   * Get export statistics for a user
   */
  static async getExportStats(userId: string, days: number = 30): Promise<any> {
    try {
      // TODO: Implement when audit_logs table is created
      // For now, return empty stats
      return {
        totalExports: 0,
        byType: {},
        totalRows: 0,
        avgRowsPerExport: 0,
        largeExports: 0,
        failedExports: 0,
        avgDuration: 0,
      };
      
      /* Uncomment when audit_logs table is created:
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action', 'export')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Calculate statistics
      const stats = {
        totalExports: data?.length || 0,
        byType: {} as Record<string, number>,
        totalRows: 0,
        avgRowsPerExport: 0,
        largeExports: 0,
        failedExports: 0,
        avgDuration: 0,
      };
      
      if (data && data.length > 0) {
        let totalDuration = 0;
        
        data.forEach(log => {
          // Count by type
          stats.byType[log.export_type] = (stats.byType[log.export_type] || 0) + 1;
          
          // Sum rows
          stats.totalRows += log.row_count || 0;
          
          // Count large exports
          if (log.row_count > this.LARGE_EXPORT_THRESHOLD) {
            stats.largeExports++;
          }
          
          // Count failures
          if (!log.success) {
            stats.failedExports++;
          }
          
          // Sum duration
          totalDuration += log.duration_ms || 0;
        });
        
        stats.avgRowsPerExport = Math.round(stats.totalRows / data.length);
        stats.avgDuration = Math.round(totalDuration / data.length);
      }
      
      return stats;
      */
    } catch (error) {
      console.error('Failed to get export stats:', error);
      throw error;
    }
  }
}