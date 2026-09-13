import { Alert } from 'react-native';
import { exportToExcel } from './excelExport';
import { generateGenericPDF } from './pdfGenerator';

export const handleReportExport = (
  reportName: string,
  data: any[],
  sheetName: string = 'Report'
) => {
  Alert.alert(
    'Export Report',
    'Choose export format:',
    [
      {
        text: 'PDF',
        onPress: async () => {
          try {
            await generateGenericPDF(reportName.replace(/_/g, ' '), data);
          } catch (e) {
            console.error('PDF export failed', e);
            Alert.alert('Error', 'Failed to generate PDF');
          }
        }
      },
      {
        text: 'Excel (XLSX)',
        onPress: async () => {
          try {
            await exportToExcel(reportName, data, sheetName);
          } catch (e) {
            console.error('Excel export failed', e);
            Alert.alert('Error', 'Failed to generate Excel file');
          }
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]
  );
};
