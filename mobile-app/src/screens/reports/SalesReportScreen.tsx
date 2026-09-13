import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LineChart } from 'react-native-gifted-charts';
import { useAuthStore } from '../../store/authStore';
import { getSalesReportSummary, getSalesTrend, SalesSummary, SalesTrendData } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const SalesReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [trend, setTrend] = useState<SalesTrendData[]>([]);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const sum = await getSalesReportSummary(user.id, newFilter);
      const trn = await getSalesTrend(user.id, newFilter, 'day');
      setSummary(sum);
      setTrend(trn);
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
    if (!summary || trend.length === 0) return;
    try {
      const data = trend.map(t => ({
        Date: t.date,
        'Total Sales': t.total,
        'Number of Bills': t.count
      }));
      data.push({ Date: 'TOTAL', 'Total Sales': summary.totalSales, 'Number of Bills': summary.totalBills });
      handleReportExport(`Sales_Report_${filterLabel}`, data, 'Sales');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const chartData = trend.map(t => ({
    value: t.total,
    label: t.date.substring(8, 10), // just the day
    dataPointText: t.total > 0 ? (t.total / 1000).toFixed(1) + 'k' : ''
  }));

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Sales Report</Text>
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
            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 flex-row flex-wrap justify-between">
              <View className="w-[48%] mb-4">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Sales</Text>
                <Text className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSales)}</Text>
              </View>
              <View className="w-[48%] mb-4">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Bills</Text>
                <Text className="text-2xl font-bold text-gray-900">{summary.totalBills}</Text>
              </View>
              <View className="w-[48%]">
                <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg Bill Value</Text>
                <Text className="text-lg font-bold text-blue-600">{formatCurrency(summary.averageBillValue)}</Text>
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Sales Trend</Text>
              {chartData.length > 0 ? (
                <View className="items-center">
                  <LineChart
                    data={chartData}
                    width={300}
                    height={200}
                    spacing={chartData.length > 10 ? 25 : 40}
                    thickness={3}
                    color="#2563eb"
                    dataPointsColor="#2563eb"
                    textColor="#6b7280"
                    textShiftY={-10}
                    textShiftX={-15}
                    textFontSize={10}
                    hideRules
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor="#e5e7eb"
                  />
                </View>
              ) : (
                <View className="h-40 items-center justify-center">
                  <Text className="text-gray-400">No data for this period</Text>
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
