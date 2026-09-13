import { getDatabase } from './db';
import { writeWithSync } from './syncHelpers';

export interface StaffSalaryTransaction {
  id: string;
  staff_id: string;
  user_id: string;
  type: 'cash_out' | 'cash_in'; // cash_out = Salary Paid / Cash Given; cash_in = Cash Received / Refund
  amount: number;              // integer paisa
  date: string; // ISO format or YYYY-MM-DD
  month: string; // YYYY-MM (e.g. 2026-09)
  note?: string | null;
  created_at: string;
  updated_at?: string | null;
  synced?: number;
  is_deleted?: number;
  firestore_path?: string | null;
}

export const addStaffSalaryTransaction = async (
  txn: Omit<StaffSalaryTransaction, 'id' | 'created_at' | 'updated_at' | 'synced' | 'is_deleted'>
): Promise<StaffSalaryTransaction> => {
  const id = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const data = {
    ...txn,
    id,
    is_deleted: 0,
    created_at: now,
    updated_at: now
  };

  await writeWithSync({
    tableName: 'staff_salary_transactions',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${txn.user_id}/staff_records/${txn.staff_id}/salary/${id}`,
    userId: txn.user_id
  });

  return { ...data, synced: 0 } as StaffSalaryTransaction;
};

export const getSalaryTransactionsByStaffId = async (
  staffId: string
): Promise<StaffSalaryTransaction[]> => {
  const db = await getDatabase();
  return db.getAllAsync<StaffSalaryTransaction>(
    `SELECT * FROM staff_salary_transactions 
      WHERE staff_id = ? AND is_deleted = 0
     ORDER BY date DESC, created_at DESC`,
    [staffId]
  );
};
