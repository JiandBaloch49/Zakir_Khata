import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './db';
import { withWriteTransaction } from './writeTransaction';
import { createUser, SubStaffRow } from './userDb';
import type { User } from '../../types';

type Manager = User & { is_deleted: number };
async function currentManager(db: SQLiteDatabase): Promise<Manager> {
  const { useAuthStore } = await import('../../store/authStore');
  const { user, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !user) throw new Error('Please log in to manage accounts.');
  const actor = await db.getFirstAsync<Manager>('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [user.id]);
  if (!actor) throw new Error('Your account no longer has access.');
  return actor;
}
async function canManage(db: SQLiteDatabase, actor: Manager): Promise<boolean> {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'staff' || !actor.parentId) return false;
  const parent = await db.getFirstAsync<{ role: string }>('SELECT role FROM users WHERE id = ?', [actor.parentId]);
  return parent?.role === 'admin';
}
export function accountPasswordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

/** Account creation used by the management screen; createUser remains the seed primitive. */
export async function createManagedAccount(input: {
  name: string; phone: string; password: string; accountType: 'staff' | 'substaff'; parentStaffId?: string;
}): Promise<User> {
  const problem = accountPasswordProblem(input.password);
  if (problem) throw new Error(problem);
  if (!input.name.trim() || !input.phone.trim()) throw new Error('Please enter a name and phone number.');
  if (input.accountType !== 'staff' && input.accountType !== 'substaff') throw new Error('Invalid account type.');
  return withWriteTransaction(async db => {
    const actor = await currentManager(db);
    if (!await canManage(db, actor)) throw new Error('Sub-staff cannot create accounts.');
    let parentId = actor.id;
    if (actor.role === 'admin' && input.accountType === 'substaff') {
      const parent = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM users WHERE id = ? AND role = 'staff' AND parentId = ? AND is_deleted = 0",
        [input.parentStaffId || '', actor.id]
      );
      if (!parent) throw new Error('Choose an active staff member from your own team.');
      parentId = parent.id;
    } else {
      if (actor.role !== 'admin' && input.accountType !== 'substaff') throw new Error('Staff can only create their own sub-staff.');
      if (input.parentStaffId && input.parentStaffId !== actor.id) throw new Error('You cannot create an account in another branch.');
    }
    // Both levels are role=staff; account_level records WHICH level, explicitly.
    // createUser rejects any role/level/parent combination that disagrees.
    // Never accept role or ownership from a spread payload.
    return createUser(
      input.name.trim(), input.phone.trim(), input.password,
      'staff', input.accountType,
      actor.businessName, parentId
    );
  });
}

export async function getManagedAccounts(): Promise<{
  isAdmin: boolean; canCreate: boolean; active: SubStaffRow[]; removed: SubStaffRow[]; parents: SubStaffRow[];
}> {
  const db = await getDatabase();
  const actor = await currentManager(db);
  const isAdmin = actor.role === 'admin';
  if (!await canManage(db, actor)) return { isAdmin, canCreate: false, active: [], removed: [], parents: [] };
  // People-list scope only; removed parents remain joined for historical attribution.
  const scope = isAdmin ? '(u.parentId = ? OR p.parentId = ?)' : 'u.parentId = ?';
  const rows = await db.getAllAsync<SubStaffRow & { is_deleted: number }>(
    `SELECT u.id, u.name, u.name_ur, u.phone, u.role, u.businessName, u.businessType,
            u.area, u.pictureUrl, u.parentId, u.createdAt, p.name AS parentName, u.is_deleted
       FROM users u LEFT JOIN users p ON p.id = u.parentId
      WHERE ${scope} AND u.role = 'staff' ORDER BY u.name ASC`,
    isAdmin ? [actor.id, actor.id] : [actor.id]
  );
  const active = rows.filter(row => !row.is_deleted);
  const removed = rows.filter(row => !!row.is_deleted);
  return { isAdmin, canCreate: true, active, removed, parents: isAdmin ? active.filter(row => row.parentId === actor.id) : [] };
}
