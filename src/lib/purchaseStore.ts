// ─────────────────────────────────────────────────────────────
//  Shared Purchase-Order store (localStorage-backed singleton)
//  Both PurchaseOrdersPage and PurchaseBillsPage read/write here
//  so that a PO raised with real items flows into Auto-Generate Bill.
// ─────────────────────────────────────────────────────────────

export interface StoredPOItem {
  id: number;
  itemName: string;
  account: string;
  quantity: number;
  rate: number;
  tax: string;
  discount: number;
  customerDetails: string;
}

export interface StoredPO {
  id: string;           // unique string id
  poNumber: string;     // 'PO-00001', 'PO-00003', …
  vendorName: string;
  date: string;         // ISO 'YYYY-MM-DD'
  deliveryDate: string;
  paymentTerms: string;
  status: 'draft' | 'pending_approval' | 'open' | 'rejected' | 'billed' | 'cancelled';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  items: StoredPOItem[];
  subTotal: number;
  total: number;
  notes: string;
}

const STORAGE_KEY = 'ff_erp_purchase_orders_v1';

// ── Demo seed (loaded once if localStorage is empty) ──────────
const DEMO_SEED: StoredPO[] = [
  {
    id: 'demo-1', poNumber: 'PO-00001', vendorName: 'Ravi Farms',
    date: '2026-05-13', deliveryDate: '2026-05-15', paymentTerms: 'Net 15',
    status: 'open',
    items: [
      { id: 1, itemName: 'Onion',  account: 'Cost of Goods Sold', quantity: 50, rate: 25, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Tomato', account: 'Cost of Goods Sold', quantity: 30, rate: 40, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 2450, total: 2572.5, notes: 'Deliver before 7 AM to Palikarani Hub.',
  },
  {
    id: 'demo-2', poNumber: 'PO-00002', vendorName: 'AK Traders',
    date: '2026-05-14', deliveryDate: '2026-05-16', paymentTerms: 'Due on Receipt',
    status: 'open',
    items: [
      { id: 1, itemName: 'Potato', account: 'Cost of Goods Sold', quantity: 40, rate: 30, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Carrot', account: 'Cost of Goods Sold', quantity: 20, rate: 35, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 1900, total: 1995, notes: 'Koyambedu pickup, morning shift.',
  },
  {
    id: 'demo-3', poNumber: 'PO-00003', vendorName: 'Fresh Vendors Co.',
    date: '2026-05-14', deliveryDate: '2026-05-16', paymentTerms: 'Net 30',
    status: 'open',
    items: [
      { id: 1, itemName: 'Tomato', account: 'Cost of Goods Sold', quantity: 25, rate: 42, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Coriander', account: 'Cost of Goods Sold', quantity: 10, rate: 60, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 1650, total: 1732.5, notes: '',
  },
  {
    id: 'demo-4', poNumber: 'PO-00004', vendorName: 'Green Valley Agro',
    date: '2026-05-15', deliveryDate: '2026-05-17', paymentTerms: 'Net 15',
    status: 'open',
    items: [
      { id: 1, itemName: 'Carrot',   account: 'Cost of Goods Sold', quantity: 30, rate: 35, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Beetroot', account: 'Cost of Goods Sold', quantity: 15, rate: 28, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 3, itemName: 'Beans',    account: 'Cost of Goods Sold', quantity: 20, rate: 55, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 2570, total: 2698.5, notes: 'Root vegetables for Vanagaram Hub.',
  },
  {
    id: 'demo-5', poNumber: 'PO-00005', vendorName: 'Tamil Nadu Produce',
    date: '2026-05-15', deliveryDate: '2026-05-18', paymentTerms: 'Net 30',
    status: 'open',
    items: [
      { id: 1, itemName: 'Cabbage',    account: 'Cost of Goods Sold', quantity: 35, rate: 20, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Drumstick', account: 'Cost of Goods Sold', quantity: 12, rate: 45, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 1240, total: 1302, notes: 'Seasonal produce — confirm availability before loading.',
  },
  {
    id: 'demo-6', poNumber: 'PO-00006', vendorName: 'Sri Murugan Traders',
    date: '2026-05-16', deliveryDate: '2026-05-18', paymentTerms: 'Due on Receipt',
    status: 'draft',
    items: [
      { id: 1, itemName: 'Beetroot',    account: 'Cost of Goods Sold', quantity: 20, rate: 28, tax: 'GST 5%', discount: 0, customerDetails: '' },
      { id: 2, itemName: 'Raw Banana',  account: 'Cost of Goods Sold', quantity: 15, rate: 32, tax: 'GST 5%', discount: 0, customerDetails: '' },
    ],
    subTotal: 1040, total: 1092, notes: 'Draft — pending rate confirmation.',
  },
];

// ── Internal helpers ─────────────────────────────────────────
function load(): StoredPO[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First visit – seed with demo data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SEED));
      return [...DEMO_SEED];
    }
    return JSON.parse(raw) as StoredPO[];
  } catch {
    return [...DEMO_SEED];
  }
}

function persist(list: StoredPO[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Public API ───────────────────────────────────────────────

/** All POs (any status) */
export function getStoredPOs(): StoredPO[] {
  return load();
}

/** Only open POs – used by Auto-Generate Bill modal */
export function getOpenPOs(): StoredPO[] {
  return load().filter(p => p.status === 'open');
}

/** POs awaiting manager approval */
export function getPendingApprovalPOs(): StoredPO[] {
  return load().filter(p => p.status === 'pending_approval');
}

/** Insert or update a PO (matched by poNumber) */
export function savePOToStore(po: StoredPO): void {
  const list = load();
  const idx  = list.findIndex(p => p.poNumber === po.poNumber);
  if (idx >= 0) list[idx] = po;
  else list.unshift(po);
  persist(list);
}

/** Mark a PO as billed after a bill is auto-generated from it */
export function markPOBilled(poNumber: string): void {
  const list = load();
  const idx  = list.findIndex(p => p.poNumber === poNumber);
  if (idx >= 0) { list[idx].status = 'billed'; persist(list); }
}

/** Remove a PO entirely */
export function deletePOFromStore(poNumber: string): void {
  persist(load().filter(p => p.poNumber !== poNumber));
}

/** Highest PO serial number present in the store */
export function getMaxPOSerial(): number {
  return load().reduce((max, p) => {
    const n = parseInt(p.poNumber.replace('PO-', ''), 10) || 0;
    return Math.max(max, n);
  }, 0);
}

/**
 * Auto-create one PO per aggregated item from sales orders.
 * Called from Sales Dashboard "Auto Create PO" button.
 */
export function createPOsFromSalesOrders(
  items: Array<{ productName: string; totalQty: number; unit: string; avgPrice: number; totalValue: number }>
): StoredPO[] {
  let serial = getMaxPOSerial();
  const today = new Date().toISOString().split('T')[0];
  const created: StoredPO[] = [];

  for (const item of items) {
    serial += 1;
    const poNumber = `PO-${String(serial).padStart(5, '0')}`;
    const subTotal = Math.round(item.totalQty * item.avgPrice);
    const total    = Math.round(subTotal * 1.05); // 5% GST

    const po: StoredPO = {
      id: `auto-${Date.now()}-${serial}`,
      poNumber,
      vendorName: '',          // to be assigned by manager
      date: today,
      deliveryDate: '',
      paymentTerms: 'Due on Receipt',
      status: 'pending_approval',
      items: [{
        id: 1,
        itemName: item.productName,
        account: 'Cost of Goods Sold',
        quantity: item.totalQty,
        rate: item.avgPrice,
        tax: 'GST 5%',
        discount: 0,
        customerDetails: '',
      }],
      subTotal,
      total,
      notes: `Auto-generated from sales orders | Avg rate ₹${item.avgPrice}/${item.unit}`,
    };

    savePOToStore(po);
    created.push(po);
  }

  return created;
}
