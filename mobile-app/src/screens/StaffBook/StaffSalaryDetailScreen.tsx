import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StaffRecord } from '../../types/staff.types';
import { updateStaffSalary } from '../../services/database/staffDb';
import {
  getSalaryTransactionsByStaffId,
  addStaffSalaryTransaction,
  StaffSalaryTransaction
} from '../../services/database/staffSalaryDb';
import { formatCurrency, rupeesToPaisa, paisaToRupeesString } from '../../utils/calculations';
import { getDisplayName } from '../../utils/displayName';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

const getCurrentMonthKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

export const StaffSalaryDetailScreen = ({ route, navigation }: any) => {
  const [staff, setStaff] = useState<StaffRecord>(route.params?.staff);
  const { user } = useAuthStore();
  const { nameDisplayMode } = useSettingsStore();

  const [transactions, setTransactions] = useState<StaffSalaryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Month filter state (defaults to Current Month 'YYYY-MM')
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const monthScrollRef = useRef<ScrollView>(null);

  // Salary Payment Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [inputDate, setInputDate] = useState(() => todayDate());
  const [inputNote, setInputNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Set Monthly Salary Modal State
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [inputMonthlySalary, setInputMonthlySalary] = useState(
    staff?.monthly_salary ? paisaToRupeesString(staff.monthly_salary) : ''
  );
  const [savingSalary, setSavingSalary] = useState(false);

  const loadSalaryData = async () => {
    if (!staff?.id) return;
    try {
      setLoading(true);
      const data = await getSalaryTransactionsByStaffId(staff.id);
      setTransactions(data);
    } catch (err) {
      if (__DEV__) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaryData();
  }, [staff?.id]);

  // Available Months (Chronological Jan to Dec for current year + transaction months)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const currentYear = new Date().getFullYear();

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      monthSet.add(`${currentYear}-${mm}`);
    }

    transactions.forEach(t => {
      if (t.month && t.month.match(/^\d{4}-\d{2}$/)) {
        monthSet.add(t.month);
      }
    });

    const sorted = Array.from(monthSet).sort();
    return ['ALL', ...sorted];
  }, [transactions]);

  // Auto scroll to active month
  useEffect(() => {
    const index = availableMonths.indexOf(selectedMonth);
    if (index >= 0 && monthScrollRef.current) {
      setTimeout(() => {
        monthScrollRef.current?.scrollTo({ x: Math.max(0, index * 60 - 40), animated: true });
      }, 100);
    }
  }, [selectedMonth, availableMonths]);

  // All-Time Summary Stats (Unfiltered - Total given to this staff overall)
  const allTimeStats = useMemo(() => {
    let totalCashOut = 0; // Total Cash Given to this Staff
    let totalCashIn = 0;  // Total Cash Received back

    transactions.forEach(t => {
      if (t.type === 'cash_out') {
        totalCashOut += t.amount;
      } else {
        totalCashIn += t.amount;
      }
    });

    return {
      totalCashOut,
      totalCashIn,
      netSalaryPaid: totalCashOut - totalCashIn,
    };
  }, [transactions]);

  // Filtered transactions by selected month
  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'ALL') return transactions;
    return transactions.filter(t => t.month === selectedMonth || (t.date && t.date.startsWith(selectedMonth)));
  }, [transactions, selectedMonth]);

  // Monthly summary stats for selected month
  const monthlyStats = useMemo(() => {
    let totalCashOut = 0;
    let totalCashIn = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'cash_out') {
        totalCashOut += t.amount;
      } else {
        totalCashIn += t.amount;
      }
    });

    return {
      totalCashOut,
      totalCashIn,
      netSalaryPaid: totalCashOut - totalCashIn,
    };
  }, [filteredTransactions]);

  // Calculated Salary Tracking
  const monthlySalary = staff?.monthly_salary || 0;
  const paidSoFar = monthlyStats.totalCashOut;
  const remainingDue = Math.max(0, monthlySalary - paidSoFar);

  // Status Badge Logic
  const statusBadge = useMemo(() => {
    if (monthlySalary <= 0) return null;
    if (paidSoFar === 0) return { label: 'Unpaid', color: Colors.error };
    if (paidSoFar < monthlySalary) return { label: 'Partial', color: '#F59E0B' };
    return { label: 'Fully Paid', color: Colors.success };
  }, [monthlySalary, paidSoFar]);

  const openModal = () => {
    if (monthlySalary > 0) {
      setInputAmount(remainingDue > 0 ? remainingDue.toString() : '');
    } else {
      setInputAmount('');
    }
    setInputNote('');
    const todayStr = todayDate();
    if (selectedMonth !== 'ALL' && !todayStr.startsWith(selectedMonth)) {
      setInputDate(`${selectedMonth}-01`);
    } else {
      setInputDate(todayStr);
    }
    setModalVisible(true);
  };

  const handleSaveTransaction = async () => {
    // staff_salary_transactions.amount is stored as integer paisa.
    const amount = rupeesToPaisa(inputAmount);
    if (amount === null) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    if (!user?.id || !staff?.id) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!inputDate || !dateRegex.test(inputDate)) {
      Alert.alert('Invalid Date', 'Please enter date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      const monthKey = inputDate.substring(0, 7);
      const newTxn = await addStaffSalaryTransaction({
        staff_id: staff.id,
        user_id: user.id,
        type: 'cash_out',
        amount,
        date: inputDate,
        month: monthKey,
        note: inputNote.trim() || undefined,
      });

      setTransactions(prev => [newTxn, ...prev]);
      setModalVisible(false);
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to save salary transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonthlySalary = async () => {
    const valRupees = parseFloat(inputMonthlySalary);
    if (isNaN(valRupees) || valRupees < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monthly salary.');
      return;
    }
    // staff_records.monthly_salary is stored as integer paisa (0 = not set).
    const val = Math.round(valRupees * 100);
    if (!user?.id || !staff?.id) return;

    setSavingSalary(true);
    try {
      await updateStaffSalary(staff.id, user.id, val);
      setStaff(prev => ({ ...prev, monthly_salary: val }));
      setSalaryModalVisible(false);
      Alert.alert('Success', 'Monthly salary updated successfully.');
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to update monthly salary.');
    } finally {
      setSavingSalary(false);
    }
  };

  const formatMonthLabel = (monthKey: string) => {
    if (monthKey === 'ALL') return 'All Months';
    const [yyyy, mm] = monthKey.split('-');
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
  };

  const renderItem = ({ item: t }: { item: StaffSalaryTransaction }) => {
    const isOut = t.type === 'cash_out';
    return (
      <View style={styles.txnRow}>
        <View style={styles.txnLeft}>
          <Text style={[styles.badge, isOut ? styles.badgeOut : styles.badgeIn]}>
            {isOut ? 'SALARY PAID' : 'CASH RECEIVED'}
          </Text>
          <Text style={styles.txnDate}>{new Date(t.date).toLocaleDateString()}{t.note ? ` • ${t.note}` : ''}</Text>
        </View>
        <View style={styles.txnRight}>
          <Text style={[styles.txnAmount, { color: Colors.success }]}>
            {isOut ? '-' : '+'}{formatCurrency(t.amount)}
          </Text>
        </View>
      </View>
    );
  };

  if (!staff) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Salary Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={{ color: Colors.textGray }}>Staff record not found.</Text>
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
        
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>{getDisplayName(staff, nameDisplayMode)}</Text>
            {statusBadge && (
              <View style={[styles.statusBadgePill, { backgroundColor: statusBadge.color }]}>
                <Text style={styles.statusBadgeText}>{statusBadge.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSub}>{staff.role}</Text>
        </View>

        <TouchableOpacity 
          style={styles.setSalaryHeaderBtn}
          onPress={() => {
            setInputMonthlySalary(staff.monthly_salary ? paisaToRupeesString(staff.monthly_salary) : '');
            setSalaryModalVisible(true);
          }}
        >
          <Text style={styles.setSalaryHeaderBtnText}>✏️ Set Salary</Text>
        </TouchableOpacity>
      </View>

      <ScreenContainer scrollable={false} hasTabBar={false} style={styles.container}>
        {/* Card 1: Grand Total All-Time Salary Card */}
        <View style={styles.grandSummaryCard}>
          <Text style={styles.grandSummaryTitle}>TOTAL CASH GIVEN TO STAFF (ALL TIME)</Text>
          <Text style={styles.grandSummaryAmount}>
            {formatCurrency(allTimeStats.totalCashOut)}
          </Text>
        </View>

        {/* Card 2: This Month Salary Tracking Summary Card */}
        <View style={styles.thisMonthCard}>
          <Text style={styles.thisMonthTitle}>
            MONTHLY SALARY TRACKING ({formatMonthLabel(selectedMonth).toUpperCase()})
          </Text>
          <View style={styles.thisMonthGrid}>
            <View style={styles.thisMonthBox}>
              <Text style={styles.thisMonthLabel}>Monthly Salary</Text>
              <Text style={styles.thisMonthValue}>
                {monthlySalary > 0 ? formatCurrency(monthlySalary) : 'Not Set'}
              </Text>
            </View>
            <View style={styles.thisMonthBox}>
              <Text style={styles.thisMonthLabel}>Paid So Far</Text>
              <Text style={[styles.thisMonthValue, { color: Colors.success }]}>
                {formatCurrency(paidSoFar)}
              </Text>
            </View>
            <View style={styles.thisMonthBox}>
              <Text style={styles.thisMonthLabel}>Remaining Due</Text>
              <Text style={[styles.thisMonthValue, { color: remainingDue > 0 ? Colors.error : Colors.textMuted }]}>
                {monthlySalary > 0 ? formatCurrency(remainingDue) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.success }]}
            onPress={openModal}
          >
            <Text style={styles.actionBtnText}>+ Pay Salary</Text>
          </TouchableOpacity>
        </View>

        {/* Month Filter Section */}
        <View style={styles.monthSection}>
          <ScrollView
            ref={monthScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthScroll}
          >
            {availableMonths.map(mKey => {
              const active = selectedMonth === mKey;
              return (
                <TouchableOpacity
                  key={mKey}
                  style={[styles.monthPill, active && styles.monthPillActive]}
                  onPress={() => setSelectedMonth(mKey)}
                >
                  <Text style={[styles.monthPillText, active && styles.monthPillTextActive]}>
                    {formatMonthLabel(mKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Inline Monthly Summary */}
          <View style={styles.inlineSummary}>
            <Text style={styles.summaryText}>
              Paid in {formatMonthLabel(selectedMonth)}: <Text style={{ color: Colors.success, fontWeight: '700' }}>{formatCurrency(monthlyStats.totalCashOut)}</Text>
            </Text>
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Transactions ({filteredTransactions.length})</Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions for {formatMonthLabel(selectedMonth)}.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTransactions}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
            />
          )}
        </View>
      </ScreenContainer>

      {/* Set Monthly Salary Modal */}
      <Modal visible={salaryModalVisible} transparent animationType="slide" onRequestClose={() => setSalaryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Fixed Monthly Salary</Text>
              <TouchableOpacity onPress={() => setSalaryModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Monthly Fixed Salary (Rs) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 50000"
                placeholderTextColor={Colors.textGray}
                keyboardType="numeric"
                value={inputMonthlySalary}
                onChangeText={setInputMonthlySalary}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.primary }]}
                onPress={handleSaveMonthlySalary}
                disabled={savingSalary}
              >
                {savingSalary ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE MONTHLY SALARY</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Salary Transaction Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pay Salary</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Amount (Rs) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textGray}
                keyboardType="numeric"
                value={inputAmount}
                onChangeText={setInputAmount}
                autoFocus
              />

              <Text style={styles.modalLabel}>Date *</Text>
              <DateField
                style={styles.modalInput}
                value={inputDate}
                onChange={setInputDate}
              />

              <Text style={styles.modalLabel}>Note / Details (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 48, textAlignVertical: 'top' }]}
                placeholder="Advance, monthly salary, bonus, etc..."
                placeholderTextColor={Colors.textGray}
                value={inputNote}
                onChangeText={setInputNote}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.success }]}
                onPress={handleSaveTransaction}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE SALARY PAYMENT</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 12, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.textWhite },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textWhite },
  headerSub: { fontSize: 11, color: Colors.textGray },

  statusBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  setSalaryHeaderBtn: {
    backgroundColor: Colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setSalaryHeaderBtnText: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },

  grandSummaryCard: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  grandSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  grandSummaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.success,
  },

  thisMonthCard: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thisMonthTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 6,
    textAlign: 'center',
  },
  thisMonthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thisMonthBox: {
    flex: 1,
    alignItems: 'center',
  },
  thisMonthLabel: {
    fontSize: 10,
    color: Colors.textGray,
    marginBottom: 2,
  },
  thisMonthValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },

  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  monthSection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  monthScroll: {
    gap: 6,
    paddingRight: 12,
    paddingVertical: 2,
  },
  monthPill: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  monthPillText: {
    color: Colors.textGray,
    fontSize: 11,
    fontWeight: '600',
  },
  monthPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  inlineSummary: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 11,
    color: Colors.textGray,
  },

  listContainer: { flex: 1 },
  listHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listTitle: { fontSize: 13, fontWeight: '700', color: Colors.textWhite },

  txnRow: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txnLeft: { flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  badgeOut: { color: Colors.success },
  badgeIn: { color: Colors.success },
  txnDate: { fontSize: 11, color: Colors.textGray },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 15, fontWeight: '800' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyText: { color: Colors.textGray, fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textGray,
    padding: 4,
  },
  modalBody: {},
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textWhite,
    marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
