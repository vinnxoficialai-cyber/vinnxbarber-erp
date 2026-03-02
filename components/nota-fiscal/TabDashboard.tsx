import React, { useState, useMemo } from 'react';
import {
    CheckCircle2, Clock, XCircle, DollarSign,
    TrendingUp, FileText, AlertTriangle, BarChart3,
    Percent, Landmark, Receipt, CreditCard, Calendar
} from 'lucide-react';
import { StatCard } from '../StatCard';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { Invoice, FiscalSettings } from '../../types';

interface TaxKpis {
    totalISS: number;
    totalPIS: number;
    totalCOFINS: number;
    totalTaxes: number;
    effectiveRate: number;
    taxPerService: { name: string; revenue: number; tax: number }[];
}

interface Props {
    invoices: Invoice[];
    kpis: {
        authorized: number;
        pending: number;
        rejected: number;
        totalFaturado: number;
        monthTotal: number;
        monthInvoices: number;
    };
    taxKpis: TaxKpis;
    isDarkMode: boolean;
    pendingComandas: number;
    pendingSubscriptions: number;
    settings: FiscalSettings | null;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PERIOD_OPTIONS: DropdownOption[] = [
    { value: 'month', label: 'Mês Atual' },
    { value: 'last_month', label: 'Mês Anterior' },
    { value: '3months', label: 'Últimos 3 meses' },
    { value: '6months', label: 'Últimos 6 meses' },
    { value: 'year', label: 'Este Ano' },
    { value: 'all', label: 'Todo Período' },
];

export default function TabDashboard({ invoices, kpis, taxKpis, isDarkMode, pendingComandas, pendingSubscriptions, settings }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';

    const [period, setPeriod] = useState('month');

    // Filter by period
    const filteredInvoices = useMemo(() => {
        const now = new Date();
        return invoices.filter(inv => {
            if (inv.status !== 'authorized') return false;
            const d = new Date(inv.createdAt);
            switch (period) {
                case 'month': return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                case 'last_month': {
                    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
                }
                case '3months': return d >= new Date(now.getFullYear(), now.getMonth() - 3, 1);
                case '6months': return d >= new Date(now.getFullYear(), now.getMonth() - 6, 1);
                case 'year': return d.getFullYear() === now.getFullYear();
                default: return true;
            }
        });
    }, [invoices, period]);

    // Period tax totals
    const periodTax = useMemo(() => {
        const iss = filteredInvoices.reduce((s, i) => s + (i.issTotal || 0), 0);
        const pis = filteredInvoices.reduce((s, i) => s + (i.pisTotal || 0), 0);
        const cofins = filteredInvoices.reduce((s, i) => s + (i.cofinsTotal || 0), 0);
        const total = iss + pis + cofins;
        const revenue = filteredInvoices.reduce((s, i) => s + i.totalAmount, 0);
        const rate = revenue > 0 ? (total / revenue) * 100 : 0;
        return { iss, pis, cofins, total, revenue, rate };
    }, [filteredInvoices]);

    // Monthly breakdown (last 6 months) with tax
    const monthlyData = useMemo(() => {
        const months: { label: string; total: number; count: number; iss: number; pis: number; cofins: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('pt-BR', { month: 'short' });
            const m = d.getMonth();
            const y = d.getFullYear();
            const monthInvs = invoices.filter(inv => {
                if (inv.status !== 'authorized') return false;
                const id = new Date(inv.createdAt);
                return id.getMonth() === m && id.getFullYear() === y;
            });
            const total = monthInvs.reduce((s, inv) => s + inv.totalAmount, 0);
            const iss = monthInvs.reduce((s, inv) => s + (inv.issTotal || 0), 0);
            const pis = monthInvs.reduce((s, inv) => s + (inv.pisTotal || 0), 0);
            const cofins = monthInvs.reduce((s, inv) => s + (inv.cofinsTotal || 0), 0);
            months.push({ label, total, count: monthInvs.length, iss, pis, cofins });
        }
        return months;
    }, [invoices]);

    const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1);
    const maxTaxMonthly = Math.max(...monthlyData.map(m => m.iss + m.pis + m.cofins), 1);

    // Last 5 invoices
    const recentInvoices = invoices.slice(0, 5);

    const STATUS_MAP: Record<string, { label: string; color: string }> = {
        draft: { label: 'Rascunho', color: 'text-slate-500' },
        queued: { label: 'Na Fila', color: 'text-blue-500' },
        processing: { label: 'Processando', color: 'text-amber-500' },
        authorized: { label: 'Autorizada', color: 'text-emerald-500' },
        rejected: { label: 'Rejeitada', color: 'text-red-500' },
        cancelled: { label: 'Cancelada', color: 'text-slate-400' },
    };

    return (
        <div className="space-y-6">
            {/* Period Filter */}
            <div className="flex items-center justify-between">
                <h2 className={`text-lg font-bold ${textMain} flex items-center gap-2`}>
                    <BarChart3 size={20} className="text-primary" /> Visão Geral Fiscal
                </h2>
                <CustomDropdown
                    value={period}
                    onChange={setPeriod}
                    options={PERIOD_OPTIONS}
                    isDarkMode={isDarkMode}
                    icon={<Calendar size={13} />}
                    className="min-w-[160px]"
                />
            </div>

            {/* KPI Cards — Row 1: Emission */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="NFs Emitidas" value={kpis.authorized.toString()}
                    Icon={CheckCircle2} bgIconColor="bg-emerald-50 dark:bg-emerald-500/10"
                    color="text-emerald-500" />
                <StatCard label="Faturado (Mês)" value={fmt(kpis.monthTotal)}
                    Icon={DollarSign} bgIconColor="bg-blue-50 dark:bg-blue-500/10"
                    color="text-blue-500"
                    subtitle={`${kpis.monthInvoices} notas no mês`} />
                <StatCard label="Pendentes" value={kpis.pending.toString()}
                    Icon={Clock} bgIconColor="bg-amber-50 dark:bg-amber-500/10"
                    color="text-amber-500" />
                <StatCard label="Total ISS" value={fmt(periodTax.iss)}
                    Icon={Landmark} bgIconColor="bg-violet-50 dark:bg-violet-500/10"
                    color="text-violet-500" />
                <StatCard label="PIS + COFINS" value={fmt(periodTax.pis + periodTax.cofins)}
                    Icon={Receipt} bgIconColor="bg-cyan-50 dark:bg-cyan-500/10"
                    color="text-cyan-500"
                    subtitle={`PIS: ${fmt(periodTax.pis)} · COF: ${fmt(periodTax.cofins)}`} />
                <StatCard label="Alíquota Efetiva" value={`${periodTax.rate.toFixed(1)}%`}
                    Icon={Percent} bgIconColor="bg-rose-50 dark:bg-rose-500/10"
                    color="text-rose-500"
                    subtitle={`${fmt(periodTax.total)} em tributos`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tributos Mensais — Stacked Bar Chart */}
                <div className={`${bgCard} border ${borderCol} rounded-xl p-5 shadow-sm`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                            <Landmark size={18} className="text-violet-500" /> Tributos por Mês
                        </h3>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className={`text-[10px] ${textSub}`}>ISS</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className={`text-[10px] ${textSub}`}>PIS</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className={`text-[10px] ${textSub}`}>COF</span></div>
                        </div>
                    </div>
                    <div className="flex items-end gap-3 h-40">
                        {monthlyData.map((m, i) => {
                            const totalTax = m.iss + m.pis + m.cofins;
                            const hPct = maxTaxMonthly > 0 ? (totalTax / maxTaxMonthly) * 100 : 4;
                            const issP = totalTax > 0 ? (m.iss / totalTax) * 100 : 33;
                            const pisP = totalTax > 0 ? (m.pis / totalTax) * 100 : 33;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                    <span className={`text-[10px] font-semibold ${textSub} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        {totalTax > 0 ? fmt(totalTax) : '-'}
                                    </span>
                                    <div className="w-full rounded-t-lg overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(hPct, 4)}%` }}>
                                        <div className="bg-emerald-500" style={{ height: `${issP}%` }} />
                                        <div className="bg-blue-500" style={{ height: `${pisP}%` }} />
                                        <div className="bg-amber-500" style={{ height: `${100 - issP - pisP}%` }} />
                                    </div>
                                    <span className={`text-[10px] font-medium ${textSub} uppercase`}>{m.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Custo Fiscal por Serviço */}
                <div className={`${bgCard} border ${borderCol} rounded-xl p-5 shadow-sm`}>
                    <h3 className={`font-semibold ${textMain} flex items-center gap-2 mb-4`}>
                        <TrendingUp size={18} className="text-primary" /> Custo Fiscal por Serviço
                    </h3>
                    {taxKpis.taxPerService.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Receipt size={48} className={`${textSub} opacity-20 mb-3`} />
                            <p className={`text-sm ${textSub}`}>Nenhum dado de tributo por serviço</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {taxKpis.taxPerService.map((svc, i) => {
                                const maxRev = taxKpis.taxPerService[0]?.revenue || 1;
                                const pct = (svc.revenue / maxRev) * 100;
                                const taxRate = svc.revenue > 0 ? (svc.tax / svc.revenue) * 100 : 0;
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-medium ${textMain} truncate max-w-[50%]`}>{svc.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs ${textSub}`}>{fmt(svc.revenue)}</span>
                                                <span className="text-xs font-bold text-violet-500">-{fmt(svc.tax)}</span>
                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50'} text-violet-500`}>
                                                    {taxRate.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                            <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Faturamento Mensal */}
                <div className={`${bgCard} border ${borderCol} rounded-xl p-5 shadow-sm`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                            <BarChart3 size={18} className="text-primary" /> Faturamento Mensal
                        </h3>
                        <span className={`text-xs ${textSub}`}>Últimos 6 meses</span>
                    </div>
                    <div className="flex items-end gap-3 h-40">
                        {monthlyData.map((m, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className={`text-[10px] font-semibold ${textSub}`}>
                                    {m.total > 0 ? fmt(m.total) : '-'}
                                </span>
                                <div className="w-full rounded-t-lg bg-primary/20 relative" style={{ height: `${Math.max((m.total / maxMonthly) * 100, 4)}%` }}>
                                    <div className="absolute inset-0 rounded-t-lg bg-primary" style={{ height: '100%', opacity: m.total > 0 ? 1 : 0.2 }} />
                                </div>
                                <span className={`text-[10px] font-medium ${textSub} uppercase`}>{m.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Últimas Notas */}
                <div className={`${bgCard} border ${borderCol} rounded-xl p-5 shadow-sm`}>
                    <h3 className={`font-semibold ${textMain} flex items-center gap-2 mb-4`}>
                        <FileText size={18} className="text-primary" /> Últimas Notas
                    </h3>
                    {recentInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <FileText size={48} className={`${textSub} opacity-20 mb-3`} />
                            <p className={`text-sm ${textSub}`}>Nenhuma nota fiscal emitida ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentInvoices.map(inv => {
                                const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                                return (
                                    <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${inv.status === 'authorized' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                <FileText size={14} className={st.color} />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${textMain}`}>
                                                    {inv.number ? `#${inv.number}` : inv.docType.toUpperCase()} — {inv.clientName}
                                                </p>
                                                <p className={`text-xs ${textSub}`}>
                                                    {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${textMain}`}>{fmt(inv.totalAmount)}</p>
                                            <p className={`text-xs font-semibold ${st.color}`}>{st.label}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Alerts */}
            {pendingComandas > 0 && (
                <div className={`${bgCard} border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-center gap-3`}>
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                        <AlertTriangle size={18} className="text-amber-500" />
                    </div>
                    <div>
                        <p className={`text-sm font-semibold ${textMain}`}>{pendingComandas} comandas fechadas sem nota fiscal</p>
                        <p className={`text-xs ${textSub}`}>Acesse a aba "Emissão" para gerar as notas pendentes</p>
                    </div>
                </div>
            )}

            {pendingSubscriptions > 0 && (
                <div className={`${bgCard} border border-violet-200 dark:border-violet-500/20 rounded-xl p-4 flex items-center gap-3`}>
                    <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-500/10">
                        <CreditCard size={18} className="text-violet-500" />
                    </div>
                    <div>
                        <p className={`text-sm font-semibold ${textMain}`}>{pendingSubscriptions} assinaturas pagas sem nota fiscal</p>
                        <p className={`text-xs ${textSub}`}>Acesse a aba "Emissão" → "Assinaturas" para gerar NFs</p>
                    </div>
                </div>
            )}
        </div>
    );
}
