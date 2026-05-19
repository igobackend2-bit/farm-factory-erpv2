// ─────────────────────────────────────────────────────────────
//  Buy Orders store — tracks vendor-wise purchase execution
//  per product (image flags, qty bought, bill creation status)
// ─────────────────────────────────────────────────────────────

const BUY_STORE_KEY = 'ff_erp_buy_orders_v1';

export interface BuyVendorEntry {
  id: string;
  type: 'static' | 'dynamic';
  vendorName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  itemName: string;
  buyQty: number;
  price: number;
  hasItemImage: boolean;
  hasWeightScaleImage: boolean;
}

export interface BuyOrder {
  id: string;
  product: string;
  requiredQty: number;
  unit: string;
  date: string;
  vendors: BuyVendorEntry[];
  billCreated: boolean;
}

function load(): BuyOrder[] {
  try {
    const raw = localStorage.getItem(BUY_STORE_KEY);
    return raw ? (JSON.parse(raw) as BuyOrder[]) : [];
  } catch { return []; }
}

function persist(list: BuyOrder[]): void {
  localStorage.setItem(BUY_STORE_KEY, JSON.stringify(list));
}

export function getBuyOrders(): BuyOrder[] {
  return load();
}

export function getBuyOrderByProduct(product: string): BuyOrder | null {
  return load().find(o => o.product === product) ?? null;
}

export function saveBuyOrder(order: BuyOrder): void {
  const list = load();
  const idx = list.findIndex(o => o.product === order.product);
  if (idx >= 0) list[idx] = order;
  else list.unshift(order);
  persist(list);
}

export function markBuyOrderBillCreated(product: string): void {
  const list = load();
  const idx = list.findIndex(o => o.product === product);
  if (idx >= 0) { list[idx].billCreated = true; persist(list); }
}

/** Total qty bought for a product across all vendors */
export function getBoughtQty(product: string): number {
  const order = getBuyOrderByProduct(product);
  if (!order) return 0;
  return order.vendors.reduce((s, v) => s + v.buyQty, 0);
}
