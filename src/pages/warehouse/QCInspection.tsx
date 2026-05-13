import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Camera, CheckCircle2, XCircle, AlertTriangle, Scale } from 'lucide-react';

type QCGrade = 'A' | 'B' | 'C' | 'D';

interface QCFormData {
  product_id: string;
  vendor_id: string;
  po_item_id?: string;
  gross_weight_kg: number;
  tare_weight_kg: number;
  grade_a_kg: number;
  grade_b_kg: number;
  grade_c_kg: number;
  grade_d_kg: number;
  overall_grade: QCGrade;
  rejection_reason?: string;
  defect_notes?: string;
}

const GRADE_CONFIG: Record<QCGrade, { label: string; color: string; bg: string; description: string }> = {
  A: { label: 'Grade A', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  description: 'Fresh, no defects — Full price' },
  B: { label: 'Grade B', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', description: 'Minor defects — 10-15% discount' },
  C: { label: 'Grade C', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', description: 'Visible damage — QC channel price' },
  D: { label: 'Grade D', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',    description: 'Reject — Return to vendor' },
};

function GradeCard({ grade, selected, onClick }: {
  grade: QCGrade; selected: boolean; onClick: () => void;
}) {
  const cfg = GRADE_CONFIG[grade];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-all ${
        selected ? `${cfg.bg} border-current ${cfg.color} shadow-sm` : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <p className={`text-lg font-bold ${selected ? cfg.color : 'text-gray-800'}`}>{cfg.label}</p>
      <p className={`text-xs mt-1 ${selected ? cfg.color : 'text-gray-500'}`}>{cfg.description}</p>
    </button>
  );
}

export default function QCInspection() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const qc = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState<QCGrade>('A');
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [lastResult, setLastResult] = useState<any>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<QCFormData>({
    defaultValues: { tare_weight_kg: 0, grade_a_kg: 0, grade_b_kg: 0, grade_c_kg: 0, grade_d_kg: 0 },
  });

  const gross = watch('gross_weight_kg') || 0;
  const tare = watch('tare_weight_kg') || 0;
  const netWeight = gross - tare;
  const gradeA = watch('grade_a_kg') || 0;
  const gradeB = watch('grade_b_kg') || 0;
  const gradeC = watch('grade_c_kg') || 0;
  const gradeD = watch('grade_d_kg') || 0;
  const gradedTotal = gradeA + gradeB + gradeC + gradeD;
  const acceptancePct = netWeight > 0 ? ((gradeA + gradeB + gradeC) / netWeight) * 100 : 0;

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id,name,sku_code').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id,name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const createQC = useMutation({
    mutationFn: async (data: QCFormData) => {
      const grnNumber = `GRN-${Date.now()}`;
      const { data: inspection, error } = await supabase.from('qc_inspections').insert({
        grn_number: grnNumber,
        hub_id: hubId,
        product_id: data.product_id,
        vendor_id: data.vendor_id,
        po_item_id: data.po_item_id || null,
        inspector_id: user!.id,
        gross_weight_kg: data.gross_weight_kg,
        tare_weight_kg: data.tare_weight_kg,
        grade_a_kg: data.grade_a_kg,
        grade_b_kg: data.grade_b_kg,
        grade_c_kg: data.grade_c_kg,
        grade_d_kg: data.grade_d_kg,
        overall_grade: selectedGrade,
        acceptance_pct: acceptancePct,
        rejection_reason: data.rejection_reason,
        defect_notes: data.defect_notes,
        status: gradeD > 0 && (gradeA + gradeB + gradeC) === 0 ? 'rejected' : gradeD > 0 ? 'partial' : 'accepted',
      }).select().single();

      if (error) throw error;

      if (gradeA + gradeB + gradeC > 0) {
        const { error: invErr } = await supabase.rpc('increment_inventory', {
          p_hub_id: hubId,
          p_product_id: data.product_id,
          p_grade_a: data.grade_a_kg,
          p_grade_b: data.grade_b_kg,
          p_grade_c: data.grade_c_kg,
        });
        if (invErr) throw new Error(`Inventory update failed: ${invErr.message}. Please try again.`);
      }

      if (gradeD > 0) {
        await supabase.from('qc_rejections').insert({
          qc_inspection_id: inspection.id,
          vendor_id: data.vendor_id,
          product_id: data.product_id,
          rejected_kg: gradeD,
          rejection_reason: data.rejection_reason || 'Grade D — substandard quality',
          return_status: 'pending',
        });
      }

      return { inspection, grnNumber };
    },
    onSuccess: ({ inspection, grnNumber }) => {
      toast.success(`QC Inspection ${grnNumber} recorded!`);
      setLastResult({ ...inspection, grnNumber });
      setStep('result');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['qc-inspections'] });
    },
    onError: (err: Error) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  const onSubmit = (data: QCFormData) => {
    const total = (Number(data.grade_a_kg) || 0) +
                  (Number(data.grade_b_kg) || 0) +
                  (Number(data.grade_c_kg) || 0) +
                  (Number(data.grade_d_kg) || 0);

    if (Math.abs(total - netWeight) > 0.1) {
      toast.error(`Weight mismatch! Graded total (${total.toFixed(1)}kg) must match Net weight (${netWeight.toFixed(1)}kg)`);
      return;
    }

    createQC.mutate({ ...data, overall_grade: selectedGrade });
  };

  const handleNewInspection = () => {
    reset();
    setSelectedGrade('A');
    setStep('form');
    setLastResult(null);
  };

  if (step === 'result' && lastResult) {
    const isRejected = lastResult.status === 'rejected';
    const isPartial = lastResult.status === 'partial';

    return (
      <div className="max-w-lg mx-auto">
        <div className={`rounded-2xl border-2 p-8 text-center ${
          isRejected ? 'border-red-200 bg-red-50' : isPartial ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'
        }`}>
          {isRejected ? (
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          ) : isPartial ? (
            <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          ) : (
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          )}

          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {isRejected ? 'Batch Rejected' : isPartial ? 'Partial Acceptance' : 'Batch Accepted'}
          </h2>
          <p className="text-sm text-gray-600 mb-6">GRN: {lastResult.grnNumber}</p>

          <div className="grid grid-cols-2 gap-3 text-left mb-6">
            {[
              { label: 'Net Weight', value: `${lastResult.net_weight_kg} kg` },
              { label: 'Acceptance', value: `${acceptancePct.toFixed(1)}%` },
              { label: 'Grade A', value: `${lastResult.grade_a_kg} kg` },
              { label: 'Grade B', value: `${lastResult.grade_b_kg} kg` },
              { label: 'Grade C', value: `${lastResult.grade_c_kg} kg` },
              { label: 'Grade D (Rejected)', value: `${lastResult.grade_d_kg} kg` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {lastResult.grade_d_kg > 0 && (
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 mb-4">
              ⚠️ {lastResult.grade_d_kg} kg rejected. Vendor will be notified via WhatsApp. Credit note will be generated.
            </div>
          )}

          <button
            onClick={handleNewInspection}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700"
          >
            New QC Inspection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">QC Inspection</h2>
        <p className="text-sm text-gray-500">Record quality check for incoming goods</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Batch Details</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
              <select {...register('product_id', { required: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select product</option>
                {(products as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku_code})</option>
                ))}
              </select>
              {errors.product_id && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
              <select {...register('vendor_id', { required: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select vendor</option>
                {(vendors as any[]).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              {errors.vendor_id && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
            <Scale className="h-4 w-4" /> Weight Measurement
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight (kg) *</label>
              <input
                type="number" step="0.1" min="0"
                {...register('gross_weight_kg', { required: true, valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tare Weight (kg)</label>
              <input
                type="number" step="0.1" min="0"
                {...register('tare_weight_kg', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.0"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <p className="text-xs text-green-600 font-medium">Net Weight</p>
                <p className="text-xl font-bold text-green-700">{netWeight.toFixed(1)} kg</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Overall Grade</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(['A', 'B', 'C', 'D'] as QCGrade[]).map(grade => (
              <GradeCard
                key={grade}
                grade={grade}
                selected={selectedGrade === grade}
                onClick={() => setSelectedGrade(grade)}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Grade Breakdown (kg)</h3>
            {gradedTotal > 0 && (
              <span className={`text-xs font-medium ${Math.abs(gradedTotal - netWeight) > 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                Total: {gradedTotal.toFixed(1)} / {netWeight.toFixed(1)} kg
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(['A', 'B', 'C', 'D'] as QCGrade[]).map(grade => {
              const cfg = GRADE_CONFIG[grade];
              return (
                <div key={grade}>
                  <label className={`block text-xs font-semibold mb-1 ${cfg.color}`}>{cfg.label} (kg)</label>
                  <input
                    type="number" step="0.1" min="0"
                    {...register(`grade_${grade.toLowerCase()}_kg` as any, { valueAsNumber: true })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.0"
                  />
                </div>
              );
            })}
          </div>

          {netWeight > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Acceptance Rate</span>
                <span className="font-semibold">{acceptancePct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full transition-all ${acceptancePct >= 80 ? 'bg-green-500' : acceptancePct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(acceptancePct, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {(selectedGrade === 'C' || selectedGrade === 'D' || gradeD > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Rejection Details</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
              <select
                {...register('rejection_reason')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select reason</option>
                <option value="Over-ripe / Spoiled">Over-ripe / Spoiled</option>
                <option value="Physical damage">Physical damage</option>
                <option value="Wrong product">Wrong product</option>
                <option value="Underweight">Underweight</option>
                <option value="Contamination">Contamination</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Defect Notes</label>
              <textarea
                {...register('defect_notes')}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Describe the defects..."
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5 text-center">
          <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Add Photos (optional)</p>
          <p className="text-xs text-gray-400">Tap to capture batch photos</p>
        </div>

        <button
          type="submit"
          disabled={createQC.isPending}
          className="w-full rounded-xl bg-green-600 px-6 py-3.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createQC.isPending ? 'Saving...' : '✓ Submit QC Inspection'}
        </button>
      </form>
    </div>
  );
}
