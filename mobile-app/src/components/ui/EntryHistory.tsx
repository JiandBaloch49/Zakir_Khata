import { useLanguageStore } from '../../store/useLanguageStore';
import type { TKey } from '../../i18n/en';
import { formatDisplayDate } from '../../utils/dates';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { EntryAuditRow, getEntryHistory } from '../../services/database/entryAuditDb';
import { formatCurrency } from '../../utils/calculations';

export function groupAuditRows(rows: EntryAuditRow[]): EntryAuditRow[][] {
  const groups = new Map<string, EntryAuditRow[]>();
  for (const row of rows) {
    const group = groups.get(row.change_group_id) || [];
    group.push(row);
    groups.set(row.change_group_id, group);
  }
  return [...groups.values()];
}
const labels: Record<string, TKey> = { amount_paisa: 'amount', partyName: 'partyName', notes: 'note', date: 'date', type: 'type', isDeleted: 'deleted' };
function valueText(json: string, kind: EntryAuditRow['value_kind'], t: ReturnType<typeof useLanguageStore.getState>['t']): string {
  const value = JSON.parse(json);
  if (value === null || value === '') return t('empty');
  if (kind === 'money_paisa') return formatCurrency(value);
  if (kind === 'date') return formatDisplayDate(String(value));
  if (kind === 'boolean') return value ? t('yes') : t('no');
  return String(value);
}
export const AuditFields = ({ rows }: { rows: EntryAuditRow[] }) => {
  const { t } = useLanguageStore();
  return <>{rows.map(row => <View key={row.id} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
    <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{labels[row.field_name] ? t(labels[row.field_name]) : row.field_name}: </Text>
    <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{valueText(row.old_value_json, row.value_kind, t)}</Text>
    <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}> → </Text>
    <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{valueText(row.new_value_json, row.value_kind, t)}</Text>
  </View>)}</>;
};

type Props = { table: string; entryId: string; visible: boolean; onClose: () => void };
export const EntryHistoryModal = ({ table, entryId, visible, onClose }: Props) => {
  const { t } = useLanguageStore();
  const userId = useAuthStore(s => s.user?.id);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getEntryHistory>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setHistory(null);
    setError('');
    if (visible) {
      setLoading(true);
      getEntryHistory(table, entryId).then(result => { if (active) setHistory(result); })
        .catch(e => { if (active) setError(e?.message || t('historyFailed')); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [table, entryId, visible, userId]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <View style={{ backgroundColor: '#FF6B35', padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('entryHistory')}</Text>
        <TouchableOpacity onPress={onClose}><Text style={{ color: '#fff', fontWeight: '700' }}>{t('close')}</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={{ margin: 24 }} color="#FF6B35" /> : error ? <Text style={{ padding: 16, color: '#EF4444' }}>{error}</Text> : history && <ScrollView contentContainerStyle={{ padding: 12 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{String(history.entry.partyName || t('khataEntry'))}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
            <Text style={{ color: '#374151' }}>{formatCurrency(Number(history.entry.amount_paisa))}</Text>
            <Text style={{ color: '#374151' }}> · </Text>
            <Text style={{ color: '#374151' }}>{formatDisplayDate(String(history.entry.date))}</Text>
          </View>
          <Text style={{ color: '#374151' }}>{history.entry.type === 'lena' || history.entry.type === 'dena' ? t(history.entry.type) : String(history.entry.type)} · {String(history.entry.notes || t('emptyNote'))}</Text>
          <Text style={{ color: '#6B7280', marginTop: 4 }}>{history.entry.isDeleted || history.entry.is_deleted ? t('deletedKept') : t('currentEntry')}</Text>
        </View>
        {!history.rows.length && <Text style={{ color: '#6B7280', padding: 12 }}>{t('noChanges')}</Text>}
        {groupAuditRows(history.rows).map(rows => <View key={rows[0].change_group_id} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontWeight: '700', color: '#111827', marginBottom: 4 }}>{t(rows[0].action === 'deleted' ? 'deletedEvent' : 'editedEvent', { name: rows[0].actor_name })}</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>{formatDisplayDate(rows[0].changed_at)} {new Date(rows[0].changed_at).toLocaleTimeString('en-PK')}</Text>
          <AuditFields rows={rows} />
        </View>)}
      </ScrollView>}
    </SafeAreaView>
  </Modal>;
};

export const EntryHistoryMarker = ({ entryId }: { entryId: string }) => {
  const { t } = useLanguageStore();
  const userId = useAuthStore(s => s.user?.id);
  const [visible, setVisible] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setHasHistory(false);
    setError('');
    getEntryHistory('transactions', entryId).then(h => { if (active) setHasHistory(h.rows.length > 0); })
      .catch(e => { if (active) setError(e?.message || t('historyFailed')); });
    return () => { active = false; };
  }, [entryId, userId]);
  if (!hasHistory && !error) return null;
  return <View style={{ marginBottom: 16 }}>
    <TouchableOpacity onPress={() => error ? Alert.alert(t('entryHistory'), error) : setVisible(true)}>
      <Text style={{ color: '#FF6B35', fontWeight: '600', fontSize: 13 }}>{error ? t('historyUnavailable') : t('editedHistory')}</Text>
    </TouchableOpacity>
    <EntryHistoryModal table="transactions" entryId={entryId} visible={visible} onClose={() => setVisible(false)} />
  </View>;
};
