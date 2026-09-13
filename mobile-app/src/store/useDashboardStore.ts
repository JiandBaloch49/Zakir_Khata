import { create } from 'zustand';
import { calculateTodaySales, getTodayBillsCount, calculatePendingPayments, calculateMonthlySales } from '../services/database/billDb';
import { calculateTodayExpenses, getMonthlyExpenseTotal } from '../services/database/expenseDb';
import { getStockItemsByUserId } from '../services/database/stockDb';
import { getBalanceSummary } from '../services/database/transactionDb';
import { getCashBalanceSummary } from '../services/database/cashbookDb';
import { getActivities } from '../services/database/activityDb';
import { ActivityLog } from '../types/activity.types';

interface DashboardMetrics {
  todaySales: number;
  todayExpenses: number;
  cashInDrawer: number;
  totalLena: number;
  totalDena: number;
  monthlyProfit: number;
  billsCreatedToday: number;
  lowStockAlerts: number;
  pendingPayments: number;
}

interface DashboardState {
  metrics: DashboardMetrics;
  recentActivities: ActivityLog[];
  loading: boolean;
  refreshDashboard: (userId: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: {
    todaySales: 0,
    todayExpenses: 0,
    cashInDrawer: 0,
    totalLena: 0,
    totalDena: 0,
    monthlyProfit: 0,
    billsCreatedToday: 0,
    lowStockAlerts: 0,
    pendingPayments: 0,
  },
  recentActivities: [],
  loading: true,

  refreshDashboard: async (userId: string) => {
    set({ loading: true });
    try {
      const now = new Date();
      
      const [
        todaySales,
        todayExpenses,
        cashSummary,
        khataSummary,
        monthlySales,
        monthlyExpenses,
        billsCreatedToday,
        pendingPayments,
        stockItems,
        activities
      ] = await Promise.all([
        calculateTodaySales(userId),
        calculateTodayExpenses(userId),
        getCashBalanceSummary(userId),
        getBalanceSummary(userId),
        calculateMonthlySales(userId),
        getMonthlyExpenseTotal(userId, now),
        getTodayBillsCount(userId),
        calculatePendingPayments(userId),
        getStockItemsByUserId(userId, true), // filterLowStock = true
        getActivities(userId, { startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }) // Last 7 days
      ]);

      set({
        metrics: {
          todaySales,
          todayExpenses,
          cashInDrawer: cashSummary.cashBalance,
          totalLena: khataSummary.totalLena,
          totalDena: khataSummary.totalDena,
          monthlyProfit: monthlySales - monthlyExpenses,
          billsCreatedToday,
          lowStockAlerts: stockItems.length,
          pendingPayments,
        },
        recentActivities: activities.slice(0, 5), // Only keep the 5 most recent
        loading: false,
      });
    } catch (error) {
      console.error('Failed to refresh dashboard metrics:', error);
      set({ loading: false });
    }
  },
}));
