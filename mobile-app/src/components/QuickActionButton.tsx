import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../theme/theme';

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({ icon, label, onPress }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={styles.container}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#00A651', '#1dd1a1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.circle}
      >
        <Text style={styles.icon}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#1dd1a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    color: '#ffffff',
    fontSize: 24,
  },
  label: {
    color: themeColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
