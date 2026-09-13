import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { addReminder } from '../../services/database/reminderDb';
import { formatCurrency } from '../../utils/calculations';

interface Props {
  visible: boolean;
  onClose: () => void;
  partyName: string;
  netBalance: number;
  phone?: string | null;
}

export const ReminderModal: React.FC<Props> = ({ visible, onClose, partyName, netBalance, phone }) => {
  const { user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const handleSetReminder = async (days: number) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const date = new Date();
      date.setDate(date.getDate() + days);
      const isoDate = date.toISOString();

      await addReminder({
        user_id: user.id,
        title: `Payment Due: ${partyName}`,
        description: `Collect ${formatCurrency(Math.abs(netBalance))} from ${partyName}.`,
        type: 'payment',
        due_date: isoDate
      });
      Alert.alert('Success', `Reminder set for ${date.toLocaleDateString()}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to set reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const getMessageText = () => {
    const amount = formatCurrency(Math.abs(netBalance));
    return `Hello ${partyName},\n\nThis is a friendly reminder regarding your pending payment of ${amount}. Please make the payment at your earliest convenience.\n\nThank you,\n${user?.businessName || 'Our Shop'}`;
  };

  const handleWhatsApp = async () => {
    if (!phone) {
      Alert.alert('No Phone', 'No phone number saved for this customer.');
      return;
    }
    const text = encodeURIComponent(getMessageText());
    const url = `whatsapp://send?phone=${phone}&text=${text}`;
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'WhatsApp is not installed on your device.');
      }
    } catch (err) {
      console.error('Error opening WhatsApp', err);
    }
  };

  const handleSMS = async () => {
    if (!phone) {
      Alert.alert('No Phone', 'No phone number saved for this customer.');
      return;
    }
    const text = encodeURIComponent(getMessageText());
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${phone}${separator}body=${text}`;
    
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Error opening SMS', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/60 p-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
          <Text className="text-2xl font-bold text-gray-800 mb-2">Set Reminder</Text>
          <Text className="text-gray-500 mb-6">When do you want to be reminded to collect {formatCurrency(Math.abs(netBalance))}?</Text>

          <View className="flex-row flex-wrap gap-2 mb-6">
            <TouchableOpacity 
              className="bg-blue-50 px-4 py-3 rounded-xl flex-1 items-center border border-blue-100"
              onPress={() => handleSetReminder(1)}
              disabled={submitting}
            >
              <Text className="text-blue-600 font-bold">Tomorrow</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-blue-50 px-4 py-3 rounded-xl flex-1 items-center border border-blue-100"
              onPress={() => handleSetReminder(3)}
              disabled={submitting}
            >
              <Text className="text-blue-600 font-bold">In 3 Days</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="bg-blue-50 px-4 py-3 rounded-xl w-full items-center border border-blue-100"
              onPress={() => handleSetReminder(7)}
              disabled={submitting}
            >
              <Text className="text-blue-600 font-bold">Next Week</Text>
            </TouchableOpacity>
          </View>

          <View className="h-px bg-gray-100 mb-6" />
          
          <Text className="text-sm font-bold text-gray-800 mb-3">Quick Actions</Text>
          
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity 
              className="flex-1 bg-green-500 p-3 rounded-xl items-center flex-row justify-center"
              onPress={handleWhatsApp}
            >
              <Text className="text-white font-bold">WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-blue-500 p-3 rounded-xl items-center flex-row justify-center"
              onPress={handleSMS}
            >
              <Text className="text-white font-bold">Send SMS</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            className="w-full p-4 rounded-xl items-center bg-gray-100"
            onPress={onClose}
          >
            <Text className="font-bold text-gray-600 text-lg">Close</Text>
          </TouchableOpacity>
          
          {submitting && (
            <View className="absolute inset-0 bg-white/50 justify-center items-center rounded-3xl">
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
