import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirestoreDB, IS_FIREBASE_CONFIGURED } from './firebaseConfig';
import { Transaction, CashEntry } from '../../types';
import { Expense } from '../../types/expense.types';
import NetInfo from '@react-native-community/netinfo';

export const syncTransactionToFirebase = async (transaction: Transaction): Promise<void> => {
  const db = getFirestoreDB();
  await setDoc(doc(db, 'users', transaction.userId, 'transactions', transaction.id), {
    ...transaction,
    syncedAt: new Date().toISOString(),
  }, { merge: true });
};

export const syncCashEntryToFirebase = async (entry: CashEntry): Promise<void> => {
  const db = getFirestoreDB();
  await setDoc(doc(db, 'users', entry.userId, 'cashbook', entry.id), {
    ...entry,
    syncedAt: new Date().toISOString(),
  }, { merge: true });
};

export const syncExpenseToFirebase = async (expense: Expense): Promise<void> => {
  const db = getFirestoreDB();
  await setDoc(doc(db, 'users', expense.user_id, 'expenses', expense.id), {
    ...expense,
    syncedAt: new Date().toISOString(),
  }, { merge: true });
};

export const syncPendingTransactions = async (userId: string): Promise<void> => {
  if (!IS_FIREBASE_CONFIGURED) return;
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) return;

  const { getPendingSyncTransactions } = await import('../database/transactionDb');
  const { getDatabase } = await import('../database/db');
  const sqliteDb = await getDatabase();
  const pending = await getPendingSyncTransactions();

  for (const t of pending) {
    if (t.userId !== userId) continue;
    try {
      await syncTransactionToFirebase(t);
      await sqliteDb.withTransactionAsync(async () => {
        await sqliteDb.runAsync(
          "UPDATE transactions SET syncStatus = 'synced', updatedAt = ? WHERE id = ?",
          [new Date().toISOString(), t.id]
        );
      });
    } catch (error) {
      if (__DEV__) console.warn('[Sync] Could not sync transaction:', t.id, error);
    }
  }
};

export const syncPendingCashEntries = async (userId: string): Promise<void> => {
  if (!IS_FIREBASE_CONFIGURED) return;
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) return;

  const { getPendingSyncCashEntries } = await import('../database/cashbookDb');
  const { getDatabase } = await import('../database/db');
  const sqliteDb = await getDatabase();
  const pending = await getPendingSyncCashEntries();

  for (const e of pending) {
    if (e.userId !== userId) continue;
    try {
      await syncCashEntryToFirebase(e);
      await sqliteDb.withTransactionAsync(async () => {
        await sqliteDb.runAsync(
          "UPDATE cashbook SET syncStatus = 'synced', updatedAt = ? WHERE id = ?",
          [new Date().toISOString(), e.id]
        );
      });
    } catch (error) {
      if (__DEV__) console.warn('[Sync] Could not sync cash entry:', e.id, error);
    }
  }
};

export const syncPendingExpenses = async (userId: string): Promise<void> => {
  if (!IS_FIREBASE_CONFIGURED) return;
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) return;

  const { getPendingSyncExpenses } = await import('../database/expenseDb');
  const { getDatabase } = await import('../database/db');
  const sqliteDb = await getDatabase();
  const pending = await getPendingSyncExpenses();

  for (const e of pending) {
    if (e.user_id !== userId) continue;
    try {
      await syncExpenseToFirebase(e);
      await sqliteDb.withTransactionAsync(async () => {
        await sqliteDb.runAsync(
          'UPDATE expenses SET synced = 1, updated_at = ? WHERE id = ?',
          [new Date().toISOString(), e.id]
        );
      });
    } catch (error) {
      if (__DEV__) console.warn('[Sync] Could not sync expense:', e.id, error);
    }
  }
};

export const syncAllPendingData = async (userId: string): Promise<void> => {
  await Promise.all([
    syncPendingTransactions(userId),
    syncPendingCashEntries(userId),
    syncPendingExpenses(userId),
  ]);
};

export const fetchTransactionsFromFirebase = async (userId: string): Promise<Transaction[]> => {
  if (!IS_FIREBASE_CONFIGURED) return [];
  try {
    const db = getFirestoreDB();
    const snap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', userId)));
    return snap.docs.map(d => d.data() as Transaction);
  } catch {
    return [];
  }
};

export const fetchCashEntriesFromFirebase = async (userId: string): Promise<CashEntry[]> => {
  if (!IS_FIREBASE_CONFIGURED) return [];
  try {
    const db = getFirestoreDB();
    const snap = await getDocs(query(collection(db, 'cashbook'), where('userId', '==', userId)));
    return snap.docs.map(d => d.data() as CashEntry);
  } catch {
    return [];
  }
};

export const fetchExpensesFromFirebase = async (userId: string): Promise<Expense[]> => {
  if (!IS_FIREBASE_CONFIGURED) return [];
  try {
    const db = getFirestoreDB();
    const snap = await getDocs(query(collection(db, 'expenses'), where('user_id', '==', userId)));
    return snap.docs.map(d => d.data() as Expense);
  } catch {
    return [];
  }
};
