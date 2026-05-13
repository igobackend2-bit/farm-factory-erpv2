import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Phone, MapPin, Plus, Edit2, X, Check, Search, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerForm {
  shop_name: string; name: string; phone: string; address: string;
  area: string; city: string; gst_number: string; credit_limit: string;
  credit_days: string; owner_name: string;
}

const EMPTY_FORM: CustomerForm = {
  shop_name: '', name: '', phone: '', address: '', area: '', city: '',
  gst_number: '', credit_limit: '0', credit_days: '0', owner_name: '',
};

export default function CustomerManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('shop_name');
      return data ?? [];
    },
  });

  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!form.shop_name.trim()) throw new Error('Shop name is required');
      if (!form.phone.trim()) throw new Error('Phone number is required');
      const payload = {
        shop_name: form.shop_name.trim(), name: form.name.trim() || form.shop_name.trim(),
        phone: form.phone.trim(), address: form.address.trim() || null,
        area: form.area.trim() || null, city: form.city.trim() || null,
        gst_number: form.gst_number.trim() || null, credit_limit: Number(form.credit_limit) || 0,
        credit_days: Number(form.credit_days) || 0, owner_name: form.owner_name.trim() || null,
        is_active: true,
      };
      if (editingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Customer updated' : 'Customer added');
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['customers-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('customers').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers-all'] }),
    onError: () => toast.error('Failed to update'),
  });

  const startEdit = (c: any) => {
    setForm({ shop_name: c.shop_name ?? '', name: c.name ?? '', phone: c.phone ?? '', address: c.address ?? '', area: c.area ?? '', city: c.city ?? '', gst_number: c.gst_number ?? '', credit_limit: String(c.credit_limit ?? 0), credit_days: String(c.credit_days ?? 0), owner_name: c.owner_name ?? '' });
    setEditingId(c.id); setShowForm(true);
  };

  const allCustomers = customers as any[];
  const filtered = allCustomers.filter(c =>
    !search || (c.shop_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) || (c.area ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = allCustomers.filter(c => c.is_active).length;
  const withOutstanding = allCustomers.filter(c => Number(c.outstanding_balance) > 0).length;
  const totalOutstanding = allCustomers.reduce((s, c) => s + Number(c.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Customers</h1><p className="text-sm text-gray-500">{activeCount} active</p></div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><Users className="h-5 w-5 text-blue-500 mb-1" /><p className="text-xl font-bold">{activeCount}</p><p className="text-xs text-gray-500">Active Customers</p></div>
        <div className={`rounded-xl border p-4 ${withOutstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <AlertTriangle className={`h-5 w-5 mb-1 ${withOutstanding > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
          <p className={`text-xl font-bold ${withOutstanding > 0 ? 'text-amber-800' : 'text-gray-900'}`}>{withOutstanding}</p>
          <p className="text-xs text-gray-500">With Outstanding</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500 mb-1">Total Outstanding</p><p className="text-xl font-bold">₹{(totalOutstanding / 1000).toFixed(1)}k</p></div>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by shop, name, phone, or area..." className="text-sm outline-none flex-1 bg-transparent" />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shop Name *</label>
                  <input type="text" value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. Sri Ram Provisions" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Owner Name</label>
                  <input type="text" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Owner full name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="+91 XXXXX XXXXX" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Area</label>
                  <input type="text" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. Anna Nagar" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. Chennai" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Full delivery address" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Credit Limit (₹)</label>
                  <input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Credit Days</label>
                  <input type="number" value={form.credit_days} onChange={e => setForm(f => ({ ...f, credit_days: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" min="0" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={() => saveCustomer.mutate()} disabled={saveCustomer.isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                <Check className="h-4 w-4" />{saveCustomer.isPending ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">{search ? 'No customers match your search' : 'No customers yet'}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => {
            const outstanding = Number(c.outstanding_balance || 0);
            const overLimit = outstanding > Number(c.credit_limit || 0) && Number(c.credit_limit || 0) > 0;
            return (
              <div key={c.id} className={`bg-white rounded-xl border-2 p-4 ${overLimit ? 'border-red-200' : c.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div><h3 className="font-semibold text-gray-800">{c.shop_name}</h3>{c.owner_name && <p className="text-xs text-gray-500">{c.owner_name}</p>}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => toggleActive.mutate({ id: c.id, active: c.is_active })}
                      className={`px-2 py-1 text-xs font-medium rounded-lg ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  {c.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gray-400" /><a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a></div>}
                  {(c.area || c.city) && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs">{[c.area, c.city].filter(Boolean).join(', ')}</span></div>}
                </div>
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    {Number(c.credit_days) > 0 && <span className="bg-blue-50 text-blue-700 rounded px-2 py-0.5">{c.credit_days}d credit</span>}
                    {Number(c.credit_limit) > 0 && <span className="bg-gray-100 text-gray-600 rounded px-2 py-0.5">Limit ₹{Number(c.credit_limit).toLocaleString()}</span>}
                  </div>
                  {outstanding > 0 && <span className={`text-xs font-semibold px-2 py-0.5 rounded ${overLimit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>Due: ₹{outstanding.toLocaleString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
