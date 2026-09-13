import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction } from '../types';
import { formatDate, formatCurrency } from '../utils/calculations';
import { useSettingsStore } from '../store/useSettingsStore';
import { getDisplayName } from '../utils/displayName';
import { themeColors } from '../theme/theme';

interface TransactionItemProps {
  transaction: Transaction;
  onPress: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onPress }) => {
  const isLena = transaction.type === 'lena';
  const { nameDisplayMode } = useSettingsStore();
  const [localMode, setLocalMode] = useState<'en' | 'ur' | 'both'>(nameDisplayMode);

  // Sync with global state if it changes
  React.useEffect(() => {
    setLocalMode(nameDisplayMode);
  }, [nameDisplayMode]);

  const toggleMode = () => {
    setLocalMode(prev => prev === 'en' ? 'ur' : 'en');
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.leftCol}>
          <TouchableOpacity onPress={toggleMode}>
            <Text style={styles.title}>
              {getDisplayName(transaction, localMode)}
            </Text>
          </TouchableOpacity>
          <Text style={styles.date}>{formatDate(transaction.date)}</Text>
          {!!transaction.notes && (
            <Text style={styles.notes}>{transaction.notes}</Text>
          )}
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.amount, isLena ? styles.textGreen : styles.textRed]}>
            {isLena ? '+' : '-'}{formatCurrency(transaction.amount_paisa)}
          </Text>
          <Text style={[styles.typeText, isLena ? styles.textGreen : styles.textRed]}>
            {isLena ? 'Lena' : 'Dena'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: themeColors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themeColors.border,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    color: themeColors.textPrimary,
    fontSize: 16,
  },
  date: {
    color: themeColors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  notes: {
    color: themeColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: 'bold',
    fontSize: 17,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  textGreen: {
    color: themeColors.success,
  },
  textRed: {
    color: themeColors.error,
  },
});
