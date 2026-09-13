import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTransactionStore } from '../../store/transactionStore';
import { deleteCashEntry } from '../../services/database/cashbookDb';
import { formatCurrency } from '../../utils/calculations';
import { CashEntry } from '../../types';
import { Colors } from '../../theme';

interface Props {
  navigation: any;
  route: {
    params: {
      entry: CashEntry;
    };
  };
}

const GREEN = '#22C55E';
const RED = '#EF4444';

export const CashEntryDetailScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { loadCashBook } = useTransactionStore();
  const [deleting, setDeleting] = useState(false);

  const entry = route?.params?.entry;

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Entry Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: Colors.textGray }}>No entry selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isIn = entry.direction === 'in';

  const formatDetailDateTime = (dateStr?: string, createdAt?: string) => {
    const ts = createdAt || dateStr;
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return dateStr || '';
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate().toString().padStart(2, '0');
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const yearShort = d.getFullYear().toString().slice(-2);
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${dayName}, ${dayNum} ${monthName} ${yearShort} • ${timeStr}`;
    } catch {
      return dateStr || '';
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditCashEntryModal', {
      mode: entry.direction,
      entry: entry,
    });
  };

  const handleDelete = () => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          setDeleting(true);
          try {
            await deleteCashEntry(entry.id, user.id);
            await loadCashBook(user.id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete entry.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entry Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        {/* Entry Detail Top Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.leftMeta}>
              <View style={[styles.circleIcon, { backgroundColor: isIn ? GREEN : RED }]}>
                <Text style={styles.circleIconText}>{isIn ? '+' : '-'}</Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.directionTitle}>{isIn ? 'IN' : 'OUT'}</Text>
                <Text style={styles.dateSubText}>{formatDetailDateTime(entry.date, entry.createdAt)}</Text>
              </View>
            </View>

            <Text style={[styles.amountText, { color: isIn ? GREEN : RED }]}>
              {formatCurrency(entry.amount_paisa || 0)}
            </Text>
          </View>

          {!!entry.description && (
            <View style={styles.descWrap}>
              <Text style={styles.descText}>{entry.description}</Text>
            </View>
          )}

          <View style={styles.cardDivider} />

          {/* EDIT ENTRY button */}
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
            <Text style={styles.editIcon}>✏️</Text>
            <Text style={styles.editText}>EDIT ENTRY</Text>
          </TouchableOpacity>
        </View>

        {/* Backed Up Card */}
        <View style={styles.backupCard}>
          <View style={styles.checkIconWrap}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.backupText}>Entry is backed up</Text>
        </View>
      </View>

      {/* Bottom Fixed Action: DELETE ENTRY */}
      <View style={[styles.bottomContainer, { paddingBottom: 24 + Math.max(insets.bottom, 12), paddingHorizontal: 16 }]}>
        <TouchableOpacity style={styles.deleteOutlineBtn} onPress={handleDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color={RED} />
          ) : (
            <>
              <Text style={styles.deleteIcon}>🗑</Text>
              <Text style={styles.deleteBtnText}>DELETE ENTRY</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 32, color: Colors.textWhite, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textWhite },

  container: { flex: 1, padding: 16, gap: 16 },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 3
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12
  },
  leftMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 },
  circleIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center'
  },
  circleIconText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  directionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textWhite },
  dateSubText: { fontSize: 12, color: Colors.textGray, marginTop: 2 },

  amountText: { fontSize: 18, fontWeight: '800' },

  descWrap: {
    backgroundColor: Colors.bgInput, padding: 10, borderRadius: 8,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border
  },
  descText: { fontSize: 13, color: Colors.textWhite },

  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  editBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 8, gap: 8
  },
  editIcon: { fontSize: 16 },
  editText: { fontSize: 14, fontWeight: '800', color: Colors.primaryLight, letterSpacing: 0.5 },

  backupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, elevation: 2
  },
  checkIconWrap: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  checkIcon: { fontSize: 16, color: RED, fontWeight: '800' },
  backupText: { fontSize: 14, fontWeight: '600', color: Colors.textGray },

  bottomContainer: { paddingHorizontal: 16, backgroundColor: Colors.bgPrimary },
  deleteOutlineBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: RED,
    backgroundColor: 'transparent'
  },
  deleteIcon: { fontSize: 16 },
  deleteBtnText: { fontSize: 15, fontWeight: '800', color: RED, letterSpacing: 0.5 }
});
