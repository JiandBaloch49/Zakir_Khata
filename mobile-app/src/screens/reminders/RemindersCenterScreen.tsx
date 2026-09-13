import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Linking, Platform } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { Reminder, getReminders, updateReminderStatus, deleteReminder } from '../../services/database/reminderDb';
import { getBillsByUserId } from '../../services/database/billDb';
import { formatCurrency } from '../../utils/calculations';
import { format, isPast, isToday } from 'date-fns';

type Props = StackScreenProps<any, any>;

export const RemindersCenterScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const loadReminders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getReminders(user.id, activeTab);
      
      const bills = await getBillsByUserId(user.id);
      const filteredBills = activeTab === 'pending' ? bills.filter(b => b.due > 0) : bills.filter(b => b.due === 0);
      
      const mappedBills: Reminder[] = filteredBills.map(b => ({
        id: `bill_ref_${b.id}`,
        user_id: b.user_id,
        title: b.party_name || 'Customer',
        description: `Bill #${b.bill_no}\nTotal: ${formatCurrency(b.total)} • Due: ${formatCurrency(b.due)}`,
        type: 'invoice',
        due_date: b.bill_date,
        status: activeTab,
        synced: 1,
        is_deleted: 0,
        deleted_at: null,
        created_at: b.created_at || new Date().toISOString(),
        updated_at: b.updated_at || b.created_at || new Date().toISOString()
      }));

      // Sort combined by due date
      const combined = [...data, ...mappedBills].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      
      setReminders(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadReminders);
    return unsubscribe;
  }, [navigation, activeTab, user]);

  const handleToggleStatus = async (reminder: Reminder) => {
    if (!user) return;
    const newStatus = reminder.status === 'pending' ? 'completed' : 'pending';
    try {
      await updateReminderStatus(reminder.id, user.id, newStatus);
      loadReminders();
    } catch (err) {
      Alert.alert('Error', 'Could not update reminder status');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteReminder(id, user.id);
            loadReminders();
          } catch (err) {
            Alert.alert('Error', 'Could not delete reminder');
          }
        }
      }
    ]);
  };

  const handleSendReminder = (reminder: Reminder) => {
    Alert.alert(
      'Send Reminder',
      'How would you like to send this reminder?',
      [
        {
          text: 'WhatsApp',
          onPress: () => {
            const msg = `Reminder: ${reminder.title}\nDue: ${format(new Date(reminder.due_date), 'dd MMM yyyy')}\n${reminder.description || ''}`;
            Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
          }
        },
        {
          text: 'SMS',
          onPress: () => {
            const msg = `Reminder: ${reminder.title}\nDue: ${format(new Date(reminder.due_date), 'dd MMM yyyy')}\n${reminder.description || ''}`;
            const url = Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(msg)}` : `sms:?body=${encodeURIComponent(msg)}`;
            Linking.openURL(url);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case 'payment': return '💰';
      case 'rent': return '🏠';
      case 'utility': return '⚡';
      case 'low_stock': return '📦';
      case 'invoice': return '🧾';
      case 'backup': return '💾';
      default: return '🔔';
    }
  };

  const renderReminder = (reminder: Reminder) => {
    const isOverdue = isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
    const isDueToday = isToday(new Date(reminder.due_date));
    
    let dateColor = 'text-gray-500';
    if (reminder.status === 'pending') {
      if (isOverdue) dateColor = 'text-red-600 font-bold';
      else if (isDueToday) dateColor = 'text-amber-600 font-bold';
    }

    return (
      <View key={reminder.id} className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-row items-center flex-1">
            <Text className="text-2xl mr-3">{getIconForType(reminder.type)}</Text>
            <View className="flex-1 pr-2">
              <Text className="text-lg font-semibold text-gray-800" numberOfLines={1}>{reminder.title}</Text>
              {reminder.description && <Text className="text-gray-500 text-sm mt-1">{reminder.description}</Text>}
              <Text className={`text-sm mt-2 ${dateColor}`}>
                Due: {format(new Date(reminder.due_date), 'dd MMM yyyy')}
                {isOverdue && reminder.status === 'pending' && ' (Overdue)'}
                {isDueToday && reminder.status === 'pending' && ' (Today)'}
              </Text>
            </View>
          </View>
        </View>
        
        <View className="flex-row mt-4 pt-3 border-t border-gray-100 justify-between items-center">
          <View className="flex-row">
            {!reminder.id.startsWith('bill_ref_') && (
              <TouchableOpacity 
                className={`px-4 py-2 rounded-lg mr-2 flex-row items-center ${reminder.status === 'completed' ? 'bg-gray-100' : 'bg-emerald-50'}`}
                onPress={() => handleToggleStatus(reminder)}
              >
                <Text className={reminder.status === 'completed' ? 'text-gray-600' : 'text-emerald-700 font-medium'}>
                  {reminder.status === 'completed' ? 'Undo' : '✓ Complete'}
                </Text>
              </TouchableOpacity>
            )}
            
            {reminder.status === 'pending' && ['payment', 'invoice'].includes(reminder.type) && (
              <TouchableOpacity 
                className="px-4 py-2 rounded-lg bg-blue-50 flex-row items-center"
                onPress={() => handleSendReminder(reminder)}
              >
                <Text className="text-blue-700 font-medium">📤 Send</Text>
              </TouchableOpacity>
            )}
          </View>

          {!reminder.id.startsWith('bill_ref_') && (
            <TouchableOpacity onPress={() => handleDelete(reminder.id)} className="p-2">
              <Text className="text-red-500">🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tabs */}
      <View className="flex-row bg-white pt-2 px-4 shadow-sm pb-0">
        <TouchableOpacity 
          className={`flex-1 pb-3 items-center border-b-2 ${activeTab === 'pending' ? 'border-blue-600' : 'border-transparent'}`}
          onPress={() => setActiveTab('pending')}
        >
          <Text className={`font-semibold ${activeTab === 'pending' ? 'text-blue-600' : 'text-gray-500'}`}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 pb-3 items-center border-b-2 ${activeTab === 'completed' ? 'border-blue-600' : 'border-transparent'}`}
          onPress={() => setActiveTab('completed')}
        >
          <Text className={`font-semibold ${activeTab === 'completed' ? 'text-blue-600' : 'text-gray-500'}`}>Completed</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReminders} />}
      >
        {reminders.length === 0 && !loading ? (
          <View className="items-center justify-center py-20">
            <Text className="text-6xl mb-4">✨</Text>
            <Text className="text-xl text-gray-400 font-medium">No {activeTab} reminders</Text>
          </View>
        ) : (
          reminders.map(renderReminder)
        )}
        <View className="h-20" />
      </ScrollView>

      {/* FAB */}
      <View className="absolute bottom-6 right-6">
        <TouchableOpacity 
          className="bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-blue-400"
          onPress={() => navigation.navigate('AddReminder')}
        >
          <Text className="text-white text-3xl font-light leading-none">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
