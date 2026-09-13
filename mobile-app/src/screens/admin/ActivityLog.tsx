import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { EntryAuditRow, getVisibleEntryAudit } from '../../services/database/entryAuditDb';
import { EntryHistoryModal, AuditFields, groupAuditRows } from '../../components/ui/EntryHistory';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useActivityStore } from '../../store/useActivityStore';
import { ActivityLog } from '../../types/activity.types';
import { formatCurrency } from '../../utils/calculations';

const ORANGE = '#FF6B35';

export const ActivityLogScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { activities, loading, fetchActivities } = useActivityStore();

  const [auditRows, setAuditRows] = useState<EntryAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [selected, setSelected] = useState<EntryAuditRow | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setAuditRows([]);
    setSelected(null);
    setAuditError('');
    if (user) {
      fetchActivities(user.id);
      setAuditLoading(true);
      getVisibleEntryAudit().then(rows => { if (active) setAuditRows(rows); })
        .catch(e => { if (active) setAuditError(e?.message || 'Could not load entry history.'); })
        .finally(() => { if (active) setAuditLoading(false); });
    }
    return () => { active = false; };
  }, [user?.id, fetchActivities]));
  type FeedItem = { id: string; timestamp: string; activity?: ActivityLog; audit?: EntryAuditRow[] };
  const feed: FeedItem[] = [
    ...activities.map(activity => ({ id: activity.id, timestamp: activity.timestamp, activity })),
    ...groupAuditRows(auditRows).map(audit => ({ id: audit[0].change_group_id, timestamp: audit[0].changed_at, audit })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'cash': return { icon: '💰', color: '#10B981' }; // Green
      case 'stock': return { icon: '📦', color: '#F59E0B' }; // Orange
      case 'bill': return { icon: '📃', color: '#3B82F6' }; // Blue
      case 'staff': return { icon: '👥', color: '#8B5CF6' }; // Purple
      case 'expense': return { icon: '💸', color: '#EF4444' }; // Red
      case 'auth': return { icon: '🔑', color: '#6B7280' }; // Gray
      default: return { icon: '📋', color: '#9CA3AF' };
    }
  };

  const renderItem = ({ item }: { item: ActivityLog }) => {
    const { icon, color } = getEntityIcon(item.entity_type);
    
    return (
      <View style={styles.logCard}>
        <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>
        <View style={styles.logContent}>
          <Text style={styles.logText}>
            <Text style={{ fontWeight: '700', color: '#111827' }}>{item.user_name}</Text> {item.description}
          </Text>
          <View style={styles.logBottomRow}>
            {item.amount ? (
              <Text style={{ color: color, fontWeight: '600', fontSize: 12 }}>
                {formatCurrency(item.amount)}
              </Text>
            ) : <View />}
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Log</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters Placeholder */}
      <View style={styles.filterBar}>
        <Text style={{ color: '#4B5563', fontSize: 13, fontWeight: '500' }}>Showing Recent Activities</Text>
      </View>

      {!!auditError && <Text style={{ padding: 12, color: '#EF4444' }}>{auditError}</Text>}
      {loading || auditLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: '#9CA3AF', fontSize: 16 }}>No activity yet.</Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={item => item.id}
          renderItem={({ item }) => item.audit ? (
            <TouchableOpacity style={styles.logCard} onPress={() => setSelected(item.audit![0])}>
              <View style={styles.logContent}>
                <Text style={styles.logText}><Text style={{ fontWeight: '700', color: '#111827' }}>{item.audit[0].actor_name}</Text> {item.audit[0].action} a Khata entry</Text>
                <AuditFields rows={item.audit} />
                <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
                <Text style={{ color: ORANGE, fontWeight: '600', marginTop: 4 }}>View entry and full history</Text>
              </View>
            </TouchableOpacity>
          ) : renderItem({ item: item.activity! })}
          contentContainerStyle={{ padding: 12 }}
        />
      )}
      {selected && <EntryHistoryModal table={selected.book_table} entryId={selected.entry_id} visible={true} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: ORANGE, paddingHorizontal: 16, height: 60,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: '#fff', fontWeight: '400' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },

  filterBar: {
    backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB'
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  logCard: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 8,
    marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logContent: { flex: 1 },
  logText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  logBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  timestamp: { fontSize: 12, color: '#9CA3AF' }
});
