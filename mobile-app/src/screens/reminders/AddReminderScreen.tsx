import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert , StyleSheet } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { addReminder } from '../../services/database/reminderDb';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DateField } from '../../components/ui/DateField';
import { todayDate } from '../../utils/dates';

type Props = StackScreenProps<any, any>;

const REMINDER_TYPES = [
  { id: 'payment', label: 'Payment', icon: '💰' },
  { id: 'invoice', label: 'Invoice', icon: '🧾' },
  { id: 'rent', label: 'Rent', icon: '🏠' },
  { id: 'utility', label: 'Utility', icon: '⚡' },
  { id: 'low_stock', label: 'Low Stock', icon: '📦' },
  { id: 'backup', label: 'Backup', icon: '💾' },
] as const;

export const AddReminderScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<any>('payment');
  
  const [dueDate, setDueDate] = useState(todayDate());

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!user) return;

    try {
      await addReminder({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        type,
        due_date: dueDate
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not save reminder');
    }
  };

  return (
    <ScreenContainer scrollable={true} hasTabBar={true} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24 }}>
      
      {/* Title */}
      <View className="mb-6">
        <Text className="text-gray-700 font-medium mb-2 ml-1">Title</Text>
        <TextInput
          className="bg-white px-4 py-4 rounded-xl border border-gray-200 text-lg shadow-sm"
          placeholder="e.g. Ali's Payment Due"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Type Selection */}
      <View className="mb-6">
        <Text className="text-gray-700 font-medium mb-2 ml-1">Category</Text>
        <View className="flex-row flex-wrap gap-2">
          {REMINDER_TYPES.map(rt => (
            <TouchableOpacity
              key={rt.id}
              onPress={() => setType(rt.id)}
              className={`flex-row items-center px-4 py-3 rounded-xl border ${type === rt.id ? 'bg-blue-50 border-blue-600' : 'bg-white border-gray-200'}`}
              style={{ minWidth: '48%' }}
            >
              <Text className="text-xl mr-2">{rt.icon}</Text>
              <Text className={`font-medium ${type === rt.id ? 'text-blue-700' : 'text-gray-600'}`}>{rt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date Selection */}
      <View className="mb-6">
        <Text className="text-gray-700 font-medium mb-2 ml-1">Due Date</Text>
        <DateField style={styles.dateField} textStyle={styles.dateFieldText} value={dueDate} onChange={setDueDate} />
      </View>

      {/* Description */}
      <View className="mb-8">
        <Text className="text-gray-700 font-medium mb-2 ml-1">Notes (Optional)</Text>
        <TextInput
          className="bg-white px-4 py-4 rounded-xl border border-gray-200 text-base shadow-sm min-h-[100px]"
          placeholder="Add any extra details..."
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        className="bg-blue-600 py-4 rounded-xl shadow-lg shadow-blue-400 mb-10 items-center"
        onPress={handleSave}
      >
        <Text className="text-white text-lg font-semibold">Save Reminder</Text>
      </TouchableOpacity>
      
    </ScreenContainer>
  );
};

// Matches the sibling card fields: bg-white / border-gray-200 / rounded-xl / p-4.
const styles = StyleSheet.create({
  dateField: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
  },
  dateFieldText: { color: '#1F2937', fontSize: 16, fontWeight: '600' },
});
