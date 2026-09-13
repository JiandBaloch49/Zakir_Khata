import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { useAuthStore } from '../../store/authStore';
import { getExpenseSummary, getExpenseTrend } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { formatCurrency } from '../../utils/calculations';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'];

export const ExpenseReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ totalExpenses: number; byCategory: any[] } | null>(null);
  const [trend, setTrend] = useState<{ date: string; total: number }[]>([]);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const sum = await getExpenseSummary(user.id, newFilter);
      const trn = await getExpenseTrend(user.id, newFilter);
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
    if (!summary) return;
    try {
      const data = summary.byCategory.map(c => ({
        Category: c.category,
        Amount: c.total,
        'Percentage %': c.percentage.toFixed(2) + '%'
      }));
      data.push({ Category: 'TOTAL', Amount: summary.totalExpenses, 'Percentage %': '100%' });
      handleReportExport(`Expense_Report_${filterLabel}`, data, 'Expenses');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const pieData = summary?.byCategory.map((c, idx) => ({
    value: c.total,
    color: COLORS[idx % COLORS.length],
    text: `${c.percentage.toFixed(0)}%`,
    textColor: 'white',
  })) || [];

  const lineData = trend.map(t => ({
    value: t.total,
    label: t.date.substring(5, 7), // Just the month digits
  }));

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Expense Report</Text>
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
              <Text className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Total Expenses</Text>
              <Text className="text-4xl font-bold text-gray-900">{formatCurrency(summary.totalExpenses)}</Text>
            </View>

            {pieData.length > 0 && (
              <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
                <Text className="text-gray-800 font-bold text-lg mb-4">By Category</Text>
                <View className="items-center pb-4">
                  <PieChart
                    data={pieData}
                    donut
                    radius={100}
                    innerRadius={60}
                    showText
                    textColor="white"
                    textSize={12}
                  />
                </View>

                {summary.byCategory.map((c, idx) => (
                  <View key={c.category} className="flex-row items-center justify-between py-2 border-b border-gray-50">
                    <View className="flex-row items-center flex-1">
                      <View className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <Text className="text-gray-700 flex-1">{c.category}</Text>
                    </View>
                    <Text className="font-semibold text-gray-900">{formatCurrency(c.total)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <Text className="text-gray-800 font-bold text-lg mb-4">Monthly Trend</Text>
              {lineData.length > 0 ? (
                <View className="items-center">
                  <LineChart
                    data={lineData}
                    width={280}
                    height={180}
                    color="#ef4444"
                    dataPointsColor="#ef4444"
                    thickness={3}
                    hideRules
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor="#e5e7eb"
                  />
                </View>
              ) : (
                <Text className="text-center text-gray-400 py-6">No trend data available</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
