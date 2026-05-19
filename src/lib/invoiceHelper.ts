import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/** Generate invoice number like INV-20260517-0001 */
async function generateInvoiceNumber(): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');
  const prefix = `INV-${today}-`;
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .like('invoice_number', `${prefix}%`);
  const seq = String((count ?? 0) + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}

export interface CreateInvoiceParams {
  orderId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMode?: string;
  notes?: string | null;
  /** Due date offset in days (default 0 = same day) */
  dueDays?: number;
}

/**
 * Creates an invoice record for a placed order.
 * Call this right after inserting the sales_order.
 * Silently fails if the invoices table doesn't exist yet.
 */
export async function createInvoiceForOrder(params: CreateInvoiceParams): Promise<string | null> {
  try {
    const invoice_number = await generateInvoiceNumber();
    const invoice_date = format(new Date(), 'yyyy-MM-dd');
    const due_date = params.dueDays
      ? format(new Date(Date.now() + params.dueDays * 86_400_000), 'yyyy-MM-dd')
      : invoice_date;

    const { data, error } = await supabase.from('invoices').insert({
      invoice_number,
      order_id:         params.orderId,
      customer_id:      params.customerId ?? null,
      customer_name:    params.customerName ?? null,
      customer_phone:   params.customerPhone ?? null,
      customer_address: params.customerAddress ?? null,
      invoice_date,
      due_date,
      subtotal:         params.subtotal,
      discount_amount:  params.discountAmount ?? 0,
      tax_amount:       params.taxAmount ?? 0,
      total_amount:     params.totalAmount,
      payment_mode:     params.paymentMode ?? 'cod',
      status:           'unpaid',
      notes:            params.notes ?? null,
    }).select('id').single();

    if (error) {
      console.warn('Invoice creation skipped:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err: any) {
    // Don't break order flow if invoice fails
    console.warn('Invoice helper error:', err?.message);
    return null;
  }
}
