import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAuthStore } from '../../store/authStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useActivityStore } from '../../store/useActivityStore';
import { createCashEntry } from '../../services/database/cashbookDb';
import { rupeesToPaisa } from '../../utils/calculations';
import { Colors } from '../../theme';

const CATEGORIES = ['Sales', 'Commission', 'Loan Received', 'Recovery', 'Investment', 'Other'];
const GREEN = '#22C55E';

export const CashInModal = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { loadCashBook } = useTransactionStore();
  const { logActivity } = useActivityStore();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const paisa = rupeesToPaisa(amount);
    if (!amount.trim()) e.amount = 'Amount is required';
    else if (paisa === null) e.amount = 'Enter a valid positive amount';
    if (!source.trim()) e.source = 'Source / description is required';
    if (!category) e.category = 'Please select a category';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Date must be YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    const paisa = rupeesToPaisa(amount)!;
    setLoading(true);
    try {
      const description = note.trim()
        ? `${source.trim()} — ${note.trim()}`
        : source.trim();
      const entry = await createCashEntry(user.id, description, paisa, 'in', date);
      
      await logActivity({
        user_id: user.id,
        user_name: user.name || 'User',
        action: 'create',
        entity_type: 'cash',
        entity_id: entry.id,
        description: `Cash In: ${description}`,
        amount: paisa / 100
      });

      await loadCashBook(user.id);
      navigation.goBack();
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash In</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={styles.form}>

        {/* Amount */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Amount (Rs.) *</Text>
          <View style={[styles.amountRow, errors.amount ? styles.inputError : null]}>
            <Text style={styles.rsPrefix}>Rs.</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textGray}
              value={amount}
              onChangeText={t => { setAmount(t); setErrors(p => ({ ...p, amount: '' })); }}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          {!!errors.amount && <Text style={styles.errText}>{errors.amount}</Text>}
        </View>

        {/* Source / Description */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Source / Description *</Text>
          <TextInput
            style={[styles.input, errors.source ? styles.inputError : null]}
            placeholder="e.g. Ali Khan, Shop Sales"
            placeholderTextColor={Colors.textGray}
            value={source}
            onChangeText={t => { setSource(t); setErrors(p => ({ ...p, source: '' })); }}
          />
          {!!errors.source && <Text style={styles.errText}>{errors.source}</Text>}
        </View>

        {/* Category */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => { setCategory(cat); setErrors(p => ({ ...p, category: '' })); }}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!errors.category && <Text style={styles.errText}>{errors.category}</Text>}
        </View>

        {/* Date */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Date *</Text>
          <TextInput
            style={[styles.input, errors.date ? styles.inputError : null]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textGray}
            value={date}
            onChangeText={t => { setDate(t); setErrors(p => ({ ...p, date: '' })); }}
          />
          {!!errors.date && <Text style={styles.errText}>{errors.date}</Text>}
        </View>

        {/* Note / Details */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Note / Details (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Additional note..."
            placeholderTextColor={Colors.textGray}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>+ CASH IN</Text>
            }
          </TouchableOpacity>
        </View>

      </ScreenContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.textWhite, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  form: { padding: 20, paddingBottom: 40 },
  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textWhite, marginBottom: 8 },

  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textWhite,
    minHeight: 48,
  },
  textArea: { minHeight: 85, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.error },
  errText: { fontSize: 12, color: Colors.error, marginTop: 4 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  rsPrefix: { fontSize: 18, fontWeight: '700', color: GREEN, marginRight: 8 },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textWhite,
    paddingVertical: 12,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 13, color: Colors.textGray, fontWeight: '600' },
  chipTextActive: { color: Colors.textWhite, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: Colors.textGray },
  submitBtn: {
    flex: 2,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
