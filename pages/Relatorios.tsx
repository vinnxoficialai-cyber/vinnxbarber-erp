import React, { useState, useMemo } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Package,
    Crown, CalendarDays, ShoppingBag, Scissors, Star, Target, Activity,
    UserCheck, AlertCircle, ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
    Filter, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { TeamMember } from '../types';

interface RelatoriosProps {
    isDarkMode: boolean;
    currentUser: TeamMember | null;
}

type ReportTab = 'vendas' | 'clientes' | 'profissionais' | 'financeiro' | 'estoque' | 'assinaturas';

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'vendas', label: 'Vendas', icon: ShoppingBag },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'profissionais', label: 'Profissionais', icon: Star },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { key: 'estoque', label: 'Estoque', icon: Package },
    { key: 'assinaturas', label: 'Assinaturas', icon: Crown },
];

export const Relatorios: React.FC<RelatoriosProps> = ({ isDarkMode, currentUser }) => {
    const { clients, members, services, products, transactions, comandas } = useAppData();
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';

    const [activeTab, setActiveTab] = useState<ReportTab>('vendas');
    const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'month' | 'all'>('month');

    const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Date filtering
    const dateRange = useMemo(() => {
        const now = new Date();
        let from: Date | null = null;
        if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
        else if (period === '7d') from = new Date(now.getTime() - 7 * 86400000);
        else if (period === '30d') from = new Date(now.getTime() - 30 * 86400000);
        else if (period === '90d') from = new Date(now.getTime() - 90 * 86400000);
        return { from, now };
    }, [period]);

    const filterDate = (dateStr?: string) => {
        if (!dateRange.from || !dateStr) return true;
        return new Date(dateStr) >= dateRange.from;
    };

    // Previous period for comparison
    const prevRange = useMemo(() => {
        if (!dateRange.from) return { from: null, to: null };
        const diff = dateRange.now.getTime() - dateRange.from.getTime();
        return { from: new Date(dateRange.from.getTime() - diff), to: dateRange.from };
    }, [dateRange]);

    const filterPrevDate = (dateStr?: string) => {
        if (!prevRange.from || !prevRange.to || !dateStr) return false;
        const d = new Date(dateStr);
        return d >= prevRange.from && d < prevRange.to;
    };

    // ===================== VENDAS DATA =====================
    const vendasData = useMemo(() => {
        const closed = comandas.filter(c => c.status === 'closed');
        const current = closed.filter(c => filterDate(c.closedAt || c.openedAt));
        const prev = closed.filter(c => filterPrevDate(c.closedAt || c.openedAt));

        const totalRevenue = current.reduce((s, c) => s + c.finalAmount, 0);
        const prevRevenue = prev.reduce((s, c) => s + c.finalAmount, 0);
        const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const totalComandas = current.length;
        const prevComandas = prev.length;
        const comandasChange = prevComandas > 0 ? ((totalComandas - prevComandas) / prevComandas) * 100 : 0;

        const ticketMedio = totalComandas > 0 ? totalRevenue / totalComandas : 0;
        const prevTicket = prevComandas > 0 ? prevRevenue / prevComandas : 0;
        const ticketChange = prevTicket > 0 ? ((ticketMedio - prevTicket) / prevTicket) * 100 : 0;

        // Services vs Products breakdown
        const totalServices = current.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').reduce((x, i) => x + i.totalPrice, 0), 0);
        const totalProducts = current.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').reduce((x, i) => x + i.totalPrice, 0), 0);

        // Top services
        const svcMap = new Map<string, { name: string; count: number; revenue: number }>();
        current.forEach(c => (c.items || []).filter(i => i.type === 'service').forEach(i => {
            const e = svcMap.get(i.name) || { name: i.name, count: 0, revenue: 0 };
            e.count += i.quantity; e.revenue += i.totalPrice;
            svcMap.set(i.name, e);
        }));
        const topServices = [...svcMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        // Top products
        const prodMap = new Map<string, { name: string; count: number; revenue: number }>();
        current.forEach(c => (c.items || []).filter(i => i.type === 'product').forEach(i => {
            const e = prodMap.get(i.name) || { name: i.name, count: 0, revenue: 0 };
            e.count += i.quantity; e.revenue += i.totalPrice;
            prodMap.set(i.name, e);
        }));
        const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        return { totalRevenue, revenueChange, totalComandas, comandasChange, ticketMedio, ticketChange, totalServices, totalProducts, topServices, topProducts };
    }, [comandas, dateRange, prevRange]);

    // ===================== CLIENTES DATA =====================
    const clientesData = useMemo(() => {
        const total = clients.length;
        const active = clients.filter(c => c.status === 'Active').length;
        const inactive = clients.filter(c => c.status === 'Inactive').length;
        const leads = clients.filter(c => c.status === 'Lead').length;
        const churned = clients.filter(c => c.status === 'Churned').length;

        // Recent visitors (have comandas in period)
        const closed = comandas.filter(c => c.status === 'closed' && filterDate(c.closedAt || c.openedAt));
        const uniqueClients = new Set(closed.map(c => c.clientId).filter(Boolean)).size;

        // At risk: active clients with no comanda in period
        const clientsWithComanda = new Set(closed.map(c => c.clientId).filter(Boolean));
        const atRisk = clients.filter(c => c.status === 'Active' && !clientsWithComanda.has(c.id)).length;

        // New clients in period
        const newClients = clients.filter(c => filterDate(c.lastVisit)).length;

        // Top clients by revenue
        const revMap = new Map<string, { name: string; revenue: number; visits: number }>();
        closed.forEach(c => {
            if (!c.clientId) return;
            const cl = clients.find(x => x.id === c.clientId);
            const e = revMap.get(c.clientId) || { name: cl?.name || c.clientName || 'Desconhecido', revenue: 0, visits: 0 };
            e.revenue += c.finalAmount; e.visits++;
            revMap.set(c.clientId, e);
        });
        const topClients = [...revMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        return { total, active, inactive, leads, churned, uniqueClients, atRisk, newClients, topClients };
    }, [clients, comandas, dateRange]);

    // ===================== PROFISSIONAIS DATA =====================
    const profData = useMemo(() => {
        const activeMembers = members.filter(m => m.status === 'Active');
        const closed = comandas.filter(c => c.status === 'closed' && filterDate(c.closedAt || c.openedAt));

        const rankings = activeMembers.map(m => {
            const mc = closed.filter(c => c.barberId === m.id);
            const revenue = mc.reduce((s, c) => s + c.finalAmount, 0);
            const totalServices = mc.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').length, 0);
            const totalProducts = mc.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').length, 0);
            const uniqueClients = new Set(mc.map(c => c.clientId).filter(Boolean)).size;
            const ticket = mc.length > 0 ? revenue / mc.length : 0;
            const avgVisits = uniqueClients > 0 ? mc.length / uniqueClients : 0;
            return { id: m.id, name: m.name, role: m.role, revenue, totalServices, totalProducts, uniqueClients, comandas: mc.length, ticket, avgVisits };
        }).sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = rankings.reduce((s, r) => s + r.revenue, 0);
        return { rankings, totalRevenue };
    }, [members, comandas, dateRange]);

    // ===================== FINANCEIRO DATA =====================
    const finData = useMemo(() => {
        const currentTx = transactions.filter(t => filterDate(t.date || t.createdAt));
        const prevTx = transactions.filter(t => filterPrevDate(t.date || t.createdAt));

        const income = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = currentTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
        const balance = income - expense;

        const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
        const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;
        const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

        const pending = currentTx.filter(t => t.status === 'Pending').reduce((s, t) => s + Math.abs(t.amount), 0);
        const overdue = currentTx.filter(t => t.status === 'Overdue').reduce((s, t) => s + Math.abs(t.amount), 0);

        // By category
        const catMap = new Map<string, { cat: string; income: number; expense: number }>();
        currentTx.forEach(t => {
            const cat = t.category || 'Sem categoria';
            const e = catMap.get(cat) || { cat, income: 0, expense: 0 };
            if (t.type === 'income') e.income += t.amount;
            else e.expense += Math.abs(t.amount);
            catMap.set(cat, e);
        });
        const byCategory = [...catMap.values()].sort((a, b) => (b.income + b.expense) - (a.income + a.expense)).slice(0, 8);

        return { income, expense, balance, incomeChange, expenseChange, pending, overdue, byCategory };
    }, [transactions, dateRange, prevRange]);

    // ===================== ESTOQUE DATA =====================
    const estoqueData = useMemo(() => {
        const total = products.length;
        const lowStock = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;
        const outOfStock = products.filter(p => (p.stock ?? 0) <= 0).length;
        const totalValue = products.reduce((s, p) => s + (p.sellPrice * (p.stock ?? 0)), 0);

        // Most sold products in period
        const closed = comandas.filter(c => c.status === 'closed' && filterDate(c.closedAt || c.openedAt));
        const prodSales = new Map<string, { name: string; qty: number; revenue: number; stock: number }>();
        closed.forEach(c => (c.items || []).filter(i => i.type === 'product').forEach(i => {
            const prod = products.find(p => p.id === i.itemId);
            const e = prodSales.get(i.name) || { name: i.name, qty: 0, revenue: 0, stock: prod?.stock ?? 0 };
            e.qty += i.quantity; e.revenue += i.totalPrice;
            prodSales.set(i.name, e);
        }));
        const topSold = [...prodSales.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

        // Stock alerts
        const alerts = products.filter(p => (p.stock ?? 0) <= 5).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 10);

        return { total, lowStock, outOfStock, totalValue, topSold, alerts };
    }, [products, comandas, dateRange]);

    // ===================== ASSINATURAS DATA (subscriptions via context not available, use comandas) =====================
    // Note: subscription data is loaded locally in Assinaturas page via getSubscriptionPlans/getSubscriptions
    // For reports, we derive what we can from comandas + clients

    // ===================== RENDER HELPERS =====================
    const renderKpi = (label: string, value: string, change: number, icon: React.ElementType, color: string, bg: string) => {
        const Icon = icon;
        return (
            <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${bg}`}><Icon size={18} className={color} /></div>
                    {change !== 0 && (
                        <div className={`flex items-center gap-0.5 text-[11px] font-bold ${change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(change).toFixed(1)}%
                        </div>
                    )}
                    {change === 0 && <div className={`flex items-center text-[11px] font-bold ${textSub}`}><MinusIcon size={10} /></div>}
                </div>
                <p className={`text-2xl font-bold ${textMain} mb-0.5`}>{value}</p>
                <p className={`text-[10px] ${textSub}`}>{label}</p>
            </div>
        );
    };

    const renderRankBar = (pct: number, color: string) => (
        <div className="flex items-center gap-2 justify-end">
            <div className={`h-2 rounded-full flex-1 max-w-[80px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs ${textSub} w-10 text-right`}>{pct.toFixed(0)}%</span>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <BarChart3 size={24} className="text-primary" /> Relatórios
                    </h1>
                    <p className={`text-sm ${textSub}`}>Visão consolidada do desempenho do negócio</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <CalendarDays size={14} className={textSub} />
                    {(['month', '7d', '30d', '90d', 'all'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${period === p ? 'bg-primary text-white' : `${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}`}>
                            {p === 'month' ? 'Este Mês' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Tudo'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className={`flex gap-1 mb-6 overflow-x-auto pb-1`}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeTab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : `${isDarkMode ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}`}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB: VENDAS ═══ */}
            {activeTab === 'vendas' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Faturamento Total', formatCurrency(vendasData.totalRevenue), vendasData.revenueChange, DollarSign, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                        {renderKpi('Comandas Fechadas', vendasData.totalComandas.toString(), vendasData.comandasChange, ShoppingBag, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Ticket Médio', formatCurrency(vendasData.ticketMedio), vendasData.ticketChange, TrendingUp, 'text-violet-500', isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50')}
                        {renderKpi('Receita Serviços', formatCurrency(vendasData.totalServices), 0, Scissors, 'text-amber-500', isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50')}
                    </div>

                    {/* Services vs Products breakdown */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Activity size={16} className="text-primary" /> Serviços vs Produtos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { label: 'Serviços', value: vendasData.totalServices, color: 'bg-primary' },
                                { label: 'Produtos', value: vendasData.totalProducts, color: 'bg-amber-500' },
                            ].map((item, i) => {
                                const total = vendasData.totalServices + vendasData.totalProducts;
                                const pct = total > 0 ? (item.value / total) * 100 : 0;
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs ${textSub}`}>{item.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${textMain}`}>{formatCurrency(item.value)}</span>
                                                <span className={`text-[10px] ${textSub}`}>{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className={`h-3 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                            <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Services + Top Products side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Scissors size={16} className="text-primary" /> Top Serviços</h3>
                            <div className="space-y-2">
                                {vendasData.topServices.length === 0 && <p className={`text-xs ${textSub} text-center py-4`}>Sem dados no período.</p>}
                                {vendasData.topServices.map((s, i) => {
                                    const maxRev = vendasData.topServices[0]?.revenue || 1;
                                    return (
                                        <div key={i} className={`flex items-center gap-3 py-1.5 ${i > 0 ? `border-t ${borderCol}` : ''}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-medium ${textMain} truncate`}>{s.name}</p>
                                                <p className={`text-[10px] ${textSub}`}>{s.count} vendas</p>
                                            </div>
                                            <span className="text-xs font-bold text-emerald-500">{formatCurrency(s.revenue)}</span>
                                            <div className={`w-16 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Package size={16} className="text-amber-500" /> Top Produtos</h3>
                            <div className="space-y-2">
                                {vendasData.topProducts.length === 0 && <p className={`text-xs ${textSub} text-center py-4`}>Sem dados no período.</p>}
                                {vendasData.topProducts.map((p, i) => {
                                    const maxRev = vendasData.topProducts[0]?.revenue || 1;
                                    return (
                                        <div key={i} className={`flex items-center gap-3 py-1.5 ${i > 0 ? `border-t ${borderCol}` : ''}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-amber-500/10 text-amber-500' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-medium ${textMain} truncate`}>{p.name}</p>
                                                <p className={`text-[10px] ${textSub}`}>{p.count} vendas</p>
                                            </div>
                                            <span className="text-xs font-bold text-amber-500">{formatCurrency(p.revenue)}</span>
                                            <div className={`w-16 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: CLIENTES ═══ */}
            {activeTab === 'clientes' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Total de Clientes', clientesData.total.toString(), 0, Users, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Clientes Ativos', clientesData.active.toString(), 0, UserCheck, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                        {renderKpi('Visitaram no Período', clientesData.uniqueClients.toString(), 0, Activity, 'text-violet-500', isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50')}
                        {renderKpi('Em Risco (s/ visita)', clientesData.atRisk.toString(), 0, AlertCircle, 'text-red-500', isDarkMode ? 'bg-red-500/10' : 'bg-red-50')}
                    </div>

                    {/* Client status breakdown */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Users size={16} className="text-primary" /> Distribuição da Base</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Ativos', value: clientesData.active, color: 'bg-emerald-500', text: 'text-emerald-500' },
                                { label: 'Inativos', value: clientesData.inactive, color: 'bg-slate-500', text: textSub },
                                { label: 'Leads', value: clientesData.leads, color: 'bg-blue-500', text: 'text-blue-500' },
                                { label: 'Churned', value: clientesData.churned, color: 'bg-red-500', text: 'text-red-500' },
                            ].map((s, i) => {
                                const pct = clientesData.total > 0 ? (s.value / clientesData.total) * 100 : 0;
                                return (
                                    <div key={i} className="text-center">
                                        <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                                        <p className={`text-[10px] ${textSub} mb-2`}>{s.label} ({pct.toFixed(0)}%)</p>
                                        <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                            <div className={`h-full rounded-full ${s.color} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top clients by revenue */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Star size={16} className="text-amber-500" /> Top Clientes por Faturamento</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                    <th className="text-left py-2 px-3">Cliente</th>
                                    <th className="text-center py-2 px-3">Visitas</th>
                                    <th className="text-right py-2 px-3">Faturamento</th>
                                    <th className="text-right py-2 px-3 w-36">Participação</th>
                                </tr></thead>
                                <tbody>
                                    {clientesData.topClients.length === 0 && <tr><td colSpan={4} className={`text-xs ${textSub} text-center py-8`}>Sem dados no período.</td></tr>}
                                    {clientesData.topClients.map((c, i) => {
                                        const totalRev = clientesData.topClients.reduce((s, x) => s + x.revenue, 0);
                                        const pct = totalRev > 0 ? (c.revenue / totalRev) * 100 : 0;
                                        return (
                                            <tr key={i} className={`border-t ${borderCol}`}>
                                                <td className={`py-2.5 px-3 font-medium ${textMain}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-amber-500/10 text-amber-500' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                                        {c.name}
                                                    </div>
                                                </td>
                                                <td className={`py-2.5 px-3 text-center ${textMain}`}>{c.visits}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCurrency(c.revenue)}</td>
                                                <td className="py-2.5 px-3">{renderRankBar(pct, 'bg-amber-500')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: PROFISSIONAIS ═══ */}
            {activeTab === 'profissionais' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Faturamento Total', formatCurrency(profData.totalRevenue), 0, DollarSign, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                        {renderKpi('Profissionais Ativos', profData.rankings.length.toString(), 0, Users, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Ticket Médio Geral', formatCurrency(profData.rankings.length > 0 ? profData.totalRevenue / profData.rankings.reduce((s, r) => s + r.comandas, 0) : 0), 0, TrendingUp, 'text-violet-500', isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50')}
                        {renderKpi('Total Comandas', profData.rankings.reduce((s, r) => s + r.comandas, 0).toString(), 0, ShoppingBag, 'text-amber-500', isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50')}
                    </div>

                    {/* Professional ranking table */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                        <div className="p-5">
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Target size={16} className="text-primary" /> Ranking de Produtividade</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                    <th className="text-left py-2 px-5">Profissional</th>
                                    <th className="text-center py-2 px-3">Serviços</th>
                                    <th className="text-center py-2 px-3">Produtos</th>
                                    <th className="text-center py-2 px-3">Clientes</th>
                                    <th className="text-center py-2 px-3">Comandas</th>
                                    <th className="text-center py-2 px-3">Média Visitas</th>
                                    <th className="text-right py-2 px-3">Ticket</th>
                                    <th className="text-right py-2 px-3">Faturamento</th>
                                    <th className="text-right py-2 px-5 w-36">% Participação</th>
                                </tr></thead>
                                <tbody>
                                    {profData.rankings.length === 0 && <tr><td colSpan={9} className={`text-xs ${textSub} text-center py-8`}>Sem dados no período.</td></tr>}
                                    {profData.rankings.map((p, i) => {
                                        const pct = profData.totalRevenue > 0 ? (p.revenue / profData.totalRevenue) * 100 : 0;
                                        return (
                                            <tr key={p.id} className={`border-t ${borderCol}`}>
                                                <td className={`py-2.5 px-5 font-medium ${textMain}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                                        <div>
                                                            <p className="text-xs font-medium">{p.name}</p>
                                                            <p className={`text-[10px] ${textSub}`}>{p.role}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`py-2.5 px-3 text-center font-bold ${textMain}`}>{p.totalServices}</td>
                                                <td className={`py-2.5 px-3 text-center ${textMain}`}>{p.totalProducts}</td>
                                                <td className={`py-2.5 px-3 text-center ${textMain}`}>{p.uniqueClients}</td>
                                                <td className={`py-2.5 px-3 text-center ${textSub}`}>{p.comandas}</td>
                                                <td className={`py-2.5 px-3 text-center font-bold ${p.avgVisits >= 3 ? 'text-emerald-500' : p.avgVisits >= 1.5 ? 'text-amber-500' : textSub}`}>{p.avgVisits.toFixed(1)}</td>
                                                <td className={`py-2.5 px-3 text-right ${textMain}`}>{formatCurrency(p.ticket)}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCurrency(p.revenue)}</td>
                                                <td className="py-2.5 px-5">{renderRankBar(pct, 'bg-primary')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: FINANCEIRO ═══ */}
            {activeTab === 'financeiro' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Receitas', formatCurrency(finData.income), finData.incomeChange, TrendingUp, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                        {renderKpi('Despesas', formatCurrency(finData.expense), finData.expenseChange, TrendingDown, 'text-red-500', isDarkMode ? 'bg-red-500/10' : 'bg-red-50')}
                        {renderKpi('Saldo', formatCurrency(finData.balance), 0, DollarSign, finData.balance >= 0 ? 'text-emerald-500' : 'text-red-500', finData.balance >= 0 ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDarkMode ? 'bg-red-500/10' : 'bg-red-50'))}
                        {renderKpi('Pendente + Atrasado', formatCurrency(finData.pending + finData.overdue), 0, AlertCircle, 'text-orange-500', isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50')}
                    </div>

                    {/* Income vs Expense visual */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Activity size={16} className="text-primary" /> Receita vs Despesa</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Receitas', value: finData.income, color: 'bg-emerald-500', text: 'text-emerald-500' },
                                { label: 'Despesas', value: finData.expense, color: 'bg-red-500', text: 'text-red-500' },
                            ].map((item, i) => {
                                const max = Math.max(finData.income, finData.expense);
                                const pct = max > 0 ? (item.value / max) * 100 : 0;
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className={`text-xs ${textSub}`}>{item.label}</span>
                                            <span className={`text-xl font-bold ${item.text}`}>{formatCurrency(item.value)}</span>
                                        </div>
                                        <div className={`h-4 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                            <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className={`pt-3 border-t ${borderCol} flex justify-between items-center`}>
                                <span className={`text-xs font-bold ${textSub}`}>Resultado</span>
                                <span className={`text-xl font-bold ${finData.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {finData.balance >= 0 ? '+' : ''}{formatCurrency(finData.balance)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* By category */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Filter size={16} className="text-violet-500" /> Por Categoria</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                    <th className="text-left py-2 px-3">Categoria</th>
                                    <th className="text-right py-2 px-3">Receitas</th>
                                    <th className="text-right py-2 px-3">Despesas</th>
                                    <th className="text-right py-2 px-3">Saldo</th>
                                </tr></thead>
                                <tbody>
                                    {finData.byCategory.length === 0 && <tr><td colSpan={4} className={`text-xs ${textSub} text-center py-8`}>Sem dados no período.</td></tr>}
                                    {finData.byCategory.map((c, i) => (
                                        <tr key={i} className={`border-t ${borderCol}`}>
                                            <td className={`py-2.5 px-3 font-medium ${textMain}`}>{c.cat}</td>
                                            <td className="py-2.5 px-3 text-right text-emerald-500 font-bold">{c.income > 0 ? formatCurrency(c.income) : '-'}</td>
                                            <td className="py-2.5 px-3 text-right text-red-500 font-bold">{c.expense > 0 ? formatCurrency(c.expense) : '-'}</td>
                                            <td className={`py-2.5 px-3 text-right font-bold ${(c.income - c.expense) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {formatCurrency(c.income - c.expense)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: ESTOQUE ═══ */}
            {activeTab === 'estoque' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Total Produtos', estoqueData.total.toString(), 0, Package, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Estoque Baixo', estoqueData.lowStock.toString(), 0, AlertCircle, 'text-amber-500', isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50')}
                        {renderKpi('Esgotados', estoqueData.outOfStock.toString(), 0, XCircle, 'text-red-500', isDarkMode ? 'bg-red-500/10' : 'bg-red-50')}
                        {renderKpi('Valor em Estoque', formatCurrency(estoqueData.totalValue), 0, DollarSign, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Top selling products */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><TrendingUp size={16} className="text-emerald-500" /> Mais Vendidos</h3>
                            <div className="space-y-2">
                                {estoqueData.topSold.length === 0 && <p className={`text-xs ${textSub} text-center py-4`}>Sem vendas no período.</p>}
                                {estoqueData.topSold.map((p, i) => {
                                    const maxQty = estoqueData.topSold[0]?.qty || 1;
                                    return (
                                        <div key={i} className={`flex items-center gap-3 py-1.5 ${i > 0 ? `border-t ${borderCol}` : ''}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-emerald-500/10 text-emerald-500' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-medium ${textMain} truncate`}>{p.name}</p>
                                                <p className={`text-[10px] ${textSub}`}>{p.qty} unid. | {formatCurrency(p.revenue)}</p>
                                            </div>
                                            <div className={`w-16 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Stock alerts */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><AlertCircle size={16} className="text-red-500" /> Alertas de Estoque</h3>
                            <div className="space-y-2">
                                {estoqueData.alerts.length === 0 && <p className={`text-xs ${textSub} text-center py-4`}>Nenhum alerta.</p>}
                                {estoqueData.alerts.map((p, i) => (
                                    <div key={i} className={`flex items-center justify-between py-2 ${i > 0 ? `border-t ${borderCol}` : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${(p.stock ?? 0) <= 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                                            <span className={`text-xs font-medium ${textMain}`}>{p.name}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(p.stock ?? 0) <= 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {(p.stock ?? 0) <= 0 ? 'Esgotado' : `${p.stock} unid.`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: ASSINATURAS (summary from comandas) ═══ */}
            {activeTab === 'assinaturas' && (
                <div className="space-y-6">
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-8 ${shadowClass} text-center`}>
                        <Crown size={48} className={`mx-auto mb-4 ${textSub} opacity-30`} />
                        <h3 className={`text-lg font-bold ${textMain} mb-2`}>Dashboard de Assinaturas</h3>
                        <p className={`text-sm ${textSub} mb-4 max-w-md mx-auto`}>
                            O relatório completo de assinaturas com MRR, Churn, Retenção, LTV e KPIs enterprise está disponível
                            na página dedicada de <strong>Assinaturas → Dashboard</strong>.
                        </p>
                        <p className={`text-xs ${textSub}`}>
                            Acesse pelo menu lateral: <strong>Comercial → Assinaturas → aba Dashboard</strong>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
