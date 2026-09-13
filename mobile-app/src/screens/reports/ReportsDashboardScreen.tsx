import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';

type Props = StackScreenProps<any, any>;

export const ReportsDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  
  const reportTiles = [
    { id: 'sales', title: 'Sales Report', icon: '📈', desc: 'Daily, weekly trends & averages', screen: 'SalesReport' },
    { id: 'pnl', title: 'Profit & Loss', icon: '💰', desc: 'Revenue, COGS & margins', screen: 'ProfitLossReport' },
    { id: 'expense', title: 'Expense Report', icon: '📉', desc: 'Category breakdown', screen: 'ExpenseReport' },
    { id: 'cash', title: 'Cash Flow', icon: '💸', desc: 'In & out balance flow', screen: 'CashFlowReport' },
    { id: 'inventory', title: 'Inventory', icon: '📦', desc: 'Valuation & performance', screen: 'InventoryReport' },
    { id: 'parties', title: 'Parties', icon: '👥', desc: 'Customers & Suppliers', screen: 'PartyReport' },
    { id: 'staff', title: 'Staff', icon: '🧑‍💼', desc: 'Performance & Attendance', screen: 'StaffReport' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-6 pt-12 pb-6 rounded-b-3xl shadow-sm">
        <Text className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Analytics</Text>
        <Text className="text-white text-3xl font-bold">Reports Center</Text>
        <Text className="text-blue-100 mt-2 text-base">Gain insights into your business</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row flex-wrap justify-between">
          {reportTiles.map((tile) => (
            <TouchableOpacity 
              key={tile.id}
              className="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-gray-100"
              style={{ width: '48%' }}
              onPress={() => navigation.navigate(tile.screen)}
            >
              <View className="bg-blue-50 w-12 h-12 rounded-full items-center justify-center mb-3">
                <Text className="text-2xl">{tile.icon}</Text>
              </View>
              <Text className="text-gray-900 font-bold text-base mb-1">{tile.title}</Text>
              <Text className="text-gray-500 text-xs leading-tight">{tile.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
