import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/calculations';

const RED = '#D32F2F';

export const BillDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { billId } = route.params;
  const { bills } = useBillStore();
  const { user } = useAuthStore();
  const bill = useMemo(() => bills.find(b => b.id === billId), [bills, billId]);
  
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadLogo = async () => {
      try {
        if (user?.pictureUrl) {
          const base64 = await FileSystem.readAsStringAsync(user.pictureUrl, { encoding: FileSystem.EncodingType.Base64 });
          setLogoBase64(`data:image/jpeg;base64,${base64}`);
        } else {
          // Temporarily disabled default company logo due to corrupted asset
          /*
          const asset = Asset.fromModule(require('../../../assets/company_logo.png'));
          await asset.downloadAsync();
          if (asset.localUri || asset.uri) {
            const uriToRead = asset.localUri || asset.uri;
            if (uriToRead.startsWith('file://') || uriToRead.startsWith('content://')) {
              const base64 = await FileSystem.readAsStringAsync(uriToRead, { encoding: FileSystem.EncodingType.Base64 });
              setLogoBase64(`data:image/png;base64,${base64}`);
            }
          }
          */
        }
      } catch (e) {
        console.warn('Failed to load logo base64', e);
      }
    };
    loadLogo();
  }, [user?.pictureUrl]);

  if (!bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: RED, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Bill not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>GO BACK</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleDownload = async () => {
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri, 
              `Bill_${bill.bill_no}.pdf`, 
              'application/pdf'
            );
            await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            Alert.alert('Success', 'Bill downloaded successfully!');
          } catch (err) {
            console.error("SAF Error:", err);
            Alert.alert(
              'Cannot Save Here', 
              'The selected folder is not writable. Please try a different folder like "Documents", or use the Share button.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share Instead', onPress: () => Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' }) }
              ]
            );
          }
        }
      } else {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to download bill');
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to share bill');
    }
  };

  const generateHTML = () => {
    const itemsHtml = bill.items?.map((item, index) => `
      <tr>
        <td style="width: 5%;">${index + 1}</td>
        <td style="width: 45%;">${item.item_name}</td>
        <td style="width: 15%; text-align: center;">${item.quantity}</td>
        <td style="width: 15%; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="width: 20%; text-align: right;">${formatCurrency(item.line_total)}</td>
      </tr>
    `).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
            .header-info { flex: 1; }
            .company-name { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; }
            .company-contact { font-size: 14px; font-weight: bold; color: #374151; margin: 0 0 5px 0; }
            .company-address { font-size: 12px; color: #4B5563; margin: 0; }
            .company-logo { width: 80px; height: 80px; object-fit: contain; border-radius: 40px; }
            
            .title { text-align: center; font-size: 32px; font-family: serif; margin: 30px 0; }
            
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .meta-box { display: flex; flex-direction: column; }
            .meta-label { font-size: 14px; color: #374151; margin-bottom: 5px; }
            .meta-value { font-size: 16px; font-weight: bold; }
            .text-right { text-align: right; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; font-size: 14px; color: #9CA3AF; text-align: left; }
            td { padding: 10px 0; font-size: 14px; }
            
            .totals-container { margin-top: 20px; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 15px 0; display: flex; justify-content: space-between; align-items: center; }
            .totals-label { font-size: 20px; font-weight: bold; }
            .totals-value { font-size: 20px; font-weight: bold; }
            
            .summary-container { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; }
            .summary-row { display: flex; justify-content: space-between; width: 60%; margin-bottom: 10px; }
            .summary-label { font-size: 14px; color: #374151; }
            .summary-value { font-size: 14px; font-weight: bold; }
            
            .details-container { margin-top: 50px; }
            .details-title { font-size: 16px; margin-bottom: 10px; }
            .details-box { border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 15px 0; font-size: 14px; color: #374151; min-height: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-info">
              <p class="company-name">${user?.businessName || 'Business Name'}</p>
              <p class="company-contact">${user?.phone || ''}</p>
              <p class="company-address">${user?.area || ''}</p>
            </div>
            ${logoBase64 ? `<img src="${logoBase64}" class="company-logo" />` : ''}
          </div>
          
          <h1 class="title">Bill</h1>
          
          <div class="meta-row">
            <div class="meta-box">
              <span class="meta-label">Bill To:</span>
              <span class="meta-value">${bill.party_name}</span>
            </div>
            <div class="meta-box text-right">
              <span class="meta-label">Bill No. ${bill.bill_no}</span>
              <span class="meta-value">${new Date(bill.bill_date).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Name</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 15%; text-align: right;">Price</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="totals-container">
            <span class="totals-label">Total</span>
            <span class="totals-value">${formatCurrency(bill.subtotal)}</span>
          </div>
          
          <div class="summary-container">
            <div class="summary-row">
              <span class="summary-label">Grand Total</span>
              <span class="summary-value">${formatCurrency(bill.total)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Received</span>
              <span class="summary-value">${formatCurrency(bill.paid)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Net Amount</span>
              <span class="summary-value">${formatCurrency(bill.due)}</span>
            </div>
          </div>
          
          <div class="details-container">
            <div class="details-title">Details</div>
            <div class="details-box">
              ${bill.notes || ''}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={[RED, '#B71C1C']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill # {bill.bill_no}</Text>
        <TouchableOpacity onPress={() => { navigation.goBack(); navigation.navigate('CreateNewBillModal', { billId: bill.id }); }} style={{ marginLeft: 'auto' }}>
          <Text style={{ fontSize: 20, color: '#fff' }}>📝</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={{ flex: 1, backgroundColor: '#f3f4f6' }} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.invoiceCard}>
          {/* Header Info */}
          <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>{user?.businessName || 'Your Company Name'}</Text>
              <Text style={styles.companyContact}>{user?.phone || 'No Phone Number'}</Text>
              <Text style={styles.companyAddress}>{user?.area || 'Address not provided'}</Text>
            </View>
            {logoBase64 && (
              <Image 
                source={{ uri: logoBase64 }} 
                style={{ width: 60, height: 60, borderRadius: 30, resizeMode: 'contain' }} 
              />
            )}
          </View>

          <Text style={styles.invoiceTitle}>Bill</Text>

          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Bill To:</Text>
              <Text style={styles.metaValue}>{bill.party_name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Bill No. {bill.bill_no}</Text>
              <Text style={styles.metaValue}>{new Date(bill.bill_date).toLocaleDateString('en-GB')}</Text>
            </View>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.th, { flex: 3 }]}>Name</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Price</Text>
            <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Amount</Text>
          </View>

          {/* Table Body */}
          {bill.items?.map((item, index) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 0.5 }]}>{index + 1}</Text>
              <Text style={[styles.td, { flex: 3 }]}>{item.item_name}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>{formatCurrency(item.unit_price)}</Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>{formatCurrency(item.line_total)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(bill.subtotal)}</Text>
          </View>
          
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Grand Total</Text>
              <Text style={styles.summaryValue}>{formatCurrency(bill.total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Received</Text>
              <Text style={styles.summaryValue}>{formatCurrency(bill.paid)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Net Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(bill.due)}</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Details</Text>
            <View style={styles.detailsBox}>
              <Text style={styles.detailsText}>{bill.notes || ' '}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGrid}>

          <TouchableOpacity style={styles.actionBtn} onPress={handleDownload}>
            <Text style={styles.actionIcon}>⬇️</Text>
            <Text style={styles.actionLabel}>Download Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShareWhatsApp}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionLabel}>Share on WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { paddingBottom: 16 + Math.max(insets.bottom, 12) + 75 }]}>
        <TouchableOpacity style={styles.createNewBtn} onPress={() => { navigation.goBack(); navigation.navigate('CreateNewBillModal'); }}>
          <Text style={styles.createNewText}>CREATE NEW BILL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <LinearGradient colors={['#F97316', '#EA580C']} style={styles.doneGradient}>
            <Text style={styles.doneText}>DONE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RED },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  backBtn: { marginRight: 16 },
  backIcon: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  
  invoiceCard: {
    backgroundColor: '#fff',
    padding: 20,
    minHeight: 500,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  companyName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  companyContact: { fontSize: 12, color: '#374151', fontWeight: 'bold', marginTop: 2 },
  companyAddress: { fontSize: 10, color: '#4B5563', marginTop: 2 },
  
  invoiceTitle: { fontSize: 24, textAlign: 'center', marginVertical: 20, fontFamily: 'serif' },
  
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaLabel: { fontSize: 12, color: '#374151', marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 8, marginBottom: 8 },
  th: { fontSize: 12, color: '#9CA3AF', fontWeight: 'bold' },
  
  tableRow: { flexDirection: 'row', marginBottom: 8 },
  td: { fontSize: 12, color: '#111827' },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, marginTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  
  summaryContainer: { alignItems: 'flex-end', marginTop: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: '60%', marginBottom: 8 },
  summaryLabel: { fontSize: 12, color: '#374151' },
  summaryValue: { fontSize: 12, color: '#111827' },
  
  detailsContainer: { marginTop: 32 },
  detailsTitle: { fontSize: 14, color: '#111827', marginBottom: 8 },
  detailsBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12 },
  detailsText: { fontSize: 12, color: '#374151', minHeight: 40 },
  
  actionGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 24 },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionIcon: { fontSize: 24, marginBottom: 8 },
  actionLabel: { fontSize: 12, color: '#D32F2F', fontWeight: '600', textAlign: 'center' },
  
  footer: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 12
  },
  createNewBtn: {
    flex: 1, height: 50, borderRadius: 25,
    borderWidth: 1, borderColor: '#D32F2F',
    justifyContent: 'center', alignItems: 'center'
  },
  createNewText: { color: '#D32F2F', fontSize: 14, fontWeight: 'bold' },
  doneBtn: { flex: 1, height: 50, borderRadius: 25, overflow: 'hidden' },
  doneGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  doneText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
