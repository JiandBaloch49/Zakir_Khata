import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery, buildTransactionReportQuery } from './types';

export type CustomerPerformance = {
  customerId: string;
  customerName: string;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  lastActive: string;
};

export const getCustomerPerformance = async (
  userId: string,
  filters: DateRangeFilter,
  orderBy: 'totalPurchases' | 'totalDue' = 'totalPurchases',
  limit: number = 10
): Promise<CustomerPerformance[]> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'bill_date', filters);

  const query = `
    SELECT 
      customer_id as customerId,
      party_name as customerName,
      SUM(total) as totalPurchases,
      SUM(paid) as totalPaid,
      SUM(due) as totalDue,
      MAX(bill_date) as lastActive
    FROM bills
    WHERE ${whereClause}
    GROUP BY customer_id, party_name
    ORDER BY ${orderBy} DESC
    LIMIT ${limit}
  `;

  return db.getAllAsync<CustomerPerformance>(query, params);
};

export type KhataSummary = {
  partyName: string;
  totalLena: number;
  totalDena: number;
  netBalance: number;
};

export const getKhataSummary = async (
  userId: string,
  filters: DateRangeFilter,
  typeFilter: 'lena' | 'dena' | 'all' = 'all',
  limit: number = 10
): Promise<KhataSummary[]> => {
  const db = await getDatabase();
  const { whereClause, params } = buildTransactionReportQuery(userId, 'date', filters);

  const query = `
    SELECT 
      partyName,
      SUM(CASE WHEN type = 'lena' THEN amount_paisa ELSE 0 END) as totalLena,
      SUM(CASE WHEN type = 'dena' THEN amount_paisa ELSE 0 END) as totalDena
    FROM transactions
    WHERE ${whereClause}
    GROUP BY partyName
    ${typeFilter === 'lena' ? 'HAVING totalLena > totalDena' : typeFilter === 'dena' ? 'HAVING totalDena > totalLena' : ''}
    ORDER BY ABS(SUM(CASE WHEN type = 'lena' THEN amount_paisa ELSE 0 END) - SUM(CASE WHEN type = 'dena' THEN amount_paisa ELSE 0 END)) DESC
    LIMIT ${limit}
  `;

  const results = await db.getAllAsync<{ partyName: string; totalLena: number; totalDena: number }>(query, params);

  return results.map(r => ({
    partyName: r.partyName,
    totalLena: r.totalLena,
    totalDena: r.totalDena,
    netBalance: r.totalLena - r.totalDena
  }));
};
