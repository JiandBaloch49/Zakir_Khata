import { getDatabase } from './db';

export interface SearchResult {
  id: string;
  type: 'customer' | 'khata' | 'bill' | 'product' | 'expense' | 'staff';
  title: string;
  subtitle: string;
  date?: string;
  amount?: number;
  metadata?: any;
}

export const executeGlobalSearch = async (query: string, userId: string): Promise<SearchResult[]> => {
  if (!query || query.trim() === '') return [];
  const db = await getDatabase();
  const searchPattern = `%${query.trim()}%`;
  
  const results: SearchResult[] = [];

  // Hierarchy filter pattern
  const hierarchyFilter = `(user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND is_deleted = 0`;
  const userHierarchyFilter = `(id = ? OR parentId = ? OR parentId IN (SELECT id FROM users WHERE parentId = ?))`;
  const transactionHierarchyFilter = `(userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) AND isDeleted = 0`;

  const params3 = [userId, userId, userId, searchPattern];
  const params4 = [userId, userId, userId, searchPattern, searchPattern];
  const params5 = [userId, userId, userId, searchPattern, searchPattern, searchPattern];

  // 1. Customers / Users
  const users = await db.getAllAsync<any>(
    `SELECT * FROM users WHERE ${userHierarchyFilter} AND (name LIKE ? OR phone LIKE ? OR businessName LIKE ?) LIMIT 10`,
    params5
  );
  users.forEach(u => results.push({
    id: u.id,
    type: 'customer',
    title: u.name,
    subtitle: u.phone + (u.businessName ? ` • ${u.businessName}` : ''),
    date: u.createdAt
  }));

  // 2. Khata / Transactions
  const transactions = await db.getAllAsync<any>(
    `SELECT * FROM transactions WHERE ${transactionHierarchyFilter} AND (partyName LIKE ? OR notes LIKE ?) LIMIT 10`,
    params4
  );
  transactions.forEach(t => results.push({
    id: t.id,
    type: 'khata',
    title: t.partyName,
    subtitle: t.notes || t.type,
    amount: t.amount_paisa,
    date: t.date,
    metadata: { type: t.type }
  }));

  // 3. Bills
  const bills = await db.getAllAsync<any>(
    `SELECT * FROM bills WHERE ${hierarchyFilter} AND (party_name LIKE ? OR party_phone LIKE ?) LIMIT 10`,
    params4
  );
  bills.forEach(b => results.push({
    id: b.id,
    type: 'bill',
    title: b.party_name,
    subtitle: b.party_phone || `Bill #${b.bill_no}`,
    amount: b.total,
    date: b.bill_date,
    metadata: { billNo: b.bill_no }
  }));

  // 4. Products / Stock
  const products = await db.getAllAsync<any>(
    `SELECT * FROM stock_items WHERE ${hierarchyFilter} AND (name_en LIKE ? OR barcode LIKE ? OR category LIKE ?) LIMIT 10`,
    params5
  );
  products.forEach(p => results.push({
    id: p.id,
    type: 'product',
    title: p.name_en,
    subtitle: p.barcode ? `Barcode: ${p.barcode}` : p.category,
    amount: p.sale_price,
    metadata: { quantity: p.quantity }
  }));

  // 5. Expenses
  const expenses = await db.getAllAsync<any>(
    `SELECT * FROM expenses WHERE ${hierarchyFilter} AND (description LIKE ? OR note LIKE ?) LIMIT 10`,
    params4
  );
  expenses.forEach(e => results.push({
    id: e.id,
    type: 'expense',
    title: e.description,
    subtitle: e.note || 'Expense',
    amount: e.amount,
    date: e.expense_date
  }));

  // 6. Staff
  const staff = await db.getAllAsync<any>(
    `SELECT * FROM staff_records WHERE ${hierarchyFilter} AND (name_en LIKE ? OR phone LIKE ?) LIMIT 10`,
    params4
  );
  staff.forEach(s => results.push({
    id: s.id,
    type: 'staff',
    title: s.name_en,
    subtitle: s.phone + ` • ${s.role}`,
    date: s.created_at
  }));

  return results;
};
