
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get all unique keys from all objects to handle cases where some objects might have missing properties
  const allKeys = [...new Set(data.flatMap(obj => Object.keys(obj)))];
  
  // Create CSV header
  const csvHeader = allKeys.join(',');
  
  // Create CSV rows
  const csvRows = data.map(obj => 
    allKeys.map(key => {
      const value = obj[key];
      
      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert objects/arrays to JSON strings
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',')
  );
  
  // Combine header and rows
  const csvContent = [csvHeader, ...csvRows].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
