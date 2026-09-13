import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { BarChart } from 'react-native-gifted-charts';
import { useAuthStore } from '../../store/authStore';
import { getProfitLossSummary, ProfitLossSummary } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const ProfitLossReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const sum = await getProfitLossSummary(user.id, newFilter);
      setSummary(sum);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filter);
  }, [filter, user]);

  const handleExport = async () => {
    if (!summary) return;
    try {
      const data = [
        { Metric: 'Total Revenue', Amount: summary.totalRevenue },
        { Metric: 'Cost of Goods Sold (COGS)', Amount: summary.totalCOGS },
        { Metric: 'Gross Profit', Amount: summary.grossProfit },
        { Metric: 'Total Expenses', Amount: summary.totalExpenses },
        { Metric: 'Net Profit', Amount: summary.netProfit },
        { Metric: 'Profit Margin %', Amount: summary.profitMarginPct.toFixed(2) + '%' },
      ];
      handleReportExport(`Profit_Loss_${filterLabel}`, data, 'P&L');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const chartData = summary ? [
    { value: summary.totalRevenue, label: 'Rev', frontColor: '#3b82f6' },
    { value: summary.totalCOGS, label: 'COGS', frontColor: '#f59e0b' },
    { value: summary.totalExpenses, label: 'Exp', frontColor: '#ef4444' },
    { value: Math.max(summary.netProfit, 0), label: 'Net', frontColor: '#10b981' },
  ] : [];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Profit & Loss</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text className="text-white text-base">Export</Text>
          </TouchableOpacity>
        </View>
        <DateFilterPicker onFilterChange={(f, l) => { setFilter(f); setFilterLabel(l); }} />
      </View>

      <ScrollView className="flex-1 px-4 -mt-8" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : summary ? (
          <>
            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 items-center">
              <Text className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Net Profit</Text>
              <Text className={`text-4xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.netProfit)}
              </Text>
              <View className="bg-gray-100 px-3 py-1 rounded-full mt-2">
                <Text className="text-gray-700 font-bold">{summary.profitMarginPct.toFixed(1)}% Margin</Text>
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Summary View</Text>
              <View className="items-center pb-4">
                <BarChart
                  data={chartData}
                  width={250}
                  height={150}
                  barWidth={35}
                  spacing={20}
                  roundedTop
                  roundedBottom={false}
                  yAxisThickness={0}
                  xAxisThickness={1}
                  xAxisColor="#e5e7eb"
                  hideRules
                />
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Breakdown</Text>

              <View className="flex-row justify-between py-3 border-b border-gray-100">
                <Text className="text-gray-600">Total Revenue</Text>
                <Text className="font-semibold text-gray-900">{formatCurrency(summary.totalRevenue)}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-gray-100">
                <Text className="text-gray-600">Cost of Goods (COGS)</Text>
                <Text className="font-semibold text-orange-500">- {formatCurrency(summary.totalCOGS)}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-gray-100 bg-gray-50 -mx-5 px-5">
                <Text className="font-bold text-gray-800">Gross Profit</Text>
                <Text className="font-bold text-gray-900">{formatCurrency(summary.grossProfit)}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-gray-100">
                <Text className="text-gray-600">Total Expenses</Text>
                <Text className="font-semibold text-red-500">- {formatCurrency(summary.totalExpenses)}</Text>
              </View>
              <View className="flex-row justify-between pt-3">
                <Text className="font-bold text-gray-800">Net Profit</Text>
                <Text className={`font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.netProfit)}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
