import { getDatabase } from './db';
import { ActivityLog } from '../../types/activity.types';
import { writeWithSync } from './syncHelpers';
import { keysetClause, keysetParams, nextCursorOf, PageCursor, PAGE_SIZE } from './pagination';
import { parseDateValue, toDateValue } from '../../utils/dates';

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

export type ActivityFilters = { staffId?: string; entityType?: string; startDate?: string; endDate?: string };

const ACTIVITY_KEYS = { date: 'timestamp', id: 'id' } as const;

/**
 * Activity visible to an admin: rows that name them in visible_to OR that they
 * wrote themselves — that whole visibility test is ONE parenthesised term, so the
 * filters below narrow it instead of leaking through an unparenthesised OR (the old
 * `A OR B AND C` bug). Deleted rows are excluded. Either date bound may be given on
 * its own. `after` pages the rows (keyset on timestamp, id); `limit` defaults to a
 * page, -1 for everything.
 */
export const getActivities = async (
  adminId: string,
  filters?: ActivityFilters,
  limit: number = PAGE_SIZE,
  after?: PageCursor | null
): Promise<{ rows: ActivityLog[]; nextCursor: PageCursor | null }> => {
  const db = await getDatabase();
  let where = `(json_extract(visible_to, '$') LIKE '%"' || ? || '"%' OR user_id = ?) AND COALESCE(is_deleted, 0) = 0`;
  const params: any[] = [adminId, adminId];
  if (filters?.staffId) { where += ' AND user_id = ?'; params.push(filters.staffId); }
  if (filters?.entityType) { where += ' AND entity_type = ?'; params.push(filters.entityType); }
  for (const bound of [filters?.startDate, filters?.endDate]) {
    if (bound !== undefined && !parseDateValue(bound)) throw new Error('Invalid date range.');
  }
  if (filters?.startDate || filters?.endDate) {
    where += ' AND date(timestamp) BETWEEN date(?) AND date(?)';
    params.push(toDateValue(filters?.startDate) || '0001-01-01', toDateValue(filters?.endDate) || '9999-12-31');
  }
  const rowsWhere = after ? `${where} AND ${keysetClause(ACTIVITY_KEYS)}` : where;
  const rowsParams = after ? [...params, ...keysetParams(after, ACTIVITY_KEYS)] : params;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM activities WHERE ${rowsWhere} ORDER BY timestamp DESC, id DESC LIMIT ?`, [...rowsParams, limit]
  );
  return {
    rows: rows.map(r => ({ ...r, visible_to: JSON.parse(r.visible_to) })),
    nextCursor: nextCursorOf(rows, limit, ACTIVITY_KEYS),
  };
};
