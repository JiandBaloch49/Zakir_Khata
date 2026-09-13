import { getDatabase } from './db';
import { assertAllowedUpdateFields } from './updateFields';
import { Bill, BillItem } from '../../types/bill.types';
import { writeWithSync } from './syncHelpers';
import { userScope, userScopeParams } from './queryHelpers';
import { parseDateValue, toDateValue } from '../../utils/dates';

export const createBill = async (
  bill: Omit<Bill, 'id' | 'bill_no' | 'created_at' | 'synced' | 'is_deleted'> & { bill_no?: number },
  items: Omit<BillItem, 'id' | 'bill_id' | 'is_deleted'>[]
): Promise<Bill> => {
  const db = await getDatabase();
  const id = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  let newBillNo = bill.bill_no;
  if (!newBillNo) {
    newBillNo = 1;
    const maxRow = await db.getFirstAsync<{ max_no: number }>(
      'SELECT MAX(bill_no) as max_no FROM bills WHERE user_id = ?',
      [bill.user_id]
    );
    if (maxRow && maxRow.max_no) {
      newBillNo = maxRow.max_no + 1;
    }
  }

  const attachments = bill.attachment_urls ? JSON.stringify(bill.attachment_urls) : null;

  const billData = {
    ...bill,
    id,
    bill_no: newBillNo,
    attachment_urls: attachments,
    voice_note_url: bill.voice_note_url || null,
    is_draft: bill.is_draft || 0,
    is_hold: bill.is_hold || 0,
    payment_method: bill.payment_method || 'cash',
    is_deleted: 0,
    deleted_at: null
  };

  await writeWithSync({
    tableName: 'bills',
    recordId: id,
    operation: 'create',
    data: billData,
    firestorePath: `users/${bill.user_id}/bills/${id}`,
    userId: bill.user_id
  });

  const savedItems: BillItem[] = [];
  for (const item of items) {
    const itemId = `billitem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const itemData = {
      ...item,
      id: itemId,
      bill_id: id,
      returned_quantity: 0,
      is_deleted: 0
    };
    await writeWithSync({
      tableName: 'bill_items',
      recordId: itemId,
      operation: 'create',
      data: itemData,
      firestorePath: `users/${bill.user_id}/bills/${id}/items/${itemId}`,
      userId: bill.user_id
    });
    savedItems.push(itemData as BillItem);
  }

  return {
    ...bill,
    id,
    bill_no: newBillNo,
    items: savedItems,
    attachment_urls: bill.attachment_urls,
    is_draft: billData.is_draft as 0 | 1,
    is_hold: billData.is_hold as 0 | 1,
    payment_method: billData.payment_method,
    created_at: now,
    updated_at: now,
    synced: 0,
    is_deleted: 0
  };
};

export const updateBill = async (
  id: string,
  userId: string,
  updates: Partial<Pick<Bill, 'bill_no' | 'customer_id' | 'party_name' | 'party_name_ur' | 'party_phone' | 'bill_date' | 'subtotal' | 'discount_pct' | 'discount_amount' | 'tax_amount' | 'total' | 'paid' | 'due' | 'status' | 'payment_method' | 'is_draft' | 'is_hold' | 'notes' | 'attachment_urls' | 'voice_note_url'>>
): Promise<void> => {
  assertAllowedUpdateFields(updates, ["bill_no","customer_id","party_name","party_name_ur","party_phone","bill_date","subtotal","discount_pct","discount_amount","tax_amount","total","paid","due","status","payment_method","is_draft","is_hold","notes","attachment_urls","voice_note_url"]);
  if (Object.keys(updates).length === 0) return;
  const now = new Date().toISOString();
  await writeWithSync({
    tableName: 'bills',
    recordId: id,
    operation: 'update',
    data: { ...updates, updated_at: now },
    firestorePath: `users/${userId}/bills/${id}`,
    userId
  });
};

export const updateBillItem = async (
  id: string,
  billId: string,
  userId: string,
  updates: Partial<Pick<BillItem, 'item_id' | 'item_name' | 'quantity' | 'returned_quantity' | 'unit_price' | 'line_total'>>
): Promise<void> => {
  assertAllowedUpdateFields(updates, ["item_id","item_name","quantity","returned_quantity","unit_price","line_total"]);
  if (Object.keys(updates).length === 0) return;
  await writeWithSync({
    tableName: 'bill_items',
    recordId: id,
    operation: 'update',
    data: updates,
    firestorePath: `users/${userId}/bills/${billId}/items/${id}`,
    userId
  });
};

export type BillFilter = {
  startDate?: string;
  endDate?: string;
  /** 'posted' = neither draft nor hold, matching the screen's default tab. */
  status?: 'all' | 'posted' | 'drafts' | 'holds';
  search?: string;
};

/** One predicate for both rows and whole-result paisa aggregates. */
export const getFilteredBills = async (userId: string, filter: BillFilter = {}, limit = -1, offset = 0) => {
  for (const date of [filter.startDate, filter.endDate]) {
    if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseDateValue(date))) {
      throw new Error('Invalid date range.');
    }
  }
  if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) throw new Error('From date must not be after To date.');
  if (filter.status && !['all', 'posted', 'drafts', 'holds'].includes(filter.status)) throw new Error('Invalid bill status.');

  let where = `${userScope('user_id')} AND is_deleted = 0`;
  const params: (string | number)[] = [...userScopeParams(userId)];
  if (filter.startDate || filter.endDate) {
    where += ' AND date(bill_date) BETWEEN date(?) AND date(?)';
    params.push(filter.startDate || '0001-01-01', filter.endDate || '9999-12-31');
  }
  if (filter.status === 'drafts') where += ' AND is_draft = 1';
  else if (filter.status === 'holds') where += ' AND is_hold = 1';
  else if (filter.status === 'posted') where += ' AND COALESCE(is_draft, 0) = 0 AND COALESCE(is_hold, 0) = 0';

  const search = filter.search?.trim();
  if (search) {
    // Literal substring search: %, _ and quotes are text, never SQL wildcards.
    where += ` AND (instr(lower(COALESCE(party_name, '')), ?) > 0
                 OR instr(COALESCE(party_phone, ''), ?) > 0
                 OR instr(COALESCE(CAST(bill_no AS TEXT), ''), ?) > 0)`;
    params.push(search.toLowerCase(), search, search);
  }

  const db = await getDatabase();
  const bills = await db.getAllAsync<any>(
    `SELECT * FROM bills WHERE ${where} ORDER BY bill_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  for (const b of bills) {
    if (b.attachment_urls) b.attachment_urls = JSON.parse(b.attachment_urls);
    b.items = await db.getAllAsync<BillItem>(
      'SELECT * FROM bill_items WHERE bill_id = ? AND is_deleted = 0', [b.id]
    );
  }

  // total/paid/due are integer paisa (v29), summed by SQL over the WHOLE filtered
  // set — never from the returned page, so the headline cannot drift from the list.
  const summary = await db.getFirstAsync<{ billCount: number; totalBilled: number; totalPaid: number; totalDue: number }>(
    `SELECT COUNT(*) as billCount,
            COALESCE(SUM(total), 0) as totalBilled,
            COALESCE(SUM(paid), 0) as totalPaid,
            COALESCE(SUM(due), 0) as totalDue
       FROM bills WHERE ${where}`, params
  );
  const { billCount = 0, totalBilled = 0, totalPaid = 0, totalDue = 0 } = summary || {};
  return { bills: bills as Bill[], billSummary: { billCount, totalBilled, totalPaid, totalDue } };
};

/** True when a bill would appear under the given filter — used to tell the user
 *  when a backdated bill saved outside the range they are looking at. */
export const billMatchesFilter = (bill: Pick<Bill, 'bill_date' | 'is_draft' | 'is_hold'>, filter: BillFilter = {}): boolean => {
  const day = toDateValue(bill.bill_date as string);
  if (!day) return false;
  if (filter.startDate && day < filter.startDate) return false;
  if (filter.endDate && day > filter.endDate) return false;
  if (filter.status === 'drafts') return bill.is_draft === 1;
  if (filter.status === 'holds') return bill.is_hold === 1;
  if (filter.status === 'posted') return bill.is_draft !== 1 && bill.is_hold !== 1;
  return true;
};

export const getBillsByUserId = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<Bill[]> => {
  const db = await getDatabase();

  let query = `
    SELECT * FROM bills 
    WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
      AND is_deleted = 0
  `;
  const params: any[] = [userId, userId, userId];

  if (startDate && endDate) {
    query += ' AND date(bill_date) BETWEEN date(?) AND date(?)';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY created_at DESC';

  const bills = await db.getAllAsync<any>(query, params);
  
  // Attach items (for a lightweight list this might be skipped, but we'll include it)
  for (const b of bills) {
    if (b.attachment_urls) {
      b.attachment_urls = JSON.parse(b.attachment_urls);
    }
    const items = await db.getAllAsync<BillItem>(
      'SELECT * FROM bill_items WHERE bill_id = ? AND is_deleted = 0',
      [b.id]
    );
    b.items = items;
  }

  return bills as Bill[];
};

export const calculateMonthlySales = async (userId: string): Promise<number> => {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(total) as total FROM bills 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND strftime('%Y-%m', bill_date) = strftime('%Y-%m', 'now', 'localtime')`,
    [userId, userId, userId]
  );
  
  return result?.total || 0;
};

export const calculateTodaySales = async (userId: string): Promise<number> => {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(total) as total FROM bills 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND date(bill_date) = date('now', 'localtime')`,
    [userId, userId, userId]
  );
  
  return result?.total || 0;
};

export const getTodayBillsCount = async (userId: string): Promise<number> => {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM bills 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND date(bill_date) = date('now', 'localtime')`,
    [userId, userId, userId]
  );
  
  return result?.count || 0;
};

export const calculatePendingPayments = async (userId: string): Promise<number> => {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(due) as total FROM bills 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
       AND due > 0`,
    [userId, userId, userId]
  );
  
  return result?.total || 0;
};

export const deleteBill = async (id: string, userId: string): Promise<void> => {
  await writeWithSync({
    tableName: 'bills',
    recordId: id,
    operation: 'delete',
    data: {},
    firestorePath: `users/${userId}/bills/${id}`,
    userId
  });
};
