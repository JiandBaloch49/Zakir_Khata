import React, { useState, useEffect } from 'react';
import { Text, Keyboard, Platform } from 'react-native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

// Admin screens
import { AdminDashboard } from '../screens/admin/AdminDashboard';
import { StaffDetailScreen } from '../screens/admin/StaffDetailScreen';
import { ActivityLogScreen } from '../screens/admin/ActivityLog';
import { StaffBooksView } from '../screens/admin/StaffBooksView';
import { SettingsScreen } from '../screens/staff/SettingsScreen';
import { ChangePasswordScreen } from '../screens/staff/ChangePasswordScreen';
import { SubStaffScreen } from '../screens/staff/SubStaffScreen';

// Shared book screens
import { CashBookScreen } from '../screens/CashBook/CashBookScreen';
import { CashEntryModal } from '../screens/CashBook/CashEntryModal';
import { CashEntryDetailScreen } from '../screens/CashBook/CashEntryDetailScreen';
import { CashHistory } from '../screens/CashBook/CashHistory';
import { StockBookScreen } from '../screens/StockBook/StockBookScreen';
import { StockInReportScreen } from '../screens/StockBook/StockInReportScreen';
import { StockOutReportScreen } from '../screens/StockBook/StockOutReportScreen';
import { AddItemModal } from '../screens/StockBook/AddItemModal';
import { StockItemDetailScreen } from '../screens/StockBook/StockItemDetailScreen';
import { BillBookScreen } from '../screens/BillBook/BillBookScreen';
import { CreateNewBillModal } from '../screens/BillBook/CreateNewBillModal';
import { BillDetailScreen } from '../screens/BillBook/BillDetailScreen';
import { StaffBookScreen } from '../screens/StaffBook/StaffBookScreen';
import { AddStaffModal } from '../screens/StaffBook/AddStaffModal';
import { StaffDetail } from '../screens/StaffBook/StaffDetail';
import { StaffAttendanceScreen } from '../screens/StaffBook/StaffAttendanceScreen';
import { ExpenseBookScreen } from '../screens/ExpenseBook/ExpenseBookScreen';
import { AddExpenseModal } from '../screens/ExpenseBook/AddExpenseModal';
import { ExpenseDetail } from '../screens/ExpenseBook/ExpenseDetail';
import { DownloadOptionsModal } from '../components/Download/DownloadOptionsModal';
import { ReportsDashboardScreen } from '../screens/reports/ReportsDashboardScreen';
import { FinancialReportsScreen } from '../screens/reports/FinancialReportsScreen';
import { InventoryReportsScreen } from '../screens/reports/InventoryReportsScreen';
import { PeopleReportsScreen } from '../screens/reports/PeopleReportsScreen';
import { SalesReportScreen } from '../screens/reports/SalesReportScreen';
import { ProfitLossReportScreen } from '../screens/reports/ProfitLossReportScreen';
import { ExpenseReportScreen } from '../screens/reports/ExpenseReportScreen';
import { CashFlowReportScreen } from '../screens/reports/CashFlowReportScreen';
import { InventoryReportScreen } from '../screens/reports/InventoryReportScreen';
import { PartyReportScreen } from '../screens/reports/PartyReportScreen';
import { StaffReportScreen } from '../screens/reports/StaffReportScreen';
import { ReportsMenuScreen } from '../screens/reports/ReportsMenuScreen';
import { RemindersCenterScreen } from '../screens/reminders/RemindersCenterScreen';
import { AddReminderScreen } from '../screens/reminders/AddReminderScreen';
import { GlobalSearchScreen } from '../screens/search/GlobalSearchScreen';
import { SyncCenterScreen } from '../screens/sync/SyncCenterScreen';
import { SuppliersScreen } from '../screens/StockBook/SuppliersScreen';
import { AddSupplierModal } from '../screens/StockBook/AddSupplierModal';
import { SupplierProfileScreen } from '../screens/StockBook/SupplierProfileScreen';
import { SupplierLedgerScreen } from '../screens/StockBook/SupplierLedgerScreen';
import { AddSupplierPaymentModal } from '../screens/StockBook/AddSupplierPaymentModal';
import { ReturnItemsModal } from '../screens/BillBook/ReturnItemsModal';
import { PurchaseBookScreen } from '../screens/PurchaseBook/PurchaseBookScreen';
import { CreatePurchaseOrderModal } from '../screens/PurchaseBook/CreatePurchaseOrderModal';
import { PurchaseOrderDetailScreen } from '../screens/PurchaseBook/PurchaseOrderDetailScreen';
import { ReceiveGoodsModal } from '../screens/PurchaseBook/ReceiveGoodsModal';
import { PurchaseInvoiceScreen } from '../screens/PurchaseBook/PurchaseInvoiceScreen';
import { CreatePurchaseInvoiceModal } from '../screens/PurchaseBook/CreatePurchaseInvoiceModal';
import { PurchaseReturnModal } from '../screens/PurchaseBook/PurchaseReturnModal';
import { CustomerBookScreen } from '../screens/CustomerBook/CustomerBookScreen';
import { StaffSalaryDetailScreen } from '../screens/StaffBook/StaffSalaryDetailScreen';

// Khata Book Screens
import { KhataScreen } from '../screens/staff/KhataScreen';
import { CustomerLedgerScreen } from '../screens/staff/CustomerLedgerScreen';
import { CustomerDetailScreen } from '../screens/staff/CustomerDetailScreen';
import { AddTransactionScreen } from '../screens/staff/AddTransactionScreen';
import { EditTransactionScreen } from '../screens/staff/EditTransactionScreen';
import { AddCustomerModal } from '../screens/staff/AddCustomerModal';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Admin Home Stack (Dashboard + Staff lookup + Books) ──────────────────────────────
const AdminHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
    <Stack.Screen name="CashBook" component={CashBookScreen} />
    <Stack.Screen name="StockBook" component={StockBookScreen} />
    <Stack.Screen name="BillBook" component={BillBookScreen} />
    <Stack.Screen name="StaffBook" component={StaffBookScreen} />
    <Stack.Screen name="ExpensesTab" component={ExpenseBookScreen} />
    <Stack.Screen name="PurchaseBook" component={PurchaseBookScreen} />
    <Stack.Screen name="CustomerBook" component={CustomerBookScreen} />
    <Stack.Screen name="CashInModal" component={CashEntryModal} options={{ presentation: 'modal' }} initialParams={{ mode: 'in' }} />
    <Stack.Screen name="CashOutModal" component={CashEntryModal} options={{ presentation: 'modal' }} initialParams={{ mode: 'out' }} />
    <Stack.Screen name="EditCashEntryModal" component={CashEntryModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="CashEntryDetail" component={CashEntryDetailScreen} />
    <Stack.Screen name="CashHistory" component={CashHistory} />
    <Stack.Screen name="StockInReportScreen" component={StockInReportScreen} />
    <Stack.Screen name="StockOutReportScreen" component={StockOutReportScreen} />
    <Stack.Screen name="AddItemModal" component={AddItemModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="SuppliersScreen" component={SuppliersScreen} />
    <Stack.Screen name="AddSupplierModal" component={AddSupplierModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
    <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} />
    <Stack.Screen name="AddSupplierPayment" component={AddSupplierPaymentModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="CreatePurchaseInvoice" component={CreatePurchaseInvoiceModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="StockItemDetail" component={StockItemDetailScreen} />
    <Stack.Screen name="CreatePurchaseOrder" component={CreatePurchaseOrderModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
    <Stack.Screen name="ReceiveGoods" component={ReceiveGoodsModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="PurchaseInvoiceDetail" component={PurchaseInvoiceScreen} />
    <Stack.Screen name="PurchaseReturn" component={PurchaseReturnModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="CreateNewBillModal" component={CreateNewBillModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="BillDetailScreen" component={BillDetailScreen} />
    <Stack.Screen name="ReturnItemsModal" component={ReturnItemsModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="AddStaffModal" component={AddStaffModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
    <Stack.Screen name="StaffDetailBook" component={StaffDetail} />
    <Stack.Screen name="StaffSalaryDetail" component={StaffSalaryDetailScreen} />
    <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
    <Stack.Screen name="AddExpenseModal" component={AddExpenseModal} options={{ presentation: 'modal' }} />
    <Stack.Screen name="ExpenseDetail" component={ExpenseDetail} />
    <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
    <Stack.Screen name="StaffBooksView" component={StaffBooksView} />
    <Stack.Screen name="ReportsDashboard" component={ReportsDashboardScreen} />
    <Stack.Screen name="ReportsMenu" component={ReportsMenuScreen} />
    <Stack.Screen name="FinancialReports" component={FinancialReportsScreen} />
    <Stack.Screen name="InventoryReports" component={InventoryReportsScreen} />
    <Stack.Screen name="PeopleReports" component={PeopleReportsScreen} />
    <Stack.Screen name="SalesReport" component={SalesReportScreen} />
    <Stack.Screen name="ProfitLossReport" component={ProfitLossReportScreen} />
    <Stack.Screen name="ExpenseReport" component={ExpenseReportScreen} />
    <Stack.Screen name="CashFlowReport" component={CashFlowReportScreen} />
    <Stack.Screen name="InventoryReport" component={InventoryReportScreen} />
    <Stack.Screen name="PartyReport" component={PartyReportScreen} />
    <Stack.Screen name="StaffReport" component={StaffReportScreen} />
    <Stack.Screen name="RemindersCenter" component={RemindersCenterScreen} />
    <Stack.Screen name="AddReminder" component={AddReminderScreen} />
    <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ presentation: 'transparentModal' }} />
    <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
    <Stack.Screen name="DownloadOptionsModal" component={DownloadOptionsModal} options={{ presentation: 'transparentModal' }} />
  </Stack.Navigator>
);

// ─── Admin's own Khata Book ───────────────────────────────────────────────────
const AdminKhataStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="KhataMain" component={KhataScreen} />
    <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} />
    <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
    <Stack.Screen name="EditTransaction" component={EditTransactionScreen} />
    <Stack.Screen name="AddCustomerModal" component={AddCustomerModal} options={{ presentation: 'modal' }} />
  </Stack.Navigator>
);

// ─── Settings Stack ──────────────────────────────────────────────────────────
const SettingsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SettingsMain" component={SettingsScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="SubStaff" component={SubStaffScreen} />
  </Stack.Navigator>
);

const CustomHideableTabBar = (props: any) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  if (isKeyboardVisible) {
    return null;
  }

  return <BottomTabBar {...props} />;
};

// ─── Root Admin Tab Navigator ─────────────────────────────────────────────────
export const AdminNavigator = () => (
  <Tab.Navigator
    tabBar={props => <CustomHideableTabBar {...props} />}
    screenOptions={{
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: '#00A651',
      tabBarInactiveTintColor: '#6B7280',
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        height: 65,
        paddingBottom: 8,
        paddingTop: 8,
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        borderRadius: 28,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={AdminHomeStack}
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🏠</Text>,
      }}
    />

    <Tab.Screen
      name="Khata"
      component={AdminKhataStack}
      options={{
        tabBarLabel: 'Khata',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📒</Text>,
      }}
    />

    <Tab.Screen
      name="More"
      component={SettingsStack}
      options={{
        tabBarLabel: 'Settings',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⚙️</Text>,
      }}
    />
  </Tab.Navigator>
);
