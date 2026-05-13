// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import {
  Plus, ChevronDown, ChevronUp, ChevronRight, MoreHorizontal,
  Upload, Download, Settings2, RefreshCw, Maximize2, ArrowUpDown,
  ArrowUp, ArrowDown, Star, Check, X, Eye, EyeOff, Info,
  Building2, Mail, Phone, Landmark,
} from 'lucide-react';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cb]);
}

const SALUTATIONS = ['', 'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'UAE', 'Singapore', 'Australia'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh',
  'West Bengal',
];

type VendorFilter = 'All' | 'Active' | 'Inactive';

/* ─── Address Block ──────────────────────────────────────────────────────── */
function AddressBlock({
  title, data, onChange, onCopy,
}: {
  title: string;
  data: any;
  onChange: (k: string, v: string) => void;
  onCopy?: () => void;
}) {
  const inp = (k: string, placeholder = '') => (
    <input
      value={data[k] || ''}
      onChange={e => onChange(k, e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 text-[13px] rounded-lg outline-none"
      style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
      onFocus={e => (e.target.style.borderColor = '#2563EB')}
      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
    />
  );

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-[15px] font-bold" style={{ color: '#111827' }}>{title}</h3>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-[12px] font-medium flex items-center gap-1 ml-2"
            style={{ color: '#2563EB' }}>
            <Download className="w-3 h-3" />
            Copy billing address
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Attention */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Attention</label>
          {inp('attention')}
        </div>

        {/* Country */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Country/Region</label>
          <div className="relative flex-1">
            <select
              value={data.country || ''}
              onChange={e => onChange('country', e.target.value)}
              className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', color: data.country ? '#111827' : '#9CA3AF' }}>
              <option value="">Select</option>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
          </div>
        </div>

        {/* Street 1 & 2 */}
        <div className="flex items-start gap-4">
          <label className="w-32 text-right text-[13px] shrink-0 pt-2" style={{ color: '#374151' }}>Address</label>
          <div className="flex-1 space-y-2">
            <textarea
              value={data.street1 || ''}
              onChange={e => onChange('street1', e.target.value)}
              placeholder="Street 1"
              rows={2}
              className="w-full px-3 py-1.5 text-[13px] rounded-lg outline-none resize-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
            <textarea
              value={data.street2 || ''}
              onChange={e => onChange('street2', e.target.value)}
              placeholder="Street 2"
              rows={2}
              className="w-full px-3 py-1.5 text-[13px] rounded-lg outline-none resize-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>
        </div>

        {/* City */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>City</label>
          {inp('city')}
        </div>

        {/* State */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>State</label>
          <div className="relative flex-1">
            <select
              value={data.state || ''}
              onChange={e => onChange('state', e.target.value)}
              className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', color: data.state ? '#111827' : '#9CA3AF' }}>
              <option value="">Select or type to add</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
          </div>
        </div>

        {/* Pin Code */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Pin Code</label>
          {inp('pinCode')}
        </div>

        {/* Phone */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Phone</label>
          <div className="flex gap-2 flex-1">
            <div className="relative">
              <select className="appearance-none pl-2 pr-6 py-1.5 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', width: '72px' }}>
                <option>+91</option>
              </select>
              <ChevronDown className="absolute right-1 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
            </div>
            {inp('phone')}
          </div>
        </div>

        {/* Fax */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Fax Number</label>
          {inp('fax')}
        </div>
      </div>
    </div>
  );
}

/* ─── Contact Persons Tab ─────────────────────────────────────────────────── */
const emptyContact = () => ({ salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '' });

function ContactPersonsTab({ contacts, onChange }: { contacts: any[]; onChange: (v: any[]) => void }) {
  const add = () => onChange([...contacts, emptyContact()]);
  const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));
  const set = (i: number, k: string, v: string) => {
    const next = contacts.map((c, idx) => idx === i ? { ...c, [k]: v } : c);
    onChange(next);
  };

  return (
    <div className="pt-2">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
            {['SALUTATION', 'FIRST NAME', 'LAST NAME', 'EMAIL ADDRESS', 'WORK PHONE', 'MOBILE', ''].map(h => (
              <th key={h} className="text-left pb-2 text-[11px] font-semibold tracking-wider px-2"
                style={{ color: '#9CA3AF' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {/* Salutation */}
              <td className="px-2 py-2 w-28">
                <div className="relative">
                  <select
                    value={c.salutation}
                    onChange={e => set(i, 'salutation', e.target.value)}
                    className="w-full appearance-none pl-2 pr-6 py-1.5 text-[13px] rounded-lg outline-none"
                    style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                    {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
              </td>
              {/* First Name */}
              <td className="px-2 py-2">
                <input value={c.firstName} onChange={e => set(i, 'firstName', e.target.value)}
                  className="w-full px-2 py-1.5 text-[13px] rounded-lg outline-none"
                  style={{ border: '1px solid #BFDBFE', background: '#FFFFFF' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#BFDBFE')} />
              </td>
              {/* Last Name */}
              <td className="px-2 py-2">
                <input value={c.lastName} onChange={e => set(i, 'lastName', e.target.value)}
                  className="w-full px-2 py-1.5 text-[13px] rounded-lg outline-none"
                  style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </td>
              {/* Email */}
              <td className="px-2 py-2">
                <input value={c.email} onChange={e => set(i, 'email', e.target.value)}
                  type="email"
                  className="w-full px-2 py-1.5 text-[13px] rounded-lg outline-none"
                  style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </td>
              {/* Work Phone */}
              <td className="px-2 py-2 w-40">
                <div className="flex gap-1">
                  <div className="relative shrink-0">
                    <select className="appearance-none pl-1.5 pr-5 py-1.5 text-[12px] rounded-lg outline-none"
                      style={{ border: '1px solid #E5E7EB', background: '#FAFAFA', width: '60px' }}>
                      <option>+91</option>
                    </select>
                    <ChevronDown className="absolute right-0.5 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                  <input value={c.workPhone} onChange={e => set(i, 'workPhone', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-[13px] rounded-lg outline-none min-w-0"
                    style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
                    onFocus={e => (e.target.style.borderColor = '#2563EB')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
              </td>
              {/* Mobile */}
              <td className="px-2 py-2 w-40">
                <div className="flex gap-1">
                  <div className="relative shrink-0">
                    <select className="appearance-none pl-1.5 pr-5 py-1.5 text-[12px] rounded-lg outline-none"
                      style={{ border: '1px solid #E5E7EB', background: '#FAFAFA', width: '60px' }}>
                      <option>+91</option>
                    </select>
                    <ChevronDown className="absolute right-0.5 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                  <input value={c.mobile} onChange={e => set(i, 'mobile', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-[13px] rounded-lg outline-none min-w-0"
                    style={{ border: '1px solid #E5E7EB', background: '#FAFAFA' }}
                    onFocus={e => (e.target.style.borderColor = '#2563EB')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
              </td>
              {/* Actions */}
              <td className="px-2 py-2 w-14">
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded hover:bg-gray-100 transition-colors">
                    <MoreHorizontal className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                  </button>
                  <button onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4" style={{ color: '#EF4444' }} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={add}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
        style={{ color: '#2563EB', border: '1.5px solid #BFDBFE', background: '#EFF6FF' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
        onMouseLeave={e => (e.currentTarget.style.background = '#EFF6FF')}>
        <Plus className="w-4 h-4" />
        Add Contact Person
      </button>
    </div>
  );
}

/* ─── Bank Details Tab ────────────────────────────────────────────────────── */
const emptyBank = () => ({ holderName: '', bankName: '', accountNo: '', reAccountNo: '', ifsc: '' });

function BankDetailsTab({ banks, onChange }: { banks: any[]; onChange: (v: any[]) => void }) {
  const [showTip, setShowTip] = useState(true);
  const [showAccount, setShowAccount] = useState<Record<number, boolean>>({});

  const add = () => onChange([...banks, emptyBank()]);
  const set = (i: number, k: string, v: string) => {
    onChange(banks.map((b, idx) => idx === i ? { ...b, [k]: v } : b));
  };

  const fld = (label: string, k: string, i: number, required = false, type = 'text', toggle = false) => (
    <div className="flex items-center gap-4 mb-4">
      <label className="w-52 text-right text-[13px] shrink-0" style={{ color: required ? '#DC2626' : '#374151' }}>
        {label}{required && ' *'}
      </label>
      <div className="relative flex-1 max-w-sm">
        <input
          type={toggle && !showAccount[i] ? 'password' : type}
          value={banks[i]?.[k] || ''}
          onChange={e => set(i, k, e.target.value)}
          className="w-full px-3 py-1.5 text-[13px] rounded-lg outline-none pr-8"
          style={{ border: `1.5px solid ${required ? '#BFDBFE' : '#E5E7EB'}`, background: '#FFFFFF' }}
          onFocus={e => (e.target.style.borderColor = '#2563EB')}
          onBlur={e => (e.target.style.borderColor = required ? '#BFDBFE' : '#E5E7EB')}
        />
        {toggle && (
          <button
            type="button"
            onClick={() => setShowAccount(prev => ({ ...prev, [i]: !prev[i] }))}
            className="absolute right-2.5 top-2 p-0.5">
            {showAccount[i]
              ? <EyeOff className="w-4 h-4" style={{ color: '#9CA3AF' }} />
              : <Eye className="w-4 h-4" style={{ color: '#9CA3AF' }} />}
          </button>
        )}
      </div>
    </div>
  );

  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Landmark className="w-10 h-10 mb-4" style={{ color: '#D1D5DB' }} />
        <p className="text-[14px] mb-3" style={{ color: '#6B7280' }}>
          Add your vendor's bank details and make payments.
        </p>
        <button
          onClick={add}
          className="text-[13px] font-semibold transition-colors"
          style={{ color: '#2563EB' }}>
          + Add Bank Account
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="flex gap-6">
        <div className="flex-1">
          {banks.map((b, i) => (
            <div key={i} className="mb-6">
              {i > 0 && <div className="mb-4" style={{ borderTop: '1px solid #E5E7EB' }} />}
              {fld('Account Holder Name', 'holderName', i)}
              {fld('Bank Name', 'bankName', i)}
              {fld('Account Number', 'accountNo', i, true, 'text', true)}
              {fld('Re-enter Account Number', 'reAccountNo', i, true)}
              {fld('IFSC', 'ifsc', i, true)}
            </div>
          ))}

          <button
            onClick={add}
            className="flex items-center gap-1.5 text-[13px] font-semibold mt-2"
            style={{ color: '#2563EB' }}>
            <Plus className="w-4 h-4" />
            Add New Bank
          </button>
        </div>

        {/* Tip card */}
        {showTip && (
          <div className="w-72 shrink-0 rounded-xl p-4 flex gap-3 self-start"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <span className="text-lg shrink-0">💡</span>
            <p className="text-[12px] leading-relaxed flex-1" style={{ color: '#92400E' }}>
              Initiate payments for your purchases directly from our system by integrating with one of our partner banks.{' '}
              <span className="font-semibold" style={{ color: '#2563EB', cursor: 'pointer' }}>Set Up Now</span>
            </p>
            <button onClick={() => setShowTip(false)} className="shrink-0 self-start">
              <X className="w-4 h-4" style={{ color: '#9CA3AF' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── New Vendor Form ─────────────────────────────────────────────────────── */
type VendorTab = 'other' | 'address' | 'contacts' | 'bank' | 'custom' | 'tags' | 'remarks';

const emptyVendorForm = () => ({
  salutation: '',
  firstName: '',
  lastName: '',
  companyName: '',
  displayName: '',
  email: '',
  workPhone: '',
  mobile: '',
  language: 'English',
  // Other Details
  pan: '',
  isMsme: false,
  currency: 'INR- Indian Rupee',
  // Tabs
  billing: { attention: '', country: '', street1: '', street2: '', city: '', state: '', pinCode: '', phone: '', fax: '' },
  shipping: { attention: '', country: '', street1: '', street2: '', city: '', state: '', pinCode: '', phone: '', fax: '' },
  contacts: [emptyContact()],
  banks: [],
  remarks: '',
});

function NewVendorForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: any) => void }) {
  const [form, setForm] = useState(emptyVendorForm());
  const [tab, setTab] = useState<VendorTab>('other');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const TABS: { key: VendorTab; label: string }[] = [
    { key: 'other',    label: 'Other Details' },
    { key: 'address',  label: 'Address' },
    { key: 'contacts', label: 'Contact Persons' },
    { key: 'bank',     label: 'Bank Details' },
    { key: 'custom',   label: 'Custom Fields' },
    { key: 'tags',     label: 'Reporting Tags' },
    { key: 'remarks',  label: 'Remarks' },
  ];

  const inp = (placeholder: string, k: string, type = 'text', required = false) => (
    <input
      type={type}
      value={(form as any)[k] || ''}
      onChange={e => set(k, e.target.value)}
      placeholder={placeholder}
      className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
      style={{ border: `1.5px solid ${required ? '#BFDBFE' : '#E5E7EB'}`, background: required ? '#FFFFFF' : '#FAFAFA' }}
      onFocus={e => (e.target.style.borderColor = '#2563EB')}
      onBlur={e => (e.target.style.borderColor = required ? '#BFDBFE' : '#E5E7EB')}
    />
  );

  const label = (text: string, required = false) => (
    <label className="w-40 text-right text-[13px] shrink-0 pt-2"
      style={{ color: required ? '#DC2626' : '#374151' }}>
      {text}{required && <span style={{ color: '#DC2626' }}>*</span>}
    </label>
  );

  const copyBilling = () => set('shipping', { ...form.billing });

  return (
    <div className="flex flex-col h-full" style={{ background: '#FFFFFF' }}>
      {/* Page header */}
      <div className="px-8 py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[22px] font-bold" style={{ color: '#111827' }}>New Vendor</h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">

        {/* GST banner */}
        <div className="flex items-center gap-3 py-3 px-4 mt-4 rounded-xl"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Download className="w-4 h-4 shrink-0" style={{ color: '#2563EB' }} />
          <p className="text-[13px]" style={{ color: '#1E40AF' }}>
            Prefill Vendor details from the GST portal using the Vendor's GSTIN.{' '}
            <span className="font-semibold underline cursor-pointer">Prefill ›</span>
          </p>
        </div>

        {/* Primary Contact */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            {label('Primary Contact')}
            <div className="flex gap-2 flex-1">
              {/* Salutation */}
              <div className="relative w-32">
                <select
                  value={form.salutation}
                  onChange={e => set('salutation', e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-[13px] rounded-lg outline-none"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', color: form.salutation ? '#111827' : '#9CA3AF' }}>
                  <option value="">Salutation</option>
                  {SALUTATIONS.filter(Boolean).map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
              </div>
              {/* First Name */}
              <input
                autoFocus
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                placeholder="First Name"
                className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#BFDBFE')}
              />
              {/* Last Name */}
              <input
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                placeholder="Last Name"
                className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="flex items-center gap-4">
            {label('Company Name')}
            {inp('', 'companyName')}
          </div>

          {/* Display Name */}
          <div className="flex items-center gap-4">
            {label('Display Name', true)}
            <div className="relative flex-1">
              <select
                value={form.displayName}
                onChange={e => set('displayName', e.target.value)}
                className="w-full appearance-none px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF', color: form.displayName ? '#111827' : '#9CA3AF' }}>
                <option value="">Select or type to add</option>
                {[form.firstName, form.lastName, form.companyName]
                  .filter(Boolean)
                  .map(n => <option key={n}>{n}</option>)}
                {form.firstName && form.lastName && (
                  <option>{form.firstName} {form.lastName}</option>
                )}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
            </div>
          </div>

          {/* Email Address */}
          <div className="flex items-center gap-4">
            {label('Email Address')}
            <div className="flex-1 flex items-center rounded-lg overflow-hidden"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
              <span className="px-3 py-2">
                <Mail className="w-4 h-4" style={{ color: '#9CA3AF' }} />
              </span>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="flex-1 py-2 pr-3 text-[13px] outline-none bg-transparent"
                style={{ color: '#111827' }}
                onFocus={e => { const p = e.target.closest('div') as HTMLElement; if (p) p.style.borderColor = '#2563EB'; }}
                onBlur={e => { const p = e.target.closest('div') as HTMLElement; if (p) p.style.borderColor = '#E5E7EB'; }}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-4">
            {label('Phone')}
            <div className="flex gap-3 flex-1">
              {/* Work Phone */}
              <div className="flex gap-1 flex-1">
                <div className="relative shrink-0">
                  <select className="appearance-none pl-2 pr-6 py-2 text-[13px] rounded-lg outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', width: '72px' }}>
                    <option>+91</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
                <input
                  value={form.workPhone}
                  onChange={e => set('workPhone', e.target.value)}
                  placeholder="Work Phone"
                  className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </div>
              {/* Mobile */}
              <div className="flex gap-1 flex-1">
                <div className="relative shrink-0">
                  <select className="appearance-none pl-2 pr-6 py-2 text-[13px] rounded-lg outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', width: '72px' }}>
                    <option>+91</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
                <input
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                  placeholder="Mobile"
                  className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </div>
            </div>
          </div>

          {/* Vendor Language */}
          <div className="flex items-center gap-4">
            {label('Vendor Language')}
            <div className="relative flex-1">
              <select
                value={form.language}
                onChange={e => set('language', e.target.value)}
                className="w-full appearance-none px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
                <option>English</option>
                <option>Hindi</option>
                <option>Tamil</option>
                <option>Telugu</option>
                <option>Kannada</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="mt-8" style={{ borderBottom: '2px solid #E5E7EB' }}>
          <div className="flex gap-0">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-5 py-3 text-[13px] font-medium transition-colors relative"
                style={{ color: tab === t.key ? '#111827' : '#6B7280' }}>
                {t.label}
                {tab === t.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#2563EB' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="pt-6">

          {/* Other Details */}
          {tab === 'other' && (
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-4">
                <label className="w-44 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>PAN</label>
                <input
                  value={form.pan}
                  onChange={e => set('pan', e.target.value)}
                  className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none"
                  style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-44 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>MSME Registered?</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => set('isMsme', !form.isMsme)}
                    className="w-4 h-4 rounded flex items-center justify-center transition-all"
                    style={{ background: form.isMsme ? '#2563EB' : 'white', border: `2px solid ${form.isMsme ? '#2563EB' : '#D1D5DB'}` }}>
                    {form.isMsme && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px]" style={{ color: '#374151' }}>This vendor is MSME registered</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-44 text-right text-[13px] shrink-0" style={{ color: '#374151' }}>Currency</label>
                <div className="relative flex-1">
                  <select
                    value={form.currency}
                    onChange={e => set('currency', e.target.value)}
                    className="w-full appearance-none px-3 py-2 text-[13px] rounded-lg outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
                    <option>INR- Indian Rupee</option>
                    <option>USD- US Dollar</option>
                    <option>EUR- Euro</option>
                    <option>GBP- British Pound</option>
                    <option>AED- UAE Dirham</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {tab === 'address' && (
            <div className="flex gap-10">
              <AddressBlock
                title="Billing Address"
                data={form.billing}
                onChange={(k, v) => set('billing', { ...form.billing, [k]: v })}
              />
              <div style={{ width: '1px', background: '#E5E7EB' }} />
              <AddressBlock
                title="Shipping Address"
                data={form.shipping}
                onChange={(k, v) => set('shipping', { ...form.shipping, [k]: v })}
                onCopy={copyBilling}
              />
            </div>
          )}

          {/* Contact Persons */}
          {tab === 'contacts' && (
            <ContactPersonsTab
              contacts={form.contacts}
              onChange={v => set('contacts', v)}
            />
          )}

          {/* Bank Details */}
          {tab === 'bank' && (
            <BankDetailsTab
              banks={form.banks}
              onChange={v => set('banks', v)}
            />
          )}

          {/* Custom Fields */}
          {tab === 'custom' && (
            <div className="flex items-center justify-center py-16">
              <p className="text-[13px] text-center max-w-md leading-relaxed" style={{ color: '#6B7280' }}>
                Start adding custom fields for your Customers and Vendors by going to{' '}
                <em>Settings → Preferences → Customers and Vendors</em>.{' '}
                You can also refine the address format of your Customers and Vendors from there.
              </p>
            </div>
          )}

          {/* Reporting Tags */}
          {tab === 'tags' && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-[13px]" style={{ color: '#6B7280' }}>
                You've not created any Reporting Tags.
              </p>
              <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
                Start creating reporting tags by going to{' '}
                <em>More Settings → Reporting Tags</em>
              </p>
            </div>
          )}

          {/* Remarks */}
          {tab === 'remarks' && (
            <div className="max-w-2xl">
              <label className="block text-[13px] font-medium mb-2">
                <span style={{ color: '#374151' }}>Remarks </span>
                <span style={{ color: '#9CA3AF' }}>(For Internal Use)</span>
              </label>
              <textarea
                rows={6}
                value={form.remarks}
                onChange={e => set('remarks', e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none resize-y"
                style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#BFDBFE')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="px-8 py-4 flex items-center gap-3"
        style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
        <button
          onClick={() => onSave(form)}
          className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
          style={{ background: '#16A34A' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
          onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#FFFFFF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Import Wizard ───────────────────────────────────────────────────────── */
type ImportStep = 1 | 2 | 3;
type DuplicateMode = 'skip' | 'overwrite' | 'add';

const VENDOR_FIELDS = [
  '— Do not import —',
  'Display Name', 'First Name', 'Last Name', 'Company Name',
  'Email', 'Work Phone', 'Mobile', 'Currency',
  'Payment Terms', 'GST Treatment', 'GSTIN',
  'PAN', 'Billing Address', 'Shipping Address',
  'Notes',
];

const SAMPLE_CSV_COLUMNS = [
  'Vendor Name', 'Company', 'Email', 'Phone', 'Mobile',
  'GST Number', 'PAN', 'Address', 'City', 'State', 'Pin Code',
];

function ImportVendorsWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ImportStep>(1);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dupMode, setDupMode] = useState<DuplicateMode>('skip');
  const [encoding, setEncoding] = useState('UTF-8 (Unicode)');
  const [showChooseMenu, setShowChooseMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  useOutsideClick(chooseRef, () => setShowChooseMenu(false));

  // Step 2: field mapping — maps CSV column → vendor field
  const [mapping, setMapping] = useState<Record<string, string>>(
    Object.fromEntries(SAMPLE_CSV_COLUMNS.map((col, i) => [col, VENDOR_FIELDS[i + 1] || '— Do not import —']))
  );

  const handleFile = (f: File) => { setFile(f); };

  const STEPS = [
    { n: 1, label: 'Configure' },
    { n: 2, label: 'Map Fields' },
    { n: 3, label: 'Preview' },
  ];

  /* ── Step progress bar ── */
  const StepBar = () => (
    <div className="flex items-center justify-center gap-0 mb-0">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-bold transition-colors"
              style={{
                background: step >= s.n ? '#2563EB' : '#F3F4F6',
                color: step >= s.n ? '#FFFFFF' : '#9CA3AF',
                border: step >= s.n ? 'none' : '2px solid #E5E7EB',
              }}>
              {s.n}
            </div>
            <span className="text-[12px] font-semibold mt-1"
              style={{ color: step === s.n ? '#111827' : '#9CA3AF' }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="w-24 h-[2px] mb-5 mx-2"
              style={{ background: step > s.n ? '#2563EB' : '#E5E7EB' }} />
          )}
        </div>
      ))}
    </div>
  );

  /* ── Step 1: Configure ── */
  const Step1 = () => (
    <div className="flex-1 overflow-y-auto px-10 py-6">
      {/* Drop zone */}
      <div
        className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-12 mb-6 transition-colors"
        style={{ borderColor: dragOver ? '#2563EB' : '#D1D5DB', background: dragOver ? '#EFF6FF' : '#FAFAFA' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: '#F3F4F6', border: '1.5px solid #E5E7EB' }}>
          <Download className="w-6 h-6" style={{ color: '#6B7280' }} />
        </div>
        {file
          ? <p className="text-[14px] font-semibold mb-3" style={{ color: '#111827' }}>📄 {file.name}</p>
          : <p className="text-[16px] font-semibold mb-4" style={{ color: '#111827' }}>Drag and drop file to import</p>
        }

        {/* Choose File split button */}
        <div className="relative flex" ref={chooseRef}>
          {/* Hidden file input — triggered programmatically */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.xls,.xlsx"
            className="hidden"
            onChange={e => {
              if (e.target.files?.[0]) { handleFile(e.target.files[0]); setShowChooseMenu(false); }
              // reset so same file can be re-selected
              e.target.value = '';
            }}
          />

          {/* Main "Choose File" button */}
          <button
            onMouseDown={e => e.preventDefault()} // prevent outside-click from firing
            onClick={() => { setShowChooseMenu(false); setTimeout(() => fileRef.current?.click(), 0); }}
            className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold text-white rounded-l-lg transition-colors"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            Choose File
          </button>

          {/* Chevron toggle */}
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowChooseMenu(v => !v)}
            className="flex items-center px-2 py-2 text-white rounded-r-lg transition-colors"
            style={{ background: '#16A34A', borderLeft: '1px solid #15803D' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Dropdown */}
          {showChooseMenu && (
            <div className="absolute top-[calc(100%+4px)] left-0 z-[80] rounded-xl shadow-2xl overflow-hidden w-52"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {[
                { label: 'Attach From Desktop', action: () => { setShowChooseMenu(false); setTimeout(() => fileRef.current?.click(), 50); } },
                { label: 'Attach From Cloud',   action: () => setShowChooseMenu(false) },
                { label: 'Attach From Documents', action: () => setShowChooseMenu(false) },
              ].map((opt, i) => (
                <button
                  key={opt.label}
                  onMouseDown={e => e.preventDefault()}
                  onClick={opt.action}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors"
                  style={{
                    color: i === 0 ? '#FFFFFF' : '#374151',
                    background: i === 0 ? '#2563EB' : 'transparent',
                  }}
                  onMouseEnter={e => { if (i !== 0) (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; }}
                  onMouseLeave={e => { if (i !== 0) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[12px] mt-4 text-center" style={{ color: '#9CA3AF' }}>
          Maximum File Size: 25 MB &nbsp;•&nbsp; File Format: CSV or TSV or XLS
        </p>
      </div>

      {/* Sample links */}
      <p className="text-[13px] mb-6" style={{ color: '#374151' }}>
        Download a{' '}
        <span className="font-semibold cursor-pointer" style={{ color: '#2563EB' }}>sample csv file</span>
        {' '}or{' '}
        <span className="font-semibold cursor-pointer" style={{ color: '#2563EB' }}>sample xls file</span>
        {' '}and compare it to your import file to ensure you have the file perfect for the import.
      </p>

      {/* Duplicate Handling */}
      <div className="flex gap-10 mb-6">
        <div className="w-48 shrink-0 pt-1">
          <span className="text-[13px] font-semibold" style={{ color: '#DC2626' }}>Duplicate Handling: *</span>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border ml-1 text-[10px] cursor-pointer"
            style={{ border: '1px solid #9CA3AF', color: '#9CA3AF' }}>?</span>
        </div>
        <div className="space-y-5">
          {([
            { key: 'skip', label: 'Skip Duplicates', desc: 'Retains the vendors and does not import the duplicates in the import file.' },
            { key: 'overwrite', label: 'Overwrite vendors', desc: 'Imports the duplicates in the import file and overwrites the existing vendors.' },
            { key: 'add', label: 'Add duplicates as new vendors', desc: 'Imports the duplicates in the import file and adds them as new vendors.' },
          ] as { key: DuplicateMode; label: string; desc: string }[]).map(opt => (
            <div key={opt.key} className="flex items-start gap-3 cursor-pointer" onClick={() => setDupMode(opt.key)}>
              <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                style={{ borderColor: dupMode === opt.key ? '#2563EB' : '#D1D5DB', background: dupMode === opt.key ? '#2563EB' : 'white' }}>
                {dupMode === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#111827' }}>{opt.label}</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#6B7280' }}>{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Character Encoding */}
      <div className="flex items-center gap-10 mb-8">
        <div className="w-48 shrink-0 text-right">
          <span className="text-[13px]" style={{ color: '#374151' }}>Character Encoding</span>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border ml-1 text-[10px] cursor-pointer"
            style={{ border: '1px solid #9CA3AF', color: '#9CA3AF' }}>?</span>
        </div>
        <div className="relative flex-1 max-w-sm">
          <select value={encoding} onChange={e => setEncoding(e.target.value)}
            className="w-full appearance-none px-4 py-2 text-[13px] rounded-lg outline-none"
            style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF' }}>
            <option>UTF-8 (Unicode)</option>
            <option>UTF-16</option>
            <option>ISO-8859-1 (Latin-1)</option>
            <option>Windows-1252</option>
          </select>
          <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
        </div>
      </div>

      {/* Page Tips */}
      <div className="rounded-xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <h4 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: '#111827' }}>
          💡 Page Tips
        </h4>
        <ul className="space-y-2">
          {[
            <span>Import data with the details of GST Treatment by referring these <span className="font-semibold cursor-pointer" style={{ color: '#2563EB' }}>accepted formats</span>.</span>,
            <span>You can download the <span className="font-semibold cursor-pointer" style={{ color: '#2563EB' }}>sample xls file</span> to get detailed information about the data fields used while importing.</span>,
            'If you have files in other formats, you can convert it to an accepted file format using any online/offline converter.',
            'You can configure your import settings and save them for future too!',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#374151' }}>
              <span className="mt-1 shrink-0">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  /* ── Step 2: Map Fields ── */
  const Step2 = () => (
    <div className="flex-1 overflow-y-auto px-10 py-6">
      <p className="text-[13px] mb-5" style={{ color: '#6B7280' }}>
        Match the columns from your file to the corresponding vendor fields. Unmapped columns will be ignored.
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                COLUMN FROM FILE
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                MAP TO VENDOR FIELD
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                SAMPLE DATA
              </th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_CSV_COLUMNS.map((col, i) => (
              <tr key={col} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                <td className="px-5 py-3 text-[13px] font-medium" style={{ color: '#111827' }}>{col}</td>
                <td className="px-5 py-3">
                  <div className="relative">
                    <select
                      value={mapping[col] || '— Do not import —'}
                      onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                      className="w-full appearance-none px-3 py-1.5 pr-7 text-[13px] rounded-lg outline-none"
                      style={{
                        border: '1.5px solid #E5E7EB',
                        background: mapping[col] === '— Do not import —' ? '#FAFAFA' : '#EFF6FF',
                        color: mapping[col] === '— Do not import —' ? '#9CA3AF' : '#2563EB',
                        fontWeight: mapping[col] === '— Do not import —' ? 400 : 600,
                      }}>
                      {VENDOR_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px]" style={{ color: '#9CA3AF' }}>
                  {['Ravi Farms', 'Green Harvest Pvt Ltd', 'ravi@example.com', '+91 9876543210', '+91 9123456789',
                    '29AABCU9603R1ZX', 'ABCDE1234F', '45 Market Road, Chennai', 'Chennai', 'Tamil Nadu', '600001'][i]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Step 3: Preview ── */
  const Step3 = () => {
    const previewData = [
      { name: 'Ravi Farms', company: 'Ravi Farms', email: 'ravi@example.com', phone: '+91 9876543210', gst: '29AABCU9603R1ZX', status: 'valid' },
      { name: 'Green Harvest Pvt Ltd', company: 'Green Harvest Pvt Ltd', email: 'info@greenharvest.com', phone: '+91 9123456789', gst: '27AABCG9876R1Z5', status: 'valid' },
      { name: 'Kumar Produce', company: 'Kumar Produce', email: 'kumar@produce.in', phone: '+91 9988776655', gst: '', status: 'warning' },
      { name: 'Fresh Agro Co.', company: 'Fresh Agro Co.', email: '', phone: '+91 8877665544', gst: '33AABCF5432R1Z9', status: 'error' },
    ];

    return (
      <div className="flex-1 overflow-y-auto px-10 py-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Records', value: '4', color: '#374151', bg: '#F9FAFB' },
            { label: 'Valid Records', value: '2', color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Records with Issues', value: '2', color: '#EF4444', bg: '#FEF2F2' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.bg === '#F9FAFB' ? '#E5E7EB' : s.color + '30'}` }}>
              <p className="text-[28px] font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-medium mt-0.5" style={{ color: '#6B7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Preview table */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th className="w-8 px-4 py-3" />
                {['VENDOR NAME', 'COMPANY', 'EMAIL', 'PHONE', 'GST NUMBER', 'STATUS'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#6B7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: '#9CA3AF' }}>{i + 1}</td>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: '#111827' }}>{row.name}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#6B7280' }}>{row.company}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: row.email ? '#6B7280' : '#FCA5A5' }}>
                    {row.email || <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#EF4444' }}>Missing</span>}
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#6B7280' }}>{row.phone}</td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#6B7280' }}>{row.gst || '—'}</td>
                  <td className="px-4 py-3">
                    {row.status === 'valid' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#F0FDF4', color: '#16A34A' }}>
                        <Check className="w-3 h-3" /> Valid
                      </span>
                    )}
                    {row.status === 'warning' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#FFFBEB', color: '#D97706' }}>
                        ⚠ Optional Missing
                      </span>
                    )}
                    {row.status === 'error' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#FEF2F2', color: '#EF4444' }}>
                        ✕ Required Missing
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[12px] mt-4" style={{ color: '#6B7280' }}>
          Only <strong>valid</strong> and <strong>warning</strong> records will be imported. Error records will be skipped.
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-10"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#FFFFFF', maxHeight: 'calc(100vh - 80px)' }}>

        {/* Modal Header */}
        <div className="flex items-start justify-between px-10 pt-7 pb-5"
          style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-center mb-5" style={{ color: '#111827' }}>
              Vendors - Select File
            </h2>
            <StepBar />
          </div>
          <button onClick={onClose} className="ml-4 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" style={{ color: '#EF4444' }} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ borderBottom: '1px solid #E5E7EB' }} />

        {/* Step content */}
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}

        {/* Footer */}
        <div className="flex items-center justify-between px-10 py-4"
          style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(s => (s - 1) as ImportStep)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
                style={{ border: '1.5px solid #E5E7EB', color: '#374151', background: '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
                ‹ Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{ border: '1.5px solid #E5E7EB', color: '#374151', background: '#FFFFFF' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
              Cancel
            </button>
            <button
              onClick={() => {
                if (step < 3) setStep(s => (s + 1) as ImportStep);
                else { onClose(); }
              }}
              className="flex items-center gap-1.5 px-6 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
              style={{ background: '#16A34A' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
              {step === 3 ? '✓ Import' : 'Next ›'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Vendors List Page ───────────────────────────────────────────────────── */
const VIEW_FILTERS: { key: VendorFilter; label: string }[] = [
  { key: 'All',      label: 'All' },
  { key: 'Active',   label: 'Active' },
  { key: 'Inactive', label: 'Inactive' },
];

export default function PurchaseVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // View filter
  const [viewFilter, setViewFilter] = useState<VendorFilter>('All');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(viewMenuRef, () => setShowViewMenu(false));
  const [starredFilters, setStarredFilters] = useState<Set<VendorFilter>>(new Set());
  const toggleStar = (k: VendorFilter) => setStarredFilters(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n;
  });

  // Kebab
  const [showKebab, setShowKebab] = useState(false);
  const [kebabSub, setKebabSub] = useState<'sort' | 'import' | 'export' | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);
  useOutsideClick(kebabRef, () => { setShowKebab(false); setKebabSub(null); });

  const handleSave = (v: any) => {
    setVendors(prev => [...prev, { ...v, id: crypto.randomUUID() }]);
    setShowForm(false);
  };

  if (showForm) {
    return <NewVendorForm onCancel={() => setShowForm(false)} onSave={handleSave} />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>

        {/* Left: All Vendors ▼ */}
        <div className="relative" ref={viewMenuRef}>
          <button
            onClick={() => setShowViewMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[15px] font-bold transition-colors"
            style={{ color: '#111827', background: showViewMenu ? '#F9FAFB' : 'transparent' }}>
            All Vendors
            {showViewMenu
              ? <ChevronUp className="w-4 h-4" style={{ color: '#2563EB' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: '#2563EB' }} />}
          </button>

          {showViewMenu && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-50 rounded-xl shadow-xl w-52 overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {VIEW_FILTERS.map(vf => (
                <button key={vf.key}
                  onClick={() => { setViewFilter(vf.key); setShowViewMenu(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors"
                  style={{
                    background: viewFilter === vf.key ? '#2563EB' : 'transparent',
                    color: viewFilter === vf.key ? '#FFFFFF' : '#374151',
                  }}
                  onMouseEnter={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <span>{vf.label}</span>
                  <Star className="w-4 h-4 cursor-pointer"
                    style={{ color: starredFilters.has(vf.key) ? '#FBBF24' : (viewFilter === vf.key ? 'rgba(255,255,255,0.5)' : '#D1D5DB') }}
                    fill={starredFilters.has(vf.key) ? '#FBBF24' : 'none'}
                    onClick={e => { e.stopPropagation(); toggleStar(vf.key); }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Import Vendors button */}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#2563EB' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
            <Upload className="w-4 h-4" />
            Import Vendors
          </button>

          {/* + New */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            <Plus className="w-4 h-4" /> New
          </button>

          {/* Kebab */}
          <div className="relative" ref={kebabRef}>
            <button
              onClick={() => { setShowKebab(v => !v); setKebabSub(null); }}
              className="p-2 rounded-lg transition-colors"
              style={{
                border: '1px solid #E5E7EB',
                background: showKebab ? '#EFF6FF' : '#FFFFFF',
                color: showKebab ? '#2563EB' : '#6B7280',
              }}>
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showKebab && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 flex"
                style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))' }}>

                {/* Import sub-panel */}
                {kebabSub === 'import' && (
                  <div className="rounded-xl overflow-hidden mr-1 w-44"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <button onClick={() => { setShowImport(true); setShowKebab(false); setKebabSub(null); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Upload className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Import Vendors
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Upload className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Import Contacts
                    </button>
                  </div>
                )}

                {/* Export sub-panel */}
                {kebabSub === 'export' && (
                  <div className="rounded-xl overflow-hidden mr-1 w-44"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Download className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Export Vendors
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Download className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Export Current View
                    </button>
                  </div>
                )}

                {/* Main menu */}
                <div className="rounded-xl overflow-hidden w-52"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                  {/* Sort by */}
                  <button
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151' }}>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                      Sort by
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>
                  <div style={{ borderTop: '1px solid #F3F4F6' }} />
                  {/* Import */}
                  <button
                    onClick={() => setKebabSub(v => v === 'import' ? null : 'import')}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors"
                    style={{ color: '#374151', background: kebabSub === 'import' ? '#EFF6FF' : 'transparent' }}
                    onMouseEnter={e => { if (kebabSub !== 'import') (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (kebabSub !== 'import') (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div className="flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" style={{ color: kebabSub === 'import' ? '#2563EB' : '#6B7280' }} />
                      <span style={{ color: kebabSub === 'import' ? '#2563EB' : '#374151', fontWeight: kebabSub === 'import' ? 600 : 400 }}>Import</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>
                  {/* Export */}
                  <button
                    onClick={() => setKebabSub(v => v === 'export' ? null : 'export')}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151', background: kebabSub === 'export' ? '#EFF6FF' : 'transparent' }}>
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                      <span style={{ color: kebabSub === 'export' ? '#2563EB' : '#374151' }}>Export</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>
                  <div style={{ borderTop: '1px solid #F3F4F6' }} />
                  {/* Preferences */}
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151' }}>
                    <Settings2 className="w-3.5 h-3.5" style={{ color: '#6B7280' }} /> Preferences
                  </button>
                  {/* Refresh */}
                  <button onClick={() => setShowKebab(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151' }}>
                    <RefreshCw className="w-3.5 h-3.5" style={{ color: '#6B7280' }} /> Refresh List
                  </button>
                  {/* Reset Column Width */}
                  <button onClick={() => setShowKebab(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151' }}>
                    <Maximize2 className="w-3.5 h-3.5" style={{ color: '#6B7280' }} /> Reset Column Width
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {vendors.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center pb-10 px-6">

          {/* Avatar with + badge */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: '#F3F4F6' }}>
              <Building2 className="w-12 h-12" style={{ color: '#9CA3AF' }} />
            </div>
            <div className="absolute bottom-1 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
              style={{ background: '#2563EB' }}>
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>

          <h2 className="text-[20px] font-bold mb-2" style={{ color: '#111827' }}>
            Every purchase starts with a vendor
          </h2>
          <p className="text-[14px] mb-7 text-center max-w-sm" style={{ color: '#6B7280' }}>
            Create and manage your vendors and their contact persons, all in one place.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: '#16A34A' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
              <Plus className="w-4 h-4" /> Create New Vendor
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={{ border: '1.5px solid #D1D5DB', color: '#374151', background: '#FFFFFF' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
              <Download className="w-4 h-4" /> Import File
            </button>
          </div>

          {/* Or import using */}
          <div className="flex items-center gap-2 mb-8">
            <span className="text-[12px]" style={{ color: '#9CA3AF' }}>- or -</span>
          </div>
          <div className="flex items-center gap-2 -mt-6">
            <span className="text-[13px]" style={{ color: '#6B7280' }}>Import using</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded font-bold" style={{ background: '#EFF6FF', color: '#2563EB' }}>G</span>
              <span className="text-[11px] px-2 py-0.5 rounded font-bold" style={{ background: '#FFF7ED', color: '#EA580C' }}>Z</span>
              <span className="text-[11px] px-2 py-0.5 rounded font-bold" style={{ background: '#F0FDF4', color: '#16A34A' }}>M</span>
            </div>
          </div>

          {/* Key Benefits card */}
          <div className="mt-8 rounded-2xl p-6 w-full max-w-2xl"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: '#111827' }}>
              🤝 Key Benefits
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Stay connected with multiple contact persons',
                'Provide portal access to vendors',
                'Handle multiple addresses effortlessly',
                'Create multi-currency transactions for contacts',
              ].map(b => (
                <div key={b} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
                  <span className="text-[13px]" style={{ color: '#374151' }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Vendor Dashboard (when vendors exist) ── */}
      {vendors.length > 0 && <VendorDashboard vendors={vendors} onNew={() => setShowForm(true)} onImport={() => setShowImport(true)} />}

      {/* Import Wizard */}
      {showImport && <ImportVendorsWizard onClose={() => setShowImport(false)} />}
    </div>
  );
}
