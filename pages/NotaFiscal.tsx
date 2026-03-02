import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Receipt, History, Users, Settings, Plus,
    TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle,
    AlertTriangle, DollarSign, BarChart3, RefreshCw
} from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useSelectedUnit } from '../context/UnitContext';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import {
    Invoice, InvoiceEmitter, ProfessionalFiscalData,
    FiscalSettings, TeamMember, Subscription, SubscriptionPlan
} from '../types';
import {
    getInvoices, getEmitters, getProfessionalFiscalData,
    getFiscalSettings, saveInvoice, saveEmitter,
    saveProfessionalFiscalData, saveFiscalSettings,
    deleteInvoice
} from '../lib/dataService';

// Tab components
import TabDashboard from '../components/nota-fiscal/TabDashboard';
import TabEmissao from '../components/nota-fiscal/TabEmissao';
import TabHistorico from '../components/nota-fiscal/TabHistorico';
import TabEquipe from '../components/nota-fiscal/TabEquipe';
import TabConfiguracoes from '../components/nota-fiscal/TabConfiguracoes';

const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'emissao', label: 'Emissão', icon: Receipt },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'equipe', label: 'Equipe', icon: Users },
    { id: 'config', label: 'Configurações', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

interface NotaFiscalProps {
    isDarkMode: boolean;
    currentUser: TeamMember;
}

export default function NotaFiscal({ isDarkMode, currentUser }: NotaFiscalProps) {
    const { members, comandas, subscriptions, subscriptionPlans, services } = useAppData();
    const confirm = useConfirm();
    const toast = useToast();

    // Theme tokens (checklist)
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';

    // State
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [emitters, setEmitters] = useState<InvoiceEmitter[]>([]);
    const [fiscalData, setFiscalData] = useState<ProfessionalFiscalData[]>([]);
    const [settings, setSettings] = useState<FiscalSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Load data
    const loadData = async () => {
        setLoading(true);
        try {
            const [inv, emt, fd, fs] = await Promise.all([
                getInvoices(),
                getEmitters(),
                getProfessionalFiscalData(),
                getFiscalSettings(),
            ]);
            setInvoices(inv);
            setEmitters(emt);
            setFiscalData(fd);
            setSettings(fs);
        } catch (err) {
            console.error('Error loading fiscal data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ===================== KPIs =====================
    const kpis = useMemo(() => {
        const authorized = invoices.filter(i => i.status === 'authorized');
        const pending = invoices.filter(i => ['draft', 'queued', 'processing'].includes(i.status));
        const rejected = invoices.filter(i => i.status === 'rejected');
        const totalFaturado = authorized.reduce((s, i) => s + i.totalAmount, 0);
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthInvoices = authorized.filter(i => {
            const d = new Date(i.createdAt);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });
        const monthTotal = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
        return { authorized: authorized.length, pending: pending.length, rejected: rejected.length, totalFaturado, monthTotal, monthInvoices: monthInvoices.length };
    }, [invoices]);

    // ===================== TAX KPIs =====================
    const taxKpis = useMemo(() => {
        const authorized = invoices.filter(i => i.status === 'authorized');
        const totalISS = authorized.reduce((s, i) => s + (i.issTotal || 0), 0);
        const totalPIS = authorized.reduce((s, i) => s + (i.pisTotal || 0), 0);
        const totalCOFINS = authorized.reduce((s, i) => s + (i.cofinsTotal || 0), 0);
        const totalTaxes = totalISS + totalPIS + totalCOFINS;
        const totalRevenue = authorized.reduce((s, i) => s + i.totalAmount, 0);
        const effectiveRate = totalRevenue > 0 ? (totalTaxes / totalRevenue) * 100 : 0;

        // Tax per service — aggregate by item description
        const serviceMap = new Map<string, { name: string; revenue: number; tax: number }>();
        authorized.forEach(inv => {
            inv.items.filter(it => it.type === 'service').forEach(item => {
                const key = item.description;
                const existing = serviceMap.get(key) || { name: key, revenue: 0, tax: 0 };
                existing.revenue += item.totalPrice;
                existing.tax += item.totalPrice * ((item.issRate || 5) / 100);
                serviceMap.set(key, existing);
            });
        });
        const taxPerService = Array.from(serviceMap.values())
            .sort((a, b) => b.tax - a.tax)
            .slice(0, 5);

        return { totalISS, totalPIS, totalCOFINS, totalTaxes, effectiveRate, taxPerService };
    }, [invoices]);

    // ===================== SUBSCRIPTIONS WITHOUT NF =====================
    const pendingSubscriptions = useMemo(() => {
        const invoicedSubIds = new Set(
            invoices
                .filter(i => i.appointmentId && !i.comandaId)
                .map(i => i.appointmentId)
        );
        return (subscriptions || []).filter(s =>
            s.status === 'active' &&
            s.lastPaymentDate &&
            !invoicedSubIds.has(s.id)
        );
    }, [subscriptions, invoices]);

    // Closed comandas without NF
    const pendingComandas = useMemo(() => {
        const invoicedComandaIds = new Set(invoices.map(i => i.comandaId).filter(Boolean));
        return (comandas || []).filter(c =>
            c.status === 'closed' && !invoicedComandaIds.has(c.id)
        );
    }, [comandas, invoices]);

    // Barbers only
    const barbers = useMemo(() =>
        (members || []).filter(m => m.role === 'Barber' && m.status === 'Active'),
        [members]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Nota Fiscal</h1>
                    <p className={`text-sm ${textSub} mt-1`}>Emissão e gestão de documentos fiscais</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={loadData}
                        className={`p-2.5 rounded-xl border ${borderCol} ${textSub} hover:shadow-md transition-all`}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setActiveTab('emissao')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
                        <Plus size={16} /> Nova Emissão
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-slate-100'}`}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id
                            ? 'bg-primary text-white shadow-sm'
                            : `${textSub} hover:${textMain}`
                            }`}>
                        <tab.icon size={16} />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'dashboard' && (
                <TabDashboard
                    invoices={invoices} kpis={kpis} taxKpis={taxKpis}
                    isDarkMode={isDarkMode}
                    pendingComandas={pendingComandas.length}
                    pendingSubscriptions={pendingSubscriptions.length}
                    settings={settings}
                />
            )}
            {activeTab === 'emissao' && (
                <TabEmissao
                    invoices={invoices} emitters={emitters}
                    pendingComandas={pendingComandas} members={barbers}
                    pendingSubscriptions={pendingSubscriptions}
                    subscriptionPlans={subscriptionPlans || []}
                    isDarkMode={isDarkMode} onRefresh={loadData}
                    confirm={confirm} toast={toast}
                />
            )}
            {activeTab === 'historico' && (
                <TabHistorico
                    invoices={invoices} isDarkMode={isDarkMode}
                    members={barbers}
                    onRefresh={loadData} confirm={confirm} toast={toast}
                />
            )}
            {activeTab === 'equipe' && (
                <TabEquipe
                    barbers={barbers} fiscalData={fiscalData}
                    isDarkMode={isDarkMode} onRefresh={loadData}
                    confirm={confirm} toast={toast}
                />
            )}
            {activeTab === 'config' && (
                <TabConfiguracoes
                    emitters={emitters} settings={settings}
                    isDarkMode={isDarkMode} onRefresh={loadData} toast={toast}
                />
            )}
        </div>
    );
}
