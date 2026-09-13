import * as Print from 'expo-print';
import { ReportOptions } from '../../types/download.types';
import {
  CASH_RECEIPT_TEMPLATE,
  EXPENSE_REPORT_TEMPLATE,
  STOCK_REPORT_TEMPLATE,
  BILL_REPORT_TEMPLATE,
  STAFF_REPORT_TEMPLATE,
} from './reportTemplates';
import { getDatabase } from '../../services/database/db';
import { generateCsvFile } from './csvGenerator';
import { formatCurrency, paisaToRupeesString } from '../../utils/calculations';
import { todayDate, formatDisplayDate } from '../../utils/dates';
import { getFilteredCashHistory } from '../../services/database/cashbookDb';
import { getFilteredExpenses } from '../../services/database/expenseDb';
import { getFilteredBills } from '../../services/database/billDb';
import { resolvePeriod, describePeriod } from './reportPeriod';

// MONEY: every amount column read here is integer paisa (v29 migration).
// PDF output goes through formatCurrency (human readable, "Rs. 1,234.56").
// CSV output goes through paisaToRupeesString ("1234.56") — formatCurrency's
// thousands separators would break CSV columns. Neither hand-divides.

/**
 * PERIOD: the caller picks the range (DownloadOptionsModal). Cash, expense and
 * bill reports call the SAME getFiltered* functions their screens call, with the
 * same {startDate, endDate}, so the rows AND the SQL-aggregated totals are the
 * figures the book shows for that range — not a parallel query that can drift.
 * Stock has no equivalent screen query (it is a per-item movement summary), so
 * it keeps its own SQL, bounded by the same resolved period. Staff is a roster
 * with no date dimension; it ignores the period and prints "As of today".
 */

/**
 * Same 3-level ownership filter the book screens use (billDb / stockDb /
 * expenseDb / staffDb / cashbookDb), so a report reconciles with what the owner
 * sees on screen. Always bind [userId, userId, userId].
 */
const hierarchyFilter = (col: string) =>
  `(${col} = ? OR ${col} IN (SELECT id FROM users WHERE parentId = ?) OR ${col} IN (SELECT id FROM users WHERE parentId IN (SELECT id FROM users WHERE parentId = ?)))`;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (html, [key, value]) => html.split(`{{${key}}}`).join(value),
    template
  );

const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const emptyRow = (colspan: number) =>
  `<tr><td class="empty" colspan="${colspan}">No records for this period</td></tr>`;

const fmtDate = (d: string) => new Date(d).toLocaleDateString();

export const generateReportFile = async (options: ReportOptions): Promise<string> => {
  const db = await getDatabase();

  // users has `name` and `businessName` (camelCase) — NOT name_en / business_name.
  const user = await db.getFirstAsync<{ name: string; businessName: string | null }>(
    'SELECT name, businessName FROM users WHERE id = ?',
    [options.userId]
  );

  const bName = user?.businessName || user?.name || 'My Business';
  // Validated once here; the book queries below re-validate the same way.
  const period = resolvePeriod({ startDate: options.startDate, endDate: options.endDate });
  const periodLabel = describePeriod(period);
  const uid = [options.userId, options.userId, options.userId];

  // ── CASH ────────────────────────────────────────────────────────────────────
  if (options.reportType === 'cash') {
    // Exactly what Cash History shows for this range: same rows, same aggregate.
    const { entries: records, cashSummary } = await getFilteredCashHistory(options.userId, period);

    if (options.format === 'csv') {
      return generateCsvFile(options, records, ['Date', 'Type', 'Description', 'Category', 'Amount'],
        r => [fmtDate(r.date), r.direction.toUpperCase(), `"${r.description || ''}"`,
              `"${r.category || ''}"`, paisaToRupeesString(r.amount_paisa)]);
    }

    let rows = '';
    records.forEach(r => {
      rows += `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.direction).toUpperCase()}</td>` +
              `<td>${esc(r.description)}</td><td>${esc(r.category)}</td>` +
              `<td class="num">${formatCurrency(r.amount_paisa)}</td></tr>`;
    });
    if (!records.length) rows = emptyRow(5);

    const html = fill(CASH_RECEIPT_TEMPLATE, {
      business_name: esc(bName), business_address: '',
      period: periodLabel, rows,
      totalIn: formatCurrency(cashSummary.cashIn), totalOut: formatCurrency(cashSummary.cashOut),
      netBalance: formatCurrency(cashSummary.cashBalance),
    });
    return (await Print.printToFileAsync({ html })).uri;
  }

  // ── EXPENSE ─────────────────────────────────────────────────────────────────
  if (options.reportType === 'expense') {
    // Exactly what the Expense book shows for this range: same rows, same aggregate.
    const { expenses: records, expenseSummary } = await getFilteredExpenses(options.userId, period);

    if (options.format === 'csv') {
      return generateCsvFile(options, records, ['Date', 'Description', 'Category', 'Amount'],
        r => [fmtDate(r.expense_date), `"${r.description || ''}"`, `"${r.category || ''}"`,
              paisaToRupeesString(r.amount)]);
    }

    let rows = '';
    records.forEach(r => {
      rows += `<tr><td>${fmtDate(r.expense_date)}</td><td>${esc(r.description)}</td>` +
              `<td>${esc(r.category)}</td><td class="num">${formatCurrency(r.amount)}</td></tr>`;
    });
    if (!records.length) rows = emptyRow(4);

    const html = fill(EXPENSE_REPORT_TEMPLATE, {
      business_name: esc(bName), period: periodLabel, rows,
      total: formatCurrency(expenseSummary.totalExpense),
    });
    return (await Print.printToFileAsync({ html })).uri;
  }

  // ── STOCK (movements aggregated per item over the period) ───────────────────
  if (options.reportType === 'stock') {
    const records = await db.getAllAsync<any>(
      `SELECT si.name_en AS name, si.location AS location,
              SUM(CASE WHEN sm.change > 0 THEN sm.change ELSE 0 END) AS qtyIn,
              SUM(CASE WHEN sm.change < 0 THEN -sm.change ELSE 0 END) AS qtyOut,
              SUM(sm.change) AS netQty,
              SUM(CASE WHEN sm.change > 0 THEN sm.change * COALESCE(sm.cost_per_unit, 0) ELSE 0 END) AS valueIn,
              SUM(CASE WHEN sm.change < 0 THEN -sm.change * COALESCE(sm.sale_price_unit, sm.cost_per_unit, 0) ELSE 0 END) AS valueOut
         FROM stock_movements sm
         JOIN stock_items si ON si.id = sm.item_id
        WHERE ${hierarchyFilter('si.user_id')} AND sm.is_deleted = 0 AND si.is_deleted = 0
          AND date(sm.date) BETWEEN date(?) AND date(?)
        GROUP BY sm.item_id
        ORDER BY si.name_en ASC`,
      [...uid, period.startDate || '0001-01-01', period.endDate || '9999-12-31']
    );

    if (options.format === 'csv') {
      return generateCsvFile(options, records, ['Item', 'Location', 'Stock IN', 'Stock OUT', 'Net Qty', 'IN Value', 'OUT Value'],
        r => [`"${r.name || ''}"`, `"${r.location || ''}"`, String(r.qtyIn ?? 0), String(r.qtyOut ?? 0),
              String(r.netQty ?? 0), paisaToRupeesString(r.valueIn ?? 0), paisaToRupeesString(r.valueOut ?? 0)]);
    }

    let rows = '', totalIn = 0, totalOut = 0;
    records.forEach(r => {
      totalIn += r.valueIn ?? 0;
      totalOut += r.valueOut ?? 0;
      rows += `<tr><td>${esc(r.name)}</td><td>${esc(r.location)}</td>` +
              `<td class="num">${r.qtyIn ?? 0}</td><td class="num">${r.qtyOut ?? 0}</td>` +
              `<td class="num">${r.netQty ?? 0}</td>` +
              `<td class="num">${formatCurrency(r.valueIn ?? 0)}</td>` +
              `<td class="num">${formatCurrency(r.valueOut ?? 0)}</td></tr>`;
    });
    if (!records.length) rows = emptyRow(7);

    const html = fill(STOCK_REPORT_TEMPLATE, {
      business_name: esc(bName), period: periodLabel, rows,
      totalInValue: formatCurrency(totalIn), totalOutValue: formatCurrency(totalOut),
    });
    return (await Print.printToFileAsync({ html })).uri;
  }

  // ── BILL ────────────────────────────────────────────────────────────────────
  if (options.reportType === 'bill') {
    // Exactly what the Bill Book's default (posted) tab shows for this range: same
    // rows, same SQL aggregate. Drafts and holds are NOT sales, so they never
    // inflate Total Billed on a document the owner may hand to an accountant. The
    // Status column stays — it documents what each printed row is.
    const { bills: records, billSummary } = await getFilteredBills(options.userId, { ...period, status: 'posted' });

    if (options.format === 'csv') {
      return generateCsvFile(options, records, ['Bill No', 'Date', 'Customer', 'Status', 'Total', 'Paid', 'Due'],
        r => [String(r.bill_no ?? ''), fmtDate(r.bill_date), `"${r.party_name || ''}"`,
              String(r.status || ''), paisaToRupeesString(r.total ?? 0),
              paisaToRupeesString(r.paid ?? 0), paisaToRupeesString(r.due ?? 0)]);
    }

    let rows = '';
    records.forEach(r => {
      rows += `<tr><td>#${esc(r.bill_no)}</td><td>${fmtDate(r.bill_date)}</td>` +
              `<td>${esc(r.party_name)}</td><td>${esc(r.status).toUpperCase()}</td>` +
              `<td class="num">${formatCurrency(r.total ?? 0)}</td>` +
              `<td class="num">${formatCurrency(r.paid ?? 0)}</td>` +
              `<td class="num">${formatCurrency(r.due ?? 0)}</td></tr>`;
    });
    if (!records.length) rows = emptyRow(7);

    const html = fill(BILL_REPORT_TEMPLATE, {
      business_name: esc(bName), period: periodLabel, rows,
      billCount: String(billSummary.billCount),
      totalBilled: formatCurrency(billSummary.totalBilled), totalPaid: formatCurrency(billSummary.totalPaid),
      totalDue: formatCurrency(billSummary.totalDue),
    });
    return (await Print.printToFileAsync({ html })).uri;
  }

  // ── STAFF (roster — "as of", not a period) ──────────────────────────────────
  // The period is deliberately ignored: a staff record has no date dimension, so
  // the modal hides the range control for this report and the document says so.
  if (options.reportType === 'staff') {
    const records = await db.getAllAsync<any>(
      `SELECT * FROM staff_records
        WHERE ${hierarchyFilter('user_id')} AND is_deleted = 0
        ORDER BY name_en ASC`,
      uid
    );

    if (options.format === 'csv') {
      return generateCsvFile(options, records, ['Name', 'Role', 'Phone', 'Area', 'Joined', 'Status', 'Monthly Salary'],
        r => [`"${r.name_en || ''}"`, `"${r.role || ''}"`, String(r.phone || ''),
              `"${r.area || ''}"`, fmtDate(r.joining_date), String(r.status || ''),
              paisaToRupeesString(r.monthly_salary ?? 0)]);
    }

    let rows = '', totalSalary = 0, active = 0;
    records.forEach(r => {
      totalSalary += r.monthly_salary ?? 0;
      if (r.status === 'active') active += 1;
      rows += `<tr><td>${esc(r.name_en)}</td><td>${esc(r.role)}</td><td>${esc(r.phone)}</td>` +
              `<td>${esc(r.area)}</td><td>${fmtDate(r.joining_date)}</td>` +
              `<td>${esc(r.status).toUpperCase()}</td>` +
              `<td class="num">${formatCurrency(r.monthly_salary ?? 0)}</td></tr>`;
    });
    if (!records.length) rows = `<tr><td class="empty" colspan="7">No staff records</td></tr>`;

    const html = fill(STAFF_REPORT_TEMPLATE, {
      business_name: esc(bName), asOfDate: formatDisplayDate(todayDate()), rows,
      totalStaff: String(records.length), activeStaff: String(active),
      totalMonthlySalary: formatCurrency(totalSalary),
    });
    return (await Print.printToFileAsync({ html })).uri;
  }

  throw new Error(`Unknown report type: ${options.reportType}`);
};
