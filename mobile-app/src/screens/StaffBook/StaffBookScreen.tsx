import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Animated, ActivityIndicator, Dimensions, Keyboard, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useStaffStore } from '../../store/useStaffStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { StaffRecord } from '../../types/staff.types';
import { getDisplayName } from '../../utils/displayName';
import { themeColors } from '../../theme/theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

const ORANGE = '#FF6B35';
const GREEN = '#4CAF50';
const GRAY = '#9CA3AF';

// Defined outside component to avoid recreation on every render
const StaffItem = React.memo(({ item, onPress, onSalaryPress, nameDisplayMode }: {
  item: StaffRecord;
  onPress: () => void;
  onSalaryPress: () => void;
  nameDisplayMode: 'en' | 'ur' | 'both';
}) => {
  const [localMode, setLocalMode] = React.useState(nameDisplayMode);

  React.useEffect(() => {
    setLocalMode(nameDisplayMode);
  }, [nameDisplayMode]);

  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={onPress}
    >
      <View style={styles.itemHeader}>
        <View style={styles.avatarBox}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </View>
        <View style={styles.itemInfo}>
          <TouchableOpacity onPress={() => setLocalMode(prev => prev === 'en' ? 'ur' : 'en')}>
            <Text style={styles.staffName}>{getDisplayName(item, localMode)}</Text>
          </TouchableOpacity>
          <Text style={styles.staffRole}>{item.role} | Joined: {new Date(item.joining_date).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity style={{ backgroundColor: themeColors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }} onPress={onSalaryPress}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>💵 Salary</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export const StaffBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(state => state.user);
  const staff = useStaffStore(state => state.staff);
  const loading = useStaffStore(state => state.loading);
  const stats = useStaffStore(state => state.stats);
  const fetchStaff = useStaffStore(state => state.fetchStaff);
  const loadStats = useStaffStore(state => state.loadStats);
  const nameDisplayMode = useSettingsStore(state => state.nameDisplayMode);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  const loadData = () => {
    if (!user) return;
    fetchStaff(user.id);
    loadStats(user.id);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, user]);

  useEffect(() => {
    loadData();
  }, [user]);

  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const renderItem = React.useCallback(({ item }: { item: StaffRecord }) => {
    return (
      <StaffItem 
        item={item} 
        onPress={() => navigation.navigate('StaffDetail', { staff: item })} 
        onSalaryPress={() => navigation.navigate('StaffSalaryDetail', { staff: item })} 
        nameDisplayMode={nameDisplayMode} 
      />
    );
  }, [navigation, nameDisplayMode]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="StaffBook" />

      {/* Sub Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Staff Book</Text>
        <TouchableOpacity 
          style={{ padding: 6 }} 
          onPress={() => navigation.navigate('DownloadOptionsModal', { reportType: 'staff' })}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#1dd1a1' }}>⬇ PDF Report</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryTitle}>Total Staff: {stats.total}</Text>
          <Text style={styles.summarySub}>Active: {stats.active} | Inactive: {stats.inactive}</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : staff.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 140, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={styles.emptyState}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.instructionText}>1- Add staff details</Text>
              <Text style={styles.instructionText}>2- Maintain staff directory</Text>
              <Text style={styles.instructionText}>3- Manage team profiles</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
        />
      )}

      {/* Add Button */}
      {!isKeyboardVisible && (
        <View style={[styles.addBtnContainer, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddStaffModal')}>
            <Text style={styles.addBtnText}>👥+ ADD STAFF</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: themeColors.cardBg, paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: themeColors.border,
  },
  backBtn: { width: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  summaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: themeColors.cardBg, marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, elevation: 3,
    marginBottom: 12
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  summarySub: { fontSize: 12, color: themeColors.textSecondary, marginTop: 2 },
  rateListLink: { fontSize: 13, color: '#1dd1a1', textDecorationLine: 'none', fontWeight: '700' },
  rateListArrow: { fontSize: 14, color: '#1dd1a1', fontWeight: '700' },

  itemRow: {
    backgroundColor: themeColors.cardBg, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 2
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: themeColors.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: themeColors.borderLight },
  itemInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  staffRole: { fontSize: 12, color: themeColors.textSecondary, marginTop: 4 },
  statusWrap: { alignItems: 'flex-end' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcons: { position: 'relative', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  shieldWrap: { position: 'absolute', top: -10, left: -10, backgroundColor: themeColors.cardBg, borderRadius: 40 },
  instructionText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 8 },
  arrowWrap: { marginTop: 24 },
  arrowIcon: { fontSize: 36, color: '#1dd1a1', fontWeight: '800' },

  addBtnContainer: {
    position: 'absolute', bottom: 75, left: 0, right: 0, alignItems: 'center'
  },
  addBtn: {
    backgroundColor: themeColors.primary, width: '80%', height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1dd1a1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  tabBar: {
    backgroundColor: themeColors.cardBg, borderTopWidth: 1, borderTopColor: themeColors.border, height: 60, flexDirection: 'row'
  },
  tabItem: { width: Dimensions.get('window').width / 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  tabItemActive: {},
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: themeColors.textSecondary },
  tabLabelActive: { color: '#1dd1a1' },
  tabIndicator: { position: 'absolute', bottom: 2, width: 24, height: 3, backgroundColor: '#1dd1a1', borderRadius: 2 },
});
