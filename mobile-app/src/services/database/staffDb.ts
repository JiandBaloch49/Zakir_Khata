import { getDatabase } from './db';
import { StaffRecord } from '../../types/staff.types';
import { writeWithSync } from './syncHelpers';

export const addStaffRecord = async (
  staff: Omit<StaffRecord, 'id' | 'created_at' | 'synced' | 'is_deleted'>
): Promise<StaffRecord> => {
  const id = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const documents = staff.document_urls ? JSON.stringify(staff.document_urls) : null;

  const data = {
    ...staff,
    id,
    document_urls: documents,
    is_deleted: 0,
    deleted_at: null
  };

  await writeWithSync({
    tableName: 'staff_records',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${staff.user_id}/staff_records/${id}`,
    userId: staff.user_id
  });

  return {
    ...staff,
    id,
    document_urls: staff.document_urls,
    created_at: now,
    updated_at: now,
    synced: 0
  } as StaffRecord;
};

export const getStaffRecords = async (userId: string): Promise<StaffRecord[]> => {
  const db = await getDatabase();


  const records = await db.getAllAsync<any>(
    `SELECT * FROM staff_records 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
     ORDER BY created_at DESC`,
    [userId, userId, userId]
  );

  return records.map(r => ({
    ...r,
    document_urls: r.document_urls ? JSON.parse(r.document_urls) : undefined
  }));
};

export const getStaffStats = async (userId: string): Promise<{ total: number; active: number; inactive: number }> => {
  const db = await getDatabase();


  const results = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM staff_records 
      WHERE (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
       AND is_deleted = 0
     GROUP BY status`,
    [userId, userId, userId]
  );

  let active = 0;
  let inactive = 0;
  
  for (const r of results) {
    if (r.status === 'active') active = r.count;
    if (r.status === 'inactive') inactive = r.count;
  }

  return {
    total: active + inactive,
    active,
    inactive
  };
};

export const updateStaffSalary = async (
  staffId: string,
  userId: string,
  monthlySalary: number
): Promise<void> => {
  const now = new Date().toISOString();
  await writeWithSync({
    tableName: 'staff_records',
    recordId: staffId,
    operation: 'update',
    data: {
      monthly_salary: monthlySalary,
      updated_at: now
    },
    firestorePath: `users/${userId}/staff_records/${staffId}`,
    userId
  });
};
