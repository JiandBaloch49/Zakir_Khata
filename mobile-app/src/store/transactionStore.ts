import { create } from 'zustand';
import { Transaction, CashEntry, CalculationResults } from '../types';
import {
  getTransactionsByUserId,
  getAllTransactions,
  deleteTransaction,
  getBalanceSummary,
} from '../services/database/transactionDb';
import {
  getCashEntriesByUserId,
  getAllCashEntries,
  getCashBalanceSummary,
} from '../services/database/cashbookDb';

interface TransactionStore {
  transactions: Transaction[];
  cashBook: CashEntry[];
  allTransactions: Transaction[];
  allCashBook: CashEntry[];
  loading: boolean;
  // SQL-aggregate balances (correct even for >50 rows)
  balanceSummary: { totalLena: number; totalDena: number; netBalance: number };
  cashSummary: { cashIn: number; cashOut: number; cashBalance: number };

  loadTransactions: (userId: string) => Promise<void>;
  loadAllTransactions: () => Promise<void>;
  removeTransaction: (id: string, userId: string) => Promise<void>;
  loadCashBook: (userId: string) => Promise<void>;
  loadAllCashBook: () => Promise<void>;
  getMetrics: () => CalculationResults;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  cashBook: [],
  allTransactions: [],
  allCashBook: [],
  loading: false,
  balanceSummary: { totalLena: 0, totalDena: 0, netBalance: 0 },
  cashSummary: { cashIn: 0, cashOut: 0, cashBalance: 0 },

  loadTransactions: async (userId) => {
    set({ loading: true });
    try {
      const [transactions, { totalLena, totalDena }] = await Promise.all([
        getTransactionsByUserId(userId, 50, 0),
        getBalanceSummary(userId),
      ]);
      set({
        transactions,
        balanceSummary: { totalLena, totalDena, netBalance: totalLena - totalDena },
      });
    } catch (error) {
      if (__DEV__) console.error('Error loading transactions:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadAllTransactions: async () => {
    set({ loading: true });
    try {
      const allTransactions = await getAllTransactions();
      set({ allTransactions });
    } catch (error) {
      if (__DEV__) console.error('Error loading all transactions:', error);
    } finally {
      set({ loading: false });
    }
  },

  removeTransaction: async (id, userId) => {
    try {
      await deleteTransaction(id, userId);
      const [transactions, { totalLena, totalDena }] = await Promise.all([
        getTransactionsByUserId(userId, 50, 0),
        getBalanceSummary(userId),
      ]);
      set({
        transactions,
        balanceSummary: { totalLena, totalDena, netBalance: totalLena - totalDena },
      });
    } catch (error) {
      if (__DEV__) console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  loadCashBook: async (userId) => {
    set({ loading: true });
    try {
      const [cashBook, { cashIn, cashOut }] = await Promise.all([
        getCashEntriesByUserId(userId, 50, 0),
        getCashBalanceSummary(userId),
      ]);
      set({ cashBook, cashSummary: { cashIn, cashOut, cashBalance: cashIn - cashOut } });
    } catch (error) {
      if (__DEV__) console.error('Error loading cash book:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadAllCashBook: async () => {
    set({ loading: true });
    try {
      const allCashBook = await getAllCashEntries();
      set({ allCashBook });
    } catch (error) {
      if (__DEV__) console.error('Error loading all cash book:', error);
    } finally {
      set({ loading: false });
    }
  },

  getMetrics: () => {
    const { balanceSummary, cashSummary } = get();
    return {
      totalLena: balanceSummary.totalLena,
      totalDena: balanceSummary.totalDena,
      netBalance: balanceSummary.netBalance,
      cashInTotal: cashSummary.cashIn,
      cashOutTotal: cashSummary.cashOut,
      cashBalance: cashSummary.cashBalance,
    };
  },
}));
