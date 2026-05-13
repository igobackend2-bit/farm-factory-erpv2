import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  AlertTriangle, Package, Phone, MessageCircle,
  ChevronDown, ChevronUp, Loader2, RefreshCw, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface Rejection {
  id: string;
  created_at: string;
  product_name: string;
  vendor_name: string;
  vendor_phone: string;
  quantity_kg: number;
  grade: string;
  rejection_reason: string;
  status: 'pending_return' | 'returned' | 'credit_issued';
  credit_note_amount: number | null;
  whatsapp_sent: boolean;
  notes: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending_return: 'bg-red-100 text-red-700',
  returned:       'bg-amber-100 text-amber-700',
  credit_issued:  'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending_return: 'Pending Return',
  returned:       'Returned',
  credit_issued:  'Credit Issued',
};

export default function QCRejections() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: rejections = [], isLoading, refetch } = useQuery({
    queryKey: ['qc-rejections', hubId],
    queryFn: async () => {
      const mocks: Rejection[] = [
        {
          id: 'rej-1',
          created_at: new Date().toISOString(),
          product_name: 'Tomato',
          vendor_name: 'Kumar Agro',
          vendor_phone: '+919876543210',
          quantity_kg: 45,
          grade: 'D',
          rejection_reason: 'Grade D — below threshold',
          status: 'pending_return',
          credit_note_amount: null,
          whatsapp_sent: false,
          notes: 'Severe bruising, smell off',
        },
        {
          id: 'rej-2',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          product_name: 'Onion',
          vendor_name: 'Rajan Farms',
          vendor_phone: '+919123456789',
          quantity_kg: 30,
          grade: 'D',
          rejection_reason: 'Spoiled / rotten',
          status: 'returned',
          credit_note_amount: null,
          whatsapp_sent: true,
          notes: 'Returned to vendor via Trip #108',
        },
        {
          id: 'rej-3',
          created_at: new Date(Date.now() - 172800000).toISOString(),
          product_name: 'Carrot',
          vendor_name: 'Sree Suppliers',
          vendor_phone: '+919000000001',
          quantity_kg: 20,
          grade: 'D',
          rejection_reason: 'Contaminated',
          status: 'credit_issued',
          credit_note_amount: 700,
          whatsapp_sent: true,
          notes: 'Credit note CN-20240423-001 issued',
        },
      ];
      return filterStatus === 'all' ? mocks : mocks.filter(r => r.status === filterStatus);
    },
  });

  const processReturn = useMutation({
    mutationFn: async (rejectionId: string) => {
      const { data, error } = await supabase.functions.invoke('process-return', {
        body: { rejection_id: rejectionId, hub_id: hubId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Return processed — inventory updated, credit note issued, vendor notified via WhatsApp');
      qc.invalidateQueries({ queryKey: ['qc-rejections'] });
    },
    onError: () => toast.error('Failed to process return'),
  });

  const sendWhatsApp = useMutation({
    mutationFn: async (rejection: Rejection) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-notify', {
        body: {
          to: rejection.vendor_phone,
          type: 'qc_rejection',
          payload: {
            vendor_name: rejection.vendor_name,
            product_name: rejection.product_name,
            quantity_kg: rejection.quantity_kg,
            reason: rejection.rejection_reason,
          },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success('WhatsApp notification sent to vendor'),
    onError: () => toast.error('WhatsApp send failed'),
  });

  const filtered = rejections;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">QC Rejections</h1>
            <p className="text-sm text-gray-500">Grade D items & return tracking</p>
          </div>
          <button onClick={() => refetch()} className="p-2 bg-red-50 text-red-600 rounded-lg">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          {['all', 'pending_return', 'returned', 'credit_issued'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                filterStatus === s
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b bg-white">
        {[
          { label: 'Pending', value: rejections.filter(r => r.status === 'pending_return').length, color: 'text-red-600' },
          { label: 'Returned', value: rejections.filter(r => r.status === 'returned').length, color: 'text-amber-600' },
          { label: 'Credited', value: rejections.filter(r => r.status === 'credit_issued').length, color: 'text-green-600' },
        ].map((stat, i) => (
          <div key={i} className={`text-center py-3 ${i < 2 ? 'border-r' : ''}`}>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No rejections</p>
            <p className="text-sm">All QC batches passed today</p>
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.product_name}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        Grade {r.grade}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.vendor_name} · {r.quantity_kg} kg · {format(new Date(r.created_at), 'dd MMM, hh:mm a')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  {expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
                  <div className="pt-3">
                    <div className="text-xs text-gray-500 mb-1">Rejection Reason</div>
                    <div className="text-sm font-medium text-gray-800">{r.rejection_reason}</div>
                  </div>
                  {r.notes && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Notes</div>
                      <div className="text-sm text-gray-700">{r.notes}</div>
                    </div>
                  )}
                  {r.credit_note_amount && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div className="text-xs text-green-600 font-medium">Credit Note Issued</div>
                      <div className="text-lg font-bold text-green-700">₹{r.credit_note_amount.toLocaleString()}</div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {r.status === 'pending_return' && (
                      <button
                        onClick={() => processReturn.mutate(r.id)}
                        disabled={processReturn.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        {processReturn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                        Process Return
                      </button>
                    )}
                    {!r.whatsapp_sent && (
                      <button
                        onClick={() => sendWhatsApp.mutate(r)}
                        disabled={sendWhatsApp.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Notify Vendor
                      </button>
                    )}
                    <a
                      href={`tel:${r.vendor_phone}`}
                      className="p-2 border rounded-lg text-gray-600 hover:bg-gray-100"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  </div>
                  {r.whatsapp_sent && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> WhatsApp notification sent
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
