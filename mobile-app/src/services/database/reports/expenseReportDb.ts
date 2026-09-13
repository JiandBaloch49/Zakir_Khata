import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery } from './types';

export type ExpenseCategorySummary = {
  category: string;
  total: number;
  percentage: number;
};

export const getExpenseSummary = async (
  userId: string,
  filters: DateRangeFilter
): Promise<{ totalExpenses: number; byCategory: ExpenseCategorySummary[] }> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'expense_date', filters);

  const totalRes = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(amount) as total FROM expenses WHERE ${whereClause}`,
    params
  );
  const totalExpenses = totalRes?.total || 0;

  const categorySql = `
    SELECT 
      COALESCE(category, 'Uncategorized') as category,
      SUM(amount) as total
    FROM expenses
    WHERE ${whereClause}
    GROUP BY COALESCE(category, 'Uncategorized')
    ORDER BY total DESC
  `;
  const categories = await db.getAllAsync<{ category: string; total: number }>(categorySql, params);

  const byCategory = categories.map(c => ({
    category: c.category,
    total: c.total,
    percentage: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
  }));

  return { totalExpenses, byCategory };
};

export const getExpenseTrend = async (
  userId: string,
  filters: DateRangeFilter
): Promise<{ date: string; total: number }[]> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'expense_date', filters);

  const sql = `
    SELECT 
      strftime('%Y-%m', expense_date) as date,
      SUM(amount) as total
    FROM expenses
    WHERE ${whereClause}
    GROUP BY strftime('%Y-%m', expense_date)
    ORDER BY date ASC
  `;

  return db.getAllAsync<{ date: string; total: number }>(sql, params);
};
