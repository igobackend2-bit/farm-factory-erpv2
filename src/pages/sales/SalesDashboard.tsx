import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle2,
  Plus, IndianRupee, Users, ChevronRight,
  Search, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600' },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-100 text-[#2C64E3]' },
  dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',  className: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-600' },
  partial:    { label: 'Partial',    className: 'bg-orange-100 text-orange-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', cfg.className)}>
      {cfg.label}
    </span>
  );
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: stats } = useQuery({
    queryKey: ['sales-stats', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('status, net_amount')
        .gte('order_date', today);

      const orders = data ?? [];
      return {
        total: orders.length,
        confirmed: orders.filter(o => o.status === 'confirmed').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        totalValue: orders.reduce((s, o) => s + (Number(o.net_amount) || 0), 0),
        pendingValue: orders
          .filter(o => !['delivered', 'cancelled'].includes(o.status))
          .reduce((s, o) => s + (Number(o.net_amount) || 0), 0),
      };
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['sales-orders-today', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, net_amount, payment_mode, order_date, created_at,
          customer:customers(shop_name, phone, area)
        `)
        .gte('order_date', today)
        .order('created_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['sales-orders-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, net_amount, payment_mode, order_date,
          customer:customers(shop_name, area)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const displayOrders = orders.length > 0 ? orders : recentOrders;
  const isHistorical = orders.length === 0 && recentOrders.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Sales Dashboard</h1>
          <p className="text-[13px] text-slate-500">
            {isHistorical ? 'Showing Recent Activity' : format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-zoho-secondary">
            <Download className="h-4 w-4 mr-2 inline" /> Export
          </button>
          <Link to="/sales/new-order" className="btn-zoho-primary">
            <Plus className="h-4 w-4 mr-1 inline" /> New Order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Today's Orders", value: stats?.total ?? 0, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Value', value: `₹${((stats?.totalValue ?? 0) / 1000).toFixed(1)}k`, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Delivered', value: stats?.delivered ?? 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Value', value: `₹${((stats?.pendingValue ?? 0) / 1000).toFixed(1)}k`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 ${card.bg} rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
              <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 zoho-card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">
              {isHistorical ? 'Recent Orders' : "Today's Orders"}
            </h2>
            <div className="flex items-center gap-4">
              <Link to="/sales/orders" className="text-xs font-bold text-[#2C64E3] hover:underline">View All</Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            {(displayOrders as any[]).length === 0 ? (
              <div className="p-20 text-center">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-slate-200" />
                </div>
                <p className="text-slate-500 font-bold text-lg">No orders yet</p>
                <p className="text-sm text-slate-400 mb-6">Orders created today will appear here.</p>
                <Link to="/sales/new-order" className="btn-zoho-primary">+ Create First Order</Link>
              </div>
            ) : (
              <table className="zoho-table w-full">
                <thead>
                  <tr>
                    <th>Order Info</th>
                    <th>Customer</th>
                    <th className="text-right">Net Amount</th>
                    <th>Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(displayOrders as any[]).map((order: any) => (
                    <tr
                      key={order.id}
                      className="group cursor-pointer hover:bg-slate-50/50"
                      onClick={() => navigate(`/sales/orders/${order.id}`)}
                    >
                      <td>
                        <div className="font-bold text-slate-800">{order.order_number}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          {order.created_at && format(new Date(order.created_at), 'h:mm a')} · {order.payment_mode?.toUpperCase()}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-700">{order.customer?.shop_name || 'Walk-in'}</div>
                        <div className="text-[11px] text-slate-400">{order.customer?.area || 'No Area'}</div>
                      </td>
                      <td className="text-right font-bold text-slate-800">
                        ₹{Number(order.net_amount).toLocaleString('en-IN')}
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#2C64E3] transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="zoho-card p-6 bg-slate-900 text-white border-none shadow-blue-900/10 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sales Insight</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Average order value is <span className="text-white font-bold">₹{((stats?.totalValue ?? 0) / (stats?.total || 1)).toFixed(0)}</span> today.
              {(stats?.total ?? 0) > 5 ? ' High volume detected.' : ' Steady pace so far.'}
            </p>
            <button className="mt-6 w-full py-2 bg-white/10 hover:bg-white/20 rounded-md text-xs font-bold transition-colors">
              View Sales Analytics
            </button>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 px-1">Quick Links</h2>
            {[
              { label: 'Customer Management', desc: 'Manage shop profiles', to: '/sales/customers', icon: Users, color: 'text-[#2C64E3]', bg: 'bg-blue-50' },
              { label: 'Sales Targets', desc: 'Track team performance', to: '/sales/targets', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Collection Entry', desc: 'Log payment collections', to: '/sales/collection', icon: IndianRupee, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(item => (
              <Link key={item.to} to={item.to}
                className="zoho-card p-4 hover:border-blue-300 transition-all group flex items-center gap-4">
                <div className={cn('p-2.5 rounded-lg group-hover:scale-110 transition-transform', item.bg)}>
                  <item.icon className={cn('h-5 w-5', item.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 ml-auto group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
