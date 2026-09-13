import { useLanguageStore } from '../../store/useLanguageStore';
import type { TKey } from '../../i18n/en';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { DateRangeFilter } from '../../services/database/reports/types';

export type DateFilterPreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'currentMonth' | 'lastMonth' | 'currentYear' | 'all';

interface Props {
  onFilterChange: (filter: DateRangeFilter, label: string) => void;
  initialPreset?: DateFilterPreset;
}

export const DateFilterPicker: React.FC<Props> = ({ onFilterChange, initialPreset = 'currentMonth' }) => {
  const { t } = useLanguageStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeLabel, setActiveLabel] = useState<TKey>('currentMonth');

  const handleSelect = (preset: DateFilterPreset, label: TKey) => {
    setActiveLabel(label);
    setModalVisible(false);

    const now = new Date();
    let filter: DateRangeFilter = {};

    switch (preset) {
      case 'today':
        filter = { startDate: format(now, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
        break;
      case 'yesterday': {
        const yesterday = subDays(now, 1);
        filter = { startDate: format(yesterday, 'yyyy-MM-dd'), endDate: format(yesterday, 'yyyy-MM-dd') };
        break;
      }
      case 'last7days':
        filter = { startDate: format(subDays(now, 7), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
        break;
      case 'last30days':
        filter = { startDate: format(subDays(now, 30), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
        break;
      case 'currentMonth':
        filter = { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
        break;
      case 'lastMonth': {
        const lastM = subMonths(now, 1);
        filter = { startDate: format(startOfMonth(lastM), 'yyyy-MM-dd'), endDate: format(endOfMonth(lastM), 'yyyy-MM-dd') };
        break;
      }
      case 'currentYear':
        filter = { startDate: format(startOfYear(now), 'yyyy-MM-dd'), endDate: format(endOfYear(now), 'yyyy-MM-dd') };
        break;
      case 'all':
        filter = {};
        break;
    }

    onFilterChange(filter, t(label));
  };

  return (
    <View className="mb-4">
      <TouchableOpacity 
        className="flex-row items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-200"
        onPress={() => setModalVisible(true)}
      >
        <Text className="text-gray-500 font-medium">{t('dateRange')}</Text>
        <View className="flex-row items-center">
          <Text className="text-blue-600 font-semibold mr-2">{t(activeLabel)}</Text>
          <Text className="text-gray-400">▼</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-center items-center p-4"
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View className="bg-white w-full rounded-2xl overflow-hidden max-h-[80%]">
            <View className="p-4 border-b border-gray-100">
              <Text className="text-lg font-bold text-center">{t('selectRange')}</Text>
            </View>
            <ScrollView>
              {[
                { id: 'today', label: 'today' as const },
                { id: 'yesterday', label: 'yesterday' as const },
                { id: 'last7days', label: 'last7days' as const },
                { id: 'last30days', label: 'last30days' as const },
                { id: 'currentMonth', label: 'currentMonth' as const },
                { id: 'lastMonth', label: 'lastMonth' as const },
                { id: 'currentYear', label: 'currentYear' as const },
                { id: 'all', label: 'allTime' as const },
              ].map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  className="p-4 border-b border-gray-50 flex-row justify-between items-center"
                  onPress={() => handleSelect(item.id as DateFilterPreset, item.label)}
                >
                  <Text className={`text-base ${activeLabel === item.label ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                    {t(item.label)}
                  </Text>
                  {activeLabel === item.label && <Text className="text-blue-600">✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
