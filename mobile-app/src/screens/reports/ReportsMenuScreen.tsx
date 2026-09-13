import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ReportsMenuScreen = ({ navigation }: any) => {
  const MenuCard = ({ title, description, icon, route, color }: any) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate(route)}
      className="bg-white rounded-2xl p-4 mb-4 flex-row items-center shadow-sm"
    >
      <View className={`w-14 h-14 rounded-full ${color} items-center justify-center mr-4`}>
        <Text className="text-2xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-gray-800 font-bold text-lg">{title}</Text>
        <Text className="text-gray-500 text-sm mt-0.5">{description}</Text>
      </View>
      <Text className="text-gray-400 font-bold text-xl">{'>'}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-green-600 px-5 pt-4 pb-6 rounded-b-3xl shadow-md">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-white text-2xl font-bold">{'<'}</Text>
          </TouchableOpacity>
          <Text className="text-white font-bold text-2xl">Reports & Analytics</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-6">
        <MenuCard 
          title="Financial Reports" 
          description="Profit & Loss, Daily Sales, Cash Flow" 
          icon="📈" 
          color="bg-blue-100" 
          route="FinancialReports" 
        />
        <MenuCard 
          title="Inventory Analytics" 
          description="Fast Moving Products, Dead Stock" 
          icon="📦" 
          color="bg-orange-100" 
          route="InventoryReports" 
        />
        <MenuCard 
          title="Customer & Staff Insights" 
          description="Best Customers, Staff Performance" 
          icon="👥" 
          color="bg-purple-100" 
          route="PeopleReports" 
        />
      </ScrollView>
    </SafeAreaView>
  );
};
