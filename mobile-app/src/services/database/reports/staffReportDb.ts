import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery } from './types';

export type StaffPerformance = {
  staffId: string;
  staffName: string;
  salesGenerated: number;
  billsCreated: number;
  expensesAdded: number;
  activitiesCount: number;
};

export const getStaffPerformance = async (
  userId: string,
  filters: DateRangeFilter
): Promise<StaffPerformance[]> => {
  const db = await getDatabase();
  
  // We'll join activities to see who created what
  // For actual sales generated, we'd need a 'created_by' field on bills, 
  // but since activities table logs 'Created Bill' with user_id matching the staff member,
  // we can estimate staff performance via activities table.
  
  let dateFilter = '';
  const params: any[] = [userId, userId, userId];
  
  if (filters.startDate) {
    dateFilter += ` AND date(a.timestamp) >= date(?)`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    dateFilter += ` AND date(a.timestamp) <= date(?)`;
    params.push(filters.endDate);
  }

  const query = `
    SELECT 
      u.id as staffId,
      u.name as staffName,
      SUM(CASE WHEN a.action LIKE '%Bill%' THEN 1 ELSE 0 END) as billsCreated,
      SUM(CASE WHEN a.action LIKE '%Expense%' THEN 1 ELSE 0 END) as expensesAdded,
      COUNT(a.id) as activitiesCount
    FROM users u
    LEFT JOIN activities a ON a.user_id = u.id ${dateFilter}
    WHERE u.parentId = ? OR u.parentId IN (SELECT id FROM users WHERE parentId = ?)
    GROUP BY u.id, u.name
    ORDER BY activitiesCount DESC
  `;

  return db.getAllAsync<StaffPerformance>(query, [userId, userId, ...params.slice(3)]);
};

export type StaffAttendanceSummary = {
  staffId: string;
  staffName: string;
  daysPresent: number;
  daysAbsent: number;
  daysHalfDay: number;
};

export const getStaffAttendanceSummary = async (
  userId: string,
  filters: DateRangeFilter
): Promise<StaffAttendanceSummary[]> => {
  const db = await getDatabase();
  
  let dateFilter = '';
  const params: any[] = [userId, userId, userId];
  
  if (filters.startDate) {
    dateFilter += ` AND date(a.date) >= date(?)`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    dateFilter += ` AND date(a.date) <= date(?)`;
    params.push(filters.endDate);
  }

  const query = `
    SELECT 
      s.id as staffId,
      s.name_en as staffName,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as daysPresent,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as daysAbsent,
      SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) as daysHalfDay
    FROM staff_records s
    LEFT JOIN staff_attendance a ON s.id = a.staff_id ${dateFilter}
    WHERE (s.user_id = ? OR s.user_id IN (SELECT id FROM users WHERE parentId = ?) OR s.user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))
      AND s.is_deleted = 0
    GROUP BY s.id, s.name_en
  `;

  return db.getAllAsync<StaffAttendanceSummary>(query, [userId, userId, ...params.slice(3)]);
};
