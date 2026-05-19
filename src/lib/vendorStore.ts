// ─────────────────────────────────────────────────────────────
//  Shared Vendor store (localStorage-backed singleton)
//  All purchase pages read vendor names from here
// ─────────────────────────────────────────────────────────────

const VENDOR_STORE_KEY = 'ff_erp_vendors_v1';

export interface StoredVendor {
  id: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  workPhone?: string;
  mobile?: string;
  pan?: string;
  gstin?: string;
  isMsme?: boolean;
  currency?: string;
  billing?: Record<string, string>;
  banks?: any[];
  remarks?: string;
}

/** Returns display name for a vendor (company name preferred, else first+last) */
export function vendorDisplayName(v: StoredVendor): string {
  return v.companyName?.trim() || `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || 'Unknown';
}

/** All vendors from localStorage */
export function getStoredVendors(): StoredVendor[] {
  try {
    const raw = localStorage.getItem(VENDOR_STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredVendor[];
  } catch { return []; }
}

/** Just vendor names as a string array — drop-in replacement for the old const VENDORS */
export function getVendorNames(): string[] {
  return getStoredVendors().map(vendorDisplayName);
}
