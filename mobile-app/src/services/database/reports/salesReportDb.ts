import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery } from './types';

export type SalesSummary = {
  totalSales: number;
  totalBills: number;
  averageBillValue: number;
  salesGrowthPct: number;
};

export type SalesTrendData = {
  date: string;
  total: number;
  count: number;
};

export const getSalesReportSummary = async (
  userId: string,
  filters: DateRangeFilter
): Promise<SalesSummary> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'bill_date', filters);

  const query = `
    SELECT 
      SUM(total) as totalSales,
      COUNT(id) as totalBills,
      AVG(total) as averageBillValue
    FROM bills
    WHERE ${whereClause}
  `;

  const result = await db.getFirstAsync<{
    totalSales: number;
    totalBills: number;
    averageBillValue: number;
  }>(query, params);

  return {
    totalSales: result?.totalSales || 0,
    totalBills: result?.totalBills || 0,
    averageBillValue: result?.averageBillValue || 0,
    salesGrowthPct: 0, // Calculated dynamically based on previous period
  };
};

export const getSalesTrend = async (
  userId: string,
  filters: DateRangeFilter,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<SalesTrendData[]> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'bill_date', filters);

  let dateGroupFormat = "date(bill_date)";
  if (groupBy === 'month') {
    dateGroupFormat = "strftime('%Y-%m', bill_date)";
  } else if (groupBy === 'week') {
    dateGroupFormat = "strftime('%Y-%W', bill_date)";
  }

  const query = `
    SELECT 
      ${dateGroupFormat} as date,
      SUM(total) as total,
      COUNT(id) as count
    FROM bills
    WHERE ${whereClause}
    GROUP BY ${dateGroupFormat}
    ORDER BY ${dateGroupFormat} ASC
  `;

  return db.getAllAsync<SalesTrendData>(query, params);
};
