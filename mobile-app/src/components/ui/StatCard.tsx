import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../theme';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}

export const StatCard = ({
  title, value, subtitle, color = Colors.primary,
}: StatCardProps) => (
  <View
    style={{
      backgroundColor: Colors.bgCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      flex: 1,
      margin: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    }}
  >
    <Text
      style={{
        color: Colors.textGray,
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {title}
    </Text>
    <Text
      style={{
        color,
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
      }}
    >
      {value}
    </Text>
    {subtitle && (
      <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
        {subtitle}
      </Text>
    )}
  </View>
);
