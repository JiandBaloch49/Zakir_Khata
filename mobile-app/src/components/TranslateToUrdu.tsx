import { useLanguageStore } from '../store/useLanguageStore';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

interface TranslateToUrduProps {
  value?: string;
  onSave: (urduText: string) => void;
  placeholder?: string;
}

export function TranslateToUrdu({ value, onSave, placeholder }: TranslateToUrduProps) {
  const { t } = useLanguageStore();
  const [isEditing, setIsEditing] = useState(false);
  const [urduText, setUrduText] = useState(value || '');

  if (!isEditing && !value) {
    return (
      <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <Text style={{ color: '#DC2626', fontSize: 13, textDecorationLine: 'underline' }}>
          {t('translateUrdu')}
        </Text>
      </TouchableOpacity>
    );
  }

  if (!isEditing && value) {
    return (
      <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <Text style={{ color: '#059669', fontSize: 13 }}>
          ✓ {value} {t('tapEdit')}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#374151' }}>{t('urduName')}</Text>
      <TextInput
        value={urduText}
        onChangeText={setUrduText}
        placeholder={placeholder ?? t('namePlaceholder')}
        style={{
          textAlign: 'right',
          writingDirection: 'rtl',
          borderWidth: 1,
          borderColor: '#D1D5DB',
          borderRadius: 8,
          padding: 8,
          fontSize: 14,
          backgroundColor: '#fff'
        }}
      />
      <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
        <TouchableOpacity 
          onPress={() => { onSave(urduText); setIsEditing(false); }}
          style={{ backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{t('save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setIsEditing(false)}
          style={{ borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}
        >
          <Text style={{ color: '#4B5563', fontSize: 12 }}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
