import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, CheckCircle2, XCircle, AlertTriangle,
    TrendingUp, FileText, Shield, Key, Settings,
    ChevronRight, BarChart3, Receipt
} from 'lucide-react';
import { Unit, Invoice, InvoiceEmitter, FiscalSettings } from '../../types';
import { getInvoices, getEmitters, getFiscalSettings } from '../../lib/dataService';

interface Props {
    units: Unit[];
    isDarkMode: boolean;
    onNavigateConfig: (unitId: string) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface UnitFiscalData {
    unit: Unit;
    invoices: Invoice[];
    emitters: InvoiceEmitter[];
    settings: FiscalSettings | null;
    loading: boolean;
}

export default function PainelFiscal({ units, isDarkMode, onNavigateConfig }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';

    const [unitData, setUnitData] = useState<UnitFiscalData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAll() {
            setLoading(true);
            const results: UnitFiscalData[] = [];
            for (const unit of units.filter(u => u.status === 'active')) {
                try {
                    const [inv, emt, fs] = await Promise.all([
                        getInvoices(unit.id),
                        getEmitters(unit.id),
                        getFiscalSettings(unit.id),
                    ]);
                    results.push({ unit, invoices: inv, emitters: emt, settings: fs, loading: false });
                } catch {
                    results.push({ unit, invoices: [], emitters: [], settings: null, loading: false });
                }
            }
            setUnitData(results);
            setLoading(false);
        }
        loadAll();
    }, [units]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (unitData.length === 0) {
        return (
            <div className={`text-center py-16 ${textSub}`}>
                <Building2 size={48} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Nenhuma unidade ativa</p>
                <p className="text-sm mt-1">Cadastre unidades para usar o painel comparativo.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className={`text-lg font-bold ${textMain}`}>Painel Fiscal — Comparativo por Unidade</h2>
                <p className={`text-sm ${textSub} mt-1`}>Visão lado a lado de todas as unidades</p>
            </div>

            {/* Grid de unidades */}
            <div className={`grid gap-6 ${unitData.length === 1 ? 'grid-cols-1' : unitData.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                {unitData.map(({ unit, invoices, emitters, settings }) => {
                    const authorized = invoices.filter(i => i.status === 'authorized');
                    const pending = invoices.filter(i => ['draft', 'queued', 'processing'].includes(i.status));
                    const rejected = invoices.filter(i => i.status === 'rejected');
                    const totalFaturado = authorized.reduce((s, i) => s + i.totalAmount, 0);
                    const totalISS = authorized.reduce((s, i) => s + (i.issTotal || 0), 0);

                    // This month
                    const now = new Date();
                    const thisMonthInvoices = authorized.filter(i => {
                        const d = new Date(i.createdAt);
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    });
                    const monthTotal = thisMonthInvoices.reduce((s, i) => s + i.totalAmount, 0);

                    // Config status
                    const hasEmitter = emitters.some(e => e.type === 'company' && e.active);
                    const hasCert = emitters.some(e => e.certificateStatus === 'valid');
                    const hasApi = settings?.apiProvider && settings.apiProvider !== 'none' && settings.apiKey;

                    return (
                        <div key={unit.id} className={`${bgCard} rounded-2xl border ${borderCol} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
                            {/* Unit header */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                            <Building2 size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <h3 className={`font-bold ${textMain}`}>{unit.tradeName || unit.name}</h3>
                                            <p className={`text-xs ${textSub}`}>{unit.cnpj || 'CNPJ não cadastrado'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onNavigateConfig(unit.id)}
                                        className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${textSub}`}
                                        title="Configurar unidade"
                                    >
                                        <Settings size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Config status badges */}
                            <div className="px-5 py-3 flex gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800">
                                <StatusBadge ok={hasEmitter} label="Emitente" isDarkMode={isDarkMode} />
                                <StatusBadge ok={hasCert} label="Certificado" isDarkMode={isDarkMode} />
                                <StatusBadge ok={!!hasApi} label="API" isDarkMode={isDarkMode} />
                            </div>

                            {/* KPIs */}
                            <div className="p-5 space-y-4">
                                {/* Faturamento */}
                                <div className="grid grid-cols-2 gap-3">
                                    <KpiCard
                                        label="Total Faturado"
                                        value={fmt(totalFaturado)}
                                        icon={<TrendingUp size={14} />}
                                        color="text-emerald-500"
                                        isDarkMode={isDarkMode}
                                    />
                                    <KpiCard
                                        label="Este Mês"
                                        value={fmt(monthTotal)}
                                        icon={<BarChart3 size={14} />}
                                        color="text-blue-500"
                                        isDarkMode={isDarkMode}
                                    />
                                </div>

                                {/* Notas */}
                                <div className="grid grid-cols-3 gap-2">
                                    <MiniKpi label="Autorizadas" value={authorized.length} color="text-emerald-500" bgColor="bg-emerald-500/10" />
                                    <MiniKpi label="Pendentes" value={pending.length} color="text-amber-500" bgColor="bg-amber-500/10" />
                                    <MiniKpi label="Rejeitadas" value={rejected.length} color="text-red-500" bgColor="bg-red-500/10" />
                                </div>

                                {/* ISS */}
                                <div className={`flex items-center justify-between py-2 px-3 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                    <span className={`text-xs font-medium ${textSub}`}>ISS Total</span>
                                    <span className={`text-sm font-bold ${textMain}`}>{fmt(totalISS)}</span>
                                </div>

                                {/* Last emission */}
                                {authorized.length > 0 && (
                                    <div className={`text-xs ${textSub} flex items-center gap-1.5`}>
                                        <Receipt size={12} />
                                        Última: {new Date(authorized[0].createdAt).toLocaleDateString('pt-BR')}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Sub-components ───

function StatusBadge({ ok, label, isDarkMode }: { ok: boolean; label: string; isDarkMode: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            ok
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}>
            {ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            {label}
        </span>
    );
}

function KpiCard({ label, value, icon, color, isDarkMode }: {
    label: string; value: string; icon: React.ReactNode; color: string; isDarkMode: boolean;
}) {
    return (
        <div className={`rounded-xl p-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
                <span className={color}>{icon}</span>
                {label}
            </div>
            <div className={`text-sm font-bold ${isDarkMode ? 'text-slate-50' : 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

function MiniKpi({ label, value, color, bgColor }: { label: string; value: number; color: string; bgColor: string }) {
    return (
        <div className={`text-center rounded-lg py-2 ${bgColor}`}>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className={`text-[10px] font-medium ${color} opacity-80`}>{label}</div>
        </div>
    );
}
