import { getDatabase } from '../db';

export type InventorySummary = {
  totalItems: number;
  totalValue: number;       // quantity * purchase_price
  totalSellingValue: number; // quantity * sale_price
  expectedProfit: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export const getInventorySummary = async (
  userId: string
): Promise<InventorySummary> => {
  const db = await getDatabase();
  
  // Note: Inventory represents current state, not historical, so no date filters are applied for this summary.
  const query = `
    SELECT 
      COUNT(id) as totalItems,
      SUM(quantity * purchase_price) as totalValue,
      SUM(quantity * sale_price) as totalSellingValue,
      SUM(CASE WHEN quantity < low_stock_threshold AND quantity > 0 THEN 1 ELSE 0 END) as lowStockCount,
      SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) as outOfStockCount
    FROM stock_items
    WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
      AND is_deleted = 0
  `;
  const params = [userId, userId, userId];

  const result = await db.getFirstAsync<{
    totalItems: number;
    totalValue: number;
    totalSellingValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>(query, params);

  const totalValue = result?.totalValue || 0;
  const totalSellingValue = result?.totalSellingValue || 0;
  const expectedProfit = totalSellingValue - totalValue;

  return {
    totalItems: result?.totalItems || 0,
    totalValue,
    totalSellingValue,
    expectedProfit,
    lowStockCount: result?.lowStockCount || 0,
    outOfStockCount: result?.outOfStockCount || 0,
  };
};

export type ProductPerformance = {
  itemId: string;
  itemName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
};

export const getProductPerformance = async (
  userId: string,
  startDate?: string,
  endDate?: string,
  orderBy: 'revenue' | 'profit' | 'quantitySold' = 'revenue',
  orderDir: 'DESC' | 'ASC' = 'DESC',
  limit: number = 10
): Promise<ProductPerformance[]> => {
  const db = await getDatabase();
  
  let dateFilter = '';
  const params: any[] = [userId, userId, userId];
  
  if (startDate) {
    dateFilter += ` AND date(b.bill_date) >= date(?)`;
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ` AND date(b.bill_date) <= date(?)`;
    params.push(endDate);
  }

  const query = `
    SELECT 
      s.id as itemId,
      s.name_en as itemName,
      SUM(bi.quantity) as quantitySold,
      SUM(bi.quantity * bi.unit_price) as revenue,
      SUM(bi.quantity * bi.unit_price) - SUM(bi.quantity * s.purchase_price) as profit
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    JOIN stock_items s ON s.id = bi.item_id
    WHERE (s.user_id = ? OR s.user_id IN (SELECT id FROM users WHERE parentId = ?) OR s.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
      AND b.is_deleted = 0 AND s.is_deleted = 0
      ${dateFilter}
    GROUP BY s.id, s.name_en
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ${limit}
  `;

  return db.getAllAsync<ProductPerformance>(query, params);
};
