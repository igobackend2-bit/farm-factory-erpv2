import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle2,
  Plus, IndianRupee, Users, ChevronRight,
  Download, Package, Zap, Eye, ArrowRight,
  RefreshCw, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MOCK_SALES_ORDERS, aggregateSalesOrders, type MockSalesOrder } from '@/data/mockSalesOrders';
import { createPOsFromSalesOrders, getPendingApprovalPOs } from '@/lib/purchaseStore';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600' },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700' },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-100 text-[#2C64E3]' },
  dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',  className: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-600' },
  partial:    { label: 'Partial',    className: 'bg-orange-100 text-orange-700' },
};

const PRODUCT_EMOJI: Record<string, string> = {
  Onion: '🧅', Tomato: '🍅', Potato: '🥔', Carrot: '🥕',
  Cabbage: '🥬', Beetroot: '🥦', Coriander: '🌿', Drumstick: '🌱',
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
  const [poCreated, setPoCreated] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  // Supabase stats
  const { data: stats } = useQuery({
    queryKey: ['sales-stats', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('status, net_amount')
        .gte('order_date', today);
      const orders = data ?? [];
      return {
        total:        orders.length || MOCK_SALES_ORDERS.length,
        delivered:    orders.filter(o => o.status === 'delivered').length || MOCK_SALES_ORDERS.filter(o => o.status === 'delivered').length,
        totalValue:   orders.reduce((s, o) => s + (Number(o.net_amount) || 0), 0) ||
                      MOCK_SALES_ORDERS.reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.qty * p.price, 0), 0),
        pendingValue: orders.filter(o => !['delivered','cancelled'].includes(o.status))
                            .reduce((s, o) => s + (Number(o.net_amount) || 0), 0) ||
                      MOCK_SALES_ORDERS.filter(o => !['delivered','cancelled'].includes(o.status))
                            .reduce((s, o) => s + o.products.reduce((ps, p) => ps + p.qty * p.price, 0), 0),
      };
    },
  });

  // Aggregated items for PO preview
  const aggregated = useMemo(() => aggregateSalesOrders(MOCK_SALES_ORDERS), []);

  // Export today's orders as CSV
  const handleExportCSV = () => {
    const dateLabel = format(new Date(), 'yyyy-MM-dd');
    const headers = [
      'Order #', 'Shop Name', 'Customer Name', 'Phone',
      'Address', 'Products', 'Total Qty (kg)', 'Total Value (₹)',
      'Created By', 'Order Date', 'Delivery Date', 'Status',
    ];

    const rows = MOCK_SALES_ORDERS.map(o => {
      const productStr = o.products.map(p => `${p.name} ${p.qty}${p.unit}`).join(' | ');
      const totalQty   = o.products.reduce((s, p) => s + p.qty, 0);
      const totalValue = o.products.reduce((s, p) => s + p.qty * p.price, 0);
      return [
        o.id, o.shopName, o.customerName, o.phone,
        o.address, productStr, totalQty, totalValue,
        o.createdBy, o.orderDate, o.deliveryDate, o.status,
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Sales_Orders_${dateLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`📥 Exported ${MOCK_SALES_ORDERS.length} orders for ${dateLabel}`);
  };

  // Auto Create PO
  const handleAutoCreatePO = () => {
    const pos = createPOsFromSalesOrders(aggregated);
    setCreatedCount(pos.length);
    setPoCreated(true);
    toast.success(`✅ ${pos.length} Purchase Orders created — pending manager approval`);
    setTimeout(() => navigate('/purchase/auto-po'), 1500);
  };

  const totalOrderValue = MOCK_SALES_ORDERS.reduce(
    (s, o) => s + o.products.reduce((ps, p) => ps + p.qty * p.price, 0), 0
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Sales Dashboard</h1>
          <p className="text-[13px] text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="btn-zoho-secondary">
            <Download className="h-4 w-4 mr-2 inline" /> Export
          </button>
          <Link to="/sales/new-order" className="btn-zoho-primary">
            <Plus className="h-4 w-4 mr-1 inline" /> New Order
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders", value: MOCK_SALES_ORDERS.length, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Value',    value: `₹${(totalOrderValue / 1000).toFixed(1)}k`, icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Delivered',      value: MOCK_SALES_ORDERS.filter(o => o.status === 'delivered').length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending',        value: MOCK_SALES_ORDERS.filter(o => ['confirmed','pending'].includes(o.status)).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 ${card.bg} rounded-xl`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-[13px] text-slate-500 font-medium">{card.label}</p>
              <p className="text-[22px] font-bold text-slate-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Orders Table — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">

          {/* Orders card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <h2 className="font-bold text-slate-800 text-sm">Sales Orders</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{MOCK_SALES_ORDERS.length}</span>
              </div>
              <Link to="/sales/orders" className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Order #</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Shop</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Items</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Value (₹)</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Created By</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MOCK_SALES_ORDERS.map(order => {
                    const value = order.products.reduce((s, p) => s + p.qty * p.price, 0);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-blue-600 text-xs font-mono">{order.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 text-xs">{order.shopName}</p>
                          <p className="text-[10px] text-gray-400">{order.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600 max-w-[140px] truncate">
                            {order.products.map(p => `${p.name} ${p.qty}${p.unit}`).join(', ')}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-xs">
                          ₹{value.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{order.createdBy}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{order.orderDate}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auto Create PO card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                <h2 className="font-bold text-slate-800 text-sm">Auto Create Purchase Orders</h2>
              </div>
              <span className="text-[11px] text-gray-400">Item-wise aggregation from all orders</span>
            </div>

            {/* Aggregated items preview */}
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                The following items will be aggregated across <span className="font-bold text-gray-700">{MOCK_SALES_ORDERS.length} orders</span> and one PO will be created per item:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50 text-amber-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Item</th>
                      <th className="px-3 py-2 text-right font-semibold">Total Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Avg Price (₹)</th>
                      <th className="px-3 py-2 text-right font-semibold">Total Value (₹)</th>
                      <th className="px-3 py-2 text-center font-semibold">From Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {aggregated.map(item => (
                      <tr key={item.productName} className="hover:bg-amber-50/30">
                        <td className="px-3 py-2.5 font-semibold text-gray-800 flex items-center gap-1.5">
                          <span>{PRODUCT_EMOJI[item.productName] ?? '📦'}</span>
                          {item.productName}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">{item.totalQty} {item.unit}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">₹{item.avgPrice}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">₹{item.totalValue.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">{item.orderCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-3 py-2.5 font-black text-gray-800">{aggregated.length} Items → {aggregated.length} POs</td>
                      <td colSpan={2}></td>
                      <td className="px-3 py-2.5 text-right font-black text-gray-900">
                        ₹{aggregated.reduce((s, i) => s + i.totalValue, 0).toLocaleString('en-IN')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 mt-2">
                ℹ️ POs are created <strong>item-wise</strong> — no customer names included. Vendor will be assigned by manager during approval.
              </div>

              {/* Create PO Button */}
              {poCreated ? (
                <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-700 font-bold text-sm">{createdCount} POs created — redirecting to Purchase Orders…</span>
                </div>
              ) : (
                <button
                  onClick={handleAutoCreatePO}
                  className="w-full mt-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Zap className="h-4 w-4" />
                  Auto Create PO from All Orders ({aggregated.length} items)
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar — 1/3 */}
        <div className="space-y-4">

          {/* Sales Insight */}
          <div className="zoho-card p-6 bg-slate-900 text-white border-none shadow-blue-900/10 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sales Insight</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Average order value is{' '}
              <span className="text-white font-bold">
                ₹{Math.round(totalOrderValue / MOCK_SALES_ORDERS.length).toLocaleString('en-IN')}
              </span>{' '}
              today.{MOCK_SALES_ORDERS.length > 5 ? ' High volume detected.' : ' Steady pace so far.'}
            </p>
            <button
              onClick={() => navigate('/purchase/auto-po')}
              className="mt-4 w-full py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Go to Purchase Orders
            </button>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 px-1">Quick Links</h2>
            {[
              { label: 'Customer Management', desc: 'Manage shop profiles',      to: '/sales/customers',  icon: Users,       color: 'text-[#2C64E3]', bg: 'bg-blue-50' },
              { label: 'Sales Targets',        desc: 'Track team performance',   to: '/sales/targets',    icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Collection Entry',     desc: 'Log payment collections',  to: '/sales/collection', icon: IndianRupee, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Purchase Orders',      desc: 'View & manage POs',        to: '/purchase/auto-po', icon: Package,     color: 'text-purple-600', bg: 'bg-purple-50' },
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
