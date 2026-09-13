import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery } from './types';

export type ProfitLossSummary = {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
};

export const getProfitLossSummary = async (
  userId: string,
  filters: DateRangeFilter
): Promise<ProfitLossSummary> => {
  const db = await getDatabase();

  // 1. Total Revenue from Bills
  const billQuery = buildReportQuery(userId, 'bill_date', filters);
  const revenueRes = await db.getFirstAsync<{ totalRevenue: number }>(
    `SELECT SUM(total) as totalRevenue FROM bills WHERE ${billQuery.whereClause}`,
    billQuery.params
  );
  const totalRevenue = revenueRes?.totalRevenue || 0;

  // 2. Total COGS from Bill Items mapped to Stock Items
  const cogsQuery = buildReportQuery(userId, 'b.bill_date', filters);
  const cogsRes = await db.getFirstAsync<{ totalCOGS: number }>(
    `SELECT SUM(bi.quantity * s.purchase_price) as totalCOGS
     FROM bill_items bi
     JOIN bills b ON b.id = bi.bill_id
     JOIN stock_items s ON s.id = bi.item_id
     WHERE ${cogsQuery.whereClause}`,
     cogsQuery.params
  );
  const totalCOGS = cogsRes?.totalCOGS || 0;

  // 3. Total Expenses
  const expQuery = buildReportQuery(userId, 'expense_date', filters);
  const expRes = await db.getFirstAsync<{ totalExpenses: number }>(
    `SELECT SUM(amount) as totalExpenses FROM expenses WHERE ${expQuery.whereClause}`,
    expQuery.params
  );
  const totalExpenses = expRes?.totalExpenses || 0;

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMarginPct,
  };
};

export const getProfitTrend = async (
  userId: string,
  filters: DateRangeFilter
): Promise<{ date: string; profit: number }[]> => {
  const db = await getDatabase();
  const dateGroupFormat = "date(bill_date)";
  
  // This is a simplified profit trend (Revenue - COGS per day)
  // Integrating expenses per day in a single SQL query is complex in SQLite without full outer joins
  // We'll calculate Gross Profit trend here
  const query = buildReportQuery(userId, 'b.bill_date', filters);
  const sql = `
    SELECT 
      ${dateGroupFormat} as date,
      SUM(b.total) - COALESCE(SUM(bi.quantity * s.purchase_price), 0) as profit
    FROM bills b
    LEFT JOIN bill_items bi ON b.id = bi.bill_id
    LEFT JOIN stock_items s ON s.id = bi.item_id
    WHERE ${query.whereClause}
    GROUP BY ${dateGroupFormat}
    ORDER BY ${dateGroupFormat} ASC
  `;

  return db.getAllAsync<{ date: string; profit: number }>(sql, query.params);
};
