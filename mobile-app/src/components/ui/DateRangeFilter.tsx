import { useLanguageStore } from '../../store/useLanguageStore';
import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { DateField } from './DateField';
import { parseDateValue, formatDisplayDate } from '../../utils/dates';

export type DateRange = { startDate?: string; endDate?: string };

/** Plain-language label for the active range, so a headline total always says
 *  which period it describes. Shared by every book that filters by date. */
export const describeRange = ({ startDate, endDate }: DateRange): string => {
  const { t } = useLanguageStore.getState();
  if (!startDate && !endDate) return t('allDatesLabel');
  if (startDate && endDate) return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
  return startDate ? t('fromDate', { date: formatDisplayDate(startDate) }) : t('upToDate', { date: formatDisplayDate(endDate) });
};

/** Controlled calendar bounds; the host supplies its existing input/pill styles. */
export const DateRangeFilter = ({ value, onChange, fieldStyle, textStyle }: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  fieldStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) => {
  const { t } = useLanguageStore();
  return (
  <View style={{ marginTop: 12 }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={textStyle}>{t('from')}</Text>
        <DateField value={value.startDate || ''} placeholder={t('anyDate')} style={fieldStyle} textStyle={textStyle}
          maximumDate={parseDateValue(value.endDate) || undefined}
          onChange={startDate => { if (!value.endDate || startDate <= value.endDate) onChange({ ...value, startDate }); }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={textStyle}>{t('to')}</Text>
        <DateField value={value.endDate || ''} placeholder={t('anyDate')} style={fieldStyle} textStyle={textStyle}
          minimumDate={parseDateValue(value.startDate) || undefined}
          onChange={endDate => { if (!value.startDate || endDate >= value.startDate) onChange({ ...value, endDate }); }} />
      </View>
    </View>
    {(value.startDate || value.endDate) && (
      <TouchableOpacity onPress={() => onChange({})} style={{ alignSelf: 'flex-end', paddingVertical: 8 }}>
        <Text style={textStyle}>{t('allDates')}</Text>
      </TouchableOpacity>
    )}
  </View>
);
};
