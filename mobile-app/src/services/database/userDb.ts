import * as Crypto from 'expo-crypto';
import { getDatabase } from './db';
import { AccountLevel, assertConsistentLevel } from './accountLevel';
import { User } from '../../types';

// Internal DB record — includes the hash, never returned to callers outside this file.
interface UserRecord {
  id: string;
  name: string;
  name_ur?: string | null;
  phone: string;
  passwordHash: string;
  role: 'admin' | 'staff';
  businessName?: string | null;
  businessType?: string | null;
  area?: string | null;
  pictureUrl?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const SCHEME_PREFIX = 'sha256$';
const HASH_ITERATIONS = 10000; // work factor, similar purpose to bcrypt rounds

function generateSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Like(password: string, salt: string): Promise<string> {
  let hash = password + salt;
  for (let i = 0; i < HASH_ITERATIONS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await pbkdf2Like(password, salt);
  return `${SCHEME_PREFIX}${salt}$${hash}`;
}

async function verifyStoredHash(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(SCHEME_PREFIX)) return false;
  const rest = stored.slice(SCHEME_PREFIX.length);
  const [salt, originalHash] = rest.split('$');
  if (!salt || !originalHash) return false;
  const candidateHash = await pbkdf2Like(password, salt);
  return candidateHash === originalHash;
}

function toPublicUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    name_ur: record.name_ur ?? undefined,
    phone: record.phone,
    role: record.role,
    businessName: record.businessName ?? undefined,
    businessType: record.businessType ?? undefined,
    area: record.area ?? undefined,
    pictureUrl: record.pictureUrl ?? undefined,
    parentId: record.parentId ?? undefined,
    createdAt: record.createdAt,
  };
}

/**
 * `accountLevel` is explicit rather than inferred, so seeding and account creation
 * both state the level they mean. An inconsistent role / level / parent combination
 * throws — it is never silently corrected.
 */
export const createUser = async (
  name: string,
  phone: string,
  password: string,
  role: 'admin' | 'staff',
  accountLevel: AccountLevel,
  businessName?: string,
  parentId?: string,
  name_ur?: string,
  businessType?: string,
  area?: string,
  pictureUrl?: string
): Promise<User> => {
  const db = await getDatabase();

  const parent = parentId
    ? await db.getFirstAsync<{ account_level: AccountLevel | null }>(
        'SELECT account_level FROM users WHERE id = ?', [parentId]
      )
    : null;
  if (parentId && !parent) throw new Error('Parent account not found.');
  assertConsistentLevel({ role, parentId, parentLevel: parent?.account_level ?? null, level: accountLevel });

  const passwordHash = await hashPassword(password);
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO users (id, name, name_ur, phone, passwordHash, role, account_level, businessName, businessType, area, pictureUrl, parentId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, name_ur ?? null, phone, passwordHash, role, accountLevel,
     businessName ?? null, businessType ?? null, area ?? null,
     pictureUrl ?? null, parentId ?? null, now, now]
  );

  return { id, name, name_ur, phone, role, businessName, businessType, area, pictureUrl, parentId, createdAt: now };
};

/**
 * Normalises a phone to the local 0XXXXXXXXXX format.
 * Strips country code (+92, 0092) if present.
 */
function normalisePhone(raw: string): string {
  let p = raw.replace(/\s+/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  else if (p.startsWith('+')) p = p.slice(1);
  
  // Remove 92 country code
  if (p.startsWith('92')) {
    p = p.slice(2);
  }
  
  // Ensure it starts with 0
  if (!p.startsWith('0')) {
    p = '0' + p;
  }
  
  return p;
}

// Used by login: verifies password and returns the public user, or null on failure.
export const verifyUserLogin = async (
  phone: string,
  password: string
): Promise<User | null> => {
  const db = await getDatabase();
  const normalised = normalisePhone(phone);
  console.log('[DB] verifyUserLogin — raw phone:', phone, '| normalised:', normalised);

  // is_deleted = 1 means the account was removed by an owner/parent staff. The row
  // is kept so their historical entries stay visible, but they cannot log in.
  const record = await db.getFirstAsync<UserRecord>(
    'SELECT * FROM users WHERE phone = ? AND is_deleted = 0 LIMIT 1',
    [normalised]
  );
  if (!record) {
    console.warn('[DB] verifyUserLogin — no user found for phone:', normalised);
    return null;
  }
  console.log('[DB] verifyUserLogin — found user:', record.id, record.role);
  const valid = await verifyStoredHash(password, record.passwordHash);
  if (!valid) {
    console.warn('[DB] verifyUserLogin — password mismatch for:', record.id);
    return null;
  }
  return toPublicUser(record);
};

export const changePassword = async (userId: string, newPassword: string): Promise<void> => {
  const db = await getDatabase();
  const passwordHash = await hashPassword(newPassword);
  await db.runAsync('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', [
    passwordHash,
    new Date().toISOString(),
    userId
  ]);
};

export const getUserByPhone = async (phone: string): Promise<User | null> => {
  const db = await getDatabase();
  const normalised = normalisePhone(phone);
  const record = await db.getFirstAsync<UserRecord>(
    'SELECT * FROM users WHERE phone = ? LIMIT 1',
    [normalised]
  );
  return record ? toPublicUser(record) : null;
};

export const getUserById = async (id: string): Promise<User | null> => {
  const db = await getDatabase();
  const record = await db.getFirstAsync<UserRecord>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return record ? toPublicUser(record) : null;
};

/**
 * Users inside the caller's own tree: their direct staff and those staff's
 * sub-staff. Excludes the caller and anyone removed.
 *
 * Replaces the old getAllUsers(), which had no filter at all and therefore
 * exposed every other business owner's staff on the admin dashboard.
 */
/** A scoped user plus their explicit level and parent's name, for display only. */
export interface ScopedUser extends User {
  account_level?: AccountLevel | null;
  parentName?: string | null;
}

export const getUsersInScope = async (viewerId: string): Promise<ScopedUser[]> => {
  const db = await getDatabase();
  const records = await db.getAllAsync<UserRecord & { account_level: AccountLevel | null; parentName: string | null }>(
    `SELECT u.id, u.name, u.name_ur, u.phone, u.role, u.businessName, u.businessType,
            u.area, u.pictureUrl, u.parentId, u.createdAt, u.updatedAt,
            u.account_level AS account_level, p.name AS parentName
       FROM users u
       LEFT JOIN users p ON p.id = u.parentId
      WHERE u.is_deleted = 0
        AND u.id != ?
        AND (u.parentId = ? OR u.parentId IN (SELECT id FROM users WHERE parentId = ?))
      ORDER BY u.createdAt DESC`,
    [viewerId, viewerId, viewerId]
  );
  return records.map(r => ({ ...toPublicUser(r), account_level: r.account_level, parentName: r.parentName }));
};

export const updateUser = async (
  id: string,
  updates: Partial<Pick<User, 'name' | 'name_ur' | 'phone' | 'businessName' | 'businessType' | 'area' | 'pictureUrl'>>
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name)                   { fields.push('name = ?');         values.push(updates.name); }
  if (updates.name_ur !== undefined)  { fields.push('name_ur = ?');      values.push(updates.name_ur ?? null); }
  if (updates.phone)                  { fields.push('phone = ?');        values.push(updates.phone); }
  if (updates.businessName !== undefined) { fields.push('businessName = ?'); values.push(updates.businessName ?? null); }
  if (updates.businessType !== undefined) { fields.push('businessType = ?'); values.push(updates.businessType ?? null); }
  if (updates.area !== undefined)     { fields.push('area = ?');         values.push(updates.area ?? null); }
  if (updates.pictureUrl !== undefined) { fields.push('pictureUrl = ?'); values.push(updates.pictureUrl ?? null); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
};

/**
 * Removes a person's ACCESS without destroying anything.
 *
 * This replaces a hard `DELETE FROM users`, which was the only place in the app
 * that could lose financial records: entry visibility is derived from live
 * parentId chains in `users` (see queryHelpers.userScope), so deleting the row
 * made every entry that person had ever recorded unreachable — to the owner too.
 *
 * Keeping the row is exactly what preserves that visibility. Nothing cascades.
 */
export const deactivateUser = async (id: string): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE users SET is_deleted = 1, deleted_at = ?, updatedAt = ? WHERE id = ?',
    [now, now, id]
  );
};

export const getSubStaffByParentId = async (parentId: string): Promise<User[]> => {
  const db = await getDatabase();
  const records = await db.getAllAsync<UserRecord>(
    'SELECT * FROM users WHERE parentId = ? AND role = "staff" AND is_deleted = 0 ORDER BY name ASC',
    [parentId]
  );
  return records.map(toPublicUser);
};

/** A sub-staff row for the management screen, with its parent staff's name. */
export interface SubStaffRow extends User {
  parentName?: string | null;
}

/**
 * Sub-staff the viewer is allowed to manage, split into active and removed.
 *  - staff  → only their own sub-staff (parentId = viewer)
 *  - admin  → every staff's sub-staff in their tree (grandchildren), flat,
 *             each row carrying the parent staff's name
 */
export const getSubStaffFor = async (
  viewerId: string,
  viewerRole: 'admin' | 'staff'
): Promise<{ active: SubStaffRow[]; removed: SubStaffRow[] }> => {
  const db = await getDatabase();

  const scope =
    viewerRole === 'admin'
      ? 'u.parentId IN (SELECT id FROM users WHERE parentId = ?)'
      : 'u.parentId = ?';

  const rows = await db.getAllAsync<UserRecord & { parentName: string | null; is_deleted: number }>(
    `SELECT u.id, u.name, u.name_ur, u.phone, u.role, u.businessName, u.businessType,
            u.area, u.pictureUrl, u.parentId, u.createdAt, u.updatedAt,
            u.is_deleted AS is_deleted, p.name AS parentName
       FROM users u
       LEFT JOIN users p ON p.id = u.parentId
      WHERE ${scope} AND u.role = 'staff'
      ORDER BY u.name ASC`,
    [viewerId]
  );

  const active: SubStaffRow[] = [];
  const removed: SubStaffRow[] = [];
  for (const r of rows) {
    const row: SubStaffRow = { ...toPublicUser(r), parentName: r.parentName };
    if (r.is_deleted === 1) removed.push(row);
    else active.push(row);
  }
  return { active, removed };
};