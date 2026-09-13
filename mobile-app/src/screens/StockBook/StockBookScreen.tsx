import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Animated, ActivityIndicator, Dimensions, Alert, Keyboard, Platform
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useStockStore } from '../../store/useStockStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { StockItem } from '../../types/stock.types';
import { formatCurrency } from '../../utils/calculations';
import { getDisplayName } from '../../utils/displayName';
import { themeColors } from '../../theme/theme';
import { TopHeaderWithBooks } from '../../components/TopHeaderWithBooks';

const ORANGE = '#FF6B35';
const GREEN = '#4CAF50';
const RED = '#EF4444';

const StockItemView = React.memo(({ item, onPress, nameDisplayMode }: { item: StockItem, onPress: () => void, nameDisplayMode: 'en' | 'ur' | 'both' }) => {
  const isLow = item.quantity < item.low_stock_threshold;
  const [localMode, setLocalMode] = React.useState(nameDisplayMode);
  
  React.useEffect(() => {
    setLocalMode(nameDisplayMode);
  }, [nameDisplayMode]);

  return (
    <TouchableOpacity 
      style={[styles.itemRow, isLow && styles.itemRowLowStock]}
      onPress={onPress}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemIconBox}>
          <Text style={{ fontSize: 18 }}>📦</Text>
        </View>
        <View style={styles.itemInfo}>
          <TouchableOpacity onPress={() => setLocalMode(prev => prev === 'en' ? 'ur' : 'en')}>
            <Text style={styles.itemName}>{getDisplayName(item, localMode)}</Text>
          </TouchableOpacity>
          <Text style={styles.itemCat}>{item.category}</Text>
        </View>
        <View style={styles.itemQtyWrap}>
          <Text style={[styles.itemQtyNum, isLow ? { color: RED } : { color: GREEN }]}>
            {item.quantity}
          </Text>
          <Text style={styles.itemQtyUnit}>{item.unit}</Text>
        </View>
      </View>

      <View style={styles.itemFooter}>
        <Text style={styles.itemFooterText}>{item.unit}</Text>
        <Text style={styles.itemFooterText}> | {item.location || 'Not Set'}</Text>
        <Text style={styles.itemFooterText}> | {formatCurrency(item.purchase_price)}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ color: '#9CA3AF', fontSize: 16 }}>{'>'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const StockBookScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    items, loading, selectedTab, totalStockValue, 
    fetchItems, fetchLowStockItems, setSelectedTab, loadStockValue 
  } = useStockStore();
  const { nameDisplayMode } = useSettingsStore();

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
    if (selectedTab === 'low') {
      fetchLowStockItems(user.id);
    } else {
      fetchItems(user.id);
    }
    loadStockValue(user.id);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, user, selectedTab]);

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

  useEffect(() => {
    loadData();
  }, [user, selectedTab]);

  const renderItem = React.useCallback(({ item }: { item: StockItem }) => {
    return <StockItemView item={item} onPress={() => navigation.navigate('StockItemDetail', { item })} nameDisplayMode={nameDisplayMode} />;
  }, [nameDisplayMode, navigation]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      
      {/* Top Header with Profile & Books Bar */}
      <TopHeaderWithBooks navigation={navigation} activeBook="StockBook" />

      {/* Sub Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Stock Book</Text>
        <TouchableOpacity 
          style={{ paddingVertical: 4, paddingHorizontal: 6 }} 
          onPress={() => navigation.navigate('DownloadOptionsModal', { reportType: 'stock' })}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1dd1a1' }}>⬇ PDF Report</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.topTabs}>
        <TouchableOpacity 
          style={[styles.topTabItem, selectedTab === 'all' && styles.topTabItemActive]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.topTabText, selectedTab === 'all' && styles.topTabTextActive]}>
            All Items ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.topTabItem, selectedTab === 'low' && styles.topTabItemActive]}
          onPress={() => setSelectedTab('low')}
        >
          <Text style={[styles.topTabText, selectedTab === 'low' && styles.topTabTextActive]}>
            Low Stock ({items.filter(i => i.quantity < i.low_stock_threshold).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row 1: Rate List & Suppliers */}
      <View style={[styles.reportRow, { marginTop: 4 }]}>
        <TouchableOpacity style={styles.reportBtn} onPress={() => Alert.alert('Rate List', 'This feature is coming soon.')}>
          <Text style={styles.reportBtnText}>📋 Rate List</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('SuppliersScreen')}>
          <Text style={styles.reportBtnText}>🏭 Suppliers</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row 2: Stock IN & Stock OUT */}
      <View style={[styles.reportRow, { paddingTop: 0, paddingBottom: 6 }]}>
        <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('StockInReportScreen')}>
          <Text style={styles.reportBtnText}>📥 Stock IN Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('StockOutReportScreen')}>
          <Text style={styles.reportBtnText}>📤 Stock OUT Report</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 140, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={styles.emptyState}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.instructionText}>1- Add items</Text>
              <Text style={styles.instructionText}>2- Add stock in/out entries</Text>
              <Text style={styles.instructionText}>3- Manage your stock easily</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Add Item Button */}
      {!isKeyboardVisible && (
        <View style={[styles.addBtnContainer, { bottom: 85 + Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddItemModal')}>
            <Text style={styles.addBtnText}>+ ADD ITEM</Text>
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

  stockValueBtn: {
    backgroundColor: themeColors.inputBg, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: themeColors.borderLight,
  },
  stockValueIcon: { fontSize: 14, marginRight: 4, color: '#1dd1a1' },
  stockValueText: { fontSize: 12, fontWeight: '700', color: '#1dd1a1' },

  topTabs: {
    flexDirection: 'row', backgroundColor: themeColors.cardBg,
    borderBottomWidth: 1, borderBottomColor: themeColors.border, height: 36,
  },
  topTabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent'
  },
  topTabItemActive: { borderBottomColor: '#1dd1a1' },
  topTabText: { fontSize: 12, fontWeight: '600', color: themeColors.textSecondary },
  topTabTextActive: { fontWeight: '800', color: '#1dd1a1' },

  reportRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4, gap: 8,
    justifyContent: 'space-between'
  },
  reportBtn: {
    flex: 1, backgroundColor: themeColors.inputBg, borderRadius: 8, height: 36,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: themeColors.borderLight
  },
  reportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  itemRow: {
    backgroundColor: themeColors.cardBg, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: themeColors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 2,
  },
  itemRowLowStock: { backgroundColor: '#2c1216', borderColor: '#5c2229' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemIconBox: { width: 40, height: 40, backgroundColor: themeColors.inputBg, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: themeColors.borderLight },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  itemCat: { fontSize: 12, color: themeColors.textSecondary, marginTop: 2 },
  itemQtyWrap: { alignItems: 'flex-end' },
  itemQtyNum: { fontSize: 18, fontWeight: '800' },
  itemQtyUnit: { fontSize: 11, color: themeColors.textMuted },
  itemFooter: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
  itemFooterText: { fontSize: 12, color: themeColors.textSecondary },

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
