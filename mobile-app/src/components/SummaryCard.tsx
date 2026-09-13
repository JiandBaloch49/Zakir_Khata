import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../utils/calculations';
import { themeColors } from '../theme/theme';

interface SummaryCardProps {
  title: string;
  amount: number; // paisa
  color: string;
  icon: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, color, icon }) => (
  <View style={styles.container}>
    <View style={styles.topRow}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={[styles.dot, { backgroundColor: color.startsWith('bg-') ? (color.includes('green') ? '#1dd1a1' : color.includes('red') ? '#ee5a6f' : '#5f27cd') : color }]} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={[styles.amount, amount >= 0 ? styles.textGreen : styles.textRed]}>
      {formatCurrency(amount)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: themeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.border,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#1dd1a1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    color: themeColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  textGreen: {
    color: themeColors.success,
  },
  textRed: {
    color: themeColors.error,
  },
});
