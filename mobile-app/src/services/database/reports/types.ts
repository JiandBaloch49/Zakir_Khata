export type DateRangeFilter = {
  startDate?: string;
  endDate?: string;
};

// Common utility to generate SQL where clause for dates and user hierarchy
export const buildReportQuery = (
  userId: string,
  dateColumn: string,
  filters: DateRangeFilter
): { whereClause: string; params: any[] } => {
  let whereClause = `
    (user_id = ? OR user_id IN (SELECT id FROM users WHERE parentId = ?) OR user_id IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
    AND is_deleted = 0
  `;
  const params: any[] = [userId, userId, userId];

  if (filters.startDate) {
    whereClause += ` AND date(${dateColumn}) >= date(?)`;
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    whereClause += ` AND date(${dateColumn}) <= date(?)`;
    params.push(filters.endDate);
  }

  return { whereClause, params };
};

export const buildTransactionReportQuery = (
  userId: string,
  dateColumn: string,
  filters: DateRangeFilter
): { whereClause: string; params: any[] } => {
  let whereClause = `
    (userId = ? OR userId IN (SELECT id FROM users WHERE parentId = ?) OR userId IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?))) 
    AND isDeleted = 0
  `;
  const params: any[] = [userId, userId, userId];

  if (filters.startDate) {
    whereClause += ` AND date(${dateColumn}) >= date(?)`;
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    whereClause += ` AND date(${dateColumn}) <= date(?)`;
    params.push(filters.endDate);
  }

  return { whereClause, params };
};
