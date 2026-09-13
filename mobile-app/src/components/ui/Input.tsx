import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { Colors } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, ...props }: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text
          style={{
            color: Colors.textGray,
            fontSize: 13,
            fontWeight: '500',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={Colors.textMuted}
        style={[
          {
            backgroundColor: Colors.bgInput,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 15,
            color: Colors.textWhite,
            borderWidth: 1,
            borderColor: focused ? Colors.borderFocus : Colors.border,
            minHeight: 50,
          },
          props.style,
        ]}
      />
      {error && (
        <Text style={{ color: Colors.error, fontSize: 12, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
};
