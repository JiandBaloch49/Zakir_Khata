import { create } from 'zustand';
import {
  PurchaseOrder, PurchaseOrderItem, PurchaseInvoice,
  PurchaseReturn, PurchaseSummary, POStatus, InvoiceStatus
} from '../types/purchase.types';
import {
  createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById,
  updatePurchaseOrderStatus, receiveGoods,
  createPurchaseInvoice, getPurchaseInvoices, getPurchaseInvoiceById,
  getPurchaseInvoicesBySupplier, createPurchaseReturn,
  getPurchaseSummary
} from '../services/database/purchaseDb';

interface PurchaseState {
  orders: PurchaseOrder[];
  invoices: PurchaseInvoice[];
  selectedOrder: PurchaseOrder | null;
  selectedInvoice: PurchaseInvoice | null;
  summary: PurchaseSummary | null;
  loading: boolean;
  error: string | null;

  loadOrders: (userId: string, status?: POStatus) => Promise<void>;
  loadInvoices: (userId: string, status?: InvoiceStatus) => Promise<void>;
  loadOrderById: (id: string) => Promise<void>;
  loadInvoiceById: (id: string) => Promise<void>;
  loadSummary: (userId: string) => Promise<void>;
  loadInvoicesBySupplier: (supplierId: string) => Promise<void>;

  createOrder: (
    userId: string, supplierId: string,
    items: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'received_qty' | 'is_deleted'>[],
    orderDate: string, expectedDate?: string, notes?: string
  ) => Promise<PurchaseOrder>;

  updateOrderStatus: (id: string, userId: string, status: POStatus) => Promise<void>;

  receiveGoods: (
    poId: string, userId: string,
    receipts: { itemId: string; stockItemId?: string | null; itemName: string; receivedQty: number; unitCost: number }[]
  ) => Promise<void>;

  createInvoice: (
    userId: string, supplierId: string,
    items: Omit<import('../types/purchase.types').PurchaseInvoiceItem, 'id' | 'invoice_id' | 'is_deleted'>[],
    invoiceDate: string,
    opts?: { poId?: string; invoiceNumber?: string; dueDate?: string; discountAmount?: number; taxAmount?: number; notes?: string }
  ) => Promise<PurchaseInvoice>;

  createReturn: (
    userId: string, invoiceId: string, supplierId: string,
    items: Omit<import('../types/purchase.types').PurchaseReturnItem, 'id' | 'return_id'>[],
    returnDate: string, reason?: string
  ) => Promise<PurchaseReturn>;

  clearSelected: () => void;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  orders: [],
  invoices: [],
  selectedOrder: null,
  selectedInvoice: null,
  summary: null,
  loading: false,
  error: null,

  loadOrders: async (userId, status) => {
    set({ loading: true, error: null });
    try {
      const orders = await getPurchaseOrders(userId, status);
      set({ orders, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadInvoices: async (userId, status) => {
    set({ loading: true, error: null });
    try {
      const invoices = await getPurchaseInvoices(userId, status);
      set({ invoices, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadOrderById: async (id) => {
    set({ loading: true });
    try {
      const order = await getPurchaseOrderById(id);
      set({ selectedOrder: order, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadInvoiceById: async (id) => {
    set({ loading: true });
    try {
      const invoice = await getPurchaseInvoiceById(id);
      set({ selectedInvoice: invoice, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadSummary: async (userId) => {
    try {
      const summary = await getPurchaseSummary(userId);
      set({ summary });
    } catch (e: any) { set({ error: e.message }); }
  },

  loadInvoicesBySupplier: async (supplierId) => {
    set({ loading: true });
    try {
      const invoices = await getPurchaseInvoicesBySupplier(supplierId);
      set({ invoices, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  createOrder: async (userId, supplierId, items, orderDate, expectedDate, notes) => {
    const order = await createPurchaseOrder(userId, supplierId, items, orderDate, expectedDate, notes);
    await get().loadOrders(userId);
    await get().loadSummary(userId);
    return order;
  },

  updateOrderStatus: async (id, userId, status) => {
    await updatePurchaseOrderStatus(id, userId, status);
    set(s => ({ orders: s.orders.map(o => o.id === id ? { ...o, status } : o) }));
    if (get().selectedOrder?.id === id) {
      set(s => ({ selectedOrder: s.selectedOrder ? { ...s.selectedOrder, status } : null }));
    }
  },

  receiveGoods: async (poId, userId, receipts) => {
    await receiveGoods(poId, userId, receipts);
    await get().loadOrderById(poId);
    await get().loadOrders(userId);
  },

  createInvoice: async (userId, supplierId, items, invoiceDate, opts) => {
    const invoice = await createPurchaseInvoice(userId, supplierId, items, invoiceDate, opts);
    await get().loadInvoices(userId);
    await get().loadSummary(userId);
    return invoice;
  },

  createReturn: async (userId, invoiceId, supplierId, items, returnDate, reason) => {
    const ret = await createPurchaseReturn(userId, invoiceId, supplierId, items, returnDate, reason);
    await get().loadInvoiceById(invoiceId);
    return ret;
  },

  clearSelected: () => set({ selectedOrder: null, selectedInvoice: null }),
}));

// Atomic selectors
export const usePurchaseOrders = () => usePurchaseStore(s => s.orders);
export const usePurchaseInvoices = () => usePurchaseStore(s => s.invoices);
export const usePurchaseSummary = () => usePurchaseStore(s => s.summary);
export const useSelectedOrder = () => usePurchaseStore(s => s.selectedOrder);
export const useSelectedInvoice = () => usePurchaseStore(s => s.selectedInvoice);
export const usePurchaseLoading = () => usePurchaseStore(s => s.loading);
