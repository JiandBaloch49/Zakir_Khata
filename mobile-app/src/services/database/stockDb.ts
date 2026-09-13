import { getDatabase } from './db';
import { StockItem, StockMovement } from '../../types/stock.types';
import { writeWithSync } from './syncHelpers';

export const createStockItem = async (
  item: Omit<StockItem, 'id' | 'created_at' | 'synced' | 'is_deleted' | 'quantity'>
): Promise<StockItem> => {
  const id = `stock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const data = {
    ...item,
    id,
    quantity: 0,
    is_deleted: 0,
    deleted_at: null
  };

  await writeWithSync({
    tableName: 'stock_items',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${item.user_id}/stock_items/${id}`,
    userId: item.user_id
  });

  return {
    ...item,
    id,
    quantity: 0,
    created_at: now,
    updated_at: now,
    synced: 0,
    is_deleted: 0,
    deleted_at: undefined,
  };
};

export const getStockItemsByUserId = async (
  userId: string,
  filterLowStock: boolean = false
): Promise<StockItem[]> => {
  const db = await getDatabase();


  let query = `
    SELECT * FROM stock_items 
    WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
      AND is_deleted = 0
  `;

  if (filterLowStock) {
    query += ' AND quantity < low_stock_threshold';
  }

  query += ' ORDER BY created_at DESC';

  return db.getAllAsync<StockItem>(query, [userId, userId, userId]);
};

export const deleteStockItem = async (id: string, userId: string): Promise<void> => {
  await writeWithSync({
    tableName: 'stock_items',
    recordId: id,
    operation: 'delete',
    data: {},
    firestorePath: `users/${userId}/stock_items/${id}`,
    userId
  });
};

/**
 * Records a stock movement (purchase/sale/adjustment) and updates the item's quantity.
 * change > 0 means stock IN, change < 0 means stock OUT.
 */
export const addStockMovement = async (
  movement: Omit<StockMovement, 'id' | 'synced' | 'is_deleted'>
): Promise<StockMovement> => {
  const db = await getDatabase();
  const id = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const data = {
    ...movement,
    id,
    is_deleted: 0,
  };

  await db.withTransactionAsync(async () => {
    // Insert the movement record
    await db.runAsync(
      `INSERT INTO stock_movements
         (id, item_id, change, reason, date, cost_per_unit, sale_price_unit, user_id, note, synced, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        id,
        movement.item_id,
        movement.change,
        movement.reason,
        movement.date,
        movement.cost_per_unit ?? null,
        movement.sale_price_unit ?? null,
        movement.user_id,
        movement.note ?? null,
      ]
    );

    // Update the item's quantity and updated_at
    await db.runAsync(
      `UPDATE stock_items SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?`,
      [movement.change, now, movement.item_id]
    );
  });

  return {
    ...movement,
    id,
    synced: 0,
    is_deleted: 0,
  };
};

/**
 * Fetches all movements for a given stock item, ordered newest first.
 */
export const getMovementsByItemId = async (itemId: string): Promise<StockMovement[]> => {
  const db = await getDatabase();
  return db.getAllAsync<StockMovement>(
    `SELECT * FROM stock_movements WHERE item_id = ? AND is_deleted = 0 ORDER BY date DESC`,
    [itemId]
  );
};

export const calculateTotalStockValue = async (userId: string): Promise<number> => {
  const db = await getDatabase();


  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(quantity * purchase_price) as total FROM stock_items 
     WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0`,
    [userId, userId, userId]
  );
  
  return result?.total || 0;
};

export interface StockReportEntry extends StockMovement {
  item_name_en: string;
  item_name_ur?: string;
  unit: string;
}

export const getStockInReport = async (userId: string, startDate?: string, endDate?: string): Promise<StockReportEntry[]> => {
  const db = await getDatabase();
  let query = `
    SELECT m.*, i.name_en as item_name_en, i.name_ur as item_name_ur, i.unit 
    FROM stock_movements m
    JOIN stock_items i ON m.item_id = i.id
    WHERE m.change > 0 AND m.is_deleted = 0 AND i.is_deleted = 0
    AND (i.user_id = ? OR i.user_id IN (SELECT id FROM users WHERE parentId = ?) OR i.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
  `;
  const params: any[] = [userId, userId, userId];

  if (startDate) {
    query += ` AND date(m.date) >= date(?)`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND date(m.date) <= date(?)`;
    params.push(endDate);
  }
  
  query += ` ORDER BY m.date DESC`;
  return db.getAllAsync<StockReportEntry>(query, params);
};

export const getStockOutReport = async (userId: string, startDate?: string, endDate?: string): Promise<StockReportEntry[]> => {
  const db = await getDatabase();
  let query = `
    SELECT m.*, i.name_en as item_name_en, i.name_ur as item_name_ur, i.unit 
    FROM stock_movements m
    JOIN stock_items i ON m.item_id = i.id
    WHERE m.change < 0 AND m.is_deleted = 0 AND i.is_deleted = 0
    AND (i.user_id = ? OR i.user_id IN (SELECT id FROM users WHERE parentId = ?) OR i.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
  `;
  const params: any[] = [userId, userId, userId];

  if (startDate) {
    query += ` AND date(m.date) >= date(?)`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND date(m.date) <= date(?)`;
    params.push(endDate);
  }
  
  query += ` ORDER BY m.date DESC`;
  return db.getAllAsync<StockReportEntry>(query, params);
};
