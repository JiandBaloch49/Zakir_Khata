import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { getTransactionsByParty, createTransaction } from '../../services/database/transactionDb';
import { getCustomerByName, customerPhotoUri, Customer } from '../../services/database/customerDb';
import { CustomerAvatar } from '../../components/ui/CustomerAvatar';
import { Transaction } from '../../types';
import { formatCurrency, formatDate, rupeesToPaisa } from '../../utils/calculations';
import { generateTransactionPDF } from '../../utils/pdfGenerator';
import { useAuthStore } from '../../store/authStore';
import { ReminderModal } from './ReminderModal';

interface RouteParams { partyName: string; userId: string }

export const CustomerDetailScreen = () => {
  const route = useRoute();
  const { partyName, userId } = route.params as RouteParams;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { user } = useAuthStore();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const [amountInput, setAmountInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTransactionsByParty(userId, partyName);
      setTransactions(data);
      const cust = await getCustomerByName(userId, partyName);
      setCustomer(cust);
    } finally {
      setLoading(false);
    }
  };

  const totalLena = transactions.filter(t => t.type === 'lena').reduce((s, t) => s + t.amount_paisa, 0);
  const totalDena = transactions.filter(t => t.type === 'dena').reduce((s, t) => s + t.amount_paisa, 0);
  const netBalance = totalLena - totalDena;

  const handleDownload = async () => {
    if (transactions.length === 0) {
      Alert.alert('Empty', 'No transactions to download');
      return;
    }
    setGenerating(true);
    try {
      await generateTransactionPDF(
        withRunning,
        user?.businessName || 'My Business',
        user?.name || 'Staff',
        `Ledger: ${partyName}`
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTransaction = async (type: 'lena' | 'dena') => {
    const paisa = rupeesToPaisa(amountInput);
    if (!paisa) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction(userId, partyName, paisa, type, notesInput);
      setAmountInput('');
      setNotesInput('');
      setShowPaymentModal(false);
      setShowCreditModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setSubmitting(false);
    }
  };

  let runningBalance = 0;
  const withRunning = [...transactions].reverse().map(t => {
    runningBalance += t.type === 'lena' ? t.amount_paisa : -t.amount_paisa;
    return { ...t, runningBalance };
  }).reverse();

  const getStatusBadge = () => {
    if (netBalance > 0) {
      if (totalDena > 0) return { label: '🟡 Partial', color: 'text-yellow-600' };
      return { label: '🔴 Payment Due', color: 'text-red-600' };
    }
    if (netBalance < 0) return { label: '🟢 Advance', color: 'text-green-600' };
    if (totalLena > 0) return { label: '🟢 Paid', color: 'text-green-600' };
    return { label: '⚪ No Balance', color: 'text-gray-500' };
  };

  const renderItem = ({ item }: { item: typeof withRunning[0] }) => {
    const isCredit = item.type === 'lena';
    return (
      <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <View className={`w-2 h-2 rounded-full mr-2 ${isCredit ? 'bg-red-500' : 'bg-green-500'}`} />
              <Text className="font-bold text-gray-800">
                {isCredit ? 'Credit Given' : 'Payment Received'}
              </Text>
            </View>
            <Text className="text-gray-400 text-xs">{formatDate(item.date)}</Text>
            {item.notes && <Text className="text-gray-600 text-sm mt-1.5 italic">"{item.notes}"</Text>}
          </View>
          <View className="items-end">
            <Text className={`font-bold text-lg ${isCredit ? 'text-red-600' : 'text-green-600'}`}>
              {isCredit ? '' : '+'}{formatCurrency(item.amount_paisa)}
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              Bal: {formatCurrency(Math.abs(item.runningBalance))} {item.runningBalance > 0 ? '(Due)' : item.runningBalance < 0 ? '(Adv)' : ''}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const currentStatus = getStatusBadge();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-5 pt-5 pb-8 rounded-b-[30px] shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center flex-1 pr-2">
            <CustomerAvatar name={partyName} uri={customerPhotoUri(customer)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
              textStyle={{ color: '#fff', fontSize: 18, fontWeight: '800' }} />
            <Text className="text-white font-extrabold text-2xl" numberOfLines={1}>{partyName}</Text>
          </View>
          <TouchableOpacity 
            onPress={handleDownload} 
            disabled={generating}
            className="bg-white/20 px-4 py-2 rounded-full flex-row items-center"
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white text-sm font-bold">📄 PDF</Text>
            )}
          </TouchableOpacity>
        </View>

        {(customer?.phone || customer?.email || customer?.cnic || customer?.address || customer?.city || customer?.notes) && (
          <View className="bg-green-700/50 rounded-xl p-3 mb-4">
            {customer.phone && <Text className="text-green-50 text-sm mb-1">📞 {customer.phone}</Text>}
            {customer.email && <Text className="text-green-50 text-sm mb-1">✉️ {customer.email}</Text>}
            {customer.cnic && <Text className="text-green-50 text-sm mb-1">🪪 {customer.cnic}</Text>}
            {(customer.address || customer.city) && (
              <Text className="text-green-50 text-sm mb-1">📍 {[customer.address, customer.city].filter(Boolean).join(', ')}</Text>
            )}
            {customer.notes && <Text className="text-green-100 text-sm italic">📝 {customer.notes}</Text>}
          </View>
        )}

        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-500 font-medium">Status</Text>
            <Text className={`font-bold ${currentStatus.color}`}>{currentStatus.label}</Text>
          </View>
          
          <View className="h-px bg-gray-100 mb-3" />
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Total Credit Given</Text>
            <Text className="font-semibold">{formatCurrency(totalLena)}</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text className="text-gray-600">Total Payment Received</Text>
            <Text className="font-semibold text-green-600">{formatCurrency(totalDena)}</Text>
          </View>
          
          <View className="bg-gray-50 p-3 rounded-xl flex-row justify-between items-center">
            <Text className="font-bold text-gray-800">Remaining Balance</Text>
            <Text className={`font-extrabold text-xl ${netBalance > 0 ? 'text-red-600' : netBalance < 0 ? 'text-green-600' : 'text-gray-800'}`}>
              {formatCurrency(Math.abs(netBalance))}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row px-4 -mt-4 mb-4 gap-2">
        <TouchableOpacity 
          className="flex-1 bg-red-500 p-3 rounded-xl shadow-sm items-center"
          onPress={() => setShowCreditModal(true)}
        >
          <Text className="text-white font-bold">Give Credit 🔴</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 bg-green-500 p-3 rounded-xl shadow-sm items-center"
          onPress={() => setShowPaymentModal(true)}
        >
          <Text className="text-white font-bold">Record Payment 🟢</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 bg-blue-500 p-3 rounded-xl shadow-sm items-center"
          onPress={() => setShowReminderModal(true)}
        >
          <Text className="text-white font-bold">Reminder ⏰</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#00A651" />
        </View>
      ) : (
        <FlatList
          data={withRunning}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text className="text-center text-gray-400 mt-10">No transactions yet.</Text>
          }
        />
      )}

      {/* Modals */}
      <Modal visible={showPaymentModal || showCreditModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 pb-10">
            <Text className="text-2xl font-bold text-gray-800 mb-2">
              {showPaymentModal ? 'Record Payment' : 'Give Credit'}
            </Text>
            <Text className="text-gray-500 mb-6">
              {showPaymentModal ? 'How much did the customer pay?' : 'How much credit did you give?'}
            </Text>

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-2xl font-bold text-center mb-4 text-gray-800"
              placeholder="Amount (Rs)"
              keyboardType="numeric"
              value={amountInput}
              onChangeText={setAmountInput}
            />

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 text-gray-800"
              placeholder="Notes (Optional)"
              value={notesInput}
              onChangeText={setNotesInput}
            />

            {/* Smart calculation preview */}
            {amountInput && !isNaN(parseFloat(amountInput)) && showPaymentModal && netBalance > 0 && (
              <View className="bg-blue-50 p-3 rounded-xl mb-6 flex-row justify-between">
                <Text className="text-blue-800">New Balance will be:</Text>
                <Text className="text-blue-800 font-bold">
                  {formatCurrency(Math.abs(netBalance - (rupeesToPaisa(amountInput) || 0)))}
                </Text>
              </View>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-200 p-4 rounded-xl items-center"
                onPress={() => { setShowPaymentModal(false); setShowCreditModal(false); setAmountInput(''); }}
              >
                <Text className="font-bold text-gray-700 text-lg">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 p-4 rounded-xl items-center ${showPaymentModal ? 'bg-green-500' : 'bg-red-500'}`}
                onPress={() => handleSaveTransaction(showPaymentModal ? 'dena' : 'lena')}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text className="font-bold text-white text-lg">Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reminder Modal Placeholder */}
      {showReminderModal && (
        <ReminderModal 
          visible={showReminderModal} 
          onClose={() => setShowReminderModal(false)} 
          partyName={partyName}
          netBalance={netBalance}
          phone={customer?.phone}
        />
      )}
    </SafeAreaView>
  );
};
