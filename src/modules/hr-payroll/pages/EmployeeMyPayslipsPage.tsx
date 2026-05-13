// @ts-nocheck
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText, Download, Calendar, IndianRupee, User, Building,
    Briefcase, Clock, CheckCircle, ChevronRight, ArrowLeft,
    TrendingUp, TrendingDown, Wallet, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { downloadPayslipPDF } from '../utils/pdfGenerator';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PayslipData {
    id: string;
    month: number;
    year: number;
    employee_name: string;
    employee_id: string;
    department: string;
    designation?: string;
    basic_salary: number;
    increment: number;
    incentive: number;
    lop_days: number;
    lop_amount: number;
    tds: number;
    days_in_month: number;
    selected_days: number;
    net_pay: number;
    paid_at?: string;
    status: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function fmt(n: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(n);
}
function fmtFull(n: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: 2
    }).format(n);
}
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}
function getInitials(name?: string) {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Salary Breakdown Bar ────────────────────────────────────────────────────
const SEGMENTS = [
    { key: 'basic_salary', label: 'Basic Salary', color: '#2563EB' },
    { key: 'incentive',    label: 'Incentive',    color: '#16A34A' },
    { key: 'increment',    label: 'Increment',    color: '#D97706' },
    { key: '_deductions',  label: 'Deductions',   color: '#DC2626' },
];

function SalaryBreakdownBar({ payslip }: { payslip: PayslipData }) {
    const deductions = payslip.lop_amount + payslip.tds;
    const values: Record<string, number> = {
        basic_salary: payslip.basic_salary,
        incentive: payslip.incentive,
        increment: payslip.increment,
        _deductions: deductions,
    };
    const gross = payslip.basic_salary + payslip.incentive + payslip.increment;
    const total = gross + deductions;

    return (
        <div>
            {/* Top summary row */}
            <div className="flex flex-wrap gap-6 mb-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Total Pay</p>
                    <p className="text-2xl font-black" style={{ color: '#111827' }}>{fmtFull(payslip.net_pay)}</p>
                </div>
                {SEGMENTS.map(seg => {
                    const v = values[seg.key] || 0;
                    if (v === 0) return null;
                    return (
                        <div key={seg.key} className="flex items-start gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: seg.color }} />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{seg.label}</p>
                                <p className="text-sm font-bold" style={{ color: '#111827' }}>{fmt(v)}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Proportional color bar */}
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                {SEGMENTS.map(seg => {
                    const v = values[seg.key] || 0;
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                        <div key={seg.key} style={{ width: `${pct}%`, background: seg.color }} />
                    );
                })}
            </div>
        </div>
    );
}

// ─── Employee Profile Header ──────────────────────────────────────────────────
function EmployeeProfileHeader({ user, lastLogin }: { user: any; lastLogin?: string }) {
    const name = user?.name || 'Employee';
    const initials = getInitials(name);
    const colors = ['#EFF6FF', '#2563EB'];

    return (
        <div className="rounded-2xl p-5 flex items-center gap-5 mb-6"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #EFF6FF, #BFDBFE)', color: '#2563EB', border: '2px solid #BFDBFE' }}>
                {initials}
            </div>

            {/* Name & meta */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-black" style={{ color: '#111827' }}>{name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#DCFCE7', color: '#16A34A' }}>● Active</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#6B7280' }}>
                    {user?.employeeId && (
                        <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> #{user.employeeId}
                        </span>
                    )}
                    {user?.department && (
                        <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" /> {user.department}
                        </span>
                    )}
                    {user?.role && (
                        <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {user.role}
                        </span>
                    )}
                    {lastLogin && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last Login: {lastLogin}
                        </span>
                    )}
                </div>
            </div>

            {/* ID badge */}
            <div className="text-right shrink-0 hidden md:block">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Employee ID</p>
                <p className="text-sm font-black" style={{ color: '#111827' }}>#{user?.employeeId || '—'}</p>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmployeeMyPayslipsPage() {
    const { user } = useAuth();
    const [payslips, setPayslips] = useState<PayslipData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
    const [lastLogin, setLastLogin] = useState<string | undefined>();

    useEffect(() => { fetchMyPayslips(); }, [user]);
    useEffect(() => { fetchLastLogin(); }, [user]);

    async function fetchLastLogin() {
        if (!user?.id) return;
        try {
            const { data } = await supabase
                .from('day_start')
                .select('submitted_at')
                .eq('employee_id', user.id)
                .order('submitted_at', { ascending: false })
                .limit(2);
            if (data && data.length > 1) {
                setLastLogin(format(new Date(data[1].submitted_at), 'dd MMM yyyy, hh:mm a'));
            }
        } catch { /* ignore */ }
    }

    async function fetchMyPayslips() {
        if (!user) return;
        try {
            setLoading(true);
            const { data: batchEmployees, error } = await supabase
                .from('salary_batch_employees')
                .select(`
          id, batch_id, employee_name, department,
          basic_salary, increment, incentive,
          lop_days, lop_amount, tds,
          days_in_month, selected_days, net_pay, status,
          salary_batches!inner(month, year, from_day, to_day, status, paid_at)
        `)
                .or(`profile_id.eq.${user.id},employee_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (error) { toast.error('Failed to load payslips'); return; }

            const formatted: PayslipData[] = (batchEmployees || []).map((be: any) => {
                const batch = be.salary_batches;
                return {
                    id: be.id,
                    month: batch.month,
                    year: batch.year,
                    employee_name: be.employee_name || user.name || '',
                    employee_id: user.employeeId || '',
                    department: be.department || user.department || '',
                    designation: user.role || '',
                    basic_salary: be.basic_salary || 0,
                    increment: be.increment || 0,
                    incentive: be.incentive || 0,
                    lop_days: be.lop_days || 0,
                    lop_amount: be.lop_amount || 0,
                    tds: be.tds || 0,
                    days_in_month: getDaysInMonth(batch.year, batch.month),
                    selected_days: be.selected_days || getDaysInMonth(batch.year, batch.month),
                    net_pay: be.net_pay || 0,
                    paid_at: batch.paid_at,
                    status: be.status || batch.status || 'Draft',
                };
            }).filter((p: PayslipData) => ['Paid', 'PAID', 'Paid Already'].includes(p.status));

            setPayslips(formatted);
        } catch { toast.error('Failed to load payslips'); }
        finally { setLoading(false); }
    }

    function downloadPayslip(payslip: PayslipData, e?: React.MouseEvent) {
        e?.stopPropagation();
        try { downloadPayslipPDF(payslip); toast.success('Payslip downloaded'); }
        catch { toast.error('Failed to generate PDF'); }
    }

    // ── Payslip Detail View ────────────────────────────────────────────────
    if (selectedPayslip) {
        const p = selectedPayslip;
        const deductions = p.lop_amount + p.tds;
        const gross = p.basic_salary + p.incentive + p.increment;
        const paidDays = p.selected_days - p.lop_days;

        const payElements = [
            { label: 'Basic Salary',  category: 'Salary',    color: '#2563EB', catBg: '#EFF6FF', catText: '#2563EB', amount: p.basic_salary, type: 'earning' },
            { label: 'Incentive',     category: 'Incentive', color: '#16A34A', catBg: '#F0FDF4', catText: '#16A34A', amount: p.incentive,    type: 'earning' },
            { label: 'Increment',     category: 'Increment', color: '#D97706', catBg: '#FFFBEB', catText: '#D97706', amount: p.increment,    type: 'earning' },
            { label: 'TDS',           category: 'Tax',       color: '#DC2626', catBg: '#FEF2F2', catText: '#DC2626', amount: p.tds,          type: 'deduction' },
            { label: 'Loss of Pay',   category: 'LOP',       color: '#DC2626', catBg: '#FEF2F2', catText: '#DC2626', amount: p.lop_amount,   type: 'deduction', note: p.lop_days > 0 ? `${p.lop_days} days` : '' },
        ].filter(el => el.amount > 0);

        return (
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Back + Actions */}
                <div className="flex items-center justify-between mb-5">
                    <button onClick={() => setSelectedPayslip(null)}
                        className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition-colors"
                        style={{ color: '#6B7280' }}>
                        <ArrowLeft className="w-4 h-4" /> Back to Payslips
                    </button>
                    <Button onClick={() => downloadPayslip(p)} className="gap-2">
                        <Download className="w-4 h-4" /> Download PDF
                    </Button>
                </div>

                {/* Employee profile header */}
                <EmployeeProfileHeader user={user} lastLogin={lastLogin} />

                {/* Payroll summary card */}
                <div className="rounded-2xl p-6 mb-5"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                    {/* Period + tab bar */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Pay Period</p>
                            <p className="text-sm font-bold" style={{ color: '#374151' }}>
                                1 {MONTHS[p.month - 1].slice(0, 3)} {p.year} — {p.days_in_month} {MONTHS[p.month - 1].slice(0, 3)} {p.year}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                                <Clock className="w-3.5 h-3.5" />
                                Working days: <strong style={{ color: '#111827' }}>{p.days_in_month}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Paid days: <strong style={{ color: '#111827' }}>{paidDays}</strong>
                            </div>
                            {p.paid_at && (
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: '#DCFCE7', color: '#16A34A' }}>
                                    ✓ Paid {format(new Date(p.paid_at), 'dd MMM yyyy')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Breakdown bar */}
                    <SalaryBreakdownBar payslip={p} />
                </div>

                {/* Pay Element Totals table */}
                <div className="rounded-2xl overflow-hidden mb-5"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                    {/* Table header */}
                    <div className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" style={{ color: '#2563EB' }} />
                            <h3 className="text-sm font-bold" style={{ color: '#111827' }}>Pay Element Totals</h3>
                        </div>
                    </div>

                    {/* Column headers */}
                    <div className="grid px-5 py-2.5" style={{
                        gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
                        borderBottom: '1px solid #F3F4F6',
                        background: '#F9FAFB'
                    }}>
                        {['Pay Element', 'Category', 'Amount', 'Type'].map(col => (
                            <span key={col} className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{col}</span>
                        ))}
                    </div>

                    {/* Rows */}
                    {payElements.map((el, i) => (
                        <div key={el.label}
                            className="grid px-5 py-3.5 items-center transition-colors hover:bg-[#F9FAFB]"
                            style={{
                                gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
                                borderBottom: i < payElements.length - 1 ? '1px solid #F3F4F6' : 'none'
                            }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-1.5 h-5 rounded-full" style={{ background: el.color }} />
                                <span className="text-sm font-semibold" style={{ color: '#111827' }}>{el.label}</span>
                                {el.note && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{el.note}</span>}
                            </div>
                            <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: el.catBg, color: el.catText }}>
                                    {el.category}
                                </span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: el.type === 'deduction' ? '#DC2626' : '#111827' }}>
                                {el.type === 'deduction' ? '-' : ''}{fmtFull(el.amount)}
                            </span>
                            <div className="flex items-center gap-1">
                                {el.type === 'earning'
                                    ? <TrendingUp className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                                    : <TrendingDown className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />}
                                <span className="text-[10px] font-bold capitalize" style={{ color: el.type === 'earning' ? '#16A34A' : '#DC2626' }}>
                                    {el.type}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Totals footer */}
                    <div className="grid px-5 py-4 items-center rounded-b-2xl"
                        style={{
                            gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
                            background: '#F9FAFB',
                            borderTop: '2px solid #E5E7EB'
                        }}>
                        <span className="text-sm font-black" style={{ color: '#111827' }}>Gross Earnings</span>
                        <span />
                        <span className="text-sm font-black" style={{ color: '#16A34A' }}>{fmtFull(gross)}</span>
                        <span />
                    </div>
                </div>

                {/* Net Pay card */}
                <div className="rounded-2xl p-6 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ background: '#2563EB' }}>
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#2563EB' }}>Net Pay (Take Home)</p>
                            <p className="text-3xl font-black" style={{ color: '#1E3A8A' }}>{fmtFull(p.net_pay)}</p>
                        </div>
                    </div>
                    <div className="text-right hidden md:block">
                        <p className="text-xs" style={{ color: '#3B82F6' }}>
                            Gross <strong>{fmtFull(gross)}</strong> − Deductions <strong style={{ color: '#DC2626' }}>{fmtFull(deductions)}</strong>
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
                            {MONTHS[p.month - 1]} {p.year} • {paidDays}/{p.days_in_month} days paid
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Loading ────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-6">
                <EmployeeProfileHeader user={user} />
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-sm" style={{ color: '#6B7280' }}>Loading payslips…</span>
                </div>
            </div>
        );
    }

    // ── Payslip List View ─────────────────────────────────────────────────
    // Build chart data from payslips
    const chartData = [...payslips].reverse().slice(-6).map(p => ({
        name: `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`,
        'Net Pay': p.net_pay,
        'Basic': p.basic_salary,
    }));

    return (
        <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Profile header */}
            <EmployeeProfileHeader user={user} lastLogin={lastLogin} />

            {/* Page title row */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-xl font-black" style={{ color: '#111827' }}>My Payslips</h1>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                        {payslips.length} payslip{payslips.length !== 1 ? 's' : ''} available
                    </p>
                </div>
            </div>

            {payslips.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center py-20 rounded-2xl"
                    style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                        style={{ background: '#EFF6FF' }}>
                        <FileText className="w-8 h-8" style={{ color: '#93C5FD' }} />
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: '#374151' }}>No payslips yet</p>
                    <p className="text-sm text-center max-w-xs" style={{ color: '#9CA3AF' }}>
                        Your payslips will appear here once your salary has been processed and marked as paid.
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Salary trend chart */}
                    {chartData.length > 1 && (
                        <div className="rounded-2xl p-5"
                            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#9CA3AF' }}>
                                Salary Trend (last {chartData.length} months)
                            </p>
                            <div style={{ height: 120 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(v: any) => [fmtFull(v)]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                                        <Bar dataKey="Net Pay" fill="#2563EB" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Basic" fill="#BFDBFE" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Payslip cards */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {payslips.map((p) => {
                            const deductions = p.lop_amount + p.tds;
                            const gross = p.basic_salary + p.incentive + p.increment;
                            return (
                                <div key={p.id}
                                    onClick={() => setSelectedPayslip(p)}
                                    className="rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.10)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}>

                                    {/* Month + year header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-base font-black" style={{ color: '#111827' }}>
                                                {MONTHS[p.month - 1]} {p.year}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                                                {p.days_in_month} days • {p.selected_days - p.lop_days} paid
                                                {p.lop_days > 0 && ` • ${p.lop_days} LOP`}
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                            style={{ background: '#DCFCE7', color: '#16A34A' }}>✓ Paid</span>
                                    </div>

                                    {/* Mini breakdown bar */}
                                    <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-0.5">
                                        {[
                                            { v: p.basic_salary, c: '#2563EB' },
                                            { v: p.incentive, c: '#16A34A' },
                                            { v: p.increment, c: '#D97706' },
                                            { v: deductions, c: '#DC2626' },
                                        ].map((seg, i) => seg.v > 0 && (
                                            <div key={i} style={{ flex: seg.v, background: seg.c }} />
                                        ))}
                                    </div>

                                    {/* Key numbers */}
                                    <div className="space-y-1.5 mb-3">
                                        <div className="flex justify-between text-xs">
                                            <span style={{ color: '#6B7280' }}>Basic Salary</span>
                                            <span className="font-semibold" style={{ color: '#111827' }}>{fmt(p.basic_salary)}</span>
                                        </div>
                                        {p.incentive > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: '#6B7280' }}>Incentive</span>
                                                <span className="font-semibold" style={{ color: '#16A34A' }}>+{fmt(p.incentive)}</span>
                                            </div>
                                        )}
                                        {p.increment > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: '#6B7280' }}>Increment</span>
                                                <span className="font-semibold" style={{ color: '#D97706' }}>+{fmt(p.increment)}</span>
                                            </div>
                                        )}
                                        {deductions > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span style={{ color: '#6B7280' }}>Deductions</span>
                                                <span className="font-semibold" style={{ color: '#DC2626' }}>-{fmt(deductions)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-1.5" style={{ borderTop: '1px solid #F3F4F6' }}>
                                            <span className="text-xs font-bold" style={{ color: '#374151' }}>Net Pay</span>
                                            <span className="text-sm font-black" style={{ color: '#2563EB' }}>{fmt(p.net_pay)}</span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
                                        <button
                                            onClick={(e) => downloadPayslip(p, e)}
                                            className="flex items-center gap-1 text-[10px] font-bold transition-colors hover:text-primary"
                                            style={{ color: '#9CA3AF' }}>
                                            <Download className="w-3 h-3" /> Download
                                        </button>
                                        <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#2563EB' }}>
                                            View Details <ChevronRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
