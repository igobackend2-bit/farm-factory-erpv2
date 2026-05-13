import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfWeek } from 'date-fns';
import {
  ShoppingBag, Search, Plus, Clock,
  CheckCircle2, Truck, XCircle, RefreshCw,
  ChevronRight, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600',    icon: <Clock className="h-3 w-3" /> },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3 w-3" /> },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-50 text-[#2C64E3]',     icon: <CheckCircle2 className="h-3 w-3" /> },
  dispatched: { label: 'Dispatched', className: 'bg-purple-50 text-purple-700', icon: <Truck className="h-3 w-3" /> },
  delivered:  { label: 'Delivered',  className: 'bg-green-50 text-green-700',   icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-50 text-red-600',       icon: <XCircle className="h-3 w-3" /> },
  partial:    { label: 'Partial',    className: 'bg-orange-50 text-orange-700', icon: <Clock className="h-3 w-3" /> },
};

const DATE_RANGES = [
  { label: 'Today',     value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'All',       value: 'all' },
] as const;

type DateRange = typeof DATE_RANGES[number]['value'];
type StatusFilter = 'all' | keyof typeof STATUS_CONFIG;

function getDateRange(range: DateRange): { from: string; to: string } | null {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (range === 'today') return { from: today, to: today };
  if (range === 'yesterday') {
    const y = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    return { from: y, to: y };
  }
  if (range === 'week') {
    return { from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: today };
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
      cfg.className
    )}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function OrderListPage() {
  const { user } = useAuth();
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'nsm'].includes((user as any)?.role ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('today');

  const range = getDateRange(dateRange);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['all-sales-orders', dateRange, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, net_amount, total_amount,
          payment_mode, payment_status, order_date, created_at,
          customer:customers(shop_name, name, phone, area)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (range) {
        q = q.gte('order_date', range.from).lte('order_date', range.to);
      }
      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (orders as any[]).filter((o: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (o.order_number ?? '').toLowerCase().includes(s) ||
      (o.customer?.shop_name ?? '').toLowerCase().includes(s) ||
      (o.customer?.name ?? '').toLowerCase().includes(s) ||
      (o.customer?.area ?? '').toLowerCase().includes(s)
    );
  });

  const statusCounts = (orders as any[]).reduce<Record<string, number>>((acc, o: any) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalValue = filtered.reduce((s: number, o: any) => s + (Number(o.net_amount ?? o.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Orders</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <ShoppingBag className="h-3.5 w-3.5" />
            {filtered.length} total orders found
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">₹{totalValue.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-[#2C64E3] hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            <RefreshCw className={cn('h-5 w-5', isLoading && 'animate-spin')} />
          </button>
          <Link to="/sales/new-order" className="btn-zoho-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Order
          </Link>
        </div>
      </div>

      <div className="zoho-card p-0 flex flex-col divide-y divide-slate-100">
        <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Filter by order #, shop name, or area..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 self-start md:self-auto">
            {DATE_RANGES.map(dr => (
              <button
                key={dr.value}
                onClick={() => setDateRange(dr.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  dateRange === dr.value
                    ? 'bg-white text-[#2C64E3] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {dr.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 flex items-center gap-6 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all flex-shrink-0',
              statusFilter === 'all'
                ? 'border-[#2C64E3] text-[#2C64E3]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            )}
          >
            All Orders ({orders.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = statusCounts[key] ?? 0;
            if (count === 0 && statusFilter !== key) return null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key as StatusFilter)}
                className={cn(
                  'text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all flex-shrink-0',
                  statusFilter === key
                    ? 'border-[#2C64E3] text-[#2C64E3]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="zoho-table-container">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white">
            <RefreshCw className="h-10 w-10 text-[#2C64E3]/20 animate-spin" />
            <p className="text-slate-400 text-sm mt-4 font-medium">Fetching orders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-slate-800 font-bold">No orders found</h3>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <table className="zoho-table">
            <thead>
              <tr>
                <th>Order Details</th>
                <th>Customer / Shop</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Payment</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order: any) => {
                const amount = Number(order.net_amount ?? order.total_amount) || 0;
                return (
                  <tr
                    key={order.id}
                    onClick={() => window.location.href = `/sales/orders/${order.id}`}
                    className="cursor-pointer group"
                  >
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#2C64E3] flex items-center gap-1">
                          #{order.order_number}
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          {format(new Date(order.order_date || order.created_at), 'dd MMM yyyy, hh:mm a')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{order.customer?.shop_name || 'N/A'}</span>
                        <span className="text-xs text-slate-500">
                          {order.customer?.name} {order.customer?.area && `· ${order.customer.area}`}
                        </span>
                      </div>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="text-right">
                      <span className="font-bold text-slate-800">₹{amount.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-tighter">
                          {order.payment_mode || 'COD'}
                        </span>
                        <span className={cn(
                          'text-[10px] font-bold mt-0.5',
                          order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'
                        )}>
                          {order.payment_status?.toUpperCase() || 'UNPAID'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#2C64E3] transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium">
          <p>Showing {filtered.length} results</p>
          <span className="h-1 w-1 rounded-full bg-slate-300"></span>
          <p>End of list</p>
        </div>
      )}
    </div>
  );
}
