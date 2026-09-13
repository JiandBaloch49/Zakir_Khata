import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { BarChart } from 'react-native-gifted-charts';
import { useAuthStore } from '../../store/authStore';
import { getCashFlowSummary, CashFlowSummary } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const CashFlowReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const sum = await getCashFlowSummary(user.id, newFilter);
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
        { Metric: 'Opening Cash', Amount: summary.openingCash },
        { Metric: 'Cash Received (In)', Amount: summary.cashIn },
        { Metric: 'Cash Paid (Out)', Amount: summary.cashOut },
        { Metric: 'Net Cash Flow', Amount: summary.netCashFlow },
        { Metric: 'Closing Cash', Amount: summary.closingCash },
      ];
      handleReportExport(`Cash_Flow_${filterLabel}`, data, 'Cash Flow');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const chartData = summary ? [
    { value: summary.cashIn, label: 'In', frontColor: '#10b981' },
    { value: summary.cashOut, label: 'Out', frontColor: '#ef4444' },
    { value: Math.abs(summary.netCashFlow), label: 'Net', frontColor: summary.netCashFlow >= 0 ? '#3b82f6' : '#f59e0b' },
  ] : [];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Cash Flow</Text>
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
              <Text className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Closing Cash</Text>
              <Text className="text-4xl font-bold text-gray-900">{formatCurrency(summary.closingCash)}</Text>
              <View className={`px-3 py-1 rounded-full mt-2 ${summary.netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <Text className={`font-bold ${summary.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {summary.netCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.netCashFlow)} Net Flow
                </Text>
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Flow Summary</Text>
              <View className="items-center pb-4">
                <BarChart
                  data={chartData}
                  width={250}
                  height={180}
                  barWidth={45}
                  spacing={30}
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
              <Text className="text-gray-800 font-bold text-lg mb-4">Cash Movement</Text>

              <View className="flex-row justify-between py-3 border-b border-gray-100 bg-gray-50 -mx-5 px-5">
                <Text className="font-bold text-gray-800">Opening Balance</Text>
                <Text className="font-bold text-gray-900">{formatCurrency(summary.openingCash)}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-gray-100">
                <Text className="text-gray-600">Cash In</Text>
                <Text className="font-semibold text-green-600">+ {formatCurrency(summary.cashIn)}</Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-gray-100">
                <Text className="text-gray-600">Cash Out</Text>
                <Text className="font-semibold text-red-500">- {formatCurrency(summary.cashOut)}</Text>
              </View>
              <View className="flex-row justify-between pt-3">
                <Text className="font-bold text-gray-800">Closing Balance</Text>
                <Text className="font-bold text-gray-900">{formatCurrency(summary.closingCash)}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
