import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, Plus, Minus, Trash2, ShoppingBag, Repeat } from 'lucide-react';

interface CartItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  qty_kg: number;
  grade: 'A' | 'B' | 'C';
}

export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomer = searchParams.get('customer_id');

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'cod' | 'credit' | 'upi'>('cod');
  const [notes, setNotes] = useState('');
  const [showCustomerPicker] = useState(!preselectedCustomer);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prefillFromSubscription = async () => {
    if (!selectedCustomer) return;
    setIsPrefilling(true);
    try {
      const { data: sub } = await supabase
        .from('b2b_subscriptions')
        .select('*, items:b2b_subscription_items(product:products(id, name), quantity_kg, unit_price)')
        .eq('customer_id', selectedCustomer.id)
        .eq('status', 'active')
        .single();

      if (!sub) {
        toast.info('No active subscription found for this customer');
        return;
      }

      const items = (sub.items || []).map((i: any) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        unit_price: i.unit_price,
        qty_kg: i.quantity_kg,
        grade: 'A' as const
      }));

      setCart(items);
      setPaymentMode('credit');
      toast.success('Cart pre-filled from active subscription');
    } catch {
      toast.error('Failed to fetch subscription items');
    } finally {
      setIsPrefilling(false);
    }
  };

  useEffect(() => {
    if (preselectedCustomer) {
      supabase
        .from('customers')
        .select('*')
        .eq('id', preselectedCustomer)
        .single()
        .then(({ data }) => { if (data) setSelectedCustomer(data); });
    }
  }, [preselectedCustomer]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const { data } = await supabase
        .from('customers')
        .select('id, shop_name, phone, area, credit_limit, outstanding_balance')
        .or(`shop_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .eq('is_active', true)
        .limit(10);
      return data ?? [];
    },
    enabled: customerSearch.length >= 2,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, unit, grade_a_price, grade_b_discount_pct, grade_c_discount_pct, min_order_kg')
        .eq('is_active', true)
        .order('name');
      if (productSearch) query = query.ilike('name', `%${productSearch}%`);
      const { data } = await query.limit(20);
      return data ?? [];
    },
  });

  const addToCart = (product: any, grade: 'A' | 'B' | 'C' = 'A') => {
    const discount = grade === 'B' ? (product.grade_b_discount_pct ?? 10) : grade === 'C' ? (product.grade_c_discount_pct ?? 20) : 0;
    const price = product.grade_a_price * (1 - discount / 100);

    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id && c.grade === grade);
      if (existing) {
        return prev.map(c => c.product_id === product.id && c.grade === grade
          ? { ...c, qty_kg: c.qty_kg + (product.min_order_kg ?? 1) }
          : c
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        unit_price: price,
        qty_kg: product.min_order_kg ?? 1,
        grade,
      }];
    });
    setProductSearch('');
  };

  const updateQty = (productId: string, grade: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.product_id === productId && c.grade === grade
        ? { ...c, qty_kg: Math.max(0, c.qty_kg + delta) }
        : c
      )
      .filter(c => c.qty_kg > 0)
    );
  };

  const removeFromCart = (productId: string, grade: string) => {
    setCart(prev => prev.filter(c => !(c.product_id === productId && c.grade === grade)));
  };

  const subtotal = cart.reduce((s, c) => s + c.qty_kg * c.unit_price, 0);
  const netAmount = subtotal;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      if (!selectedCustomer) throw new Error('Select a customer');
      if (cart.length === 0) throw new Error('Add products to cart');

      try {
        const { data: order, error: orderErr } = await supabase
          .from('sales_orders')
          .insert({
            customer_id: selectedCustomer.id,
            order_date: format(new Date(), 'yyyy-MM-dd'),
            status: 'confirmed',
            payment_mode: paymentMode,
            subtotal,
            net_amount: netAmount,
            notes: notes.trim() || null,
            created_by: user!.id,
            hub_id: (user as any)?.hub_id ?? null,
          })
          .select()
          .single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabase
          .from('sales_order_items')
          .insert(cart.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            qty_kg: item.qty_kg,
            unit_price: item.unit_price,
            total_price: item.qty_kg * item.unit_price,
            qc_grade: item.grade,
          })));
        if (itemsErr) throw itemsErr;

        return order;
      } catch (err) {
        setIsSubmitting(false);
        throw err;
      }
    },
    onSuccess: (order) => {
      toast.success(`Order ${order?.order_number} placed!`);
      navigate('/sales');
    },
    onError: (e: Error) => {
      setIsSubmitting(false);
      toast.error(e.message);
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">New Order</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'd MMMM yyyy · hh:mm a')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Customer</h2>

        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 p-3">
            <div>
              <p className="font-semibold text-green-800">{selectedCustomer.shop_name}</p>
              <p className="text-xs text-gray-600">{selectedCustomer.area} · {selectedCustomer.phone}</p>
              {selectedCustomer.outstanding_balance > 0 && (
                <p className="text-xs text-red-600 mt-0.5">Outstanding: ₹{selectedCustomer.outstanding_balance}</p>
              )}
              <button
                onClick={prefillFromSubscription}
                disabled={isPrefilling}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1.5 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                <Repeat className={`h-3 w-3 ${isPrefilling ? 'animate-spin' : ''}`} />
                {isPrefilling ? 'Prefilling...' : 'Pre-fill from Subscription'}
              </button>
            </div>
            <button onClick={() => setSelectedCustomer(null)}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1">
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Search by shop name or phone..." autoFocus={showCustomerPicker} />
            {(customers as any[]).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto">
                {(customers as any[]).map((c: any) => (
                  <button key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{c.shop_name}</p>
                    <p className="text-xs text-gray-500">{c.area} · {c.phone}</p>
                    {c.outstanding_balance > 0 && (
                      <p className="text-xs text-red-500">Dues: ₹{c.outstanding_balance}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Add Products</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Search products..." />
        </div>

        {(products as any[]).length > 0 && productSearch && (
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {(products as any[]).map((p: any) => (
              <div key={p.id} className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">₹{p.grade_a_price}/kg</p>
                </div>
                <div className="flex gap-1.5">
                  {(['A', 'B', 'C'] as const).map(grade => (
                    <button key={grade}
                      onClick={() => addToCart(p, grade)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                        grade === 'A' ? 'bg-green-600 text-white' :
                        grade === 'B' ? 'bg-yellow-500 text-white' :
                        'bg-orange-500 text-white'
                      }`}>
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Cart ({cart.length} items)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {cart.map(item => (
              <div key={`${item.product_id}-${item.grade}`} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                      item.grade === 'A' ? 'bg-green-100 text-green-700' :
                      item.grade === 'B' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>Grade {item.grade}</span>
                  </div>
                  <p className="text-xs text-gray-500">₹{item.unit_price.toFixed(2)}/kg</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.product_id, item.grade, -0.5)}
                    className="h-6 w-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold">{item.qty_kg}kg</span>
                  <button onClick={() => updateQty(item.product_id, item.grade, 0.5)}
                    className="h-6 w-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
                    <Plus className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeFromCart(item.product_id, item.grade)}
                    className="ml-1 text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-right w-20">
                  <p className="text-sm font-bold text-gray-800">
                    ₹{(item.qty_kg * item.unit_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
            <span className="font-semibold text-gray-800">Total</span>
            <span className="text-lg font-bold text-green-700">₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Payment Mode</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['cod', 'credit', 'upi'] as const).map(mode => (
              <button key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${
                  paymentMode === mode ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {mode === 'cod' ? '💵 COD' : mode === 'credit' ? '📋 Credit' : '📱 UPI'}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Special instructions..." />
          </div>
        </div>
      )}

      {cart.length > 0 && selectedCustomer && (
        <button
          onClick={() => placeOrder.mutate()}
          disabled={placeOrder.isPending || isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200"
        >
          <ShoppingBag className="h-5 w-5" />
          {placeOrder.isPending || isSubmitting ? 'Placing Order...' : `Place Order — ₹${netAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
        </button>
      )}
    </div>
  );
}
