import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getStaffRecords, StaffRecord } from '../../services/database/staffDb';
import { getTodayAttendanceForUser, clockIn, clockOut, StaffAttendance } from '../../services/database/attendanceDb';

const ORANGE = '#FF6B35';
const GREEN = '#10B981';
const RED = '#EF4444';
const BLUE = '#3B82F6';

export const StaffAttendanceScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const staffList = await getStaffRecords(user.id);
      const attList = await getTodayAttendanceForUser(user.id);
      setStaff(staffList);
      setAttendance(attList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, user]);

  const handleClockIn = async (staffId: string) => {
    if (!user) return;
    try {
      await clockIn(user.id, staffId, 'present');
      loadData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to clock in');
    }
  };

  const handleClockOut = async (attId: string) => {
    if (!user) return;
    try {
      await clockOut(attId, user.id);
      loadData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to clock out');
    }
  };

  const renderItem = ({ item }: { item: StaffRecord }) => {
    const todayAtt = attendance.find(a => a.staff_id === item.id);

    return (
      <View style={styles.card}>
        <View style={styles.infoCol}>
          <Text style={styles.name}>{item.name_en}</Text>
          <Text style={styles.role}>{item.role}</Text>
        </View>

        <View style={styles.actionCol}>
          {!todayAtt ? (
            <TouchableOpacity style={styles.btnIn} onPress={() => handleClockIn(item.id)}>
              <Text style={styles.btnText}>Clock IN</Text>
            </TouchableOpacity>
          ) : !todayAtt.clock_out ? (
            <TouchableOpacity style={styles.btnOut} onPress={() => handleClockOut(todayAtt.id)}>
              <Text style={styles.btnText}>Clock OUT</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>Shift Completed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Attendance (Today)</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={ORANGE} style={{ flex: 1 }} />
      ) : staff.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 60 }}>👥</Text>
          <Text style={styles.emptyText}>No staff members found.</Text>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 135 }}
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: ORANGE, paddingHorizontal: 16, height: 60,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: '#fff', fontWeight: '400' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16 },
  
  card: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1
  },
  infoCol: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  role: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  
  actionCol: { minWidth: 100, alignItems: 'flex-end' },
  btnIn: { backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnOut: { backgroundColor: RED, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  badgeDone: { backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  badgeDoneText: { color: '#4B5563', fontWeight: '700', fontSize: 12 },
});
