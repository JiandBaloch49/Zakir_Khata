import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Animated, ActivityIndicator, Dimensions, Keyboard, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useExpenseStore } from '../../store/useExpenseStore';
import { Expense } from '../../types/expense.types';
import { Colors } from '../../theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';
import { formatCurrency } from '../../utils/calculations';
import { DateRangeFilter, DateRange, describeRange } from '../../components/ui/DateRangeFilter';

export const ExpenseBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    expenses, loading, monthlyTotal,
    fetchExpenses, filter, setFilter
  } = useExpenseStore();

  const range: DateRange = { startDate: filter.startDate, endDate: filter.endDate };
  const setRange = (next: DateRange) => {
    if (user) setFilter(user.id, { ...filter, ...next });
  };

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);

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

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  const loadData = () => {
    if (user) fetchExpenses(user.id);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, user]);

  useEffect(() => {
    loadData();
  }, [user]);

  const rangeLabel = describeRange(range);

  const renderItem = ({ item }: { item: Expense }) => {
    return (
      <TouchableOpacity 
        style={styles.itemRow}
        onPress={() => navigation.navigate('ExpenseDetail', { expense: item })}
      >
        <View style={styles.itemTopLine}>
          <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
        </View>

        <View style={styles.itemBottomLine}>
          <Text style={styles.dateText}>{new Date(item.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</Text>
          <View style={styles.divider} />
          <Text style={styles.noteText} numberOfLines={1}>{item.note || 'No additional note'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="ExpensesTab" />

      {/* Summary Card — total is the SQL sum of the SAME filter the list uses */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total expense {rangeLabel}</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(monthlyTotal)}</Text>
      </View>

      <View style={{ paddingHorizontal: 12 }}>
        <DateRangeFilter value={range} onChange={setRange}
          fieldStyle={styles.rangeField} textStyle={styles.rangeText} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : expenses.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 140, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={styles.emptyState}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.instructionText}>1- Create expenses</Text>
              <Text style={styles.instructionText}>2- Manage your expense</Text>
              <Text style={styles.instructionText}>3- Keep record of all expenses</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
        />
      )}

      {/* Add Button */}
      {!isKeyboardVisible && (
        <View style={[styles.addBtnContainer, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddExpenseModal')}>
            <Text style={styles.addBtnText}>+ CREATE EXPENSE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textWhite, fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  summaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, elevation: 3,
    marginBottom: 12
  },
  rangeField: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  rangeText: { fontSize: 12, color: Colors.textGray, fontWeight: '600' },
  summaryTitle: { fontSize: 13, color: Colors.textGray, fontWeight: '600' },
  summaryAmount: { fontSize: 16, fontWeight: '800', color: Colors.error },

  itemRow: {
    backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 2
  },
  itemTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  description: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textWhite, marginRight: 16 },
  amount: { fontSize: 15, fontWeight: '800', color: Colors.error },

  itemBottomLine: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 11, color: Colors.textGray },
  divider: { width: 1, height: 10, backgroundColor: Colors.border, marginHorizontal: 8 },
  noteText: { flex: 1, fontSize: 11, color: Colors.textMuted },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcons: { position: 'relative', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  shieldWrap: { position: 'absolute', top: -10, left: -10, backgroundColor: Colors.bgCard, borderRadius: 40 },
  instructionText: { fontSize: 14, color: Colors.textGray, marginBottom: 8 },
  arrowWrap: { marginTop: 24 },
  arrowIcon: { fontSize: 36, color: Colors.primaryLight, fontWeight: '800' },

  addBtnContainer: {
    position: 'absolute', bottom: 75, left: 0, right: 0, alignItems: 'center'
  },
  addBtn: {
    backgroundColor: Colors.primary, width: '80%', height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6
  },
  addBtnText: { color: Colors.textWhite, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  tabBar: {
    backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border, height: 60, flexDirection: 'row'
  },
  tabItem: { width: Dimensions.get('window').width / 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  tabItemActive: {},
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: Colors.textGray },
  tabLabelActive: { color: Colors.primaryLight },
  tabIndicator: { position: 'absolute', bottom: 2, width: 24, height: 3, backgroundColor: Colors.primaryLight, borderRadius: 2 },
});

