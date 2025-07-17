/**
 * SecureCSVExporter - Security-hardened CSV export implementation
 * Prevents CSV injection attacks and implements rate limiting
 */

interface Column {
  field: string;
  label: string;
  type?: string;
}

interface ExportResult {
  blob: Blob;
  filename: string;
  rowCount: number;
}

export class SecureCSVExporter {
  // Security: Prefixes that can trigger formula execution in spreadsheet apps
  private static readonly DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];
  
  // Rate limiting configuration
  private static lastExportTime = 0;
  private static readonly RATE_LIMIT_MS = 1000; // 1 second between exports
  private static readonly MAX_ROWS_PER_EXPORT = 100000; // Prevent memory issues
  
  /**
   * Sanitize a single cell value to prevent CSV injection
   */
  static sanitizeCell(value: any): string {
    // Handle null/undefined
    if (value === null || value === undefined) return '';
    
    let str = String(value);
    
    // Security: Escape double quotes by doubling them
    str = str.replace(/"/g, '""');
    
    // Security: Prevent formula injection
    if (this.DANGEROUS_PREFIXES.some(prefix => str.startsWith(prefix))) {
      // Prefix with single quote to neutralize formulas
      str = `'${str}`;
    }
    
    // Additional check for hidden formula patterns
    if (str.includes('=') && (str.includes('(') || str.includes('!'))) {
      str = `'${str}`;
    }
    
    // Wrap in quotes if contains delimiter, newline, or quote
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      str = `"${str}"`;
    }
    
    return str;
  }
  
  /**
   * Check if export is allowed based on rate limiting
   */
  private static checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.lastExportTime < this.RATE_LIMIT_MS) {
      return false;
    }
    this.lastExportTime = now;
    return true;
  }
  
  /**
   * Validate export request
   */
  private static validateExportRequest(data: any[], columns: Column[]): void {
    if (!Array.isArray(data)) {
      throw new Error('Export data must be an array');
    }
    
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('At least one column must be specified');
    }
    
    if (data.length > this.MAX_ROWS_PER_EXPORT) {
      throw new Error(`Export limited to ${this.MAX_ROWS_PER_EXPORT.toLocaleString()} rows`);
    }
    
    // Validate column configuration
    columns.forEach((col, index) => {
      if (!col.field || typeof col.field !== 'string') {
        throw new Error(`Invalid column configuration at index ${index}`);
      }
      if (!col.label || typeof col.label !== 'string') {
        throw new Error(`Column at index ${index} must have a label`);
      }
    });
  }
  
  /**
   * Export data to secure CSV format
   */
  static async exportSecure(
    data: any[], 
    columns: Column[],
    filename?: string
  ): Promise<ExportResult> {
    // Rate limiting check
    if (!this.checkRateLimit()) {
      throw new Error('Export rate limit exceeded. Please wait a moment before trying again.');
    }
    
    // Validate inputs
    this.validateExportRequest(data, columns);
    
    try {
      // Build CSV content
      const csvContent = await this.buildCSVContent(data, columns);
      
      // Create blob with BOM for Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { 
        type: 'text/csv;charset=utf-8' 
      });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const finalFilename = filename || `export_${timestamp}.csv`;
      
      return {
        blob,
        filename: finalFilename,
        rowCount: data.length
      };
    } catch (error) {
      // Log error for monitoring
      console.error('CSV export error:', error);
      throw new Error('Failed to export data. Please try again.');
    }
  }
  
  /**
   * Build CSV content from data
   */
  private static async buildCSVContent(
    data: any[], 
    columns: Column[]
  ): Promise<string> {
    const rows: string[] = [];
    
    // Add headers
    const headers = columns.map(col => this.sanitizeCell(col.label));
    rows.push(headers.join(','));
    
    // Process data in chunks to prevent blocking
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      for (const row of chunk) {
        const values = columns.map(col => {
          // Support nested field access (e.g., "user.name")
          const value = this.getNestedValue(row, col.field);
          return this.sanitizeCell(value);
        });
        rows.push(values.join(','));
      }
      
      // Yield to prevent blocking UI
      if (i + CHUNK_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return rows.join('\n');
  }
  
  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }
  
  /**
   * Download the CSV file (browser utility)
   */
  static downloadCSV(result: ExportResult): void {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}