import { getDatabase } from './db';
import { ActivityLog } from '../../types/activity.types';
import { writeWithSync } from './syncHelpers';

export const logActivityRecord = async (
  activity: Omit<ActivityLog, 'id' | 'timestamp'>
): Promise<void> => {
  const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const timestamp = new Date().toISOString();

  // Ensure visible_to is always a valid JSON array
  const visibleTo = activity.visible_to && activity.visible_to.length > 0 
    ? JSON.stringify(activity.visible_to) 
    : JSON.stringify([activity.user_id]);

  const data = {
    ...activity,
    id,
    visible_to: visibleTo,
    timestamp,
    is_deleted: 0,
    deleted_at: null
  };

  await writeWithSync({
    tableName: 'activities',
    recordId: id,
    operation: 'create',
    data,
    firestorePath: `users/${activity.user_id}/activities/${id}`,
    userId: activity.user_id
  });
};

export const getActivities = async (
  adminId: string,
  filters?: { staffId?: string; entityType?: string; startDate?: string; endDate?: string }
): Promise<ActivityLog[]> => {
  const db = await getDatabase();

  let query = `
    SELECT * FROM activities 
    WHERE json_extract(visible_to, '$') LIKE '%"' || ? || '"%' 
       OR user_id = ?
  `;
  const params: any[] = [adminId, adminId];

  if (filters?.staffId) {
    query += ' AND user_id = ?';
    params.push(filters.staffId);
  }
  
  if (filters?.entityType) {
    query += ' AND entity_type = ?';
    params.push(filters.entityType);
  }

  if (filters?.startDate && filters?.endDate) {
    query += ' AND date(timestamp) BETWEEN date(?) AND date(?)';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY timestamp DESC LIMIT 100';

  const rows = await db.getAllAsync<any>(query, params);
  
  return rows.map(r => ({
    ...r,
    visible_to: JSON.parse(r.visible_to)
  }));
};
