import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Dimensions, KeyboardAvoidingView, Platform, Image, Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useActivityStore } from '../../store/useActivityStore';
import { useExpenseStore } from '../../store/useExpenseStore';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Colors } from '../../theme';
import { rupeesToPaisa } from '../../utils/calculations';
import { evaluateExpression } from '../../utils/safeCalc';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

export const AddExpenseModal = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { addExpense, fetchExpenses, loadMonthlyTotal } = useExpenseStore();
  const { logActivity } = useActivityStore();

  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayDate());
  const [category, setCategory] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const CATEGORIES = [
    'Rent', 'Electricity', 'Salary', 'Fuel', 'Internet',
    'Transport', 'Maintenance', 'Marketing', 'Miscellaneous'
  ];

  const handleCalculatorPress = (val: string) => {
    if (val === 'AC') {
      setAmountStr('');
    } else if (val === '←' || val === '✕') {
      setAmountStr(p => p.slice(0, -1));
    } else if (val === '=') {
      const result = evaluateExpression(amountStr);
      if (result.ok) {
        setAmountStr(String(result.value));
      } else {
        setAmountStr('Error');
        setTimeout(() => setAmountStr(''), 1000);
      }
    } else {
      if (amountStr === '0' && val !== '.') {
        setAmountStr(val);
      } else {
        setAmountStr(p => p + val);
      }
    }
  };

  const handlePickReceipt = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setReceiptUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    // Always evaluate the display as an expression. Never parseFloat it: that read
    // "12+5" as 12 and silently saved the wrong amount whenever the user hadn't
    // pressed "=" first. Going through the evaluator makes that impossible.
    const calc = evaluateExpression(amountStr);
    if (!calc.ok) {
      Alert.alert('Invalid amount', 'Please complete the calculation.');
      return;
    }
    const finalAmount = calc.value;

    if (finalAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a short description.');
      return;
    }

    if (!user) return;

    // expenses.amount is stored as integer paisa.
    const amountPaisa = rupeesToPaisa(String(finalAmount));
    if (amountPaisa === null) {
      Alert.alert("Error", "Please enter a valid amount greater than 0.");
      return;
    }

    try {
      await addExpense({
        user_id: user.id,
        amount: amountPaisa,
        description: description.trim(),
        category: category.trim() || undefined,
        note: note.trim() || undefined,
        receipt_url: receiptUrl || undefined,
        expense_date: date,
      });

      // Refresh parent data
      await fetchExpenses(user.id);
      await loadMonthlyTotal(user.id);

      // Log Activity
      await logActivity({
        user_id: user.id,
        user_name: user.name || 'User',
        action: 'create',
        entity_type: 'expense',
        description: `added an expense for ${description.trim()}`,
        amount: amountPaisa
      });

      Alert.alert('Success', 'Expense recorded successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      if (__DEV__) console.error(err);
      Alert.alert('Error', 'Failed to save expense.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScreenContainer scrollable={true} hasTabBar={true}>
        <View style={styles.formContainer}>
            {/* Amount */}
            <View style={styles.amountBox}>
              <Text style={styles.rsPrefix}>Rs</Text>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                placeholder="0"
                placeholderTextColor={Colors.textGray}
                editable={false} // Managed by custom calculator below
              />
              <TouchableOpacity onPress={() => handleCalculatorPress('AC')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Receipt & Date */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[styles.receiptBtn, receiptUrl ? { borderColor: Colors.primary } : {}]} onPress={handlePickReceipt}>
                {receiptUrl ? (
                  <Image source={{ uri: receiptUrl }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
                ) : (
                  <Text style={{ fontSize: 20, marginRight: 8 }}>📷</Text>
                )}
                <Text style={{ color: Colors.primaryLight, fontWeight: '600' }}>
                  {receiptUrl ? 'Change Receipt' : 'Attach Receipt'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.fieldWrap, { flex: 1, marginBottom: 0 }]}>
                <DateField
                  style={styles.input}
                  value={date}
                  onChange={setDate}
                />
              </View>
            </View>

            {/* Description */}
            <View style={[styles.fieldWrap, { marginTop: 16 }]}>
              <TextInput
                style={styles.input}
                placeholder="Short Description (e.g., Office Supplies)"
                placeholderTextColor={Colors.textGray}
                value={description}
                onChangeText={setDescription}
                maxLength={50}
              />
            </View>

            {/* Category Dropdown (Chips) */}
            <View style={[styles.fieldWrap, { marginTop: 16 }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textWhite, marginBottom: 8 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Note */}
            <View style={[styles.fieldWrap, { marginTop: 16 }]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add detailed note about this expense..."
                placeholderTextColor={Colors.textGray}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>SAVE EXPENSE</Text>
            </TouchableOpacity>
          </View>
        </ScreenContainer>
        
        {/* Persistent Calculator Keypad at Bottom */}
        {!isKeyboardVisible && (
          <View style={[styles.calculator, { paddingBottom: 16 + Math.max(insets.bottom, 8) }]}>
            {[
              ['AC', 'M+', 'M-', '÷'],
              ['7', '8', '9', '×'],
              ['4', '5', '6', '-'],
              ['1', '2', '3', '+'],
              ['.', '0', '←', '=']
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.calcRow}>
                {row.map((btn) => {
                  const isOp = ['AC','M+','M-','÷','×','-','+','=','←'].includes(btn);
                  return (
                    <TouchableOpacity
                      key={btn}
                      style={[styles.calcBtn, isOp ? styles.calcBtnOp : styles.calcBtnNum]}
                      onPress={() => handleCalculatorPress(btn)}
                    >
                      <Text style={[styles.calcBtnText, isOp && { fontWeight: '600', color: Colors.primaryLight }]}>{btn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

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

  formContainer: { padding: 16 },

  amountBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, height: 56
  },
  rsPrefix: { fontSize: 16, color: Colors.textGray, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700', color: Colors.textWhite },
  clearIcon: { fontSize: 20, color: Colors.error, padding: 8 },

  receiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, height: 50
  },

  fieldWrap: { marginBottom: 16 },
  input: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, height: 50,
    fontSize: 14, color: Colors.textWhite,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },

  chip: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, marginRight: 8
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textGray, fontWeight: '500' },
  chipTextActive: { color: Colors.textWhite, fontWeight: '700' },

  saveBtn: {
    backgroundColor: Colors.primary, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 16
  },
  saveBtnText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },

  calculator: {
    backgroundColor: Colors.bgSecondary, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 8, paddingBottom: 24
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calcBtn: {
    flex: 1, height: 48, justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 3, borderRadius: 6,
  },
  calcBtnNum: { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  calcBtnOp: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  calcBtnText: { fontSize: 18, color: Colors.textWhite, fontWeight: '400' }
});

