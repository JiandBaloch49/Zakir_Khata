import { useLanguageStore } from '../../store/useLanguageStore';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/authStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { ReportOptions } from '../../types/download.types';
import { todayDate, formatDisplayDate } from '../../utils/dates';
import { DateRangeFilter, DateRange } from '../ui/DateRangeFilter';
import { REPORT_PRESETS, ReportPreset, presetPeriod, periodSlug, initialPeriod } from './reportPeriod';

const ORANGE = '#FF6B35';

export const DownloadOptionsModal = ({ route, navigation }: any) => {
  const { t } = useLanguageStore();
  // `date` (YYYY-MM-DD) is the day a day-view screen was showing when it opened this
  // sheet — the Cash Book's Day Book — so "daily cash in/out" is the default and the
  // preset pills / From–To still reach a week, a month or any custom span.
  // `period` is the range a report screen (Stock IN/OUT) is already showing.
  const { reportType, date: viewedDay, period: shownPeriod } = route.params as
    { reportType: ReportOptions['reportType']; date?: string; period?: { startDate?: string; endDate?: string } };
  const { user } = useAuthStore();
  const { isGenerating, generateFile } = useDownloadStore();

  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');

  // The period drives the report's SQL (pdfGenerator). Presets fill the same
  // from–to fields the books use; touching a field switches to Custom. Staff is a
  // roster with no date dimension, so the control is hidden for it and the
  // document prints "As of today" instead.
  const isRoster = reportType === 'staff';
  const initial = initialPeriod(viewedDay, shownPeriod);
  const [preset, setPreset] = useState<ReportPreset>(initial.preset);
  const [range, setRange] = useState<DateRange>(initial.range);

  const choosePreset = (next: ReportPreset) => {
    setPreset(next);
    if (next !== 'custom') setRange(presetPeriod(next));
  };
  const editRange = (next: DateRange) => {
    setPreset('custom');
    setRange(next);
  };

  const handleDownload = async () => {
    if (!user) return;

    const isPdf = format === 'pdf';
    const mimeType = isPdf ? 'application/pdf' : 'text/csv';
    const period = isRoster ? {} : range;
    const fileName = `${reportType}_report_${isRoster ? todayDate() : periodSlug(period)}.${isPdf ? 'pdf' : 'csv'}`;

    try {
      const fileUri = await generateFile({
        reportType,
        userId: user.id,
        startDate: period.startDate,
        endDate: period.endDate,
        format,
      });

      // Same save/share path as the working per-bill PDF (BillDetailScreen).
      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) return; // folder picker cancelled — stay open so they can retry

        try {
          const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
          const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            mimeType
          );
          await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert(t('success'), t('savedReport'), [
            { text: t('ok'), onPress: () => navigation.goBack() },
          ]);
        } catch (safErr) {
          if (__DEV__) console.error('[Download] SAF error:', safErr);
          Alert.alert(
            t('cannotSave'),
            t('folderHelp'),
            [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('shareInstead'),
                onPress: async () => {
                  await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: t('shareReport') });
                  navigation.goBack();
                },
              },
            ]
          );
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            UTI: isPdf ? '.pdf' : '.csv',
            mimeType,
            dialogTitle: t('saveReport'),
          });
        }
        navigation.goBack();
      }
    } catch (err: any) {
      // Do NOT goBack() here — the sheet stays open so the failure is visible.
      if (__DEV__) console.error('[Download] Failed to generate report:', err);
      Alert.alert(t('downloadFailed'), err?.message || t('reportFailed'));
    }
  };

  return (
    <View style={styles.modalBg}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('downloadReport')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={isGenerating}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {isRoster ? (
          <>
            <Text style={styles.label}>{t('period')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <Text style={styles.dateText}>{t('rosterAsOf')}</Text>
              <Text style={styles.dateText}>{formatDisplayDate(todayDate())}</Text>
            </View>
            <Text style={styles.hint}>{t('rosterHelp')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('period')}</Text>
            <View style={styles.formatRow}>
              {REPORT_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.formatBtn, styles.presetBtn, preset === p.key && styles.formatBtnActive]}
                  onPress={() => choosePreset(p.key)}
                >
                  <Text style={preset === p.key ? styles.formatTextActive : styles.formatText} numberOfLines={1}>
                    {t(({ today: 'today', week: 'sevenDays', month: 'thisMonth', custom: 'custom' } as const)[p.key])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <DateRangeFilter value={range} onChange={editRange}
              fieldStyle={styles.dateBox} textStyle={styles.dateLabel} />
          </>
        )}

        <Text style={styles.label}>{t('format')}</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity 
            style={[styles.formatBtn, format === 'pdf' && styles.formatBtnActive]}
            onPress={() => setFormat('pdf')}
          >
            <Text style={format === 'pdf' ? styles.formatTextActive : styles.formatText}>{t('pdf')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
            onPress={() => setFormat('csv')}
          >
            <Text style={format === 'csv' ? styles.formatTextActive : styles.formatText}>{t('csv')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.downloadBtn} 
          onPress={handleDownload}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.downloadBtnText}>{t('savePhone')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  close: { fontSize: 20, color: '#6B7280' },
  
  label: { fontSize: 14, color: '#4B5563', marginBottom: 8, marginTop: 12 },
  dateText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  presetBtn: { paddingHorizontal: 6, paddingVertical: 10 },
  dateBox: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  dateLabel: { fontSize: 13, color: '#4B5563' },
  
  formatRow: { flexDirection: 'row', gap: 12 },
  formatBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  formatBtnActive: { borderColor: ORANGE, backgroundColor: '#FFF7ED' },
  formatText: { color: '#4B5563', fontWeight: '600' },
  formatTextActive: { color: ORANGE, fontWeight: '600' },

  downloadBtn: { backgroundColor: ORANGE, padding: 16, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  downloadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
