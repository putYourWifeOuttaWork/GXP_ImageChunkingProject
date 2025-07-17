import { SecureCSVExporter } from '../SecureCSVExporter';

describe('SecureCSVExporter', () => {
  describe('sanitizeCell', () => {
    it('should escape formula injection attempts', () => {
      expect(SecureCSVExporter.sanitizeCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(SecureCSVExporter.sanitizeCell('+1234')).toBe("'+1234");
      expect(SecureCSVExporter.sanitizeCell('-1234')).toBe("'-1234");
      expect(SecureCSVExporter.sanitizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    });

    it('should handle null and undefined values', () => {
      expect(SecureCSVExporter.sanitizeCell(null)).toBe('');
      expect(SecureCSVExporter.sanitizeCell(undefined)).toBe('');
    });

    it('should escape double quotes', () => {
      expect(SecureCSVExporter.sanitizeCell('Hello "World"')).toBe('"Hello ""World"""');
    });

    it('should wrap values with commas in quotes', () => {
      expect(SecureCSVExporter.sanitizeCell('Hello, World')).toBe('"Hello, World"');
    });

    it('should handle hidden formula patterns', () => {
      expect(SecureCSVExporter.sanitizeCell('test=IMPORTXML()')).toBe("'test=IMPORTXML()");
      expect(SecureCSVExporter.sanitizeCell('data=A1!B2')).toBe("'data=A1!B2");
    });
  });

  describe('exportSecure', () => {
    const mockData = [
      {
        dimensions: { site: 'Site A', date: '2024-01-01' },
        measures: { count: 100, avg: 50 }
      },
      {
        dimensions: { site: 'Site B', date: '2024-01-02' },
        measures: { count: 200, avg: 75 }
      }
    ];

    const mockColumns = [
      { field: 'dimensions.site', label: 'Site' },
      { field: 'dimensions.date', label: 'Date' },
      { field: 'measures.count', label: 'Count' },
      { field: 'measures.avg', label: 'Average' }
    ];

    it('should validate column configuration', async () => {
      const invalidColumns = [{ field: 'test' }]; // Missing label
      
      await expect(
        SecureCSVExporter.exportSecure(mockData, invalidColumns as any)
      ).rejects.toThrow('Column at index 0 must have a label');
    });

    it('should enforce row limits', async () => {
      const largeData = Array(100001).fill(mockData[0]);
      
      await expect(
        SecureCSVExporter.exportSecure(largeData, mockColumns)
      ).rejects.toThrow('Export limited to 100,000 rows');
    });

    it('should enforce rate limiting', async () => {
      // First export should succeed
      await SecureCSVExporter.exportSecure(mockData, mockColumns);
      
      // Immediate second export should fail
      await expect(
        SecureCSVExporter.exportSecure(mockData, mockColumns)
      ).rejects.toThrow('Export rate limit exceeded');
    });

    it('should generate valid CSV content', async () => {
      // Wait for rate limit to clear
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = await SecureCSVExporter.exportSecure(mockData, mockColumns);
      
      expect(result.blob).toBeDefined();
      expect(result.filename).toMatch(/^export_.*\.csv$/);
      expect(result.rowCount).toBe(2);
    });
  });
});