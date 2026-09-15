import { getDatabase } from './db';
import { assertAllowedUpdateFields } from './updateFields';
import { writeWithSync } from './syncHelpers';
import {
  normalizeCnic, normalizeEmail, normalizePhone, normalizeText,
} from '../../utils/contactValidation';

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  /** v34. Durable copy under FileSystem.documentDirectory — never the picker's cache URI. */
  photo_local_path?: string | null;
  /** v34. Stays null until Firebase Storage upload is wired (sync deferred). */
  photo_remote_url?: string | null;
  email?: string | null;
  /** v34. National ID, 00000-0000000-0. Local only: never logged, never synced. */
  cnic?: string | null;
  address?: string | null;
  city?: string | null;
  created_at: string;
  updated_at?: string | null;
  synced?: number;
  is_deleted?: number;
}

export type CustomerInput = Partial<Pick<Customer,
  'name' | 'phone' | 'notes' | 'photo_local_path' | 'photo_remote_url' | 'email' | 'cnic' | 'address' | 'city'>>;

const EDITABLE_FIELDS = ['name', 'phone', 'notes', 'photo_local_path', 'photo_remote_url', 'email', 'cnic', 'address', 'city'] as const;

/**
 * Least access for national-ID data: the owner and the staff who runs a branch may
 * see a customer's CNIC; a sub-staff recording a sale may not. Enforced where the
 * value is READ (every customer query below redacts it) and mirrored on writes (a
 * sub-staff can neither set nor wipe it), not merely hidden in the UI.
 * Uses account_level (v32), the explicit level — never parentId depth.
 */
export const canViewCnic = async (userId: string): Promise<boolean> => {
  const db = await getDatabase();
  const viewer = await db.getFirstAsync<{ role: string; account_level: string | null }>(
    'SELECT role, account_level FROM users WHERE id = ? AND is_deleted = 0', [userId]
  );
  if (!viewer) return false;
  return viewer.role === 'admin' || viewer.account_level === 'admin' || viewer.account_level === 'staff';
};

const redactCnic = async <T extends { cnic?: string | null } | null>(userId: string, rows: T[]): Promise<T[]> => {
  if (rows.every(r => !r || r.cnic == null)) return rows;
  if (await canViewCnic(userId)) return rows;
  return rows.map(r => (r ? { ...r, cnic: null } : r));
};

/** The image to show for a customer: remote if we have it, else the local copy, else nothing (caller draws the initial). */
export const customerPhotoUri = (c: Pick<Customer, 'photo_local_path' | 'photo_remote_url'> | null | undefined): string | null =>
  c?.photo_remote_url || c?.photo_local_path || null;

/**
 * One validation for every add/edit path. Only name is required; every other
 * field is optional but, once entered, must be well-formed. Returns the
 * normalised values to persist. Throws a message ready for an Alert.
 */
export const normalizeCustomerInput = (input: CustomerInput, { requireName }: { requireName: boolean }): CustomerInput => {
  const out: CustomerInput = {};
  if (input.name !== undefined || requireName) {
    const name = normalizeText(input.name);
    if (!name) throw new Error('Please enter customer name');
    out.name = name;
  }
  if (input.phone !== undefined) out.phone = normalizePhone(input.phone);
  if (input.email !== undefined) out.email = normalizeEmail(input.email);
  if (input.cnic !== undefined) out.cnic = normalizeCnic(input.cnic);
  if (input.address !== undefined) out.address = normalizeText(input.address);
  if (input.city !== undefined) out.city = normalizeText(input.city);
  if (input.notes !== undefined) out.notes = normalizeText(input.notes);
  if (input.photo_local_path !== undefined) out.photo_local_path = normalizeText(input.photo_local_path);
  if (input.photo_remote_url !== undefined) out.photo_remote_url = normalizeText(input.photo_remote_url);
  return out;
};

export const addCustomer = async (
  customer: CustomerInput & { user_id: string }
): Promise<Customer> => {
  const { user_id, ...fields } = customer;
  const clean = normalizeCustomerInput(fields, { requireName: true });
  if (clean.cnic != null && !(await canViewCnic(user_id))) throw new Error('Only the owner or branch staff can record a CNIC.');
  const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const data = {
    ...clean,
    user_id,
    id,
    is_deleted: 0,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };

  await writeWithSync({
    tableName: 'customers',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${user_id}/customers/${id}`,
    userId: user_id
  });

  return { ...data, name: clean.name as string, synced: 0 } as Customer;
};

export const updateCustomer = async (
  id: string,
  userId: string,
  updates: CustomerInput
): Promise<void> => {
  assertAllowedUpdateFields(updates, [...EDITABLE_FIELDS]);
  const clean = normalizeCustomerInput(updates, { requireName: false });
  if ('cnic' in clean && !(await canViewCnic(userId))) {
    // A sub-staff never sees the CNIC, so their edit form cannot carry it: setting
    // one is refused, and a blank must not silently wipe the stored value.
    if (clean.cnic != null) throw new Error('Only the owner or branch staff can record a CNIC.');
    delete clean.cnic;
  }
  if (Object.keys(clean).length === 0) return;
  const now = new Date().toISOString();

  await writeWithSync({
    tableName: 'customers',
    recordId: id,
    operation: 'update',
    data: { ...clean, updated_at: now },
    firestorePath: `users/${userId}/customers/${id}`,
    userId,
  });
};

export const getCustomerById = async (userId: string, id: string): Promise<Customer | null> => {
  const db = await getDatabase();
  const [result] = await redactCnic(userId, [await db.getFirstAsync<Customer>(
    `SELECT * FROM customers
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
       AND id = ?
       AND is_deleted = 0
     LIMIT 1`,
    [userId, userId, userId, id]
  )]);
  return result ?? null;
};

export const getCustomerByName = async (userId: string, name: string): Promise<Customer | null> => {
  const db = await getDatabase();
  const [result] = await redactCnic(userId, [await db.getFirstAsync<Customer>(
    `SELECT * FROM customers
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
       AND name = ?
       AND is_deleted = 0
     LIMIT 1`,
    [userId, userId, userId, name]
  )]);
  return result ?? null;
};

export type CustomerCursor = { name: string; id: string };

/**
 * Customers matching `query` (name or phone, literal substring, case-insensitive),
 * alphabetically, `limit` at a time. `after` is the last row of the previous page,
 * so typing narrows via SQL and a long list never has to be loaded whole. The
 * count covers the WHOLE match, not the page. CNIC is redacted exactly as in every
 * other read. Used by the Customer Book and by the Add Transaction / Create Bill
 * pickers — the hottest path in the app — so the initial load is bounded too.
 */
export const searchCustomers = async (
  userId: string, query = '', limit = 50, after?: CustomerCursor | null
): Promise<{ rows: Customer[]; total: number; nextCursor: CustomerCursor | null }> => {
  const db = await getDatabase();
  let where = `(user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
       AND is_deleted = 0`;
  const params: any[] = [userId, userId, userId];
  const needle = query.trim().toLowerCase();
  if (needle) {
    // Literal substring on name or phone — %, _ and quotes are text, never wildcards.
    where += " AND (instr(lower(COALESCE(name, '')), ?) > 0 OR instr(COALESCE(phone, ''), ?) > 0)";
    params.push(needle, needle);
  }
  const rowsWhere = after ? `${where} AND (lower(name) > ? OR (lower(name) = ? AND id > ?))` : where;
  const rowsParams = after ? [...params, after.name.toLowerCase(), after.name.toLowerCase(), after.id] : params;
  const rows = await redactCnic(userId, await db.getAllAsync<Customer>(
    `SELECT * FROM customers WHERE ${rowsWhere} ORDER BY lower(name) ASC, id ASC LIMIT ?`, [...rowsParams, limit]
  ));
  const count = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM customers WHERE ${where}`, params);
  const last = rows[rows.length - 1];
  return { rows, total: count?.n ?? 0, nextCursor: limit > 0 && rows.length === limit && last ? { name: last.name, id: last.id } : null };
};

export const getCustomers = async (userId: string): Promise<Customer[]> => {
  const db = await getDatabase();
  return redactCnic(userId, await db.getAllAsync<Customer>(
    `SELECT * FROM customers
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
       AND is_deleted = 0
     ORDER BY created_at DESC`,
    [userId, userId, userId]
  ));
};

export const autoSeedCustomersFromTransactions = async (userId: string): Promise<void> => {
  const db = await getDatabase();

  // Get all unique partyNames from transactions that belong to this user's realm
  const txParties = await db.getAllAsync<{ partyName: string }>(
    `SELECT DISTINCT partyName FROM transactions
     WHERE (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
      AND isDeleted = 0
      AND partyName IS NOT NULL
      AND partyName != ''`,
    [userId, userId, userId]
  );

  // Get existing customers
  const existingCusts = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM customers
     WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
      AND is_deleted = 0`,
    [userId, userId, userId]
  );

  const existingNames = new Set(existingCusts.map(c => c.name.toLowerCase().trim()));
  const missingNames = txParties
    .map(p => p.partyName.trim())
    .filter(name => !existingNames.has(name.toLowerCase()));

  // Create missing customers
  for (const name of missingNames) {
    if (!name) continue;
    await addCustomer({
      user_id: userId,
      name,
    });
  }
};
