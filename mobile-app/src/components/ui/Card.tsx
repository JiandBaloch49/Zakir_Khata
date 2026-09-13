import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Colors } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card = ({ children, style }: CardProps) => (
  <View
    style={[
      {
        backgroundColor: Colors.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
      style,
    ]}
  >
    {children}
  </View>
);
