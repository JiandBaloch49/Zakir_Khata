import { formatDisplayDate } from './dates';
import { Transaction, CashEntry, CalculationResults } from '../types';

export const CURRENCY_PREFIX = 'Rs. ';

// All input values are in paisa. Returns paisa.
export const calculateTotalLena = (transactions: Transaction[]): number =>
  transactions.filter(t => t.type === 'lena').reduce((s, t) => s + t.amount_paisa, 0);

export const calculateTotalDena = (transactions: Transaction[]): number =>
  transactions.filter(t => t.type === 'dena').reduce((s, t) => s + t.amount_paisa, 0);

export const calculateNetBalance = (transactions: Transaction[]): number =>
  calculateTotalLena(transactions) - calculateTotalDena(transactions);

export const calculateCashIn = (cashBook: CashEntry[]): number =>
  cashBook.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount_paisa, 0);

export const calculateCashOut = (cashBook: CashEntry[]): number =>
  cashBook.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount_paisa, 0);

export const calculateCashBalance = (cashBook: CashEntry[]): number =>
  calculateCashIn(cashBook) - calculateCashOut(cashBook);

export const calculateAllMetrics = (
  transactions: Transaction[],
  cashBook: CashEntry[]
): CalculationResults => ({
  totalLena: calculateTotalLena(transactions),
  totalDena: calculateTotalDena(transactions),
  netBalance: calculateNetBalance(transactions),
  cashInTotal: calculateCashIn(cashBook),
  cashOutTotal: calculateCashOut(cashBook),
  cashBalance: calculateCashBalance(cashBook),
});

export const calculateStaffBalance = (transactions: Transaction[]): number =>
  calculateNetBalance(transactions);

// Accepts paisa, displays in rupees.
export const formatCurrency = (amountPaisa: number): string => {
  const rupees = Math.abs(amountPaisa) / 100;
  return `${CURRENCY_PREFIX}${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

/**
 * Display form for a stored date. Tolerates legacy rows: full ISO timestamps render
 * as their local calendar day, and malformed values (e.g. "2026-99-99" typed before
 * the date picker existed) render as-is rather than as "Invalid Date" or a throw.
 */
export const formatDate = (dateString: string): string => formatDisplayDate(dateString);

// Converts a user-entered rupee string ("150.50") to integer paisa (15050).
// Returns null if the string is not a valid positive number.
export const rupeesToPaisa = (input: string): number | null => {
  const trimmed = input.trim().replace(/,/g, '');
  const val = parseFloat(trimmed);
  if (isNaN(val) || val <= 0 || val > 99_999_999) return null;
  return Math.round(val * 100);
};

// Converts stored paisa integer back to a display string for input fields ("150.50").
export const paisaToRupeesString = (paisa: number): string => {
  const rupees = paisa / 100;
  return rupees % 1 === 0 ? rupees.toString() : rupees.toFixed(2);
};
