import { getDatabase } from './db';

export interface FinancialMetrics {
  totalSales: number;
  totalExpenses: number;
  totalCOGS: number; // Cost of Goods Sold
  netProfit: number;
}

export const getFinancialMetrics = async (userId: string, startDate: string, endDate: string): Promise<FinancialMetrics> => {
  const db = await getDatabase();

  // Total Sales from Bills
  const salesRow = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(total) as total FROM bills 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND date(bill_date) BETWEEN date(?) AND date(?)`,
    [userId, userId, userId, startDate, endDate]
  );
  const totalSales = salesRow?.total || 0;

  // Total Expenses
  const expRow = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(amount) as total FROM expenses 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND date(expense_date) BETWEEN date(?) AND date(?)`,
    [userId, userId, userId, startDate, endDate]
  );
  const totalExpenses = expRow?.total || 0;

  // COGS: We sum up (quantity * purchase_price) of items sold in this period
  // We can get this by joining bill_items with stock_items
  const cogsRow = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(bi.quantity * s.purchase_price) as total
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
     LEFT JOIN stock_items s ON s.name_en = bi.item_name
      WHERE (b.user_id = ? OR b.user_id IN (SELECT id FROM users WHERE parentId = ?) OR b.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
       AND b.is_deleted = 0 AND bi.is_deleted = 0
       AND date(b.bill_date) BETWEEN date(?) AND date(?)`,
    [userId, userId, userId, startDate, endDate]
  );
  const totalCOGS = cogsRow?.total || 0;

  const netProfit = totalSales - totalExpenses - totalCOGS;

  return { totalSales, totalExpenses, totalCOGS, netProfit };
};

export interface CustomerRank {
  partyName: string;
  totalSpend: number;
}

export const getTopCustomers = async (userId: string, limit: number = 10): Promise<CustomerRank[]> => {
  const db = await getDatabase();

  return db.getAllAsync<CustomerRank>(
    `SELECT party_name as partyName, SUM(total) as totalSpend
     FROM bills
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
     GROUP BY party_name
     ORDER BY totalSpend DESC
     LIMIT ?`,
    [userId, userId, userId, limit]
  );
};

export interface ProductRank {
  itemName: string;
  quantitySold: number;
  revenue: number;
}

export const getFastMovingProducts = async (userId: string, limit: number = 10): Promise<ProductRank[]> => {
  const db = await getDatabase();

  return db.getAllAsync<ProductRank>(
    `SELECT bi.item_name as itemName, SUM(bi.quantity) as quantitySold, SUM(bi.line_total) as revenue
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
      WHERE (b.user_id = ? OR b.user_id IN (SELECT id FROM users WHERE parentId = ?) OR b.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND b.is_deleted = 0 AND bi.is_deleted = 0
     GROUP BY bi.item_name
     ORDER BY quantitySold DESC
     LIMIT ?`,
    [userId, userId, userId, limit]
  );
};

export interface DeadStock {
  itemName: string;
  quantity: number;
  daysSinceLastSale: number;
}

export const getDeadStock = async (userId: string, daysThreshold: number = 30): Promise<DeadStock[]> => {
  const db = await getDatabase();

  return db.getAllAsync<DeadStock>(
    `SELECT s.name_en as itemName, s.quantity as quantity, 
            CAST(julianday('now') - julianday(COALESCE(MAX(b.bill_date), s.created_at)) AS INTEGER) as daysSinceLastSale
     FROM stock_items s
     LEFT JOIN bill_items bi ON s.name_en = bi.item_name
     LEFT JOIN bills b ON bi.bill_id = b.id
      WHERE (s.user_id = ? OR s.user_id IN (SELECT id FROM users WHERE parentId = ?) OR s.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND s.is_deleted = 0
       AND s.quantity > 0
     GROUP BY s.id
     HAVING daysSinceLastSale >= ?
     ORDER BY daysSinceLastSale DESC`,
    [userId, userId, userId, daysThreshold]
  );
};

export interface StaffPerformance {
  staffName: string;
  billsGenerated: number;
  totalSales: number;
}

export const getStaffPerformance = async (userId: string): Promise<StaffPerformance[]> => {
  const db = await getDatabase();

  return db.getAllAsync<StaffPerformance>(
    `SELECT u.name as staffName, COUNT(b.id) as billsGenerated, SUM(b.total) as totalSales
     FROM users u
     LEFT JOIN bills b ON b.user_id = u.id AND b.is_deleted = 0
     WHERE u.id = ? OR u.parentId = ? OR u.parentId IN (SELECT id FROM users WHERE parentId = ?)
     GROUP BY u.id
     ORDER BY totalSales DESC`,
    [userId, userId, userId]
  );
};
