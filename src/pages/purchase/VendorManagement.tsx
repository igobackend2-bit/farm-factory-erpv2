import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Plus, X, Check, Edit2, Phone, MapPin } from 'lucide-react';

interface VendorForm {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  gst_number: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
}

const EMPTY: VendorForm = {
  name: '', contact_person: '', phone: '', address: '',
  gst_number: '', bank_name: '', account_number: '', ifsc_code: '',
};

export default function VendorManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('*').order('name');
      return data ?? [];
    },
  });

  const saveVendor = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Vendor name required');
      if (editId) {
        const { error } = await supabase.from('vendors').update(form).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendors').insert({ ...form, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Vendor updated!' : 'Vendor added!');
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['vendors-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('vendors').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors-all'] }),
  });

  const filtered = (vendors as any[]).filter(v =>
    !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (v: any) => {
    setForm({ name: v.name, contact_person: v.contact_person ?? '', phone: v.phone ?? '', address: v.address ?? '',
      gst_number: v.gst_number ?? '', bank_name: v.bank_name ?? '', account_number: v.account_number ?? '', ifsc_code: v.ifsc_code ?? '' });
    setEditId(v.id);
    setShowForm(true);
  };

  const f = (key: keyof VendorForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-sm text-gray-500">Manage fresh produce suppliers</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }} className="btn-zoho-primary">
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors..." className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Vendor Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Vendor Name *', placeholder: 'e.g. Ravi Farms' },
                { key: 'contact_person', label: 'Contact Person', placeholder: 'Name' },
                { key: 'phone', label: 'Phone', placeholder: '+91 9876543210' },
                { key: 'gst_number', label: 'GST Number', placeholder: 'Optional' },
                { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. SBI' },
                { key: 'account_number', label: 'Account Number', placeholder: '' },
                { key: 'ifsc_code', label: 'IFSC Code', placeholder: '' },
              ].map(field => (
                <div key={field.key} className={field.key === 'name' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <input type="text" value={(form as any)[field.key]} onChange={f(field.key as keyof VendorForm)}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input type="text" value={form.address} onChange={f('address')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
              <button onClick={() => saveVendor.mutate()} disabled={saveVendor.isPending} className="flex-1 btn-zoho-primary justify-center py-2.5">
                <Check className="h-4 w-4" /> {saveVendor.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendors list */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading vendors...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No vendors found</div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filtered.map((v: any) => (
              <div key={v.id} className={`px-5 py-4 flex items-start justify-between ${!v.is_active ? 'opacity-50' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{v.name}</p>
                    {!v.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inactive</span>}
                  </div>
                  {v.contact_person && <p className="text-sm text-gray-500 mt-0.5">{v.contact_person}</p>}
                  <div className="flex gap-3 mt-1">
                    {v.phone && (
                      <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-xs text-blue-600">
                        <Phone className="h-3 w-3" /> {v.phone}
                      </a>
                    )}
                    {v.address && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" /> {v.address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => startEdit(v)} className="text-gray-400 hover:text-gray-600 p-1">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleActive.mutate({ id: v.id, active: v.is_active })}
                    className={`text-xs rounded-full px-2 py-0.5 font-medium ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
