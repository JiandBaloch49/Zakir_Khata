import { getDatabase } from '../db';
import { DateRangeFilter, buildReportQuery } from './types';

export type CashFlowSummary = {
  openingCash: number;
  cashIn: number;
  cashOut: number;
  closingCash: number;
  netCashFlow: number;
};

export const getCashFlowSummary = async (
  userId: string,
  filters: DateRangeFilter
): Promise<CashFlowSummary> => {
  const db = await getDatabase();
  const { whereClause, params } = buildReportQuery(userId, 'date', filters);
  const whereClauseWithoutDates = buildReportQuery(userId, 'date', {}).whereClause;

  // 1. Opening Cash (All cash up to the startDate)
  let openingCash = 0;
  if (filters.startDate) {
    const startQuery = `
      SELECT 
        SUM(CASE WHEN direction = 'in' THEN amount_paisa ELSE 0 END) -
        SUM(CASE WHEN direction = 'out' THEN amount_paisa ELSE 0 END) as balance
      FROM cashbook
      WHERE ${whereClauseWithoutDates} AND date(date) < date(?)
    `;
    const startRes = await db.getFirstAsync<{ balance: number }>(startQuery, [params[0], params[1], params[2], filters.startDate]);
    openingCash = startRes?.balance || 0;
  } else {
    // If no start date, opening cash is 0
    openingCash = 0;
  }

  // 2. Cash In / Out during period
  const flowQuery = `
    SELECT 
      SUM(CASE WHEN direction = 'in' THEN amount_paisa ELSE 0 END) as cashIn,
      SUM(CASE WHEN direction = 'out' THEN amount_paisa ELSE 0 END) as cashOut
    FROM cashbook
    WHERE ${whereClause}
  `;
  const flowRes = await db.getFirstAsync<{ cashIn: number; cashOut: number }>(flowQuery, params);
  
  const cashIn = flowRes?.cashIn || 0;
  const cashOut = flowRes?.cashOut || 0;
  const netCashFlow = cashIn - cashOut;
  const closingCash = openingCash + netCashFlow;

  return {
    openingCash,
    cashIn,
    cashOut,
    netCashFlow,
    closingCash
  };
};
