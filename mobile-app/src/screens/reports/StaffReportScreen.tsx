import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { getStaffPerformance, getStaffAttendanceSummary, StaffPerformance, StaffAttendanceSummary } from '../../services/database/reports';
import { DateFilterPicker } from '../../components/reports/DateFilterPicker';
import { handleReportExport } from '../../utils/exportUtils';

type Props = StackScreenProps<any, any>;

export const StaffReportScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<StaffPerformance[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendanceSummary[]>([]);
  const [filter, setFilter] = useState({});
  const [filterLabel, setFilterLabel] = useState('Current Month');
  const [activeTab, setActiveTab] = useState<'performance' | 'attendance'>('performance');

  const loadData = async (newFilter: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const perf = await getStaffPerformance(user.id, newFilter);
      const att = await getStaffAttendanceSummary(user.id, newFilter);
      setPerformance(perf);
      setAttendance(att);
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
    if (activeTab === 'performance' && performance.length > 0) {
      const data = performance.map(p => ({
        'Staff Name': p.staffName,
        'Bills Created': p.billsCreated,
        'Expenses Added': p.expensesAdded,
        'Total Activities': p.activitiesCount
      }));
      handleReportExport(`Staff_Performance_${filterLabel}`, data, 'Performance');
    } else if (activeTab === 'attendance' && attendance.length > 0) {
      const data = attendance.map(a => ({
        'Staff Name': a.staffName,
        'Days Present': a.daysPresent,
        'Days Absent': a.daysAbsent,
        'Half Days': a.daysHalfDay,
        'Total Logged Days': a.daysPresent + a.daysAbsent + a.daysHalfDay
      }));
      handleReportExport(`Staff_Attendance_${filterLabel}`, data, 'Attendance');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-4 pt-4 pb-12 rounded-b-3xl">
        <View className="flex-row justify-between items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-white text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Staff Reports</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text className="text-white text-base">Export</Text>
          </TouchableOpacity>
        </View>
        <DateFilterPicker onFilterChange={(f, l) => { setFilter(f); setFilterLabel(l); }} />
      </View>

      <View className="flex-row mx-4 -mt-6 bg-white rounded-xl shadow-sm p-1 border border-gray-100">
        <TouchableOpacity 
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'performance' ? 'bg-blue-50' : ''}`}
          onPress={() => setActiveTab('performance')}
        >
          <Text className={`font-semibold ${activeTab === 'performance' ? 'text-blue-600' : 'text-gray-500'}`}>Performance</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'attendance' ? 'bg-blue-50' : ''}`}
          onPress={() => setActiveTab('attendance')}
        >
          <Text className={`font-semibold ${activeTab === 'attendance' ? 'text-blue-600' : 'text-gray-500'}`}>Attendance</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : activeTab === 'performance' ? (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <Text className="text-gray-800 font-bold text-lg mb-4">Activity Performance</Text>
            
            {performance.length === 0 ? (
              <Text className="text-gray-400 py-4 text-center">No staff performance data for this period</Text>
            ) : (
              performance.map((p, idx) => (
                <View key={p.staffId} className={`py-3 ${idx < performance.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="font-semibold text-gray-900 flex-1">{p.staffName}</Text>
                    <Text className="font-bold text-blue-600">{p.activitiesCount} Actions</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-500 text-xs">Bills: {p.billsCreated}</Text>
                    <Text className="text-gray-500 text-xs">Expenses: {p.expensesAdded}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <Text className="text-gray-800 font-bold text-lg mb-4">Attendance Summary</Text>
            
            {attendance.length === 0 ? (
              <Text className="text-gray-400 py-4 text-center">No attendance data logged</Text>
            ) : (
              attendance.map((a, idx) => (
                <View key={a.staffId} className={`py-3 ${idx < attendance.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <Text className="font-semibold text-gray-900 mb-2">{a.staffName}</Text>
                  <View className="flex-row justify-between">
                    <View className="items-center bg-green-50 px-3 py-1 rounded">
                      <Text className="text-green-700 font-bold">{a.daysPresent}</Text>
                      <Text className="text-green-600 text-[10px]">Present</Text>
                    </View>
                    <View className="items-center bg-red-50 px-3 py-1 rounded">
                      <Text className="text-red-700 font-bold">{a.daysAbsent}</Text>
                      <Text className="text-red-600 text-[10px]">Absent</Text>
                    </View>
                    <View className="items-center bg-orange-50 px-3 py-1 rounded">
                      <Text className="text-orange-700 font-bold">{a.daysHalfDay}</Text>
                      <Text className="text-orange-600 text-[10px]">Half Day</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
