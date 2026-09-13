import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const exportToCSV = async (filename: string, headers: string[], data: any[][]): Promise<void> => {
  // Build CSV string
  const rows = [headers, ...data];
  const csvContent = rows
    .map((row) => 
      row.map((cell) => {
        // Escape quotes and wrap in quotes if there's a comma
        const cellString = String(cell ?? '');
        if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
          return `"${cellString.replace(/"/g, '""')}"`;
        }
        return cellString;
      }).join(',')
    )
    .join('\n');

  // Define file URI
  const fileUri = `${FileSystem.documentDirectory}${filename}.csv`;

  try {
    // Write the CSV content to a local file
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Open native share dialog
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Share ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      console.warn('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw error;
  }
};
