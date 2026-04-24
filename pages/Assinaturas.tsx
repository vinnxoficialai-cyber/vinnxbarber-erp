import React, { useState, useMemo, useEffect } from 'react';
import {
    CreditCard, Plus, Pencil, Trash2, X, Search, DollarSign,
    Users, Calendar, Crown, TrendingUp, TrendingDown, Pause,
    XCircle, CheckCircle, AlertCircle, Loader2,
    Hash, Infinity, Percent, Star, Package, BarChart3,
    History, CalendarOff, Gift, UserPlus,
    EyeOff, Receipt, Repeat, UserX, Scissors, Eye,
    Link, Zap, Globe, ExternalLink, Landmark, Shield, Wallet, ArrowRight, Info, Filter,
    Target, Clock, Activity, ShoppingBag, UserCheck, Award, LayoutDashboard, CalendarDays
} from 'lucide-react';
import { SubscriptionPlan, Subscription, TeamMember, PlanServiceRule, PlanProductRule, Comanda, Transaction } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { CustomDropdown } from '../components/CustomDropdown';
import {
    saveSubscriptionPlan, deleteSubscriptionPlan, getSubscriptionPlans,
    saveSubscription, deleteSubscription, getSubscriptions,
    getBillingConfig, saveBillingConfig
} from '../lib/dataService';
import { testAsaasConnection } from '../lib/asaasService';
import type { BillingGatewayConfig } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';

interface AssinaturasProps { isDarkMode: boolean; currentUser: TeamMember; }
type PageTab = 'plans' | 'subscribers' | 'dashboard' | 'history' | 'integration';

const STATUS_CONFIG: Record<string, { label: string; color: string; darkColor: string; icon: React.ElementType }> = {
    active: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', darkColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
    paused: { label: 'Pausado', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', darkColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Pause },
    cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/20', darkColor: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
    overdue: { label: 'Inadimplente', color: 'bg-red-500/10 text-red-600 border-red-500/20', darkColor: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle },
};
const RECURRENCE_LABELS: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' };
const COMMISSION_TYPES: { value: string; label: string }[] = [
    { value: 'default', label: 'Padrão do serviço' }, { value: 'fixed', label: 'Valor fixo' },
    { value: 'percentage', label: 'Percentual' }, { value: 'time', label: 'Por tempo' },
];
const DAYS_WEEK = [
    { key: 0, label: 'Dom' }, { key: 1, label: 'Seg' }, { key: 2, label: 'Ter' },
    { key: 3, label: 'Qua' }, { key: 4, label: 'Qui' }, { key: 5, label: 'Sex' }, { key: 6, label: 'Sáb' },
];

// Dashboard goals (configuráveis)
const DASHBOARD_GOALS = { mrr: 5000, subscribers: 30, newSales: 10, freqAvg: 4.0, occupationRate: 80, revenueTotal: 8000 };

const defaultPlanForm = (): SubscriptionPlan => ({
    id: '', name: '', description: '', price: 0, servicesIncluded: [], maxUsesPerMonth: undefined,
    durationDays: 30, active: true, recurrence: 'monthly', availableForSale: true,
    creditEnabled: true, creditPrice: undefined, boletoEnabled: false, boletoPrice: undefined,
    benefits: [], planServices: [], planProducts: [], disabledDays: [], excludedProfessionals: [],
    unitScope: 'all', allowedUnitIds: [],
});

export const Assinaturas: React.FC<AssinaturasProps> = ({ isDarkMode, currentUser }) => {
    const { permissions: contextPermissions } = useAppData();
    const { filteredServices: services, filteredClients: clients, filteredMembers: members, filteredProducts: products, filteredTransactions: transactions, filteredComandas: comandas, selectedUnitId } = useFilteredData();
    const isUnitFiltering = selectedUnitId !== 'all';
    const { canCreate } = usePermissions(currentUser, contextPermissions);
    const confirm = useConfirm();
    const toast = useToast();
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';
    const inputCls = `w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`;
    const labelCls = `block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`;

    const [activeTab, setActiveTab] = useState<PageTab>('plans');
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [planForm, setPlanForm] = useState<SubscriptionPlan>(defaultPlanForm());
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const defaultSubForm = {
        planId: '', clientId: '', clientName: '', status: 'active' as Subscription['status'],
        startDate: new Date().toISOString().split('T')[0], paymentDay: 5,
        paymentMethod: '' as string, cardBrand: '', cardLast4: '', billingEmail: '',
        soldBy: '', soldByName: '', saleChannel: '', saleCommission: 0, saleCommissionType: 'percentage' as string,
        autoRenew: true, cancellationReason: '', notes: '',
    };
    const [subForm, setSubForm] = useState(defaultSubForm);
    const [subModalSection, setSubModalSection] = useState(0);
    const SUB_SECTIONS = ['Dados', 'Pagamento', 'Venda & Contrato'];
    const [newBenefit, setNewBenefit] = useState('');
    const [svcForm, setSvcForm] = useState<PlanServiceRule>({ serviceId: '', discount: 100, monthlyLimit: undefined, commissionType: 'default', customCommission: undefined });
    const [prodForm, setProdForm] = useState<PlanProductRule>({ productId: '', discount: 10, monthlyLimit: undefined, commission: undefined });
    const [planModalSection, setPlanModalSection] = useState(0);
    const barbers = useMemo(() => members.filter(m => m.status === 'Active'), [members]);
    // Plan subscribers modal
    const [planSubsModalPlanId, setPlanSubsModalPlanId] = useState<string | null>(null);
    const [planSubsSearch, setPlanSubsSearch] = useState('');
    // History filters
    const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
    const [historyPlanFilter, setHistoryPlanFilter] = useState<string>('all');
    const [historyMethodFilter, setHistoryMethodFilter] = useState<string>('all');
    // Dashboard date filter
    const [dashPeriod, setDashPeriod] = useState<'month' | '7d' | '30d' | '90d' | 'all'>('month');
    // Integration tab state
    const defaultBillingConfig: BillingGatewayConfig = {
        id: crypto.randomUUID(), provider: 'asaas', environment: 'sandbox',
        apiKey: '', active: false, autoCreateCustomer: true, autoCharge: true,
        sendNotifications: true, daysBeforeDue: 5, maxRetries: 3, finePercent: 2,
        interestPercent: 1, enableCredit: true, enableBoleto: true, enablePix: true,
    };
    const [integrationConfig, setIntegrationConfig] = useState<BillingGatewayConfig>(defaultBillingConfig);
    const [integrationTesting, setIntegrationTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => { (async () => { setLoading(true); try { const [p, s, bc] = await Promise.all([getSubscriptionPlans(), getSubscriptions(), getBillingConfig()]); setPlans(p); setSubscriptions(s); if (bc) setIntegrationConfig(bc); } finally { setLoading(false); } })(); }, []);
    const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Unit-filtered subscriptions (Decisão #8: filtro direto por unitId)
    const unitSubscriptions = useMemo(() =>
        isUnitFiltering ? subscriptions.filter(s => s.unitId === selectedUnitId || !s.unitId) : subscriptions,
        [subscriptions, selectedUnitId, isUnitFiltering]);

    // KPIs
    const kpis = useMemo(() => {
        const act = unitSubscriptions.filter(s => s.status === 'active');
        const mrr = act.reduce((s, sub) => s + (sub.plan?.price || 0), 0);
        const cancelled = unitSubscriptions.filter(s => s.status === 'cancelled').length;
        const paused = unitSubscriptions.filter(s => s.status === 'paused').length;
        const overdue = unitSubscriptions.filter(s => s.status === 'overdue').length;
        const churn = unitSubscriptions.length > 0 ? (cancelled / unitSubscriptions.length * 100) : 0;
        const avg = act.length > 0 ? mrr / act.length : 0;
        const totalRevenue = mrr * 12;
        const planDist = plans.map(p => {
            const subs = unitSubscriptions.filter(s => s.planId === p.id && s.status === 'active');
            const revenue = subs.length * p.price;
            return { name: p.name, count: subs.length, revenue, pct: mrr > 0 ? (revenue / mrr) * 100 : 0 };
        });
        const retentionRate = unitSubscriptions.length > 0 ? ((unitSubscriptions.length - cancelled) / unitSubscriptions.length * 100) : 100;
        const ltv = avg * 12 * (retentionRate / 100);

        // Date filter for dashboard
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let dateFrom: Date | null = null;
        if (dashPeriod === 'month') { dateFrom = new Date(now.getFullYear(), now.getMonth(), 1); }
        else if (dashPeriod === '7d') { dateFrom = new Date(now.getTime() - 7 * 86400000); }
        else if (dashPeriod === '30d') { dateFrom = new Date(now.getTime() - 30 * 86400000); }
        else if (dashPeriod === '90d') { dateFrom = new Date(now.getTime() - 90 * 86400000); }

        const filterByDate = (dateStr?: string) => {
            if (!dateFrom || !dateStr) return true;
            return new Date(dateStr) >= dateFrom;
        };

        // Enterprise metrics
        const newSales = unitSubscriptions.filter(s => filterByDate(s.createdAt)).length;
        const freqAvg = act.length > 0 ? act.reduce((s, sub) => s + sub.usesThisMonth, 0) / act.length : 0;

        // Client subscriber IDs
        const subscriberIds = new Set(act.map(s => s.clientId));

        // Comandas filtered by period
        const closedComandas = comandas.filter(c => c.status === 'closed' && filterByDate(c.closedAt || c.openedAt));
        const subComandas = closedComandas.filter(c => c.clientId && subscriberIds.has(c.clientId));
        const nonSubComandas = closedComandas.filter(c => c.clientId && !subscriberIds.has(c.clientId));
        const ticketSub = subComandas.length > 0 ? subComandas.reduce((s, c) => s + c.finalAmount, 0) / subComandas.length : 0;
        const ticketNonSub = nonSubComandas.length > 0 ? nonSubComandas.reduce((s, c) => s + c.finalAmount, 0) / nonSubComandas.length : 0;

        // Extras revenue (services/products from subscriber comandas)
        const extraServicesRevenue = subComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').reduce((x, i) => x + i.totalPrice, 0), 0);
        const extraProductsRevenue = subComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').reduce((x, i) => x + i.totalPrice, 0), 0);

        // Occupation rate: comandas / (active members x business days in period x estimated daily slots)
        const activeMembers = members.filter(m => m.status === 'Active').length;
        const daysInPeriod = dateFrom ? Math.max(1, Math.ceil((now.getTime() - dateFrom.getTime()) / 86400000)) : 30;
        const businessDays = Math.ceil(daysInPeriod * 5 / 7);
        const estimatedSlots = 8; // slots estimados por profissional/dia
        const totalCapacity = activeMembers * businessDays * estimatedSlots;
        const occupationRate = totalCapacity > 0 ? Math.min((closedComandas.length / totalCapacity) * 100, 100) : 0;
        const subOccupation = totalCapacity > 0 ? Math.min((subComandas.length / totalCapacity) * 100, 100) : 0;
        const nonSubOccupation = totalCapacity > 0 ? Math.min((nonSubComandas.length / totalCapacity) * 100, 100) : 0;

        // Top clients by visits
        const topVisits = [...act].sort((a, b) => b.usesThisMonth - a.usesThisMonth).slice(0, 10);
        // New subscribers filtered by period
        const newSubscribers = unitSubscriptions.filter(s => filterByDate(s.createdAt) && s.status === 'active').slice(0, 10);

        // Professional performance (filtered by period)
        const profPerf = members.filter(m => m.status === 'Active').map(m => {
            const mComandas = closedComandas.filter(c => c.barberId === m.id);
            const totalServices = mComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').length, 0);
            const totalProducts = mComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').length, 0);
            const totalRevenue = mComandas.reduce((s, c) => s + c.finalAmount, 0);
            const uniqueClients = new Set(mComandas.map(c => c.clientId).filter(Boolean)).size;
            const avgVisitsPerClient = uniqueClients > 0 ? mComandas.length / uniqueClients : 0;
            const extrasRevenue = mComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').reduce((x, i) => x + i.totalPrice, 0), 0);
            const extrasServiceRevenue = mComandas.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').reduce((x, i) => x + i.totalPrice, 0), 0);
            return { id: m.id, name: m.name, role: m.role, totalServices, totalProducts, totalRevenue, uniqueClients, avgVisitsPerClient, extrasRevenue, extrasServiceRevenue, comandasCount: mComandas.length };
        });
        const totalAllRevenue = profPerf.reduce((s, p) => s + p.totalRevenue, 0);

        return {
            mrr, active: act.length, cancelled, paused, overdue, churn, avg, totalRevenue, planDist, retentionRate, ltv,
            newSales, freqAvg, ticketSub, ticketNonSub, extraServicesRevenue, extraProductsRevenue,
            topVisits, newSubscribers, profPerf, totalAllRevenue,
            occupationRate, subOccupation, nonSubOccupation,
        };
    }, [unitSubscriptions, plans, comandas, members, dashPeriod]);
    const [dashSubTab, setDashSubTab] = useState<'visits' | 'extras' | 'products' | 'new'>('visits');
    const [profSubTab, setProfSubTab] = useState<'productivity' | 'sales'>('productivity');

    // Plan CRUD
    const openPlanModal = (plan?: SubscriptionPlan) => {
        if (plan) { setEditingPlanId(plan.id); setPlanForm({ ...plan }); }
        else { setEditingPlanId(null); setPlanForm(defaultPlanForm()); }
        setPlanModalSection(0); setIsPlanModalOpen(true);
    };
    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        const plan: SubscriptionPlan = { ...planForm, id: editingPlanId || crypto.randomUUID() };
        const r = await saveSubscriptionPlan(plan);
        if (!r.success) { toast.error('Erro', r.error || ''); return; }
        setPlans(await getSubscriptionPlans());
        toast.success(editingPlanId ? 'Plano atualizado' : 'Plano criado');
        setIsPlanModalOpen(false);
    };
    const handleDeletePlan = async (id: string) => {
        if (!await confirm({ title: 'Excluir Plano', message: 'Todos os assinantes serão desvinculados.', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return;
        const r = await deleteSubscriptionPlan(id);
        if (!r.success) { toast.error('Erro', r.error || ''); return; }
        setPlans(p => p.filter(x => x.id !== id)); toast.success('Plano excluído');
    };
    const addBenefit = () => { if (!newBenefit.trim()) return; setPlanForm(p => ({ ...p, benefits: [...p.benefits, newBenefit.trim()] })); setNewBenefit(''); };
    const removeBenefit = (i: number) => setPlanForm(p => ({ ...p, benefits: p.benefits.filter((_, idx) => idx !== i) }));
    const addServiceRule = () => {
        if (!svcForm.serviceId) return;
        setPlanForm(p => ({ ...p, planServices: [...p.planServices.filter(s => s.serviceId !== svcForm.serviceId), { ...svcForm }] }));
        setSvcForm({ serviceId: '', discount: 100, monthlyLimit: undefined, commissionType: 'default', customCommission: undefined });
    };
    const removeServiceRule = (sid: string) => setPlanForm(p => ({ ...p, planServices: p.planServices.filter(s => s.serviceId !== sid) }));
    const addProductRule = () => {
        if (!prodForm.productId) return;
        setPlanForm(p => ({ ...p, planProducts: [...p.planProducts.filter(x => x.productId !== prodForm.productId), { ...prodForm }] }));
        setProdForm({ productId: '', discount: 10, monthlyLimit: undefined, commission: undefined });
    };
    const removeProductRule = (pid: string) => setPlanForm(p => ({ ...p, planProducts: p.planProducts.filter(x => x.productId !== pid) }));
    const toggleDay = (d: number) => setPlanForm(p => ({ ...p, disabledDays: p.disabledDays.includes(d) ? p.disabledDays.filter(x => x !== d) : [...p.disabledDays, d] }));
    const toggleProf = (mid: string) => setPlanForm(p => ({ ...p, excludedProfessionals: p.excludedProfessionals.includes(mid) ? p.excludedProfessionals.filter(x => x !== mid) : [...p.excludedProfessionals, mid] }));

    // Sub CRUD
    const openSubModal = (sub?: Subscription) => {
        if (sub) {
            setEditingSubId(sub.id);
            setSubForm({
                planId: sub.planId, clientId: sub.clientId, clientName: sub.clientName || '',
                status: sub.status, startDate: sub.startDate?.split('T')[0] || '', paymentDay: sub.paymentDay,
                paymentMethod: sub.paymentMethod || '', cardBrand: sub.cardBrand || '', cardLast4: sub.cardLast4 || '',
                billingEmail: sub.billingEmail || '', soldBy: sub.soldBy || '', soldByName: sub.soldByName || '',
                saleChannel: sub.saleChannel || '', saleCommission: sub.saleCommission || 0,
                saleCommissionType: sub.saleCommissionType || 'percentage',
                autoRenew: sub.autoRenew ?? true, cancellationReason: sub.cancellationReason || '', notes: sub.notes || '',
            });
        } else { setEditingSubId(null); setSubForm({ ...defaultSubForm }); }
        setSubModalSection(0); setIsSubModalOpen(true);
    };
    // Open sub modal pre-selecting a plan from card
    const openSubModalForPlan = (planId: string) => {
        setEditingSubId(null);
        setSubForm({ ...defaultSubForm, planId });
        setSubModalSection(0); setIsSubModalOpen(true);
    };
    const handleSaveSub = async (e?: React.FormEvent) => {
        e?.preventDefault();

        // Errata E3: Validar unidade selecionada
        if (!editingSubId && (!selectedUnitId || selectedUnitId === 'all')) {
            toast.error('Selecione uma unidade', 'É necessário selecionar uma unidade específica para criar uma assinatura.');
            return;
        }

        // Decisão #4: Bloquear múltiplas ativas na mesma unidade
        if (!editingSubId) {
            const targetUnit = selectedUnitId !== 'all' ? selectedUnitId : undefined;
            const existing = subscriptions.find(s =>
                s.clientId === subForm.clientId &&
                s.status === 'active' &&
                s.unitId === targetUnit
            );
            if (existing) {
                toast.error('Assinatura existente', 'Este cliente já possui uma assinatura ativa nesta unidade.');
                return;
            }
        }

        const client = clients.find(c => c.id === subForm.clientId);
        const sub: Subscription = {
            id: editingSubId || crypto.randomUUID(),
            planId: subForm.planId, clientId: subForm.clientId,
            clientName: client?.name || subForm.clientName,
            status: subForm.status, startDate: subForm.startDate, paymentDay: subForm.paymentDay,
            usesThisMonth: 0,
            paymentMethod: (subForm.paymentMethod || undefined) as Subscription['paymentMethod'],
            cardBrand: subForm.cardBrand || undefined, cardLast4: subForm.cardLast4 || undefined,
            billingEmail: subForm.billingEmail || undefined,
            soldBy: subForm.soldBy || undefined, soldByName: subForm.soldByName || undefined,
            saleChannel: subForm.saleChannel || undefined,
            saleCommission: subForm.saleCommission || undefined,
            saleCommissionType: (subForm.saleCommissionType || undefined) as Subscription['saleCommissionType'],
            autoRenew: subForm.autoRenew, cancellationReason: subForm.cancellationReason || undefined,
            notes: subForm.notes || undefined,
            unitId: selectedUnitId !== 'all' ? selectedUnitId : undefined,
        };
        const r = await saveSubscription(sub);
        if (!r.success) { toast.error('Erro', r.error || ''); return; }
        setSubscriptions(await getSubscriptions());
        toast.success(editingSubId ? 'Assinatura atualizada' : 'Assinatura criada'); setIsSubModalOpen(false);
    };
    const handleDeleteSub = async (id: string) => {
        if (!await confirm({ title: 'Excluir Assinatura', message: 'Deseja excluir esta assinatura?', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return;
        const r = await deleteSubscription(id);
        if (!r.success) { toast.error('Erro', r.error || ''); return; }
        setSubscriptions(p => p.filter(s => s.id !== id)); toast.success('Assinatura excluída');
    };

    const PLAN_SECTIONS = ['Detalhes', 'Pagamento', 'Benefícios', 'Serviços', 'Produtos', 'Restrições'];
    const TABS: { key: PageTab; label: string; icon: React.ElementType }[] = [
        { key: 'plans', label: 'Planos', icon: Crown }, { key: 'subscribers', label: 'Assinantes', icon: Users },
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { key: 'history', label: 'Histórico', icon: History },
        { key: 'integration', label: 'Integração', icon: Link },
    ];

    /* ═══════ RENDER ═══════ */
    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-primary" />
        </div>
    );

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">
            {/* ═══ PLAN MODAL ═══ */}
            {isPlanModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>{editingPlanId ? 'Editar Plano' : 'Novo Plano'}</h3>
                            <button onClick={() => setIsPlanModalOpen(false)} className={textSub}><X size={20} /></button>
                        </div>
                        {/* Section tabs */}
                        <div className={`flex border-b ${borderCol} overflow-x-auto`}>
                            {PLAN_SECTIONS.map((s, i) => (
                                <button key={i} onClick={() => setPlanModalSection(i)}
                                    className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${planModalSection === i ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>{s}</button>
                            ))}
                        </div>
                        <form onSubmit={handleSavePlan} className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {/* Section 0: Detalhes */}
                            {planModalSection === 0 && (<>
                                <div>
                                    <label className={labelCls}><Crown size={12} /> Nome do Plano</label>
                                    <input type="text" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Ex: Clube VIP" required />
                                </div>
                                <div>
                                    <label className={labelCls}>Descrição</label>
                                    <textarea value={planForm.description || ''} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}><Repeat size={12} /> Recorrência</label>
                                        <CustomDropdown value={planForm.recurrence} onChange={v => setPlanForm(p => ({ ...p, recurrence: v as any }))} options={[{ value: 'monthly', label: 'Mensal' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'semiannual', label: 'Semestral' }, { value: 'annual', label: 'Anual' }]} isDarkMode={isDarkMode} />
                                    </div>
                                    <div>
                                        <label className={labelCls}><DollarSign size={12} /> Valor Base</label>
                                        <input type="number" value={planForm.price} onChange={e => setPlanForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className={inputCls} min="0" step="0.01" required />
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={planForm.active} onChange={e => setPlanForm(p => ({ ...p, active: e.target.checked }))} className="accent-primary w-4 h-4" />
                                        <span className={textMain}>Plano ativo</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={planForm.availableForSale} onChange={e => setPlanForm(p => ({ ...p, availableForSale: e.target.checked }))} className="accent-primary w-4 h-4" />
                                        <span className={textMain}>Disponível para venda</span>
                                    </label>
                                </div>
                            </>)}
                            {/* Section 1: Pagamento */}
                            {planModalSection === 1 && (<>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={planForm.creditEnabled} onChange={e => setPlanForm(p => ({ ...p, creditEnabled: e.target.checked }))} className="accent-primary w-4 h-4" />
                                        <CreditCard size={14} className="text-primary" /><span className={`font-medium ${textMain}`}>Cartão de Crédito</span>
                                    </label>
                                    {planForm.creditEnabled && (
                                        <div><label className={labelCls}><DollarSign size={12} /> Valor Crédito</label>
                                            <input type="number" value={planForm.creditPrice ?? planForm.price} onChange={e => setPlanForm(p => ({ ...p, creditPrice: parseFloat(e.target.value) || 0 }))} className={inputCls} min="0" step="0.01" /></div>
                                    )}
                                </div>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={planForm.boletoEnabled} onChange={e => setPlanForm(p => ({ ...p, boletoEnabled: e.target.checked }))} className="accent-primary w-4 h-4" />
                                        <Receipt size={14} className="text-amber-500" /><span className={`font-medium ${textMain}`}>Boleto Bancário</span>
                                    </label>
                                    {planForm.boletoEnabled && (
                                        <div><label className={labelCls}><DollarSign size={12} /> Valor Boleto</label>
                                            <input type="number" value={planForm.boletoPrice ?? planForm.price} onChange={e => setPlanForm(p => ({ ...p, boletoPrice: parseFloat(e.target.value) || 0 }))} className={inputCls} min="0" step="0.01" /></div>
                                    )}
                                </div>
                            </>)}
                            {/* Section 2: Benefícios */}
                            {planModalSection === 2 && (<>
                                <div className="flex gap-2">
                                    <input type="text" value={newBenefit} onChange={e => setNewBenefit(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                                        className={`flex-1 ${inputCls}`} placeholder='Ex: "1 corte por semana", "10% off em produtos"' />
                                    <button type="button" onClick={addBenefit} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-600"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-2">
                                    {planForm.benefits.map((b, i) => (
                                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${borderCol}`}>
                                            <div className="flex items-center gap-2"><Gift size={14} className="text-primary" /><span className={`text-sm ${textMain}`}>{b}</span></div>
                                            <button type="button" onClick={() => removeBenefit(i)} className="text-red-500 hover:text-red-400"><X size={14} /></button>
                                        </div>
                                    ))}
                                    {planForm.benefits.length === 0 && <p className={`text-xs ${textSub} text-center py-4`}>Nenhum benefício adicionado.</p>}
                                </div>
                            </>)}
                            {/* Section 3: Serviços */}
                            {planModalSection === 3 && (<>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <p className={`text-xs font-semibold ${textMain} uppercase`}>Adicionar Serviço</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}><Scissors size={12} /> Serviço</label>
                                            <CustomDropdown value={svcForm.serviceId} onChange={v => setSvcForm(p => ({ ...p, serviceId: v }))} options={[{ value: '', label: 'Selecionar...' }, ...services.filter(s => s.active && !planForm.planServices.some(ps => ps.serviceId === s.id)).map(s => ({ value: s.id, label: s.name }))]} isDarkMode={isDarkMode} />
                                        </div>
                                        <div>
                                            <label className={labelCls}><Percent size={12} /> Desconto (%)</label>
                                            <input type="number" value={svcForm.discount} onChange={e => setSvcForm(p => ({ ...p, discount: parseInt(e.target.value) || 0 }))} className={inputCls} min="0" max="100" />
                                        </div>
                                        <div>
                                            <label className={labelCls}><Hash size={12} /> Limite mensal</label>
                                            <input type="number" value={svcForm.monthlyLimit ?? ''} onChange={e => setSvcForm(p => ({ ...p, monthlyLimit: e.target.value ? parseInt(e.target.value) : undefined }))} className={inputCls} min="0" placeholder="Ilimitado" />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Tipo comissão</label>
                                            <CustomDropdown value={svcForm.commissionType} onChange={v => setSvcForm(p => ({ ...p, commissionType: v as any }))} options={COMMISSION_TYPES} isDarkMode={isDarkMode} />
                                        </div>
                                    </div>
                                    {svcForm.commissionType !== 'default' && (
                                        <div><label className={labelCls}>Comissão customizada</label>
                                            <input type="number" value={svcForm.customCommission ?? ''} onChange={e => setSvcForm(p => ({ ...p, customCommission: e.target.value ? parseFloat(e.target.value) : undefined }))} className={inputCls} min="0" step="0.01" /></div>
                                    )}
                                    <button type="button" onClick={addServiceRule} disabled={!svcForm.serviceId}
                                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${svcForm.serviceId ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30' : 'bg-slate-300/20 text-slate-400 cursor-not-allowed border border-transparent'}`}>
                                        <Plus size={14} className="inline mr-1" />Adicionar Serviço
                                    </button>
                                </div>
                                {planForm.planServices.length > 0 && (
                                    <div className={`rounded-lg border ${borderCol} overflow-hidden`}>
                                        <table className="w-full text-xs">
                                            <thead className={`${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                                <tr><th className="px-3 py-2 text-left">Serviço</th><th className="px-3 py-2">Desconto</th><th className="px-3 py-2">Limite</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2"></th></tr>
                                            </thead>
                                            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                                {planForm.planServices.map(ps => {
                                                    const svc = services.find(s => s.id === ps.serviceId); return (
                                                        <tr key={ps.serviceId}>
                                                            <td className={`px-3 py-2 ${textMain}`}>{svc?.name || '—'}</td>
                                                            <td className={`px-3 py-2 text-center ${ps.discount === 100 ? 'text-emerald-500 font-bold' : textSub}`}>{ps.discount}%</td>
                                                            <td className={`px-3 py-2 text-center ${textSub}`}>{ps.monthlyLimit ?? '∞'}</td>
                                                            <td className={`px-3 py-2 text-center ${textSub}`}>{ps.commissionType !== 'default' ? `${ps.customCommission ?? '—'} (${ps.commissionType})` : 'Padrão'}</td>
                                                            <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeServiceRule(ps.serviceId)} className="text-red-500 hover:text-red-400"><Trash2 size={12} /></button></td>
                                                        </tr>);
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>)}
                            {/* Section 4: Produtos */}
                            {planModalSection === 4 && (<>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <p className={`text-xs font-semibold ${textMain} uppercase`}>Adicionar Produto</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}><Package size={12} /> Produto</label>
                                            <CustomDropdown value={prodForm.productId} onChange={v => setProdForm(p => ({ ...p, productId: v }))} options={[{ value: '', label: 'Selecionar...' }, ...products.filter(p => p.active && !planForm.planProducts.some(pp => pp.productId === p.id)).map(p => ({ value: p.id, label: p.name }))]} isDarkMode={isDarkMode} />
                                        </div>
                                        <div>
                                            <label className={labelCls}><Percent size={12} /> Desconto (%)</label>
                                            <input type="number" value={prodForm.discount} onChange={e => setProdForm(p => ({ ...p, discount: parseInt(e.target.value) || 0 }))} className={inputCls} min="0" max="100" />
                                        </div>
                                        <div>
                                            <label className={labelCls}><Hash size={12} /> Limite mensal</label>
                                            <input type="number" value={prodForm.monthlyLimit ?? ''} onChange={e => setProdForm(p => ({ ...p, monthlyLimit: e.target.value ? parseInt(e.target.value) : undefined }))} className={inputCls} min="0" placeholder="Ilimitado" />
                                        </div>
                                        <div>
                                            <label className={labelCls}><Percent size={12} /> Comissão (%)</label>
                                            <input type="number" value={prodForm.commission ?? ''} onChange={e => setProdForm(p => ({ ...p, commission: e.target.value ? parseFloat(e.target.value) : undefined }))} className={inputCls} min="0" max="100" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={addProductRule} disabled={!prodForm.productId}
                                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${prodForm.productId ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30' : 'bg-slate-300/20 text-slate-400 cursor-not-allowed border border-transparent'}`}>
                                        <Plus size={14} className="inline mr-1" />Adicionar Produto
                                    </button>
                                </div>
                                {planForm.planProducts.length > 0 && (
                                    <div className={`rounded-lg border ${borderCol} overflow-hidden`}>
                                        <table className="w-full text-xs">
                                            <thead className={`${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                                <tr><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2">Desconto</th><th className="px-3 py-2">Qtd/mês</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2"></th></tr>
                                            </thead>
                                            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                                {planForm.planProducts.map(pp => {
                                                    const prod = products.find(p => p.id === pp.productId); return (
                                                        <tr key={pp.productId}>
                                                            <td className={`px-3 py-2 ${textMain}`}>{prod?.name || '—'}</td>
                                                            <td className={`px-3 py-2 text-center ${textSub}`}>{pp.discount}%</td>
                                                            <td className={`px-3 py-2 text-center ${textSub}`}>{pp.monthlyLimit ?? '∞'}</td>
                                                            <td className={`px-3 py-2 text-center ${textSub}`}>{pp.commission != null ? `${pp.commission}%` : 'Padrão'}</td>
                                                            <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeProductRule(pp.productId)} className="text-red-500 hover:text-red-400"><Trash2 size={12} /></button></td>
                                                        </tr>);
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>)}
                            {/* Section 5: Restrições (Days+Professionals) */}
                            {planModalSection === 5 && (<>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <p className={`text-xs font-semibold ${textMain} uppercase flex items-center gap-1`}><CalendarOff size={12} /> Dias Desabilitados</p>
                                    <p className={`text-[11px] ${textSub}`}>Dias em que o plano NÃO pode ser utilizado.</p>
                                    <div className="flex gap-2">
                                        {DAYS_WEEK.map(d => (
                                            <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all border ${planForm.disabledDays.includes(d.key)
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/30 ring-1 ring-red-500/20'
                                                    : `${isDarkMode ? 'border-dark-border text-slate-400' : 'border-slate-300 text-slate-500'} hover:border-primary`}`}>{d.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <p className={`text-xs font-semibold ${textMain} uppercase flex items-center gap-1`}><UserX size={12} /> Profissionais Excluídos</p>
                                    <p className={`text-[11px] ${textSub}`}>Profissionais que NÃO atendem clientes deste plano.</p>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                        {barbers.map(b => (
                                            <label key={b.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${planForm.excludedProfessionals.includes(b.id) ? 'bg-red-500/5 border border-red-500/20' : `border ${borderCol} hover:border-primary/30`}`}>
                                                <input type="checkbox" checked={planForm.excludedProfessionals.includes(b.id)} onChange={() => toggleProf(b.id)} className="accent-red-500 w-4 h-4" />
                                                <span className={`text-sm ${planForm.excludedProfessionals.includes(b.id) ? 'text-red-500 line-through' : textMain}`}>{b.name}</span>
                                                <span className={`text-[10px] ml-auto ${textSub}`}>{b.role === 'Barber' ? 'Barbeiro' : b.role}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>)}
                        </form>
                        {/* Footer pinned to bottom */}
                        <div className={`p-5 border-t ${borderCol} mt-auto flex gap-3 shrink-0`}>
                            {planModalSection > 0 && <button type="button" onClick={() => setPlanModalSection(s => s - 1)} className={`px-6 py-3 rounded-lg border ${borderCol} font-semibold text-sm ${textMain}`}>Anterior</button>}
                            {planModalSection < PLAN_SECTIONS.length - 1
                                ? <button type="button" onClick={() => setPlanModalSection(s => s + 1)} className="flex-1 py-3 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg shadow-lg shadow-primary/20">Próximo</button>
                                : <button type="button" onClick={handleSavePlan as any} disabled={!planForm.name.trim()} className={`flex-1 py-3 font-bold rounded-lg shadow-lg ${planForm.name.trim() ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>{editingPlanId ? 'Salvar Plano' : 'Criar Plano'}</button>
                            }
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ SUBSCRIBER MODAL (Enterprise) ═══ */}
            {isSubModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>{editingSubId ? 'Editar Assinatura' : 'Nova Assinatura'}</h3>
                            <button onClick={() => setIsSubModalOpen(false)} className={textSub}><X size={20} /></button>
                        </div>
                        {/* Section tabs */}
                        <div className={`flex border-b ${borderCol} overflow-x-auto`}>
                            {SUB_SECTIONS.map((s, i) => (
                                <button key={i} onClick={() => setSubModalSection(i)}
                                    className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${subModalSection === i ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>{s}</button>
                            ))}
                        </div>
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {/* Section 0: Dados */}
                            {subModalSection === 0 && (<>
                                <div><label className={labelCls}><Users size={12} /> Cliente</label>
                                    <CustomDropdown value={subForm.clientId} onChange={v => { const c = clients.find(c => c.id === v); setSubForm(p => ({ ...p, clientId: v, clientName: c?.name || '' })); }} options={[{ value: '', label: 'Selecionar cliente...' }, ...clients.filter(c => c.status === 'Active').map(c => ({ value: c.id, label: c.name }))]} isDarkMode={isDarkMode} /></div>
                                <div><label className={labelCls}><Crown size={12} /> Plano</label>
                                    <CustomDropdown value={subForm.planId} onChange={v => setSubForm(p => ({ ...p, planId: v }))} options={[{ value: '', label: 'Selecionar plano...' }, ...plans.filter(p => p.active).map(p => ({ value: p.id, label: `${p.name} — ${formatCurrency(p.price)}` }))]} isDarkMode={isDarkMode} /></div>
                                {subForm.planId && (() => {
                                    const selPlan = plans.find(p => p.id === subForm.planId);
                                    if (!selPlan) return null;
                                    return (
                                        <div className={`p-3 rounded-lg border ${isDarkMode ? 'border-primary/20 bg-primary/5' : 'border-primary/10 bg-primary/5'}`}>
                                            <p className="text-xs text-primary font-bold mb-1">Resumo do Plano</p>
                                            <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                <div><span className={textSub}>Valor:</span> <span className={`font-bold ${textMain}`}>{formatCurrency(selPlan.price)}</span></div>
                                                <div><span className={textSub}>Recorrência:</span> <span className={`font-bold ${textMain}`}>{RECURRENCE_LABELS[selPlan.recurrence]}</span></div>
                                                <div><span className={textSub}>Serviços:</span> <span className={`font-bold ${textMain}`}>{selPlan.planServices.length}</span></div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className={labelCls}><Calendar size={12} /> Início</label>
                                        <input type="date" value={subForm.startDate} onChange={e => setSubForm(p => ({ ...p, startDate: e.target.value }))} className={inputCls} required /></div>
                                    <div><label className={labelCls}><DollarSign size={12} /> Dia Pgto</label>
                                        <input type="number" value={subForm.paymentDay} onChange={e => setSubForm(p => ({ ...p, paymentDay: parseInt(e.target.value) || 5 }))} className={inputCls} min="1" max="28" /></div>
                                    <div><label className={labelCls}>Status</label>
                                        <CustomDropdown value={subForm.status} onChange={v => setSubForm(p => ({ ...p, status: v as any }))} options={[{ value: 'active', label: 'Ativo' }, { value: 'paused', label: 'Pausado' }, { value: 'cancelled', label: 'Cancelado' }, { value: 'overdue', label: 'Inadimplente' }]} isDarkMode={isDarkMode} /></div>
                                </div>
                            </>)}
                            {/* Section 1: Pagamento */}
                            {subModalSection === 1 && (<>
                                <div><label className={labelCls}><Wallet size={12} /> Forma de Pagamento</label>
                                    <CustomDropdown value={subForm.paymentMethod} onChange={v => setSubForm(p => ({ ...p, paymentMethod: v }))} options={[{ value: '', label: 'Não definido' }, { value: 'credit', label: 'Cartão de Crédito' }, { value: 'boleto', label: 'Boleto Bancário' }, { value: 'pix', label: 'Pix' }]} isDarkMode={isDarkMode} /></div>
                                {subForm.paymentMethod === 'credit' && (
                                    <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                        <p className={`text-xs font-bold ${textMain} flex items-center gap-1`}><CreditCard size={14} className="text-primary" /> Dados do Cartão</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className={labelCls}>Bandeira</label>
                                                <CustomDropdown value={subForm.cardBrand} onChange={v => setSubForm(p => ({ ...p, cardBrand: v }))} options={[{ value: '', label: 'Selecionar...' }, { value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' }, { value: 'elo', label: 'Elo' }, { value: 'amex', label: 'American Express' }, { value: 'hipercard', label: 'Hipercard' }]} isDarkMode={isDarkMode} /></div>
                                            <div><label className={labelCls}>Últimos 4 dígitos</label>
                                                <input type="text" value={subForm.cardLast4} onChange={e => setSubForm(p => ({ ...p, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} className={inputCls} placeholder="0000" maxLength={4} /></div>
                                        </div>
                                    </div>
                                )}
                                <div><label className={labelCls}><Receipt size={12} /> Email de Cobrança</label>
                                    <input type="email" value={subForm.billingEmail} onChange={e => setSubForm(p => ({ ...p, billingEmail: e.target.value }))} className={inputCls} placeholder="cliente@email.com (opcional)" /></div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={subForm.autoRenew} onChange={e => setSubForm(p => ({ ...p, autoRenew: e.target.checked }))} className="accent-primary w-4 h-4" />
                                        <span className={textMain}>Renovação automática</span>
                                    </label>
                                </div>
                                {subForm.paymentMethod && (
                                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-emerald-50 border border-emerald-200'}`}>
                                        <p className="text-[11px] text-emerald-500 font-medium"><CheckCircle size={10} className="inline mr-1" />
                                            {subForm.paymentMethod === 'credit' ? 'Cartão será cobrado automaticamente no dia do pagamento' : subForm.paymentMethod === 'boleto' ? 'Boleto será gerado automaticamente e enviado por email' : 'Chave Pix será enviada no dia do pagamento'}
                                        </p>
                                    </div>
                                )}
                            </>)}
                            {/* Section 2: Venda & Contrato */}
                            {subModalSection === 2 && (<>
                                <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                    <p className={`text-xs font-bold ${textMain} flex items-center gap-1`}><DollarSign size={14} className="text-primary" /> Comissão de Venda</p>
                                    <div><label className={labelCls}><Users size={12} /> Vendedor / Consultor</label>
                                        <CustomDropdown value={subForm.soldBy} onChange={v => { const m = barbers.find(b => b.id === v); setSubForm(p => ({ ...p, soldBy: v, soldByName: m?.name || '' })); }} options={[{ value: '', label: 'Selecionar profissional...' }, ...barbers.map(b => ({ value: b.id, label: `${b.name} — ${b.role === 'Barber' ? 'Barbeiro' : b.role}` }))]} isDarkMode={isDarkMode} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelCls}><Percent size={12} /> Tipo de Comissão</label>
                                            <CustomDropdown value={subForm.saleCommissionType} onChange={v => setSubForm(p => ({ ...p, saleCommissionType: v }))} options={[{ value: 'percentage', label: 'Percentual (%)' }, { value: 'fixed', label: 'Valor Fixo (R$)' }]} isDarkMode={isDarkMode} /></div>
                                        <div><label className={labelCls}><DollarSign size={12} /> {subForm.saleCommissionType === 'percentage' ? 'Comissão (%)' : 'Comissão (R$)'}</label>
                                            <input type="number" value={subForm.saleCommission} onChange={e => setSubForm(p => ({ ...p, saleCommission: parseFloat(e.target.value) || 0 }))} className={inputCls} min="0" step="0.01" /></div>
                                    </div>
                                    {subForm.soldBy && subForm.planId && (() => {
                                        const selPlan = plans.find(p => p.id === subForm.planId);
                                        const val = subForm.saleCommissionType === 'percentage' ? (selPlan?.price || 0) * (subForm.saleCommission / 100) : subForm.saleCommission;
                                        return <p className={`text-[11px] ${textSub} mt-1`}>Comissão estimada: <span className="text-primary font-bold">{formatCurrency(val)}</span> por {selPlan ? RECURRENCE_LABELS[selPlan.recurrence]?.toLowerCase() : 'mês'}</p>;
                                    })()}
                                </div>
                                <div><label className={labelCls}><Globe size={12} /> Canal de Aquisição</label>
                                    <CustomDropdown value={subForm.saleChannel} onChange={v => setSubForm(p => ({ ...p, saleChannel: v }))} options={[{ value: '', label: 'Selecionar...' }, { value: 'presencial', label: 'Presencial (na barbearia)' }, { value: 'instagram', label: 'Instagram' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'indicacao', label: 'Indicação de cliente' }, { value: 'site', label: 'Site / Landing Page' }, { value: 'outro', label: 'Outro' }]} isDarkMode={isDarkMode} /></div>
                                {subForm.status === 'cancelled' && (
                                    <div><label className={labelCls}><XCircle size={12} /> Motivo do Cancelamento</label>
                                        <textarea value={subForm.cancellationReason} onChange={e => setSubForm(p => ({ ...p, cancellationReason: e.target.value }))} className={`${inputCls} resize-none`} rows={2} placeholder="Por que o cliente cancelou?" /></div>
                                )}
                                <div><label className={labelCls}><Info size={12} /> Observações Internas</label>
                                    <textarea value={subForm.notes} onChange={e => setSubForm(p => ({ ...p, notes: e.target.value }))} className={`${inputCls} resize-none`} rows={2} placeholder="Anotações visíveis apenas para a equipe..." /></div>
                            </>)}
                        </div>
                        {/* Footer pinned to bottom */}
                        <div className={`p-5 border-t ${borderCol} mt-auto flex gap-3 shrink-0`}>
                            {subModalSection > 0 && <button type="button" onClick={() => setSubModalSection(s => s - 1)} className={`px-6 py-3 rounded-lg border ${borderCol} font-semibold text-sm ${textMain}`}>Anterior</button>}
                            {subModalSection < SUB_SECTIONS.length - 1
                                ? <button type="button" onClick={() => setSubModalSection(s => s + 1)} className="flex-1 py-3 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg shadow-lg shadow-primary/20">Próximo</button>
                                : <button type="button" onClick={handleSaveSub as any} disabled={!subForm.planId || !subForm.clientId}
                                    className={`flex-1 py-3 font-bold rounded-lg shadow-lg ${subForm.planId && subForm.clientId ? 'bg-primary hover:bg-primary-600 text-white shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>
                                    {editingSubId ? 'Salvar Assinatura' : 'Criar Assinatura'}</button>
                            }
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ PLAN SUBSCRIBERS MODAL ═══ */}
            {planSubsModalPlanId && (() => {
                const modalPlan = plans.find(p => p.id === planSubsModalPlanId);
                const planSubs = unitSubscriptions.filter(s => s.planId === planSubsModalPlanId && (!planSubsSearch || (s.clientName || '').toLowerCase().includes(planSubsSearch.toLowerCase())));
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
                            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                <div>
                                    <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}><Crown size={18} className="text-primary" /> Assinantes — {modalPlan?.name || '—'}</h3>
                                    <p className={`text-xs ${textSub}`}>{planSubs.length} assinante{planSubs.length !== 1 ? 's' : ''} encontrado{planSubs.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button onClick={() => setPlanSubsModalPlanId(null)} className={textSub}><X size={20} /></button>
                            </div>
                            <div className={`px-4 py-3 border-b ${borderCol}`}>
                                <div className="relative"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={16} />
                                    <input type="text" value={planSubsSearch} onChange={e => setPlanSubsSearch(e.target.value)} placeholder="Buscar por nome..."
                                        className={`pl-9 pr-4 py-2 text-sm w-full border rounded-lg ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {planSubs.length === 0 ? (
                                    <div className={`px-6 py-16 text-center ${textSub}`}><Users size={40} className="mx-auto mb-3 opacity-20" /><p className="text-sm">Nenhum assinante neste plano.</p>
                                        <button onClick={() => { setPlanSubsModalPlanId(null); openSubModalForPlan(planSubsModalPlanId); }} className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-600"><UserPlus size={14} className="inline mr-1" />Cadastrar Assinante</button>
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium sticky top-0`}>
                                            <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Pagamento</th><th className="px-5 py-3">Consumo</th><th className="px-5 py-3">Início</th><th className="px-5 py-3 text-right">Ações</th></tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                            {planSubs.map(sub => {
                                                const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active; const SI = cfg.icon;
                                                const max = sub.plan?.maxUsesPerMonth; const pct = max ? Math.min((sub.usesThisMonth / max) * 100, 100) : 0;
                                                const methodLabels: Record<string, string> = { credit: 'Cartão', boleto: 'Boleto', pix: 'Pix' };
                                                return (
                                                    <tr key={sub.id} className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                                                        <td className={`px-5 py-3 font-medium ${textMain}`}>{sub.clientName || '—'}</td>
                                                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${isDarkMode ? cfg.darkColor : cfg.color}`}><SI size={10} />{cfg.label}</span></td>
                                                        <td className={`px-5 py-3 text-xs ${textSub}`}>{sub.paymentMethod ? methodLabels[sub.paymentMethod] || sub.paymentMethod : '—'}</td>
                                                        <td className="px-5 py-3">{max ? (<div className="flex items-center gap-2"><div className={`w-16 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div><span className={`text-xs ${textSub}`}>{sub.usesThisMonth}/{max}</span></div>) : <Infinity size={12} className={textSub} />}</td>
                                                        <td className={`px-5 py-3 text-xs ${textSub}`}>{sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR') : '—'}</td>
                                                        <td className="px-5 py-3 text-right"><div className="flex justify-end gap-2">
                                                            <button onClick={() => { setPlanSubsModalPlanId(null); openSubModal(sub); }} className="text-primary hover:underline text-xs font-medium">Editar</button>
                                                            <button onClick={() => handleDeleteSub(sub.id)} className="text-red-500 hover:underline text-xs font-medium">Excluir</button>
                                                        </div></td>
                                                    </tr>);
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className={`p-4 border-t ${borderCol} flex justify-between items-center`}>
                                <button onClick={() => { setPlanSubsModalPlanId(null); openSubModalForPlan(planSubsModalPlanId); }} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-600 flex items-center gap-1"><UserPlus size={14} /> Cadastrar Assinante</button>
                                <button onClick={() => setPlanSubsModalPlanId(null)} className={`px-4 py-2 rounded-lg border ${borderCol} font-semibold text-sm ${textMain}`}>Fechar</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Assinaturas</h1>
                    <p className={`${textSub} text-sm`}>Planos de assinatura, gestão de recorrência e indicadores avançados.</p>
                </div>
                <div className="flex gap-3">
                    {activeTab === 'plans' && canCreate('/assinaturas') && <button onClick={() => openPlanModal()} className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm flex items-center gap-2"><Plus size={18} />Novo Plano</button>}
                    {activeTab === 'subscribers' && canCreate('/assinaturas') && <button onClick={() => openSubModal()} className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm flex items-center gap-2"><Plus size={18} />Nova Assinatura</button>}
                </div>
            </div>

            {/* ═══ KPIs ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'MRR', value: formatCurrency(kpis.mrr), icon: DollarSign, color: 'text-emerald-500', bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50' },
                    { label: 'Ativos', value: kpis.active.toString(), icon: Users, color: 'text-primary', bg: isDarkMode ? 'bg-primary/10' : 'bg-primary/5' },
                    { label: 'Churn', value: `${kpis.churn.toFixed(1)}%`, icon: TrendingDown, color: 'text-red-500', bg: isDarkMode ? 'bg-red-500/10' : 'bg-red-50' },
                    { label: 'LTV Médio', value: formatCurrency(kpis.ltv), icon: TrendingUp, color: 'text-violet-500', bg: isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50' },
                    { label: 'Ticket Médio', value: formatCurrency(kpis.avg), icon: Star, color: 'text-amber-500', bg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50' },
                    { label: 'Retenção', value: `${kpis.retentionRate.toFixed(1)}%`, icon: CheckCircle, color: 'text-cyan-500', bg: isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50' },
                    { label: 'Inadimplentes', value: kpis.overdue.toString(), icon: AlertCircle, color: 'text-orange-500', bg: isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50' },
                    { label: 'Receita Anual', value: formatCurrency(kpis.totalRevenue), icon: BarChart3, color: 'text-indigo-500', bg: isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50' },
                ].map((k, i) => (
                    <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 ${shadowClass} flex items-center gap-3`}>
                        <div className={`p-2 rounded-lg ${k.bg}`}><k.icon size={20} className={k.color} /></div>
                        <div><p className={`text-xs ${textSub}`}>{k.label}</p><p className={`text-lg font-bold ${textMain}`}>{k.value}</p></div>
                    </div>
                ))}
            </div>

            {/* ═══ TABS ═══ */}
            <div className="flex gap-1 mb-6 overflow-x-auto">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-primary text-white shadow-md shadow-primary/20' : `${isDarkMode ? 'text-slate-400 hover:bg-dark-surface' : 'text-slate-600 hover:bg-slate-100'}`}`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB: PLANS ═══ */}
            {activeTab === 'plans' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                            <Crown size={48} className={`${textSub} opacity-20 mb-3`} /><p className={`${textSub} text-sm`}>Nenhum plano cadastrado.</p>
                        </div>
                    ) : plans.map(plan => {
                        const subsCount = unitSubscriptions.filter(s => s.planId === plan.id && s.status === 'active').length;
                        return (
                            <div key={plan.id} className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden ${shadowClass} flex flex-col`}>
                                <div className="p-5 flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'}`}><Crown size={18} className="text-primary" /></div>
                                            <div><h3 className={`font-bold ${textMain}`}>{plan.name}</h3>
                                                {plan.description && <p className={`text-xs ${textSub} mt-0.5`}>{plan.description}</p>}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${plan.active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>{plan.active ? 'Ativo' : 'Inativo'}</span>
                                            {!plan.availableForSale && <span className={`px-2 py-0.5 rounded-full text-[10px] border ${isDarkMode ? 'border-dark-border text-slate-500' : 'border-slate-200 text-slate-400'}`}><EyeOff size={8} className="inline mr-0.5" />Oculto</span>}
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-primary mb-1">{formatCurrency(plan.price)}<span className={`text-xs font-normal ${textSub} ml-1`}>/{RECURRENCE_LABELS[plan.recurrence] || 'mês'}</span></div>
                                    <div className="space-y-1.5 mb-3">
                                        <div className={`flex items-center gap-2 text-xs ${textSub}`}><Users size={12} /> {subsCount} assinante{subsCount !== 1 ? 's' : ''}</div>
                                        {plan.planServices.length > 0 && <div className={`flex items-center gap-2 text-xs ${textSub}`}><Scissors size={12} /> {plan.planServices.length} serviço{plan.planServices.length !== 1 ? 's' : ''}</div>}
                                        {plan.planProducts.length > 0 && <div className={`flex items-center gap-2 text-xs ${textSub}`}><Package size={12} /> {plan.planProducts.length} produto{plan.planProducts.length !== 1 ? 's' : ''}</div>}
                                        {plan.benefits.length > 0 && <div className={`flex items-center gap-2 text-xs ${textSub}`}><Gift size={12} /> {plan.benefits.length} benefício{plan.benefits.length !== 1 ? 's' : ''}</div>}
                                        {plan.disabledDays.length > 0 && <div className={`flex items-center gap-2 text-xs text-red-400`}><CalendarOff size={12} /> {plan.disabledDays.map(d => DAYS_WEEK.find(x => x.key === d)?.label).join(', ')} off</div>}
                                        {plan.creditEnabled && <div className={`flex items-center gap-2 text-xs ${textSub}`}><CreditCard size={12} /> Crédito {plan.creditPrice ? formatCurrency(plan.creditPrice) : ''}</div>}
                                        {plan.boletoEnabled && <div className={`flex items-center gap-2 text-xs ${textSub}`}><Receipt size={12} /> Boleto {plan.boletoPrice ? formatCurrency(plan.boletoPrice) : ''}</div>}
                                    </div>
                                </div>
                                <div className={`px-5 py-3 border-t ${borderCol} space-y-2`}>
                                    <div className="flex gap-2">
                                        <button onClick={() => openSubModalForPlan(plan.id)} className="flex-1 py-2 text-xs font-bold uppercase rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 flex items-center justify-center gap-1"><UserPlus size={12} /> Cadastrar</button>
                                        <button onClick={() => { setPlanSubsModalPlanId(plan.id); setPlanSubsSearch(''); }} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border ${isDarkMode ? 'border-dark-border text-slate-300 hover:bg-dark' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} flex items-center justify-center gap-1`}><Users size={12} /> Assinantes ({subsCount})</button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openPlanModal(plan)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border ${isDarkMode ? 'border-dark-border text-slate-300 hover:bg-dark' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} flex items-center justify-center gap-1`}><Pencil size={12} /> Editar</button>
                                        <button onClick={() => handleDeletePlan(plan.id)} className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/5 flex items-center justify-center gap-1"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ TAB: SUBSCRIBERS ═══ */}
            {activeTab === 'subscribers' && (<>
                <div className="mb-4"><div className="relative flex-1 md:max-w-xs">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar assinante..."
                        className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`} />
                </div></div>
                <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                    <table className="w-full text-left text-sm">
                        <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
                            <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Plano</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Consumo</th><th className="px-6 py-4">Início</th><th className="px-6 py-4">Dia Pgto</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                            {(() => {
                                const filtered = subscriptions.filter(s => !searchQuery || (s.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.plan?.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                                if (filtered.length === 0) return <tr><td colSpan={7} className={`px-6 py-12 text-center ${textSub}`}><Users size={32} className="mx-auto mb-2 opacity-30" />Nenhum assinante.</td></tr>;
                                return filtered.map(sub => {
                                    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active; const SI = cfg.icon;
                                    const max = sub.plan?.maxUsesPerMonth; const pct = max ? Math.min((sub.usesThisMonth / max) * 100, 100) : 0;
                                    return (
                                        <tr key={sub.id} className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                                            <td className={`px-6 py-3 font-medium ${textMain}`}>{sub.clientName || '—'}</td>
                                            <td className={`px-6 py-3 ${textSub}`}><Crown size={12} className="inline text-primary mr-1" />{sub.plan?.name || '—'}</td>
                                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${isDarkMode ? cfg.darkColor : cfg.color}`}><SI size={10} />{cfg.label}</span></td>
                                            <td className="px-6 py-3">{max ? (<div className="flex items-center gap-2"><div className={`w-20 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div><span className={`text-xs ${textSub}`}>{sub.usesThisMonth}/{max}</span></div>) : <Infinity size={12} className={textSub} />}</td>
                                            <td className={`px-6 py-3 text-xs ${textSub}`}>{sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR') : '—'}</td>
                                            <td className={`px-6 py-3 text-xs ${textSub}`}>Dia {sub.paymentDay}</td>
                                            <td className="px-6 py-3 text-right"><div className="flex justify-end gap-2">
                                                <button onClick={() => openSubModal(sub)} className="text-primary hover:underline text-xs font-medium">Editar</button>
                                                <button onClick={() => handleDeleteSub(sub.id)} className="text-red-500 hover:underline text-xs font-medium">Excluir</button>
                                            </div></td>
                                        </tr>);
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </>)}

            {/* ═══ TAB: DASHBOARD ═══ */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Date Filter */}
                    <div className="flex items-center justify-between">
                        <h2 className={`text-sm font-bold ${textMain} flex items-center gap-2`}><LayoutDashboard size={16} className="text-primary" /> Dashboard</h2>
                        <div className="flex items-center gap-1.5">
                            <CalendarDays size={14} className={textSub} />
                            {(['month', '7d', '30d', '90d', 'all'] as const).map(p => (
                                <button key={p} onClick={() => setDashPeriod(p)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${dashPeriod === p ? 'bg-primary text-white' : `${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}`}>
                                    {p === 'month' ? 'Este Mês' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Tudo'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 1: Executive KPIs with Goals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'MRR', value: formatCurrency(kpis.mrr), numVal: kpis.mrr, goal: DASHBOARD_GOALS.mrr, goalLabel: `Meta: ${formatCurrency(DASHBOARD_GOALS.mrr)}`, icon: DollarSign, color: 'text-emerald-500', bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50', barColor: 'bg-emerald-500' },
                            { label: 'Assinantes', value: kpis.active.toString(), numVal: kpis.active, goal: DASHBOARD_GOALS.subscribers, goalLabel: `Meta: ${DASHBOARD_GOALS.subscribers}`, icon: Users, color: 'text-primary', bg: isDarkMode ? 'bg-primary/10' : 'bg-primary/5', barColor: 'bg-primary' },
                            { label: 'Novas Vendas', value: kpis.newSales.toString(), numVal: kpis.newSales, goal: DASHBOARD_GOALS.newSales, goalLabel: `Meta: ${DASHBOARD_GOALS.newSales}`, icon: ShoppingBag, color: kpis.newSales >= DASHBOARD_GOALS.newSales ? 'text-emerald-500' : 'text-red-500', bg: kpis.newSales >= DASHBOARD_GOALS.newSales ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDarkMode ? 'bg-red-500/10' : 'bg-red-50'), barColor: kpis.newSales >= DASHBOARD_GOALS.newSales ? 'bg-emerald-500' : 'bg-red-500' },
                            { label: 'Frequência Média', value: kpis.freqAvg.toFixed(1), numVal: kpis.freqAvg, goal: DASHBOARD_GOALS.freqAvg, goalLabel: `Meta: ${DASHBOARD_GOALS.freqAvg.toFixed(1)}`, icon: Activity, color: 'text-violet-500', bg: isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50', barColor: 'bg-violet-500' },
                        ].map((k, i) => {
                            const pctGoal = k.goal > 0 ? Math.min((k.numVal / k.goal) * 100, 100) : 0;
                            const goalColor = pctGoal >= 80 ? 'bg-emerald-500' : pctGoal >= 50 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                                <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass} relative overflow-hidden`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className={`p-2 rounded-lg ${k.bg}`}><k.icon size={18} className={k.color} /></div>
                                        <span className={`text-[10px] font-bold ${pctGoal >= 80 ? 'text-emerald-500' : pctGoal >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{pctGoal.toFixed(0)}%</span>
                                    </div>
                                    <p className={`text-2xl font-bold ${textMain} mb-0.5`}>{k.value}</p>
                                    <p className={`text-[10px] ${textSub} mb-2`}>{k.goalLabel}</p>
                                    <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <div className={`h-full rounded-full ${goalColor} transition-all`} style={{ width: `${pctGoal}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* â"€â"€ Section 1b: Health Indicators â"€â"€ */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Retenção', value: `${kpis.retentionRate.toFixed(1)}%`, color: kpis.retentionRate >= 80 ? 'text-emerald-500' : 'text-red-500' },
                            { label: 'Churn', value: `${kpis.churn.toFixed(1)}%`, color: 'text-red-500' },
                            { label: 'LTV Médio', value: formatCurrency(kpis.ltv), color: 'text-violet-500' },
                            { label: 'Inadimplentes', value: kpis.overdue.toString(), color: 'text-orange-500' },
                            { label: 'ARR', value: formatCurrency(kpis.totalRevenue), color: 'text-indigo-500' },
                        ].map((h, i) => (
                            <div key={i} className={`${bgCard} border ${borderCol} rounded-lg p-3 ${shadowClass}`}>
                                <p className={`text-[10px] ${textSub} mb-0.5`}>{h.label}</p>
                                <p className={`text-lg font-bold ${h.color}`}>{h.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* -- Operational Indicators (Ticket Médio + Taxa de Ocupação) -- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Ticket Médio Comparison */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Star size={16} className="text-amber-500" /> Ticket Médio</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className={`text-xs ${textSub}`}>Assinantes</span>
                                        <span className="text-xl font-bold text-emerald-500">{formatCurrency(kpis.ticketSub)}</span>
                                    </div>
                                    <div className={`h-3 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${kpis.ticketSub > 0 && kpis.ticketNonSub > 0 ? Math.min((kpis.ticketSub / Math.max(kpis.ticketSub, kpis.ticketNonSub)) * 100, 100) : (kpis.ticketSub > 0 ? 100 : 0)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className={`text-xs ${textSub}`}>Avulsos</span>
                                        <span className={`text-xl font-bold ${textMain}`}>{formatCurrency(kpis.ticketNonSub)}</span>
                                    </div>
                                    <div className={`h-3 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <div className={`h-full rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-400'} transition-all`} style={{ width: `${kpis.ticketNonSub > 0 && kpis.ticketSub > 0 ? Math.min((kpis.ticketNonSub / Math.max(kpis.ticketSub, kpis.ticketNonSub)) * 100, 100) : (kpis.ticketNonSub > 0 ? 100 : 0)}%` }} />
                                    </div>
                                </div>
                                {kpis.ticketSub > 0 && kpis.ticketNonSub > 0 && (
                                    <p className={`text-[11px] ${textSub} pt-2 border-t ${borderCol}`}>
                                        Assinantes gastam <span className={`font-bold ${kpis.ticketSub > kpis.ticketNonSub ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {kpis.ticketSub > kpis.ticketNonSub ? '+' : ''}{((kpis.ticketSub / kpis.ticketNonSub - 1) * 100).toFixed(0)}%</span> {kpis.ticketSub > kpis.ticketNonSub ? 'a mais' : 'a menos'} que avulsos
                                    </p>
                                )}
                            </div>
                        </div>
                        {/* Taxa de Ocupação */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Target size={16} className="text-primary" /> Taxa de Ocupação</h3>
                            <div className="flex flex-col items-center mb-4">
                                <div className="relative w-28 h-28">
                                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} strokeWidth="12" fill="none" />
                                        <circle cx="50" cy="50" r="42" stroke={kpis.occupationRate >= DASHBOARD_GOALS.occupationRate ? '#10b981' : kpis.occupationRate >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="12" fill="none" strokeDasharray={`${kpis.occupationRate * 2.64} 264`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-2xl font-bold ${kpis.occupationRate >= DASHBOARD_GOALS.occupationRate ? 'text-emerald-500' : kpis.occupationRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{kpis.occupationRate.toFixed(0)}%</span>
                                    </div>
                                </div>
                                <p className={`text-[10px] ${textSub} mt-1`}>Meta: {DASHBOARD_GOALS.occupationRate}%</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className={textSub}>Assinantes</span>
                                    <span className="font-bold text-primary">{kpis.subOccupation.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className={textSub}>Avulsos</span>
                                    <span className={`font-bold ${textMain}`}>{kpis.nonSubOccupation.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                        {/* Revenue Breakdown with Goal */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><DollarSign size={16} className="text-emerald-500" /> Receita</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Recorrência (MRR)', value: kpis.mrr, color: 'bg-emerald-500' },
                                    { label: 'Serviços Extras', value: kpis.extraServicesRevenue, color: 'bg-amber-500' },
                                    { label: 'Produtos Extras', value: kpis.extraProductsRevenue, color: 'bg-violet-500' },
                                ].map((r, i) => {
                                    const total = kpis.mrr + kpis.extraServicesRevenue + kpis.extraProductsRevenue;
                                    const pct = total > 0 ? (r.value / total) * 100 : 0;
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-xs ${textSub}`}>{r.label}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${textMain}`}>{formatCurrency(r.value)}</span>
                                                    <span className={`text-[10px] ${textSub}`}>{pct.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                <div className={`h-full rounded-full ${r.color} transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {(() => {
                                    const total = kpis.mrr + kpis.extraServicesRevenue + kpis.extraProductsRevenue;
                                    const goalPct = DASHBOARD_GOALS.revenueTotal > 0 ? Math.min((total / DASHBOARD_GOALS.revenueTotal) * 100, 100) : 0;
                                    return (
                                        <div className={`pt-3 border-t ${borderCol}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-xs font-bold ${textSub}`}>Total</span>
                                                <span className={`text-lg font-bold text-emerald-500`}>{formatCurrency(total)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`flex-1 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                    <div className={`h-full rounded-full ${goalPct >= 80 ? 'bg-emerald-500' : goalPct >= 50 ? 'bg-amber-500' : 'bg-red-500'} transition-all`} style={{ width: `${goalPct}%` }} />
                                                </div>
                                                <span className={`text-[10px] ${textSub}`}>{goalPct.toFixed(0)}% da meta</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* -- Sales by Plan -- */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Crown size={16} className="text-primary" /> Vendas por Plano</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                    <th className="text-left py-2 px-3">Plano</th>
                                    <th className="text-center py-2 px-3">Vendas</th>
                                    <th className="text-right py-2 px-3">Receita</th>
                                    <th className="text-right py-2 px-3 w-40">% MRR</th>
                                </tr></thead>
                                <tbody>{kpis.planDist.map((pd, i) => (
                                    <tr key={i} className={`border-t ${borderCol}`}>
                                        <td className={`py-2.5 px-3 font-medium ${textMain}`}>{pd.name}</td>
                                        <td className={`py-2.5 px-3 text-center font-bold ${textMain}`}>{pd.count}</td>
                                        <td className={`py-2.5 px-3 text-right text-emerald-500 font-bold`}>{formatCurrency(pd.revenue)}</td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2 justify-end">
                                                <div className={`h-2 rounded-full flex-1 max-w-[100px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pd.pct}%` }} />
                                                </div>
                                                <span className={`text-xs ${textSub} w-10 text-right`}>{pd.pct.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                            {kpis.planDist.length === 0 && <p className={`text-xs ${textSub} text-center py-6`}>Nenhum plano cadastrado.</p>}
                        </div>
                    </div>

                    {/* â"€â"€ Section 3: Client Behavior (sub-tabs) â"€â"€ */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                        <div className={`flex border-b ${borderCol} px-5 pt-3`}>
                            {([
                                { key: 'visits' as const, label: 'Mais Visitas', icon: Activity },
                                { key: 'extras' as const, label: 'Serviço Extra', icon: Scissors },
                                { key: 'products' as const, label: 'Produtos', icon: Package },
                                { key: 'new' as const, label: 'Novos Assinantes', icon: UserPlus },
                            ]).map(t => (
                                <button key={t.key} onClick={() => setDashSubTab(t.key)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${dashSubTab === t.key ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>
                                    <t.icon size={14} /> {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-5">
                            {dashSubTab === 'visits' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                            <th className="text-left py-2 px-3">#</th>
                                            <th className="text-left py-2 px-3">Cliente</th>
                                            <th className="text-left py-2 px-3">Plano</th>
                                            <th className="text-center py-2 px-3">Visitas/Mês</th>
                                        </tr></thead>
                                        <tbody>{kpis.topVisits.map((sub, i) => (
                                            <tr key={sub.id} className={`border-t ${borderCol}`}>
                                                <td className={`py-2 px-3 ${i < 3 ? 'text-primary font-bold' : textSub}`}>{i + 1}º</td>
                                                <td className={`py-2 px-3 font-medium ${textMain}`}>{sub.clientName || 'Cliente'}</td>
                                                <td className={`py-2 px-3 text-xs ${textSub}`}>{sub.plan?.name || '—'}</td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${i < 3 ? 'bg-primary/10 text-primary' : `${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}`}>{sub.usesThisMonth}</span>
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                    {kpis.topVisits.length === 0 && <p className={`text-xs ${textSub} text-center py-8`}>Nenhum assinante com visitas este mês.</p>}
                                </div>
                            )}
                            {dashSubTab === 'extras' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                            <th className="text-left py-2 px-3">Cliente</th>
                                            <th className="text-left py-2 px-3">Plano</th>
                                            <th className="text-center py-2 px-3">Serviços Extras</th>
                                            <th className="text-right py-2 px-3">Valor Extras</th>
                                        </tr></thead>
                                        <tbody>{(() => {
                                            const act = subscriptions.filter(s => s.status === 'active');
                                            const subExtras = act.map(sub => {
                                                const subCom = comandas.filter(c => c.clientId === sub.clientId && c.status === 'closed');
                                                const extraSvc = subCom.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').length, 0);
                                                const extraVal = subCom.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'service').reduce((x, i) => x + i.totalPrice, 0), 0);
                                                return { ...sub, extraSvc, extraVal };
                                            }).filter(s => s.extraSvc > 0).sort((a, b) => b.extraVal - a.extraVal).slice(0, 10);
                                            return subExtras.length > 0 ? subExtras.map((s, i) => (
                                                <tr key={s.id} className={`border-t ${borderCol}`}>
                                                    <td className={`py-2 px-3 font-medium ${textMain}`}>{s.clientName || 'Cliente'}</td>
                                                    <td className={`py-2 px-3 text-xs ${textSub}`}>{s.plan?.name || '—'}</td>
                                                    <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500">{s.extraSvc}</span></td>
                                                    <td className={`py-2 px-3 text-right font-bold text-emerald-500`}>{formatCurrency(s.extraVal)}</td>
                                                </tr>
                                            )) : <tr><td colSpan={4} className={`text-xs ${textSub} text-center py-8`}>Nenhum serviço extra registrado.</td></tr>;
                                        })()}</tbody>
                                    </table>
                                </div>
                            )}
                            {dashSubTab === 'products' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                            <th className="text-left py-2 px-3">Cliente</th>
                                            <th className="text-left py-2 px-3">Plano</th>
                                            <th className="text-center py-2 px-3">Produtos</th>
                                            <th className="text-right py-2 px-3">Valor</th>
                                        </tr></thead>
                                        <tbody>{(() => {
                                            const act = subscriptions.filter(s => s.status === 'active');
                                            const subProds = act.map(sub => {
                                                const subCom = comandas.filter(c => c.clientId === sub.clientId && c.status === 'closed');
                                                const prodQty = subCom.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').length, 0);
                                                const prodVal = subCom.reduce((s, c) => s + (c.items || []).filter(i => i.type === 'product').reduce((x, i) => x + i.totalPrice, 0), 0);
                                                return { ...sub, prodQty, prodVal };
                                            }).filter(s => s.prodQty > 0).sort((a, b) => b.prodVal - a.prodVal).slice(0, 10);
                                            return subProds.length > 0 ? subProds.map((s, i) => (
                                                <tr key={s.id} className={`border-t ${borderCol}`}>
                                                    <td className={`py-2 px-3 font-medium ${textMain}`}>{s.clientName || 'Cliente'}</td>
                                                    <td className={`py-2 px-3 text-xs ${textSub}`}>{s.plan?.name || '—'}</td>
                                                    <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">{s.prodQty}</span></td>
                                                    <td className={`py-2 px-3 text-right font-bold text-emerald-500`}>{formatCurrency(s.prodVal)}</td>
                                                </tr>
                                            )) : <tr><td colSpan={4} className={`text-xs ${textSub} text-center py-8`}>Nenhum produto comprado por assinantes.</td></tr>;
                                        })()}</tbody>
                                    </table>
                                </div>
                            )}
                            {dashSubTab === 'new' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                            <th className="text-left py-2 px-3">Cliente</th>
                                            <th className="text-left py-2 px-3">Plano</th>
                                            <th className="text-center py-2 px-3">Status</th>
                                            <th className="text-right py-2 px-3">Data</th>
                                        </tr></thead>
                                        <tbody>{kpis.newSubscribers.length > 0 ? kpis.newSubscribers.map(s => {
                                            const sc = STATUS_CONFIG[s.status];
                                            return (
                                                <tr key={s.id} className={`border-t ${borderCol}`}>
                                                    <td className={`py-2 px-3 font-medium ${textMain}`}>{s.clientName || 'Cliente'}</td>
                                                    <td className={`py-2 px-3 text-xs ${textSub}`}>{s.plan?.name || '—'}</td>
                                                    <td className="py-2 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDarkMode ? sc?.darkColor : sc?.color}`}>{sc?.label}</span></td>
                                                    <td className={`py-2 px-3 text-right text-xs ${textSub}`}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                                                </tr>
                                            );
                                        }) : <tr><td colSpan={4} className={`text-xs ${textSub} text-center py-8`}>Nenhum novo assinante este mês.</td></tr>}</tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>



                    {/* â"€â"€ Section 5: Professional Performance (sub-tabs) â"€â"€ */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                        <div className={`flex border-b ${borderCol} px-5 pt-3`}>
                            {([
                                { key: 'productivity' as const, label: 'Produtividade', icon: Target },
                                { key: 'sales' as const, label: 'Vendas Extras', icon: ShoppingBag },
                            ]).map(t => (
                                <button key={t.key} onClick={() => setProfSubTab(t.key)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${profSubTab === t.key ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>
                                    <t.icon size={14} /> {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-5 overflow-x-auto">
                            {profSubTab === 'productivity' && (
                                <table className="w-full text-sm">
                                    <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                        <th className="text-left py-2 px-3">Profissional</th>
                                        <th className="text-center py-2 px-3">Serviços</th>
                                        <th className="text-center py-2 px-3">Clientes</th>
                                        <th className="text-center py-2 px-3">Comandas</th>
                                        <th className="text-center py-2 px-3">Média Visitas</th>
                                        <th className="text-right py-2 px-3">Faturamento</th>
                                        <th className="text-right py-2 px-3 w-36">% Participação</th>
                                    </tr></thead>
                                    <tbody>{kpis.profPerf.sort((a, b) => b.totalRevenue - a.totalRevenue).map((p, i) => {
                                        const pct = kpis.totalAllRevenue > 0 ? (p.totalRevenue / kpis.totalAllRevenue) * 100 : 0;
                                        return (
                                            <tr key={p.id} className={`border-t ${borderCol}`}>
                                                <td className={`py-2.5 px-3 font-medium ${textMain}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                                        {p.name}
                                                    </div>
                                                </td>
                                                <td className={`py-2.5 px-3 text-center font-bold ${textMain}`}>{p.totalServices}</td>
                                                <td className={`py-2.5 px-3 text-center ${textMain}`}>{p.uniqueClients}</td>
                                                <td className={`py-2.5 px-3 text-center ${textSub}`}>{p.comandasCount}</td>
                                                <td className={`py-2.5 px-3 text-center font-bold ${p.avgVisitsPerClient >= 3 ? 'text-emerald-500' : p.avgVisitsPerClient >= 1.5 ? 'text-amber-500' : textSub}`}>{p.avgVisitsPerClient.toFixed(1)}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCurrency(p.totalRevenue)}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <div className={`h-2 rounded-full flex-1 max-w-[80px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className={`text-xs ${textSub} w-10 text-right`}>{pct.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            )}
                            {profSubTab === 'sales' && (
                                <table className="w-full text-sm">
                                    <thead><tr className={`text-[11px] ${textSub} uppercase`}>
                                        <th className="text-left py-2 px-3">Profissional</th>
                                        <th className="text-center py-2 px-3">Serv. Extras</th>
                                        <th className="text-center py-2 px-3">Produtos</th>
                                        <th className="text-right py-2 px-3">Fatur. Extras</th>
                                        <th className="text-right py-2 px-3 w-36">% Participação</th>
                                    </tr></thead>
                                    <tbody>{(() => {
                                        const totalExtras = kpis.profPerf.reduce((s, p) => s + p.extrasRevenue + p.extrasServiceRevenue, 0);
                                        return kpis.profPerf.sort((a, b) => (b.extrasRevenue + b.extrasServiceRevenue) - (a.extrasRevenue + a.extrasServiceRevenue)).map((p, i) => {
                                            const extras = p.extrasRevenue + p.extrasServiceRevenue;
                                            const pct = totalExtras > 0 ? (extras / totalExtras) * 100 : 0;
                                            return (
                                                <tr key={p.id} className={`border-t ${borderCol}`}>
                                                    <td className={`py-2.5 px-3 font-medium ${textMain}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-amber-500/10 text-amber-500' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                                            {p.name}
                                                        </div>
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-center font-bold ${textMain}`}>{p.totalServices}</td>
                                                    <td className={`py-2.5 px-3 text-center ${textMain}`}>{p.totalProducts}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-amber-500">{formatCurrency(extras)}</td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <div className={`h-2 rounded-full flex-1 max-w-[80px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className={`text-xs ${textSub} w-10 text-right`}>{pct.toFixed(0)}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}</tbody>
                                </table>
                            )}
                            {kpis.profPerf.length === 0 && <p className={`text-xs ${textSub} text-center py-8`}>Nenhum profissional com dados.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: HISTORY ═══ */}
            {activeTab === 'history' && (<>
                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex items-center gap-1.5">
                        <Filter size={14} className={textSub} />
                        <CustomDropdown value={historyStatusFilter} onChange={v => setHistoryStatusFilter(v)} options={[{ value: 'all', label: 'Todos status' }, { value: 'active', label: 'Ativo' }, { value: 'paused', label: 'Pausado' }, { value: 'cancelled', label: 'Cancelado' }, { value: 'overdue', label: 'Inadimplente' }]} isDarkMode={isDarkMode} />
                    </div>
                    <CustomDropdown value={historyPlanFilter} onChange={v => setHistoryPlanFilter(v)} options={[{ value: 'all', label: 'Todos planos' }, ...plans.map(p => ({ value: p.id, label: p.name }))]} isDarkMode={isDarkMode} />
                    <CustomDropdown value={historyMethodFilter} onChange={v => setHistoryMethodFilter(v)} options={[{ value: 'all', label: 'Todas formas' }, { value: 'credit', label: 'Cartão' }, { value: 'boleto', label: 'Boleto' }, { value: 'pix', label: 'Pix' }]} isDarkMode={isDarkMode} />
                    {(historyStatusFilter !== 'all' || historyPlanFilter !== 'all' || historyMethodFilter !== 'all') && (
                        <button onClick={() => { setHistoryStatusFilter('all'); setHistoryPlanFilter('all'); setHistoryMethodFilter('all'); }} className="text-xs text-primary hover:underline">Limpar filtros</button>
                    )}
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                    <div className={`p-4 border-b ${borderCol}`}>
                        <h3 className={`font-semibold ${textMain}`}>Histórico de Assinaturas</h3>
                        <p className={`text-xs ${textSub}`}>Todas as assinaturas ordenadas por data de criação.</p>
                    </div>
                    <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                        {(() => {
                            const methodLabels: Record<string, string> = { credit: 'Cartão', boleto: 'Boleto', pix: 'Pix' };
                            const filtered = subscriptions.filter(s => {
                                if (historyStatusFilter !== 'all' && s.status !== historyStatusFilter) return false;
                                if (historyPlanFilter !== 'all' && s.planId !== historyPlanFilter) return false;
                                if (historyMethodFilter !== 'all' && s.paymentMethod !== historyMethodFilter) return false;
                                return true;
                            });
                            if (filtered.length === 0) return <div className={`px-6 py-12 text-center ${textSub}`}><History size={32} className="mx-auto mb-2 opacity-30" />Nenhum registro encontrado.</div>;
                            return filtered.map(sub => {
                                const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active; const SI = cfg.icon;
                                return (
                                    <div key={sub.id} className={`px-5 py-4 flex items-center gap-4 ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? cfg.darkColor : cfg.color} border`}><SI size={16} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium text-sm ${textMain} truncate`}>{sub.clientName || '—'}</p>
                                            <p className={`text-xs ${textSub}`}><Crown size={10} className="inline text-primary mr-1" />{sub.plan?.name || '—'} · Dia {sub.paymentDay}{sub.paymentMethod ? ` · ${methodLabels[sub.paymentMethod]}` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isDarkMode ? cfg.darkColor : cfg.color}`}>{cfg.label}</span>
                                            <p className={`text-[10px] ${textSub} mt-1`}>{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </>)}

            {/* ═══ TAB: INTEGRATION ═══ */}
            {activeTab === 'integration' && (
                <div className="space-y-6">
                    {/* Section 1: Gateway Comparison */}
                    <div>
                        <h3 className={`text-sm font-bold ${textMain} mb-3 flex items-center gap-2`}><Landmark size={16} className="text-primary" /> Comparativo de Gateways de Pagamento</h3>
                        <p className={`text-xs ${textSub} mb-4`}>Taxas reais do mercado brasileiro para cobrança recorrente de assinaturas.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Asaas */}
                            <div className={`${bgCard} border-2 border-primary/40 rounded-xl overflow-hidden ${shadowClass} relative`}>
                                <div className="absolute top-3 right-3"><span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold border border-primary/20 flex items-center gap-1"><Star size={10} /> Recomendado</span></div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center"><Landmark size={20} className="text-white" /></div>
                                        <div><h4 className={`font-bold ${textMain}`}>Asaas</h4><p className={`text-[10px] ${textSub}`}>Fintech brasileira · PMEs</p></div></div>
                                    <div className="space-y-2.5 mb-4">
                                        <div className="flex justify-between text-xs"><span className={textSub}>Mensalidade</span><span className={`font-bold text-emerald-500`}>Grátis</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Cartão Crédito</span><span className={`font-bold ${textMain}`}>R$0,49 + 1,99%</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Boleto</span><span className={`font-bold ${textMain}`}>R$ 0,99</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Pix</span><span className={`font-bold ${textMain}`}>R$ 0,99</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>API Recorrência</span><span className="font-bold text-emerald-500">Completa</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>NF Automática</span><span className="font-bold text-emerald-500">Sim</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Inadimplência</span><span className="font-bold text-emerald-500">WhatsApp + Email + SMS</span></div>
                                    </div>
                                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-emerald-50 border border-emerald-200'}`}>
                                        <p className="text-[11px] text-emerald-500 font-medium"><CheckCircle size={10} className="inline mr-1" />Melhor custo-benefício para barbearias</p>
                                    </div>
                                </div>
                            </div>
                            {/* Stripe */}
                            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden ${shadowClass} relative opacity-60`}>
                                <div className="absolute top-3 right-3"><span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold border border-amber-500/20">Em Breve</span></div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center"><Globe size={20} className="text-white" /></div>
                                        <div><h4 className={`font-bold ${textMain}`}>Stripe</h4><p className={`text-[10px] ${textSub}`}>Global · SaaS &amp; Startups</p></div></div>
                                    <div className="space-y-2.5 mb-4">
                                        <div className="flex justify-between text-xs"><span className={textSub}>Mensalidade</span><span className={`font-bold text-emerald-500`}>Grátis</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Cartão Crédito</span><span className={`font-bold ${textMain}`}>3,99% + R$0,39</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Boleto</span><span className={`font-bold text-red-400`}>R$ 3,45</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Pix</span><span className={`font-bold ${textMain}`}>1,19%</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>API Recorrência</span><span className="font-bold text-emerald-500">Billing dedicado</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>NF Automática</span><span className={`font-bold text-red-400`}>Não</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Anti-Fraude</span><span className="font-bold text-emerald-500">Stripe Radar</span></div>
                                    </div>
                                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-violet-500/5 border border-violet-500/10' : 'bg-violet-50 border border-violet-200'}`}>
                                        <p className={`text-[11px] ${isDarkMode ? 'text-violet-400' : 'text-violet-600'} font-medium`}><Info size={10} className="inline mr-1" />Ideal para alcance global</p>
                                    </div>
                                </div>
                            </div>
                            {/* PagSeguro */}
                            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden ${shadowClass} relative opacity-60`}>
                                <div className="absolute top-3 right-3"><span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold border border-amber-500/20">Em Breve</span></div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center"><Wallet size={20} className="text-white" /></div>
                                        <div><h4 className={`font-bold ${textMain}`}>PagSeguro</h4><p className={`text-[10px] ${textSub}`}>PagBank · Varejo BR</p></div></div>
                                    <div className="space-y-2.5 mb-4">
                                        <div className="flex justify-between text-xs"><span className={textSub}>Mensalidade</span><span className={`font-bold text-emerald-500`}>Grátis</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Cartão Crédito</span><span className={`font-bold ${textMain}`}>0,79% a 4,99%</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Boleto</span><span className={`font-bold ${textMain}`}>Variável</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Pix</span><span className="font-bold text-emerald-500">0% promo</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>API Recorrência</span><span className={`font-bold ${textMain}`}>Básica</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>NF Automática</span><span className={`font-bold text-red-400`}>Não</span></div>
                                        <div className="flex justify-between text-xs"><span className={textSub}>Maquininha</span><span className="font-bold text-emerald-500">Integrada</span></div>
                                    </div>
                                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-500/5 border border-slate-500/10' : 'bg-slate-50 border border-slate-200'}`}>
                                        <p className={`text-[11px] ${textSub} font-medium`}><Info size={10} className="inline mr-1" />Para já clientes PagBank</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Configuration Panel */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                        <div className={`p-4 border-b ${borderCol} flex items-center justify-between`}>
                            <div>
                                <h3 className={`font-semibold ${textMain} flex items-center gap-2`}><Zap size={16} className="text-amber-500" /> Configuração do Gateway</h3>
                                <p className={`text-xs ${textSub}`}>Configure a integração com o gateway de pagamento.</p>
                            </div>
                            {integrationConfig?.active && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold border border-emerald-500/20">Conectado</span>}
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className={labelCls}><Landmark size={12} /> Gateway</label>
                                    <select className={inputCls} value="asaas"
                                        onChange={() => toast.info('Gateway fixo', 'Atualmente apenas o Asaas está disponível.')}>
                                        <option value="asaas">Asaas</option>
                                        <option value="stripe" disabled>Stripe — Em Breve</option>
                                        <option value="pagseguro" disabled>PagSeguro — Em Breve</option>
                                    </select>
                                </div>
                                <div><label className={labelCls}><Shield size={12} /> Ambiente</label>
                                    <select className={inputCls} value={integrationConfig.environment}
                                        onChange={e => setIntegrationConfig(prev => ({...prev, environment: e.target.value as any}))}>
                                        <option value="sandbox">Sandbox (Testes)</option>
                                        <option value="production">Produção</option>
                                    </select>
                                </div>
                            </div>
                            <div><label className={labelCls}><CreditCard size={12} /> API Key</label>
                                <div className="flex gap-2">
                                    <input type={showApiKey ? 'text' : 'password'} className={`flex-1 ${inputCls}`}
                                        placeholder="$aact_xxxxxxxxxx..."
                                        value={integrationConfig.apiKey || ''}
                                        onChange={e => setIntegrationConfig(prev => ({...prev, apiKey: e.target.value}))} />
                                    <button className={`px-3 py-2 rounded-lg border ${borderCol} ${textSub} hover:opacity-80 transition`}
                                        onClick={() => setShowApiKey(!showApiKey)}>
                                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div><label className={labelCls}><Link size={12} /> Webhook URL</label>
                                <div className="flex gap-2">
                                    <input type="text" className={`flex-1 ${inputCls}`}
                                        value={`${window.location.origin}/api/asaas-webhook`} readOnly />
                                    <button className={`px-3 py-2 rounded-lg border ${borderCol} ${textSub} hover:opacity-80 transition`}
                                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/asaas-webhook`); toast.success('Copiado!'); }}>
                                        Copiar
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[{ key: 'enableCredit', label: 'Crédito' }, { key: 'enableBoleto', label: 'Boleto' }, { key: 'enablePix', label: 'PIX' }].map(m => (
                                    <label key={m.key} className={`flex items-center gap-2 p-3 rounded-lg border ${borderCol} cursor-pointer`}>
                                        <input type="checkbox" checked={integrationConfig[m.key as keyof BillingGatewayConfig] as boolean}
                                            onChange={e => setIntegrationConfig(prev => ({...prev, [m.key]: e.target.checked}))}
                                            className="accent-primary" />
                                        <span className={`text-sm ${textMain}`}>{m.label}</span>
                                    </label>
                                ))}
                            </div>
                            {/* Advanced Config */}
                            <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                <p className={`text-xs font-bold ${textMain} flex items-center gap-1.5`}><Zap size={12} className="text-primary" /> Configuração Avançada</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { key: 'autoCharge', label: 'Cobrança Automática' },
                                        { key: 'autoCreateCustomer', label: 'Criar Cliente no Gateway' },
                                        { key: 'sendNotifications', label: 'Enviar Notificações' },
                                    ].map(t => (
                                        <label key={t.key} className={`flex items-center gap-2 p-2.5 rounded-lg border ${borderCol} cursor-pointer text-xs`}>
                                            <input type="checkbox" checked={integrationConfig[t.key as keyof BillingGatewayConfig] as boolean}
                                                onChange={e => setIntegrationConfig(prev => ({...prev, [t.key]: e.target.checked}))}
                                                className="accent-primary" />
                                            <span className={textMain}>{t.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className={`text-[10px] font-medium ${textSub} mb-1 block`}>Dias antes venc.</label>
                                        <input type="number" min={1} max={30} className={inputCls}
                                            value={integrationConfig.daysBeforeDue}
                                            onChange={e => setIntegrationConfig(prev => ({...prev, daysBeforeDue: +e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-medium ${textSub} mb-1 block`}>Multa (%)</label>
                                        <input type="number" min={0} max={20} step={0.5} className={inputCls}
                                            value={integrationConfig.finePercent}
                                            onChange={e => setIntegrationConfig(prev => ({...prev, finePercent: +e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-medium ${textSub} mb-1 block`}>Juros mensal (%)</label>
                                        <input type="number" min={0} max={10} step={0.5} className={inputCls}
                                            value={integrationConfig.interestPercent}
                                            onChange={e => setIntegrationConfig(prev => ({...prev, interestPercent: +e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-medium ${textSub} mb-1 block`}>Tentativas máx.</label>
                                        <input type="number" min={1} max={10} className={inputCls}
                                            value={integrationConfig.maxRetries}
                                            onChange={e => setIntegrationConfig(prev => ({...prev, maxRetries: +e.target.value}))} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button className={`flex-1 py-3 rounded-lg font-bold text-sm transition border ${borderCol} ${textMain} hover:opacity-80`}
                                    disabled={integrationTesting || !integrationConfig?.apiKey}
                                    onClick={async () => {
                                        setIntegrationTesting(true);
                                        try {
                                            const r = await testAsaasConnection(integrationConfig?.apiKey, integrationConfig?.environment);
                                            toast.success('Conexão OK!', `Saldo: R$ ${r.balance?.toFixed(2) || '0.00'} (${r.environment})`);
                                        } catch (err: any) { toast.error('Erro', err.message); }
                                        finally { setIntegrationTesting(false); }
                                    }}>
                                    {integrationTesting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : <Zap size={14} className="inline mr-2" />}
                                    Testar Conexão
                                </button>
                                <button className="flex-1 py-3 bg-primary text-white font-bold rounded-lg text-sm hover:opacity-90 transition"
                                    disabled={!integrationConfig?.apiKey}
                                    onClick={async () => {
                                        if (!integrationConfig) return;
                                        const r = await saveBillingConfig(integrationConfig);
                                        if (r.success) toast.success('Configuração salva!');
                                        else toast.error('Erro', r.error || '');
                                    }}>
                                    Salvar Configuração
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Integration Status */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Gateway', value: integrationConfig.apiKey ? 'Asaas' : 'Não configurado', icon: Link, color: integrationConfig.apiKey ? 'text-emerald-500' : 'text-slate-400', bg: integrationConfig.apiKey ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDarkMode ? 'bg-slate-500/10' : 'bg-slate-50') },
                            { label: 'Cobranças Auto', value: integrationConfig.autoCharge ? 'Ativado' : 'Desativado', icon: Repeat, color: integrationConfig.autoCharge ? 'text-blue-500' : 'text-slate-400', bg: integrationConfig.autoCharge ? (isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50') : (isDarkMode ? 'bg-slate-500/10' : 'bg-slate-50') },
                            { label: 'Ambiente', value: integrationConfig.environment === 'production' ? 'Produção' : 'Sandbox', icon: Shield, color: integrationConfig.environment === 'production' ? 'text-red-500' : 'text-amber-500', bg: integrationConfig.environment === 'production' ? (isDarkMode ? 'bg-red-500/10' : 'bg-red-50') : (isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50') },
                            { label: 'Notificações', value: integrationConfig.sendNotifications ? 'Ativado' : 'Desativado', icon: Zap, color: integrationConfig.sendNotifications ? 'text-emerald-500' : 'text-slate-400', bg: integrationConfig.sendNotifications ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDarkMode ? 'bg-slate-500/10' : 'bg-slate-50') },
                        ].map((s, i) => (
                            <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 ${shadowClass} flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon size={18} className={s.color} /></div>
                                <div><p className={`text-xs ${textSub}`}>{s.label}</p><p className={`text-sm font-bold ${s.color}`}>{s.value}</p></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
};
