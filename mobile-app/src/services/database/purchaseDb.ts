import { getDatabase } from './db';
import { writeWithSync } from './syncHelpers';
import { generateId, nowISO } from './queryHelpers';
import { addStockMovement, getStockItemsByUserId } from './stockDb';
import {
  PurchaseOrder, PurchaseOrderItem,
  PurchaseInvoice, PurchaseInvoiceItem,
  PurchaseReturn, PurchaseReturnItem,
  PurchaseSummary, POStatus, InvoiceStatus
} from '../../types/purchase.types';

export type {
  PurchaseOrder, PurchaseOrderItem,
  PurchaseInvoice, PurchaseInvoiceItem,
  PurchaseReturn, PurchaseReturnItem,
  PurchaseSummary
};

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export const createPurchaseOrder = async (
  userId: string,
  supplierId: string,
  items: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'received_qty' | 'is_deleted'>[],
  orderDate: string,
  expectedDate?: string,
  notes?: string
): Promise<PurchaseOrder> => {
  const db = await getDatabase();
  const id = generateId('po');
  const now = nowISO();

  // Auto-increment PO number per user
  const maxRow = await db.getFirstAsync<{ max_no: number }>(
    'SELECT MAX(po_number) as max_no FROM purchase_orders WHERE user_id = ?',
    [userId]
  );
  const po_number = (maxRow?.max_no ?? 0) + 1;
  const total = items.reduce((s, i) => s + i.line_total, 0);

  const data = {
    id, user_id: userId, supplier_id: supplierId,
    po_number, status: 'draft' as POStatus,
    order_date: orderDate,
    expected_date: expectedDate || null,
    notes: notes || null,
    total, received_total: 0,
    is_deleted: 0, deleted_at: null,
  };

  await writeWithSync({
    tableName: 'purchase_orders',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${userId}/purchase_orders/${id}`,
    userId
  });

  // Insert items
  for (const item of items) {
    const itemId = generateId('poi');
    const itemData = { ...item, id: itemId, po_id: id, received_qty: 0, is_deleted: 0 };
    await db.runAsync(
      `INSERT INTO purchase_order_items (id, po_id, stock_item_id, item_name, quantity, unit_cost, line_total, received_qty, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [itemId, id, item.stock_item_id || null, item.item_name, item.quantity, item.unit_cost, item.line_total]
    );
  }

  const savedItems = items.map((i, idx) => ({ ...i, id: `poi_${idx}`, po_id: id, received_qty: 0, is_deleted: 0 as const }));
  return { ...data, items: savedItems, created_at: now, updated_at: now, synced: 0 } as PurchaseOrder;
};

export const getPurchaseOrders = async (userId: string, status?: POStatus): Promise<PurchaseOrder[]> => {
  const db = await getDatabase();
  let query = `
    SELECT po.*, s.name as supplier_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.user_id = ? AND po.is_deleted = 0
  `;
  const params: any[] = [userId];
  if (status) { query += ' AND po.status = ?'; params.push(status); }
  query += ' ORDER BY po.created_at DESC';
  return db.getAllAsync<PurchaseOrder>(query, params);
};

export const getPurchaseOrderById = async (id: string): Promise<PurchaseOrder | null> => {
  const db = await getDatabase();
  const po = await db.getFirstAsync<PurchaseOrder>(
    `SELECT po.*, s.name as supplier_name FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ? AND po.is_deleted = 0`,
    [id]
  );
  if (!po) return null;
  const items = await db.getAllAsync<PurchaseOrderItem>(
    'SELECT * FROM purchase_order_items WHERE po_id = ? AND is_deleted = 0',
    [id]
  );
  return { ...po, items };
};

export const updatePurchaseOrderStatus = async (
  id: string, userId: string, status: POStatus
): Promise<void> => {
  const now = nowISO();
  await writeWithSync({
    tableName: 'purchase_orders',
    recordId: id,
    operation: 'update',
    data: { status, updated_at: now },
    firestorePath: `users/${userId}/purchase_orders/${id}`,
    userId
  });
};

/**
 * Mark items as received.
 * Automatically increases stock for each item via addStockMovement.
 */
export const receiveGoods = async (
  poId: string,
  userId: string,
  receipts: { itemId: string; stockItemId?: string | null; itemName: string; receivedQty: number; unitCost: number }[]
): Promise<void> => {
  const db = await getDatabase();
  const now = nowISO();
  let allReceived = true;
  let anyReceived = false;

  for (const r of receipts) {
    if (r.receivedQty <= 0) continue;
    anyReceived = true;

    // Update received_qty on the PO item
    await db.runAsync(
      `UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?`,
      [r.receivedQty, r.itemId]
    );

    // Check if fully received
    const poItem = await db.getFirstAsync<{ quantity: number; received_qty: number }>(
      'SELECT quantity, received_qty FROM purchase_order_items WHERE id = ?',
      [r.itemId]
    );
    if (poItem && poItem.received_qty < poItem.quantity) allReceived = false;

    // Increase stock if linked to a stock item
    if (r.stockItemId) {
      await addStockMovement({
        item_id: r.stockItemId,
        change: r.receivedQty,
        reason: 'purchase',
        date: now.split('T')[0],
        cost_per_unit: r.unitCost,
        user_id: userId,
        note: `Received from PO`,
      });
    }
  }

  if (!anyReceived) return;

  // Update PO totals and status
  const totRow = await db.getFirstAsync<{ received_total: number }>(
    'SELECT SUM(received_qty * unit_cost) as received_total FROM purchase_order_items WHERE po_id = ? AND is_deleted = 0',
    [poId]
  );
  const newStatus: POStatus = allReceived ? 'received' : 'partial';
  await db.runAsync(
    `UPDATE purchase_orders SET status = ?, received_total = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [newStatus, totRow?.received_total ?? 0, now, poId]
  );
};

// ─── Purchase Invoices ────────────────────────────────────────────────────────

export const createPurchaseInvoice = async (
  userId: string,
  supplierId: string,
  items: Omit<PurchaseInvoiceItem, 'id' | 'invoice_id' | 'is_deleted'>[],
  invoiceDate: string,
  opts?: {
    poId?: string;
    invoiceNumber?: string;
    dueDate?: string;
    discountAmount?: number;
    taxAmount?: number;
    notes?: string;
  }
): Promise<PurchaseInvoice> => {
  const db = await getDatabase();
  const id = generateId('pinv');
  const now = nowISO();

  // Auto-generate invoice number if not provided
  const maxRow = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM purchase_invoices WHERE user_id = ?',
    [userId]
  );
  const invoiceNumber = opts?.invoiceNumber || `INV-${String((maxRow?.cnt ?? 0) + 1).padStart(4, '0')}`;

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const discountAmount = opts?.discountAmount ?? 0;
  const taxAmount = opts?.taxAmount ?? 0;
  const total = subtotal - discountAmount + taxAmount;
  const balance_due = total;

  const data = {
    id, user_id: userId, supplier_id: supplierId,
    po_id: opts?.poId || null,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: opts?.dueDate || null,
    subtotal, discount_amount: discountAmount, tax_amount: taxAmount,
    total, amount_paid: 0, balance_due,
    status: 'unpaid' as InvoiceStatus,
    notes: opts?.notes || null,
    is_deleted: 0, deleted_at: null,
  };

  await writeWithSync({
    tableName: 'purchase_invoices',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${userId}/purchase_invoices/${id}`,
    userId
  });

  // Insert invoice items + update stock
  for (const item of items) {
    const itemId = generateId('piitem');
    await db.runAsync(
      `INSERT INTO purchase_invoice_items (id, invoice_id, stock_item_id, item_name, quantity, unit_cost, line_total, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [itemId, id, item.stock_item_id || null, item.item_name, item.quantity, item.unit_cost, item.line_total]
    );

    // Auto-increase stock
    if (item.stock_item_id) {
      await addStockMovement({
        item_id: item.stock_item_id,
        change: item.quantity,
        reason: 'purchase',
        date: invoiceDate,
        cost_per_unit: item.unit_cost,
        user_id: userId,
        note: `Purchase Invoice ${invoiceNumber}`,
      });
    }
  }

  return { ...data, created_at: now, updated_at: now, synced: 0 } as PurchaseInvoice;
};

export const getPurchaseInvoices = async (userId: string, status?: InvoiceStatus): Promise<PurchaseInvoice[]> => {
  const db = await getDatabase();
  let query = `
    SELECT pi.*, s.name as supplier_name
    FROM purchase_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    WHERE pi.user_id = ? AND pi.is_deleted = 0
  `;
  const params: any[] = [userId];
  if (status) { query += ' AND pi.status = ?'; params.push(status); }
  query += ' ORDER BY pi.invoice_date DESC';
  return db.getAllAsync<PurchaseInvoice>(query, params);
};

export const getPurchaseInvoiceById = async (id: string): Promise<PurchaseInvoice | null> => {
  const db = await getDatabase();
  const inv = await db.getFirstAsync<PurchaseInvoice>(
    `SELECT pi.*, s.name as supplier_name FROM purchase_invoices pi
     LEFT JOIN suppliers s ON s.id = pi.supplier_id WHERE pi.id = ? AND pi.is_deleted = 0`,
    [id]
  );
  if (!inv) return null;
  const items = await db.getAllAsync<PurchaseInvoiceItem>(
    'SELECT * FROM purchase_invoice_items WHERE invoice_id = ? AND is_deleted = 0',
    [id]
  );
  return { ...inv, items };
};

export const getPurchaseInvoicesBySupplier = async (supplierId: string): Promise<PurchaseInvoice[]> => {
  const db = await getDatabase();
  return db.getAllAsync<PurchaseInvoice>(
    `SELECT pi.*, s.name as supplier_name FROM purchase_invoices pi
     LEFT JOIN suppliers s ON s.id = pi.supplier_id
     WHERE pi.supplier_id = ? AND pi.is_deleted = 0
     ORDER BY pi.invoice_date DESC`,
    [supplierId]
  );
};

// ─── Purchase Returns ─────────────────────────────────────────────────────────

export const createPurchaseReturn = async (
  userId: string,
  invoiceId: string,
  supplierId: string,
  items: Omit<PurchaseReturnItem, 'id' | 'return_id'>[],
  returnDate: string,
  reason?: string
): Promise<PurchaseReturn> => {
  const db = await getDatabase();
  const id = generateId('pret');
  const now = nowISO();
  const totalRefund = items.reduce((s, i) => s + i.line_total, 0);

  const data = {
    id, user_id: userId, invoice_id: invoiceId, supplier_id: supplierId,
    return_date: returnDate, reason: reason || null,
    total_refund: totalRefund, status: 'pending' as const,
    is_deleted: 0, deleted_at: null,
  };

  await writeWithSync({
    tableName: 'purchase_returns',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${userId}/purchase_returns/${id}`,
    userId
  });

  // Insert return items + reduce stock
  for (const item of items) {
    const itemId = generateId('pritem');
    await db.runAsync(
      `INSERT INTO purchase_return_items (id, return_id, stock_item_id, item_name, quantity, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itemId, id, item.stock_item_id || null, item.item_name, item.quantity, item.unit_cost, item.line_total]
    );

    // Reduce stock
    if (item.stock_item_id) {
      await addStockMovement({
        item_id: item.stock_item_id,
        change: -item.quantity,
        reason: 'adjustment',
        date: returnDate,
        cost_per_unit: item.unit_cost,
        user_id: userId,
        note: `Purchase Return`,
      });
    }
  }

  return { ...data, created_at: now, updated_at: now, synced: 0 } as PurchaseReturn;
};

export const getPurchaseReturnsByInvoice = async (invoiceId: string): Promise<PurchaseReturn[]> => {
  const db = await getDatabase();
  return db.getAllAsync<PurchaseReturn>(
    'SELECT * FROM purchase_returns WHERE invoice_id = ? AND is_deleted = 0 ORDER BY return_date DESC',
    [invoiceId]
  );
};

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export const getPurchaseSummary = async (userId: string): Promise<PurchaseSummary> => {
  const db = await getDatabase();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [ordersRow, invoicesRow, paidRow] = await Promise.all([
    db.getFirstAsync<{ total: number; pending: number }>(
      `SELECT COUNT(*) as total,
         SUM(CASE WHEN status IN ('draft','sent','partial') THEN 1 ELSE 0 END) as pending
       FROM purchase_orders WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    ),
    db.getFirstAsync<{ total_invoiced: number; total_outstanding: number }>(
      `SELECT COALESCE(SUM(total), 0) as total_invoiced,
         COALESCE(SUM(balance_due), 0) as total_outstanding
       FROM purchase_invoices WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    ),
    db.getFirstAsync<{ paid_this_month: number }>(
      `SELECT COALESCE(SUM(amount), 0) as paid_this_month
       FROM supplier_payments
       WHERE user_id = ? AND is_deleted = 0 AND payment_date >= ?`,
      [userId, monthStart]
    ),
  ]);

  return {
    totalOrders: ordersRow?.total ?? 0,
    pendingOrders: ordersRow?.pending ?? 0,
    totalInvoiced: invoicesRow?.total_invoiced ?? 0,
    totalOutstanding: invoicesRow?.total_outstanding ?? 0,
    totalPaidThisMonth: paidRow?.paid_this_month ?? 0,
  };
};
