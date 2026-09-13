import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, ViewStyle,
} from 'react-native';
import { Colors } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
  disabled?: boolean;
}

export const Button = ({
  title, onPress, loading, variant = 'primary', style, disabled,
}: ButtonProps) => {
  const bgColor =
    variant === 'primary' ? Colors.primary
    : variant === 'danger' ? Colors.error
    : Colors.bgCard;

  const glowColor =
    variant === 'primary' ? Colors.primary
    : variant === 'danger' ? Colors.error
    : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: bgColor,
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
          minHeight: 50,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
