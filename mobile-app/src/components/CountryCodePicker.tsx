import type { TKey } from '../i18n/en';
import { useLanguageStore } from '../store/useLanguageStore';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Platform } from 'react-native';

export type CountryInfo = {
  name: string;
  labelKey: TKey;
  code: string;
  flag: string;
};

export const ASIAN_COUNTRIES: CountryInfo[] = [
  { name: 'Pakistan', labelKey: 'country0', code: '+92', flag: '🇵🇰' },
  { name: 'India', labelKey: 'country1', code: '+91', flag: '🇮🇳' },
  { name: 'Bangladesh', labelKey: 'country2', code: '+880', flag: '🇧🇩' },
  { name: 'Afghanistan', labelKey: 'country3', code: '+93', flag: '🇦🇫' },
  { name: 'Saudi Arabia', labelKey: 'country4', code: '+966', flag: '🇸🇦' },
  { name: 'United Arab Emirates', labelKey: 'country5', code: '+971', flag: '🇦🇪' },
  { name: 'Qatar', labelKey: 'country6', code: '+974', flag: '🇶🇦' },
  { name: 'Oman', labelKey: 'country7', code: '+968', flag: '🇴🇲' },
  { name: 'Kuwait', labelKey: 'country8', code: '+965', flag: '🇰🇼' },
  { name: 'Bahrain', labelKey: 'country9', code: '+973', flag: '🇧🇭' },
  { name: 'Malaysia', labelKey: 'country10', code: '+60', flag: '🇲🇾' },
  { name: 'Indonesia', labelKey: 'country11', code: '+62', flag: '🇮🇩' },
];

interface CountryCodePickerProps {
  selectedCode: string;
  onSelect: (code: string) => void;
}

export const CountryCodePicker = ({ selectedCode, onSelect }: CountryCodePickerProps) => {
  const { t } = useLanguageStore();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedCountry = ASIAN_COUNTRIES.find(c => c.code === selectedCode) || ASIAN_COUNTRIES[0];

  return (
    <>
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.text}>
          {selectedCountry.flag} {selectedCountry.code}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectCountry')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={ASIAN_COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.item}
                  onPress={() => {
                    onSelect(item.code);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <Text style={styles.itemName}>{t(item.labelKey)}</Text>
                  <Text style={styles.itemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  itemCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
