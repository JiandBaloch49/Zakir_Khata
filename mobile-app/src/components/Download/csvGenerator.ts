import * as FileSystem from 'expo-file-system';
import { ReportOptions } from '../../types/download.types';

export const generateCsvFile = async (
  options: ReportOptions,
  data: any[],
  headers: string[],
  rowMapper: (row: any) => string[]
): Promise<string> => {
  const headerRow = headers.join(',');
  const bodyRows = data.map(r => rowMapper(r).join(',')).join('\n');
  const csvContent = `${headerRow}\n${bodyRows}`;

  const fileName = `${options.reportType}_report_${Date.now()}.csv`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
  return fileUri;
};
