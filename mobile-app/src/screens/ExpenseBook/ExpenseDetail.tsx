import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { formatCurrency } from '../../utils/calculations';

export const ExpenseDetail = ({ route, navigation }: any) => {
  const expense = route.params?.expense;
  const [viewerVisible, setViewerVisible] = React.useState(false);

  if (!expense) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.textGray }}>Expense not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Detail</Text>
        <TouchableOpacity style={{ padding: 8 }} onPress={() => Alert.alert('Edit Expense', 'Expense editing is coming soon.')}>
          <Text style={{ fontSize: 20, color: Colors.textWhite }}>✎</Text>
        </TouchableOpacity>
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={{ padding: 16 }}>
        
        {/* Main Details Card */}
        <View style={styles.card}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.amountText}>{formatCurrency(expense.amount)}</Text>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{expense.description}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{new Date(expense.expense_date).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Note Card */}
        {expense.note ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.noteText}>{expense.note}</Text>
          </View>
        ) : null}

        {/* Receipt Card */}
        {expense.receipt_url ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Receipt</Text>
            <TouchableOpacity 
              style={styles.receiptPlaceholder} 
              onPress={() => setViewerVisible(true)}
              activeOpacity={0.8}
            >
              <Image 
                source={{ uri: expense.receipt_url }} 
                style={{ width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' }} 
              />
              <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>🔍 Tap to View</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal visible={viewerVisible} transparent={true} animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity 
              style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} 
              onPress={() => setViewerVisible(false)}
            >
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
            <Image 
              source={{ uri: expense.receipt_url }} 
              style={{ width: '100%', height: '80%', resizeMode: 'contain' }} 
            />
          </View>
        </Modal>

      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 60,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textWhite, fontWeight: '400' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textWhite },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, elevation: 2
  },
  amountText: { fontSize: 32, fontWeight: '800', color: Colors.error },
  
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: Colors.textGray, fontWeight: '500' },
  value: { fontSize: 14, color: Colors.textWhite, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textWhite, marginBottom: 8 },
  noteText: { fontSize: 14, color: Colors.textGray, lineHeight: 20 },

  receiptPlaceholder: {
    backgroundColor: Colors.bgInput, height: 150, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    borderColor: Colors.border, borderStyle: 'dashed'
  }
});

