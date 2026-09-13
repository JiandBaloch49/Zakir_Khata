/**
 * supplier.types.ts
 * All supplier-related TypeScript types.
 */

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  business_name?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  outstanding_balance?: number; // computed, not stored — sum of unpaid invoices
  created_at: string;
  updated_at?: string | null;
  synced: number;
  is_deleted: number;
  deleted_at?: string | null;
  firestore_path?: string | null;
}

export interface SupplierPayment {
  id: string;
  user_id: string;
  supplier_id: string;
  invoice_id?: string | null;        // optional — can be a general payment
  amount: number;                    // integer paisa (1 Rs = 100 paisa)
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'online';
  reference?: string | null;         // cheque no / transaction ID
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  synced: number;
  is_deleted: number;
  deleted_at?: string | null;
  firestore_path?: string | null;
}

/** A unified ledger entry (invoice or payment) for the supplier ledger screen */
export interface SupplierLedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment' | 'return';
  label: string;              // "Invoice #INV-001" or "Payment" or "Return"
  amount: number;             // positive = debit (money owed), shown in "payable" column
  credit: number;             // positive = credit (money paid / returned)
  balance: number;            // running balance
  reference_id: string;       // invoice_id or payment_id for navigation
}
