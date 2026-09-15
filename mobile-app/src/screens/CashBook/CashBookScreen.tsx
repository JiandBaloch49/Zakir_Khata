import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, FlatList, Dimensions, Keyboard, Platform, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useTransactionStore } from '../../store/transactionStore';
import { getDayBook, DayTotals } from '../../services/database/cashbookDb';
import { closeDay, getDayStatus, DayStatus } from '../../services/database/dayClosingDb';
import { CashEntry } from '../../types';
import { Colors } from '../../theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';
import { formatCurrency } from '../../utils/calculations';
import { todayDate, localDate, parseDateValue } from '../../utils/dates';
import { DateField } from '../../components/ui/DateField';

export const CashBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { cashSummary, loadCashBook } = useTransactionStore();
  
  // The day being viewed. Defaults to today; stepping back shows past days on this
  // same screen. Nothing is archived or hidden when the date rolls over.
  const [viewDate, setViewDate] = useState(todayDate());
  const [todayEntries, setTodayEntries] = useState<CashEntry[]>([]);
  const [dayTotals, setDayTotals] = useState<DayTotals>({ cashIn: 0, cashOut: 0, net: 0, entryCount: 0 });
  // Closing a day is optional: when nothing is ever closed this stays null and the
  // screen behaves exactly as it did before the feature existed.
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  const loadDailyData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await loadCashBook(user.id);
      const { entries, dayTotals: totals } = await getDayBook(user.id, viewDate);
      setTodayEntries(entries);
      setDayTotals(totals);
      setDayStatus(await getDayStatus(user.id, viewDate));
    } catch (err) {
      if (__DEV__) console.error('[CashBook] day load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDailyData();
    });
    return unsubscribe;
  }, [navigation, user]);

  useEffect(() => {
    loadDailyData();
  }, [user, viewDate]);

  // Header label for the day being viewed, e.g. "SAT, 05 SEP 2026"
  const formatDayTitle = (value: string) => {
    const d = parseDateValue(value);
    if (!d) return value;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${dayName}, ${dayNum} ${monthName} ${d.getFullYear()}`;
  };

  const today = todayDate();
  const isToday = viewDate === today;
  const stepDay = (days: number) => {
    const base = parseDateValue(viewDate) || new Date();
    base.setDate(base.getDate() + days);
    const next = localDate(base);
    // There is nothing to browse in the future.
    if (next > today) return;
    setViewDate(next);
  };

  const handleCloseDay = () => {
    const already = dayStatus?.latest;
    Alert.alert(
      already ? 'Close Day Again?' : 'Close Day',
      `${formatDayTitle(viewDate)}\n\n` +
      `In ${formatCurrency(dayTotals.cashIn)} · Out ${formatCurrency(dayTotals.cashOut)}\n` +
      `Balance ${formatCurrency(dayTotals.net)} · ${dayTotals.entryCount} ${dayTotals.entryCount === 1 ? 'entry' : 'entries'}\n\n` +
      (already
        ? 'This day was already closed. A new closing will be recorded alongside the existing one — the earlier closing is kept.'
        : 'This records the day\'s totals. Entries are never deleted, and you can still add to this day afterwards.'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: already ? 'Close Again' : 'Close Day',
          onPress: async () => {
            setClosing(true);
            try {
              await closeDay(viewDate);
              await loadDailyData();
            } catch (err: any) {
              if (__DEV__) console.error('[CashBook] close day failed:', err);
              Alert.alert('Error', err?.message || 'Could not close the day.');
            } finally {
              setClosing(false);
            }
          },
        },
      ]
    );
  };

  const formatClosedAt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatEntryTime = (createdAt?: string, date?: string) => {
    const ts = createdAt || date;
    if (ts) {
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch {}
    }
    return '';
  };

  // Day totals come from SQL (getDayBook) over the same predicate as the rows,
  // hierarchy-scoped like every other book — no JS reduce over the loaded list.
  const { cashIn: todayInPaisa, cashOut: todayOutPaisa, net: todayBalancePaisa } = dayTotals;


  const renderEntryItem = ({ item }: { item: CashEntry }) => {
    const isIn = item.direction === 'in';
    const timeStr = formatEntryTime(item.createdAt, item.date);

    return (
      <TouchableOpacity 
        style={styles.entryRow}
        onPress={() => navigation.navigate('CashEntryDetail', { entry: item })}
        activeOpacity={0.7}
      >
        <View style={styles.entryLeft}>
          {!!timeStr && <Text style={styles.timeText}>{timeStr}</Text>}
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>{item.description || 'Cash Entry'}</Text>
          </View>
        </View>

        <View style={styles.entryAmountsRight}>
          <View style={styles.amountCol}>
            {!isIn && (
              <Text style={[styles.entryAmount, { color: Colors.error }]}>
                {formatCurrency(item.amount_paisa)}
              </Text>
            )}
          </View>
          <View style={styles.amountCol}>
            {isIn && (
              <Text style={[styles.entryAmount, { color: Colors.success }]}>
                {formatCurrency(item.amount_paisa)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="CashBook" />

      {/* Sub Header — same row and button as the Bill Book. The export opens on the day
          being viewed; the sheet's presets still offer a week, a month or a custom span. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Cash Book</Text>
        <TouchableOpacity
          style={{ padding: 6 }}
          onPress={() => navigation.navigate('DownloadOptionsModal', { reportType: 'cash', date: viewDate })}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1dd1a1' }}>⬇ PDF Report</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card Header */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryVal, { color: Colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatCurrency(cashSummary.cashBalance || 0)}
          </Text>
          <Text style={styles.summarySubLabel}>Cash in Hand (all time)</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <Text style={[styles.summaryVal, { color: todayBalancePaisa >= 0 ? Colors.success : Colors.error }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatCurrency(todayBalancePaisa)}
          </Text>
          <Text style={styles.summarySubLabel}>{isToday ? 'Today Balance' : 'Day Balance'}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <TouchableOpacity 
          style={[styles.summaryCol, { alignItems: 'center' }]}
          onPress={() => navigation.navigate('CashHistory')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, marginBottom: 2 }}>🕒</Text>
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Day navigator — past days are this same screen, not a separate list */}
      <View style={styles.dayNavRow}>
        <TouchableOpacity onPress={() => stepDay(-1)} style={styles.dayNavBtn} activeOpacity={0.7}>
          <Text style={styles.dayNavArrow}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <DateField
            value={viewDate}
            onChange={setViewDate}
            maximumDate={new Date()}
            style={styles.dayNavField}
            textStyle={styles.dayNavFieldText}
          />
        </View>

        <TouchableOpacity
          onPress={() => stepDay(1)}
          style={[styles.dayNavBtn, isToday && styles.dayNavBtnDisabled]}
          disabled={isToday}
          activeOpacity={0.7}
        >
          <Text style={[styles.dayNavArrow, isToday && styles.dayNavArrowDisabled]}>›</Text>
        </TouchableOpacity>

        {!isToday && (
          <TouchableOpacity onPress={() => setViewDate(today)} style={styles.todayChip} activeOpacity={0.7}>
            <Text style={styles.todayChipText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Header Banner */}
      <View style={styles.dateHeaderBanner}>
        <View style={styles.dateHeaderLeft}>
          <Text style={styles.dateTitle}>{formatDayTitle(viewDate)}</Text>
          <Text style={styles.entriesCountText}>
            {dayTotals.entryCount} {dayTotals.entryCount === 1 ? 'Entry' : 'Entries'}
          </Text>
        </View>

        <View style={styles.dateHeaderRight}>
          <View style={styles.totalsHeaderRow}>
            <Text style={[styles.columnLabel, { color: Colors.error }]}>Out</Text>
            <Text style={[styles.columnLabel, { color: Colors.success }]}>In</Text>
          </View>
          <View style={styles.totalsValueRow}>
            <Text style={[styles.columnVal, { color: Colors.error }]}>
              {formatCurrency(todayOutPaisa)}
            </Text>
            <Text style={[styles.columnVal, { color: Colors.success }]}>
              {formatCurrency(todayInPaisa)}
            </Text>
          </View>
        </View>
      </View>

      {/* Close Day / closing status — additive, and absent until someone closes a day */}
      {dayStatus && (dayStatus.canClose || dayStatus.latest) && (
        <View style={styles.closeDayRow}>
          {dayStatus.latest ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.closedLabel}>
                Closed {formatClosedAt(dayStatus.latest.closed_at)} by {dayStatus.latest.closed_by_name}
                {dayStatus.closings.length > 1 ? ` · ${dayStatus.closings.length} closings` : ''}
              </Text>
              <Text style={styles.closedFigure}>
                At close: {formatCurrency(dayStatus.latest.closing_balance_paisa)}
                {' · '}{dayStatus.latest.entry_count} {dayStatus.latest.entry_count === 1 ? 'entry' : 'entries'}
              </Text>
              {/* Drift: both figures shown, neither silently corrected */}
              {dayStatus.drifted && (
                <Text style={styles.driftText}>
                  Changed since close — now {formatCurrency(dayStatus.current.net)}
                  {' · '}{dayStatus.current.entryCount} {dayStatus.current.entryCount === 1 ? 'entry' : 'entries'}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.closedLabel}>This day is not closed yet.</Text>
          )}

          {dayStatus.canClose && (
            <TouchableOpacity
              style={[styles.closeDayBtn, closing && { opacity: 0.6 }]}
              onPress={handleCloseDay}
              disabled={closing}
              activeOpacity={0.8}
            >
              <Text style={styles.closeDayBtnText}>
                {closing ? '…' : dayStatus.latest ? 'Close Again' : 'Close Day'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Daily Entries List */}
      <FlatList
        data={todayEntries}
        keyExtractor={item => item.id}
        renderItem={renderEntryItem}
        contentContainerStyle={{ paddingBottom: 150, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💵</Text>
            <Text style={styles.emptyTitle}>{isToday ? 'No Cash Entries Today' : 'No Cash Entries This Day'}</Text>
            <Text style={styles.emptySubtitle}>Tap Cash In or Cash Out below to record a transaction.</Text>
          </View>
        }
      />

      {/* Bottom Action Row (Cash Out / Cash In) - Hidden when typing / keyboard open */}
      {!isKeyboardVisible && (
        <View style={[styles.actionRow, { marginBottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity
            style={styles.cashBtnWrap}
            onPress={() => navigation.navigate('CashOutModal', { mode: 'out', date: viewDate })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#c0392b', '#ee5a6f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cashBtn, styles.redGlow]}
            >
              <Text style={styles.btnText}>CASH OUT</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cashBtnWrap}
            onPress={() => navigation.navigate('CashInModal', { mode: 'in', date: viewDate })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00A651', '#1dd1a1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cashBtn, styles.greenGlow]}
            >
              <Text style={styles.btnText}>CASH IN</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, marginHorizontal: 12, marginTop: 12, marginBottom: 8,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, elevation: 3,
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 15, fontWeight: '800' },
  summarySubLabel: { fontSize: 11, color: Colors.textGray, fontWeight: '600', marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  historyText: { fontSize: 12, color: Colors.error, fontWeight: '700' },

  dayNavRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 4, marginBottom: 8,
  },
  dayNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNavBtnDisabled: { opacity: 0.4 },
  dayNavArrow: { fontSize: 20, color: Colors.textWhite, fontWeight: '700', marginTop: -2 },
  dayNavArrowDisabled: { color: Colors.textGray },
  dayNavField: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  dayNavFieldText: { fontSize: 13, color: Colors.textWhite, fontWeight: '700' },
  todayChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  todayChipText: { fontSize: 12, color: Colors.textWhite, fontWeight: '800' },
  closeDayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 8, padding: 12,
    backgroundColor: Colors.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  closedLabel: { fontSize: 11, color: Colors.textGray, fontWeight: '600' },
  closedFigure: { fontSize: 12, color: Colors.textWhite, fontWeight: '700', marginTop: 2 },
  driftText: { fontSize: 11, color: Colors.warning, fontWeight: '700', marginTop: 3 },
  closeDayBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  closeDayBtnText: { fontSize: 12, color: Colors.textWhite, fontWeight: '800' },
  dateHeaderBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  dateHeaderLeft: { flex: 1 },
  dateTitle: { fontSize: 13, fontWeight: '800', color: Colors.textWhite, letterSpacing: 0.5 },
  entriesCountText: { fontSize: 12, color: Colors.textGray, marginTop: 2 },

  dateHeaderRight: { alignItems: 'flex-end' },
  totalsHeaderRow: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  totalsValueRow: { flexDirection: 'row', gap: 16 },
  columnLabel: { fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  columnVal: { fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'right', flexShrink: 0 },

  entryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border, marginHorizontal: 12,
  },
  entryLeft: { flex: 1, marginRight: 8 },
  timeText: { fontSize: 11, color: Colors.textGray, marginBottom: 4 },
  chip: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start',
  },
  chipText: { fontSize: 12, color: Colors.textWhite, fontWeight: '600' },

  entryAmountsRight: { flexDirection: 'row', gap: 16, alignItems: 'center', flexShrink: 0 },
  amountCol: { minWidth: 60, alignItems: 'flex-end', justifyContent: 'center' },
  entryAmount: { fontSize: 15, fontWeight: '800', textAlign: 'right', flexShrink: 0 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textWhite },
  emptySubtitle: { fontSize: 12, color: Colors.textGray, marginTop: 4, textAlign: 'center' },

  actionRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cashBtnWrap: { flex: 1 },
  cashBtn: {
    minHeight: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  greenGlow: {
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  redGlow: {
    shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  btnText: { color: Colors.textWhite, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});


