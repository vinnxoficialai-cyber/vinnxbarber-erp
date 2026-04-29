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
    getBillingConfig, saveBillingConfig,
    getSubscriptionInterests, updateSubscriptionInterestStatus, deleteSubscriptionInterest,
} from '../lib/dataService';
import type { SubscriptionInterest } from '../lib/dataService';
import { testAsaasConnection, createAsaasCustomer, createAsaasSubscription, tokenizeCreditCard, updateAsaasSubscription, cancelAsaasSubscription, configureAsaasWebhook, getAsaasWebhookStatus } from '../lib/asaasService';
import type { BillingGatewayConfig } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';

interface AssinaturasProps { isDarkMode?: boolean; currentUser: TeamMember; }
type PageTab = 'plans' | 'subscribers' | 'dashboard' | 'history' | 'integration';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    active: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
    pending_payment: { label: 'Aguardando Pgto', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
    paused: { label: 'Pausado', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Pause },
    cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
    overdue: { label: 'Inadimplente', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: AlertCircle },
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

export const Assinaturas: React.FC<AssinaturasProps> = ({ isDarkMode: _isDarkMode, currentUser }) => {
    const { permissions: contextPermissions } = useAppData();
    const { filteredServices: services, filteredClients: clients, filteredMembers: members, filteredProducts: products, filteredTransactions: transactions, filteredComandas: comandas, selectedUnitId } = useFilteredData();
    const isUnitFiltering = selectedUnitId !== 'all';
    const { canCreate } = usePermissions(currentUser, contextPermissions);
    const confirm = useConfirm();
    const toast = useToast();
    // Semantic tokens — auto dark mode via CSS variables
    const isDarkMode = _isDarkMode ?? document.documentElement.classList.contains('dark');
    const textMain = 'text-foreground';
    const textSub = 'text-muted-foreground';
    const bgCard = 'bg-card';
    const borderCol = 'border-border';
    const bgInput = 'bg-muted/50';
    const shadowClass = 'shadow-sm dark:shadow-none';
    const inputCls = `w-full bg-transparent border border-input rounded-lg p-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none`;
    const labelCls = `block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1`;

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
        planId: '', clientId: '', clientName: '', cpfCnpj: '', status: 'active' as Subscription['status'],
        startDate: new Date().toISOString().split('T')[0], paymentDay: 5,
        paymentMethod: '' as string, cardBrand: '', cardLast4: '', billingEmail: '',
        // Full card fields for ASAAS
        cardNumber: '', cardHolderName: '', cardExpiryMonth: '', cardExpiryYear: '', cardCvv: '',
        holderCpf: '', holderPostalCode: '', holderAddressNumber: '', holderPhone: '',
        soldBy: '', soldByName: '', saleChannel: '', saleCommission: 0, saleCommissionType: 'percentage' as string,
        autoRenew: true, cancellationReason: '', notes: '',
    };
    const [subForm, setSubForm] = useState(defaultSubForm);
    const [subModalSection, setSubModalSection] = useState(0);
    const SUB_SECTIONS = ['Dados', 'Pagamento', 'Venda & Contrato'];
    const [newBenefit, setNewBenefit] = useState('');
    const [interests, setInterests] = useState<SubscriptionInterest[]>([]);
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
        apiKey: '', active: true, autoCreateCustomer: true, autoCharge: true,
        sendNotifications: true, daysBeforeDue: 5, maxRetries: 3, finePercent: 2,
        interestPercent: 1, enableCredit: true, enableBoleto: true, enablePix: true,
    };
    const [integrationConfig, setIntegrationConfig] = useState<BillingGatewayConfig>(defaultBillingConfig);
    const [integrationTesting, setIntegrationTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => { (async () => { setLoading(true); try { const [p, s, bc, si] = await Promise.all([getSubscriptionPlans(), getSubscriptions(), getBillingConfig(), getSubscriptionInterests()]); setPlans(p); setSubscriptions(s); if (bc) setIntegrationConfig(bc); setInterests(si); } finally { setLoading(false); } })(); }, []);
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

        // ═══ SYNC PRICE TO ASAAS (when editing and price changed) ═══
        if (editingPlanId && integrationConfig.apiKey) {
            const oldPlan = plans.find(p => p.id === editingPlanId);
            if (oldPlan && oldPlan.price !== plan.price) {
                // Find all active/pending subs for this plan that have a gateway ID
                const affectedSubs = subscriptions.filter(s => 
                    s.planId === editingPlanId && 
                    (s.status === 'active' || s.status === 'pending_payment') &&
                    s.gatewaySubscriptionId
                );
                if (affectedSubs.length > 0) {
                    toast.info('Atualizando ASAAS...', `Sincronizando novo valor (R$ ${plan.price.toFixed(2)}) em ${affectedSubs.length} assinatura(s)...`);
                    let updated = 0;
                    const failedSubs: string[] = [];
                    for (const sub of affectedSubs) {
                        try {
                            await updateAsaasSubscription({
                                gatewaySubscriptionId: sub.gatewaySubscriptionId!,
                                value: plan.price,
                                description: `Plano ${plan.name}`,
                            });
                            updated++;
                        } catch (err: any) {
                            failedSubs.push(sub.clientName || sub.id);
                            console.error(`[ASAAS] Failed to update sub ${sub.id}:`, err?.message);
                        }
                    }
                    if (updated === affectedSubs.length) {
                        toast.success('ASAAS atualizado!', `${updated} assinatura(s) atualizada(s) para R$ ${plan.price.toFixed(2)}.`);
                    } else if (failedSubs.length > 0) {
                        toast.warning(
                            'Ação necessária no ASAAS',
                            `Plano local atualizado ✓\n${updated > 0 ? `${updated} assinatura(s) sincronizada(s) ✓\n` : ''}${failedSubs.length} assinatura(s) precisam de ajuste manual no painel ASAAS (cartão de crédito com faturas pagas não permite alteração automática de valor).`,
                            true
                        );
                    }
                }
            }
        }

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
        let reuseSubId: string | undefined;
        if (!editingSubId) {
            const targetUnit = selectedUnitId !== 'all' ? selectedUnitId : undefined;
            const existing = subscriptions.find(s =>
                s.clientId === subForm.clientId &&
                (s.status === 'active' || s.status === 'pending_payment') &&
                s.unitId === targetUnit
            );
            if (existing) {
                toast.error('Assinatura existente', 'Este cliente já possui uma assinatura ativa nesta unidade.');
                return;
            }
            // If there's an overdue sub for this client (e.g. card was refused), reuse its ID
            const overdueExisting = subscriptions.find(s =>
                s.clientId === subForm.clientId &&
                s.status === 'overdue' &&
                s.unitId === targetUnit
            );
            reuseSubId = overdueExisting?.id;
        }

        // ═══ PAYMENT VALIDATION (when ASAAS is configured) ═══
        if (!editingSubId && integrationConfig.apiKey) {
            if (!subForm.paymentMethod) {
                toast.error('Forma de pagamento obrigatória', 'Selecione uma forma de pagamento na aba "Pagamento".');
                setSubModalSection(1);
                return;
            }

            // CPF validation
            const clientForValidation = clients.find(c => c.id === subForm.clientId);
            const hasCpf = (clientForValidation as any)?.cpf || (clientForValidation as any)?.cpfCnpj || subForm.cpfCnpj?.replace(/\D/g, '');
            if (!hasCpf) {
                toast.error('CPF obrigatório', 'Informe o CPF/CNPJ do cliente para cobrança automática.');
                setSubModalSection(0);
                return;
            }

            // Credit card fields validation
            if (subForm.paymentMethod === 'credit') {
                const missing: string[] = [];
                if (!subForm.cardNumber || subForm.cardNumber.replace(/\s/g, '').length < 13) missing.push('Número do cartão');
                if (!subForm.cardHolderName) missing.push('Nome no cartão');
                if (!subForm.cardExpiryMonth) missing.push('Mês de validade');
                if (!subForm.cardExpiryYear) missing.push('Ano de validade');
                if (!subForm.cardCvv || subForm.cardCvv.length < 3) missing.push('CVV');
                if (!subForm.holderCpf || subForm.holderCpf.replace(/\D/g, '').length < 11) missing.push('CPF do titular');
                if (!subForm.holderPostalCode || subForm.holderPostalCode.replace(/\D/g, '').length < 8) missing.push('CEP');
                if (!subForm.holderAddressNumber) missing.push('Nº Endereço');
                if (!subForm.holderPhone || subForm.holderPhone.replace(/\D/g, '').length < 10) missing.push('Telefone do titular');

                if (missing.length > 0) {
                    toast.error('Dados do cartão incompletos', `Preencha: ${missing.join(', ')}`);
                    setSubModalSection(1);
                    return;
                }
            }
        }

        const client = clients.find(c => c.id === subForm.clientId);
        const sub: Subscription = {
            id: editingSubId || reuseSubId || crypto.randomUUID(),
            planId: subForm.planId, clientId: subForm.clientId,
            clientName: client?.name || subForm.clientName,
            // New subs with ASAAS start as pending_payment; without ASAAS or editing, use form value
            status: (!editingSubId && integrationConfig.apiKey) ? 'pending_payment' : subForm.status,
            startDate: subForm.startDate, paymentDay: subForm.paymentDay,
            usesThisMonth: editingSubId ? (subscriptions.find(s => s.id === editingSubId)?.usesThisMonth ?? 0) : 0,
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

        // ═══ SYNC CANCELLATION WITH ASAAS (when editing status to cancelled) ═══
        if (editingSubId && subForm.status === 'cancelled' && integrationConfig.apiKey) {
            const existingSub = subscriptions.find(s => s.id === editingSubId);
            if (existingSub?.gatewaySubscriptionId && existingSub.status !== 'cancelled') {
                try {
                    toast.info('Cancelando no ASAAS...', 'Cancelando cobrança recorrente...');
                    await cancelAsaasSubscription({ gatewaySubscriptionId: existingSub.gatewaySubscriptionId, subscriptionId: editingSubId });
                    toast.success('ASAAS atualizado', 'Cobrança recorrente cancelada no gateway.');
                } catch (err: any) {
                    console.error('ASAAS cancel sync error:', err);
                    toast.warning('Aviso ASAAS', `Cancelamento local OK, mas ASAAS: ${err.message}`);
                }
            }
        }

        // ═══ SYNC PLAN CHANGE WITH ASAAS (when editing and plan changed) ═══
        if (editingSubId && integrationConfig.apiKey && subForm.status !== 'cancelled') {
            const existingSub = subscriptions.find(s => s.id === editingSubId);
            if (existingSub?.gatewaySubscriptionId && existingSub.planId !== subForm.planId) {
                const newPlan = plans.find(p => p.id === subForm.planId);
                if (newPlan) {
                    try {
                        toast.info('Atualizando ASAAS...', `Sincronizando novo plano (${newPlan.name} - R$ ${newPlan.price.toFixed(2)})...`);
                        await updateAsaasSubscription({
                            gatewaySubscriptionId: existingSub.gatewaySubscriptionId,
                            value: newPlan.price,
                            description: `Plano ${newPlan.name}`,
                        });
                        toast.success('ASAAS atualizado', `Plano alterado para ${newPlan.name}.`);
                    } catch (err: any) {
                        console.error('ASAAS plan change sync error:', err);
                        toast.warning('Ação necessária no ASAAS', `Plano atualizado localmente ✓ Atualize o valor manualmente no painel ASAAS para esta assinatura (cartão de crédito com faturas pagas não permite alteração automática).`, true);
                    }
                }
            }
        }

        // ═══ SAVE CPF TO CLIENT IF PROVIDED ═══
        const cpfValue = subForm.cpfCnpj?.replace(/\D/g, '');
        if (cpfValue && client && !(client as any)?.cpf) {
            try {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('clients').update({ cpf: subForm.cpfCnpj }).eq('id', client.id);
            } catch (err) { console.error('CPF save error:', err); }
        }

        // ═══ AUTO-SYNC WITH ASAAS (only for new subscriptions) ═══
        if (!editingSubId && integrationConfig.apiKey) {
            const plan = plans.find(p => p.id === sub.planId);
            const clientCpf = cpfValue || (client as any)?.cpf?.replace(/\D/g, '') || (client as any)?.cpfCnpj?.replace(/\D/g, '');
            try {
                // 1. Always create/refresh ASAAS customer (avoids stale/removed customer IDs)
                let asaasCustomerId: string | null = null;
                if (client && clientCpf) {
                    toast.info('Sincronizando...', 'Registrando cliente no ASAAS...');
                    const custResult = await createAsaasCustomer({
                        clientId: client.id,
                        name: client.name,
                        cpfCnpj: clientCpf,
                        email: client.email || subForm.billingEmail || undefined,
                        phone: client.phone || undefined,
                    });
                    asaasCustomerId = custResult.customerId;
                }

                // 2. Tokenize credit card FIRST (validate before creating subscription)
                if (asaasCustomerId && plan) {
                    const recurrenceMap: Record<string, string> = {
                        monthly: 'MONTHLY', quarterly: 'QUARTERLY',
                        semiannual: 'SEMIANNUALLY', annual: 'YEARLY',
                    };
                    const billingTypeMap: Record<string, string> = {
                        credit: 'CREDIT_CARD', boleto: 'BOLETO', pix: 'PIX',
                    };
                    const today = new Date().toISOString().split('T')[0];

                    let creditCardToken: string | undefined;
                    let cardData: any = null;
                    let holderData: any = null;

                    // Step 2a: Prepare card data if credit card payment
                    if (sub.paymentMethod === 'credit' && subForm.cardNumber) {
                        cardData = {
                            holderName: subForm.cardHolderName,
                            number: subForm.cardNumber.replace(/\s/g, ''),
                            expiryMonth: subForm.cardExpiryMonth,
                            expiryYear: subForm.cardExpiryYear,
                            ccv: subForm.cardCvv,
                        };
                        holderData = {
                            name: subForm.cardHolderName || client?.name,
                            email: subForm.billingEmail || client?.email,
                            cpfCnpj: (subForm.holderCpf || subForm.cpfCnpj || '').replace(/\D/g, ''),
                            postalCode: subForm.holderPostalCode?.replace(/\D/g, ''),
                            addressNumber: subForm.holderAddressNumber,
                            phone: (subForm.holderPhone || client?.phone || '').replace(/\D/g, ''),
                        };

                        // Try tokenization (optional — some accounts don't have permission)
                        try {
                            toast.info('Validando cartão...', 'Verificando dados do cartão de crédito...');
                            const tokenResult = await tokenizeCreditCard({
                                customerId: asaasCustomerId,
                                creditCard: cardData,
                                creditCardHolderInfo: holderData,
                            });
                            creditCardToken = tokenResult.creditCardToken;
                            toast.success('Cartão validado!', `${tokenResult.creditCardBrand} ****${tokenResult.creditCardNumber}`);
                        } catch (tokenErr: any) {
                            // Check if it's a permission error (account doesn't support tokenization)
                            const isPermissionError = tokenErr.message?.includes('permissão') || tokenErr.message?.includes('permission');
                            if (isPermissionError) {
                                // Tokenization not available — proceed with raw card data
                                console.log('[ASAAS] Tokenization not available, using raw card data');
                            } else {
                                // Actual card error — block subscription
                                toast.error('Cartão recusado!', tokenErr.message || 'Verifique os dados do cartão e tente novamente.');
                                const { supabase: sbRevert } = await import('../lib/supabase');
                                await sbRevert.from('subscriptions').update({ status: 'overdue' }).eq('id', sub.id);
                                setSubscriptions(await getSubscriptions());
                                setSubModalSection(1);
                                return;
                            }
                        }
                    }

                    // Step 2b: Create subscription with token or raw card data
                    toast.info('Processando pagamento...', sub.paymentMethod === 'credit' ? 'Cobrando cartão...' : 'Gerando cobrança...');

                    const asaasResult = await createAsaasSubscription({
                        customerId: asaasCustomerId,
                        subscriptionId: sub.id,
                        value: plan.price,
                        billingType: billingTypeMap[sub.paymentMethod || ''] || 'UNDEFINED',
                        nextDueDate: today,
                        description: `Plano ${plan.name}`,
                        cycle: recurrenceMap[plan.recurrence] || 'MONTHLY',
                        // Use token if available, otherwise raw card data
                        ...(creditCardToken 
                            ? { creditCardToken } 
                            : (cardData ? { creditCard: cardData, creditCardHolderInfo: holderData } : {})
                        ),
                    });

                    // 3. Check first payment status and update subscription accordingly
                    const { supabase: sb } = await import('../lib/supabase');
                    if (sub.paymentMethod === 'credit' && asaasResult.firstPaymentStatus) {
                        const payStatus = asaasResult.firstPaymentStatus;
                        if (payStatus === 'CONFIRMED' || payStatus === 'RECEIVED') {
                            // ✅ Payment confirmed — ACTIVATE subscription
                            await sb.from('subscriptions').update({ status: 'active' }).eq('id', sub.id);
                            toast.success('Pagamento confirmado!', `R$ ${plan.price.toFixed(2)} cobrado com sucesso. Assinatura ativa!`);
                        } else if (payStatus === 'PENDING') {
                            // ⏳ Payment pending — keep as pending_payment
                            toast.warning('Pagamento pendente', 'Peça ao cliente para verificar as notificações do banco/app do cartão e aprovar a cobrança. A assinatura será ativada automaticamente após a confirmação.');
                        } else if (payStatus === 'REFUSED' || payStatus === 'OVERDUE') {
                            // ❌ Payment refused — mark as overdue
                            await sb.from('subscriptions').update({ status: 'overdue' }).eq('id', sub.id);
                            toast.error('Pagamento recusado!', 'O banco recusou a cobrança. Peça ao cliente para: 1) Verificar notificações do banco/app do cartão e aprovar a transação. 2) Verificar se o cartão está liberado para compras online. Depois, tente novamente.');
                        } else {
                            toast.info('ASAAS sincronizado', `Assinatura criada. Status: ${payStatus}. Aguardando confirmação.`);
                        }
                    } else {
                        // Non-credit (boleto/pix) — stays as pending_payment until webhook confirms
                        toast.info('Cobrança gerada!', `Aguardando pagamento via ${sub.paymentMethod === 'boleto' ? 'boleto' : 'Pix'}. A assinatura será ativada após confirmação.`);
                    }
                } else if (!asaasCustomerId) {
                    toast.warning('ASAAS parcial', 'Cliente sem CPF — assinatura criada localmente, mas não sincronizada com o gateway.');
                }
            } catch (err: any) {
                console.error('ASAAS sync error:', err);
                // Mark subscription as overdue since payment couldn't be processed
                try {
                    const { supabase: sb2 } = await import('../lib/supabase');
                    await sb2.from('subscriptions').update({ status: 'overdue' }).eq('id', sub.id);
                } catch (_) {}
                toast.error('Falha na cobrança', `${err.message}. Peça ao cliente para verificar as notificações do banco e aprovar a transação, depois tente novamente.`);
            }
        }

        setSubscriptions(await getSubscriptions());
        if (!editingSubId && integrationConfig.apiKey) { /* toast already shown by ASAAS sync */ }
        else toast.success(editingSubId ? 'Assinatura atualizada' : 'Assinatura criada');
        setIsSubModalOpen(false);
    };
    const handleDeleteSub = async (id: string) => {
        if (!await confirm({ title: 'Excluir Assinatura', message: 'Deseja excluir esta assinatura? Isso também cancelará a cobrança no gateway de pagamento.', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' })) return;
        
        // Cancel in ASAAS first if has gateway subscription
        const sub = subscriptions.find(s => s.id === id);
        if (sub?.gatewaySubscriptionId && integrationConfig.apiKey) {
            try {
                toast.info('Cancelando...', 'Cancelando cobrança no ASAAS...');
                await cancelAsaasSubscription({ gatewaySubscriptionId: sub.gatewaySubscriptionId, subscriptionId: sub.id });
            } catch (err: any) {
                console.error('ASAAS cancel error:', err);
                toast.warning('Aviso', `Cobrança ASAAS não cancelada: ${err.message}. A assinatura local será excluída.`);
            }
        }
        
        const r = await deleteSubscription(id);
        if (!r.success) { toast.error('Erro', r.error || ''); return; }
        setSubscriptions(p => p.filter(s => s.id !== id));
        toast.success('Assinatura excluída', sub?.gatewaySubscriptionId ? 'Cobrança cancelada no ASAAS e assinatura removida.' : 'Assinatura removida.');
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
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center bg-muted/50`}>
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
                                            <thead className={`bg-muted/30`}>
                                                <tr><th className="px-3 py-2 text-left">Serviço</th><th className="px-3 py-2">Desconto</th><th className="px-3 py-2">Limite</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2"></th></tr>
                                            </thead>
                                            <tbody className={`divide-y divide-border`}>
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
                                            <thead className={`bg-muted/30`}>
                                                <tr><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2">Desconto</th><th className="px-3 py-2">Qtd/mês</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2"></th></tr>
                                            </thead>
                                            <tbody className={`divide-y divide-border`}>
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
                                                    : `border-border text-muted-foreground hover:border-primary`}`}>{d.label}</button>
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
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center bg-muted/50`}>
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
                        <form autoComplete="off" className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {/* Section 0: Dados */}
                            {subModalSection === 0 && (<>
                                <div><label className={labelCls}><Users size={12} /> Cliente</label>
                                    <CustomDropdown searchable value={subForm.clientId} onChange={v => { const c = clients.find(c => c.id === v); setSubForm(p => ({ ...p, clientId: v, clientName: c?.name || '', cpfCnpj: (c as any)?.cpf || (c as any)?.cpfCnpj || '' })); }} options={[{ value: '', label: 'Selecionar cliente...' }, ...clients.filter(c => c.status === 'Active').map(c => ({ value: c.id, label: c.name }))]} isDarkMode={isDarkMode} /></div>
                                {/* CPF/CNPJ — obrigatório para integração ASAAS */}
                                {subForm.clientId && (() => {
                                    const selClient = clients.find(c => c.id === subForm.clientId);
                                    const hasCpf = (selClient as any)?.cpf || (selClient as any)?.cpfCnpj;
                                    return (
                                        <div>
                                            <label className={labelCls}><Hash size={12} /> CPF / CNPJ {hasCpf && <CheckCircle size={10} className="text-emerald-500" />}</label>
                                            {hasCpf ? (
                                                <p className={`text-sm ${textMain} px-2.5 py-2`}>{(selClient as any)?.cpf || (selClient as any)?.cpfCnpj} <span className="text-emerald-500 text-[10px] ml-1">✓ cadastrado</span></p>
                                            ) : (
                                                <>
                                                    <input type="text" className={inputCls}
                                                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                                                        value={subForm.cpfCnpj || ''}
                                                        onChange={e => {
                                                            let v = e.target.value.replace(/\D/g, '');
                                                            if (v.length <= 11) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
                                                            else v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
                                                            setSubForm(p => ({ ...p, cpfCnpj: v }));
                                                        }}
                                                        maxLength={18} />
                                                    <p className={`text-[10px] mt-1 text-amber-500`}>
                                                        <AlertCircle size={10} className="inline mr-1" />Obrigatório para cobrança automática via ASAAS. Será salvo no cadastro do cliente.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}
                                <div><label className={labelCls}><Crown size={12} /> Plano</label>
                                    <CustomDropdown value={subForm.planId} onChange={v => setSubForm(p => ({ ...p, planId: v }))} options={[{ value: '', label: 'Selecionar plano...' }, ...plans.filter(p => p.active).map(p => ({ value: p.id, label: `${p.name} — ${formatCurrency(p.price)}` }))]} isDarkMode={isDarkMode} /></div>
                                {subForm.planId && (() => {
                                    const selPlan = plans.find(p => p.id === subForm.planId);
                                    if (!selPlan) return null;
                                    return (
                                        <div className={`p-3 rounded-lg border border-primary/20 bg-primary/5`}>
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
                                        <CustomDropdown value={subForm.status} onChange={v => setSubForm(p => ({ ...p, status: v as any }))} options={[{ value: 'active', label: 'Ativo' }, { value: 'pending_payment', label: 'Aguardando Pgto' }, { value: 'paused', label: 'Pausado' }, { value: 'cancelled', label: 'Cancelado' }, { value: 'overdue', label: 'Inadimplente' }]} isDarkMode={isDarkMode} /></div>
                                </div>
                            </>)}
                            {/* Section 1: Pagamento */}
                            {subModalSection === 1 && (<>
                                <div><label className={labelCls}><Wallet size={12} /> Forma de Pagamento</label>
                                    <CustomDropdown value={subForm.paymentMethod} onChange={v => setSubForm(p => ({ ...p, paymentMethod: v }))} options={[{ value: '', label: 'Não definido' }, { value: 'credit', label: 'Cartão de Crédito' }, { value: 'boleto', label: 'Boleto Bancário' }, { value: 'pix', label: 'Pix' }]} isDarkMode={isDarkMode} /></div>
                                {subForm.paymentMethod === 'credit' && (
                                    <div className={`p-4 rounded-lg border ${borderCol} space-y-3`}>
                                        <p className={`text-xs font-bold ${textMain} flex items-center gap-1`}><CreditCard size={14} className="text-primary" /> Dados do Cartão</p>
                                        <div>
                                            <label className={labelCls}>Número do Cartão</label>
                                            <input type="text" className={inputCls} placeholder="0000 0000 0000 0000"
                                                value={subForm.cardNumber}
                                                onChange={e => {
                                                    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
                                                    v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
                                                    setSubForm(p => ({ ...p, cardNumber: v }));
                                                }}
                                                maxLength={19} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Nome no Cartão</label>
                                            <input type="text" className={inputCls} placeholder="NOME COMO IMPRESSO NO CARTÃO"
                                                value={subForm.cardHolderName}
                                                onChange={e => setSubForm(p => ({ ...p, cardHolderName: e.target.value.toUpperCase() }))} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={labelCls}>Mês</label>
                                                <CustomDropdown value={subForm.cardExpiryMonth} onChange={v => setSubForm(p => ({ ...p, cardExpiryMonth: v }))} options={[{ value: '', label: 'MM' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') }))]} isDarkMode={isDarkMode} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Ano</label>
                                                <CustomDropdown value={subForm.cardExpiryYear} onChange={v => setSubForm(p => ({ ...p, cardExpiryYear: v }))} options={[{ value: '', label: 'AAAA' }, ...Array.from({ length: 10 }, (_, i) => { const y = new Date().getFullYear() + i; return { value: String(y), label: String(y) }; })]} isDarkMode={isDarkMode} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>CVV</label>
                                                <input type="password" className={inputCls} placeholder="•••" maxLength={4}
                                                    value={subForm.cardCvv}
                                                    onChange={e => setSubForm(p => ({ ...p, cardCvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                                            </div>
                                        </div>
                                        <div className={`mt-2 p-3 rounded-lg border border-border bg-muted/30`}>
                                            <p className={`text-[10px] font-bold ${textMain} mb-2`}>Dados do Titular</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={`text-[10px] ${textSub} mb-0.5 block`}>CPF do Titular</label>
                                                    <input type="text" className={inputCls} placeholder="000.000.000-00"
                                                        value={subForm.holderCpf}
                                                        onChange={e => {
                                                            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                            v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
                                                            setSubForm(p => ({ ...p, holderCpf: v }));
                                                        }} maxLength={14} />
                                                </div>
                                                <div>
                                                    <label className={`text-[10px] ${textSub} mb-0.5 block`}>Telefone</label>
                                                    <input type="text" className={inputCls} placeholder="(00) 00000-0000"
                                                        value={subForm.holderPhone}
                                                        onChange={e => {
                                                            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                            v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                                                            setSubForm(p => ({ ...p, holderPhone: v }));
                                                        }} maxLength={15} />
                                                </div>
                                                <div>
                                                    <label className={`text-[10px] ${textSub} mb-0.5 block`}>CEP</label>
                                                    <input type="text" className={inputCls} placeholder="00000-000"
                                                        value={subForm.holderPostalCode}
                                                        onChange={e => {
                                                            let v = e.target.value.replace(/\D/g, '').slice(0, 8);
                                                            v = v.replace(/(\d{5})(\d{0,3})/, '$1-$2');
                                                            setSubForm(p => ({ ...p, holderPostalCode: v }));
                                                        }} maxLength={9} />
                                                </div>
                                                <div>
                                                    <label className={`text-[10px] ${textSub} mb-0.5 block`}>Nº Endereço</label>
                                                    <input type="text" className={inputCls} placeholder="123"
                                                        value={subForm.holderAddressNumber}
                                                        onChange={e => setSubForm(p => ({ ...p, holderAddressNumber: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>
                                        <p className={`text-[10px] text-emerald-500 flex items-center gap-1`}>
                                            <Shield size={10} /> Dados transmitidos com segurança via HTTPS para o ASAAS.
                                        </p>
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
                                    <div className={`p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10`}>
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
                        </form>
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
                            <div className={`p-4 border-b ${borderCol} flex justify-between items-center bg-muted/50`}>
                                <div>
                                    <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}><Crown size={18} className="text-primary" /> Assinantes — {modalPlan?.name || '—'}</h3>
                                    <p className={`text-xs ${textSub}`}>{planSubs.length} assinante{planSubs.length !== 1 ? 's' : ''} encontrado{planSubs.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button onClick={() => setPlanSubsModalPlanId(null)} className={textSub}><X size={20} /></button>
                            </div>
                            <div className={`px-4 py-3 border-b ${borderCol}`}>
                                <div className="relative"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={16} />
                                    <input type="text" value={planSubsSearch} onChange={e => setPlanSubsSearch(e.target.value)} placeholder="Buscar por nome..."
                                        className={`pl-9 pr-4 py-2 text-sm w-full border rounded-lg bg-transparent border-input text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {planSubs.length === 0 ? (
                                    <div className={`px-6 py-16 text-center ${textSub}`}><Users size={40} className="mx-auto mb-3 opacity-20" /><p className="text-sm">Nenhum assinante neste plano.</p>
                                        <button onClick={() => { setPlanSubsModalPlanId(null); openSubModalForPlan(planSubsModalPlanId); }} className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-600"><UserPlus size={14} className="inline mr-1" />Cadastrar Assinante</button>
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className={`bg-muted/30 text-foreground uppercase font-medium sticky top-0`}>
                                            <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Pagamento</th><th className="px-5 py-3">Consumo</th><th className="px-5 py-3">Início</th><th className="px-5 py-3 text-right">Ações</th></tr>
                                        </thead>
                                        <tbody className={`divide-y divide-border`}>
                                            {planSubs.map(sub => {
                                                const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active; const SI = cfg.icon;
                                                const max = sub.plan?.maxUsesPerMonth; const pct = max ? Math.min((sub.usesThisMonth / max) * 100, 100) : 0;
                                                const methodLabels: Record<string, string> = { credit: 'Cartão', boleto: 'Boleto', pix: 'Pix' };
                                                return (
                                                    <tr key={sub.id} className="hover:bg-muted/30">
                                                        <td className={`px-5 py-3 font-medium ${textMain}`}>{sub.clientName || '—'}</td>
                                                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${cfg.color}`}><SI size={10} />{cfg.label}</span>{sub.pendingPlanId && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">→ {sub.pendingPlanName}</span>}</td>
                                                        <td className={`px-5 py-3 text-xs ${textSub}`}>{sub.paymentMethod ? methodLabels[sub.paymentMethod] || sub.paymentMethod : '—'}</td>
                                                        <td className="px-5 py-3">{max ? (<div className="flex items-center gap-2"><div className={`w-16 h-1.5 rounded-full bg-muted`}><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div><span className={`text-xs ${textSub}`}>{sub.usesThisMonth}/{max}</span></div>) : <Infinity size={12} className={textSub} />}</td>
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
                    { label: 'MRR', value: formatCurrency(kpis.mrr), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Ativos', value: kpis.active.toString(), icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Churn', value: `${kpis.churn.toFixed(1)}%`, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
                    { label: 'LTV Médio', value: formatCurrency(kpis.ltv), icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                    { label: 'Ticket Médio', value: formatCurrency(kpis.avg), icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Retenção', value: `${kpis.retentionRate.toFixed(1)}%`, icon: CheckCircle, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
                    { label: 'Inadimplentes', value: kpis.overdue.toString(), icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: 'Receita Anual', value: formatCurrency(kpis.totalRevenue), icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
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
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
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
                                            <div className={`p-2 rounded-lg bg-primary/10`}><Crown size={18} className="text-primary" /></div>
                                            <div><h3 className={`font-bold ${textMain}`}>{plan.name}</h3>
                                                {plan.description && <p className={`text-xs ${textSub} mt-0.5`}>{plan.description}</p>}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${plan.active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>{plan.active ? 'Ativo' : 'Inativo'}</span>
                                            {!plan.availableForSale && <span className={`px-2 py-0.5 rounded-full text-[10px] border border-border text-muted-foreground`}><EyeOff size={8} className="inline mr-0.5" />Oculto</span>}
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
                                        <button onClick={() => { setPlanSubsModalPlanId(plan.id); setPlanSubsSearch(''); }} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border border-border text-foreground hover:bg-muted flex items-center justify-center gap-1`}><Users size={12} /> Assinantes ({subsCount})</button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openPlanModal(plan)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border border-border text-foreground hover:bg-muted flex items-center justify-center gap-1`}><Pencil size={12} /> Editar</button>
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
                        className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full bg-transparent border-input text-foreground placeholder:text-muted-foreground`} />
                </div></div>
                <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                    <table className="w-full text-left text-sm">
                        <thead className={`bg-muted/30 text-foreground uppercase font-medium`}>
                            <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Plano</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Consumo</th><th className="px-6 py-4">Início</th><th className="px-6 py-4">Dia Pgto</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className={`divide-y divide-border`}>
                            {(() => {
                                const filtered = subscriptions.filter(s => !searchQuery || (s.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.plan?.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                                if (filtered.length === 0) return <tr><td colSpan={7} className={`px-6 py-12 text-center ${textSub}`}><Users size={32} className="mx-auto mb-2 opacity-30" />Nenhum assinante.</td></tr>;
                                return filtered.map(sub => {
                                    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active; const SI = cfg.icon;
                                    const max = sub.plan?.maxUsesPerMonth; const pct = max ? Math.min((sub.usesThisMonth / max) * 100, 100) : 0;
                                    return (
                                        <tr key={sub.id} className="hover:bg-muted/30">
                                            <td className={`px-6 py-3 font-medium ${textMain}`}>{sub.clientName || '—'}</td>
                                            <td className={`px-6 py-3 ${textSub}`}><Crown size={12} className="inline text-primary mr-1" />{sub.plan?.name || '—'}</td>
                                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${cfg.color}`}><SI size={10} />{cfg.label}</span></td>
                                            <td className="px-6 py-3">{max ? (<div className="flex items-center gap-2"><div className={`w-20 h-1.5 rounded-full bg-muted`}><div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div><span className={`text-xs ${textSub}`}>{sub.usesThisMonth}/{max}</span></div>) : <Infinity size={12} className={textSub} />}</td>
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

                {/* ═══ LEADS (Subscription Interests) ═══ */}
                {interests.length > 0 && (
                    <div className="mt-8">
                        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}>
                            <Target size={16} className="text-amber-500" />
                            Leads de Interesse
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                                {interests.filter(i => i.status === 'pending').length} pendente{interests.filter(i => i.status === 'pending').length !== 1 ? 's' : ''}
                            </span>
                        </h3>
                        <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                            <table className="w-full text-left text-sm">
                                <thead className={`bg-muted/30 text-foreground uppercase font-medium`}>
                                    <tr><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Plano</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Data</th><th className="px-6 py-3 text-right">Ações</th></tr>
                                </thead>
                                <tbody className={`divide-y divide-border`}>
                                    {interests.map(interest => {
                                        const statusColors: Record<string, string> = {
                                            pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                                            contacted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                                            converted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                                            dismissed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
                                        };
                                        const statusLabels: Record<string, string> = { pending: 'Pendente', contacted: 'Contatado', converted: 'Convertido', dismissed: 'Descartado' };
                                        return (
                                            <tr key={interest.id} className="hover:bg-muted/30">
                                                <td className={`px-6 py-3 font-medium ${textMain}`}>{interest.clientName || '—'}</td>
                                                <td className={`px-6 py-3 ${textSub}`}>{interest.planName || 'Geral'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${statusColors[interest.status] || ''}`}>
                                                        {statusLabels[interest.status] || interest.status}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-3 text-xs ${textSub}`}>{interest.createdAt ? new Date(interest.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {interest.status === 'pending' && (
                                                            <button onClick={async () => {
                                                                await updateSubscriptionInterestStatus(interest.id, 'contacted');
                                                                setInterests(p => p.map(i => i.id === interest.id ? { ...i, status: 'contacted' as const } : i));
                                                            }} className="text-blue-500 hover:underline text-xs font-medium">Contatei</button>
                                                        )}
                                                        {(interest.status === 'pending' || interest.status === 'contacted') && (
                                                            <button onClick={async () => {
                                                                await updateSubscriptionInterestStatus(interest.id, 'converted');
                                                                setInterests(p => p.map(i => i.id === interest.id ? { ...i, status: 'converted' as const } : i));
                                                            }} className="text-emerald-500 hover:underline text-xs font-medium">Convertido</button>
                                                        )}
                                                        {interest.status !== 'dismissed' && interest.status !== 'converted' && (
                                                            <button onClick={async () => {
                                                                await updateSubscriptionInterestStatus(interest.id, 'dismissed');
                                                                setInterests(p => p.map(i => i.id === interest.id ? { ...i, status: 'dismissed' as const } : i));
                                                            }} className="text-gray-500 hover:underline text-xs font-medium">Descartar</button>
                                                        )}
                                                        <button onClick={async () => {
                                                            await deleteSubscriptionInterest(interest.id);
                                                            setInterests(p => p.filter(i => i.id !== interest.id));
                                                        }} className="text-red-500 hover:underline text-xs font-medium"><Trash2 size={12} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
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
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${dashPeriod === p ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                                    {p === 'month' ? 'Este Mês' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Tudo'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 1: Executive KPIs with Goals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'MRR', value: formatCurrency(kpis.mrr), numVal: kpis.mrr, goal: DASHBOARD_GOALS.mrr, goalLabel: `Meta: ${formatCurrency(DASHBOARD_GOALS.mrr)}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', barColor: 'bg-emerald-500' },
                            { label: 'Assinantes', value: kpis.active.toString(), numVal: kpis.active, goal: DASHBOARD_GOALS.subscribers, goalLabel: `Meta: ${DASHBOARD_GOALS.subscribers}`, icon: Users, color: 'text-primary', bg: 'bg-primary/10', barColor: 'bg-primary' },
                            { label: 'Novas Vendas', value: kpis.newSales.toString(), numVal: kpis.newSales, goal: DASHBOARD_GOALS.newSales, goalLabel: `Meta: ${DASHBOARD_GOALS.newSales}`, icon: ShoppingBag, color: kpis.newSales >= DASHBOARD_GOALS.newSales ? 'text-emerald-500' : 'text-red-500', bg: kpis.newSales >= DASHBOARD_GOALS.newSales ? 'bg-emerald-500/10' : 'bg-red-500/10', barColor: kpis.newSales >= DASHBOARD_GOALS.newSales ? 'bg-emerald-500' : 'bg-red-500' },
                            { label: 'Frequência Média', value: kpis.freqAvg.toFixed(1), numVal: kpis.freqAvg, goal: DASHBOARD_GOALS.freqAvg, goalLabel: `Meta: ${DASHBOARD_GOALS.freqAvg.toFixed(1)}`, icon: Activity, color: 'text-violet-500', bg: 'bg-violet-500/10', barColor: 'bg-violet-500' },
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
                                    <div className={`h-1.5 rounded-full bg-muted`}>
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
                                    <div className={`h-3 rounded-full bg-muted`}>
                                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${kpis.ticketSub > 0 && kpis.ticketNonSub > 0 ? Math.min((kpis.ticketSub / Math.max(kpis.ticketSub, kpis.ticketNonSub)) * 100, 100) : (kpis.ticketSub > 0 ? 100 : 0)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className={`text-xs ${textSub}`}>Avulsos</span>
                                        <span className={`text-xl font-bold ${textMain}`}>{formatCurrency(kpis.ticketNonSub)}</span>
                                    </div>
                                    <div className={`h-3 rounded-full bg-muted`}>
                                        <div className={`h-full rounded-full bg-muted-foreground/50 transition-all`} style={{ width: `${kpis.ticketNonSub > 0 && kpis.ticketSub > 0 ? Math.min((kpis.ticketNonSub / Math.max(kpis.ticketSub, kpis.ticketNonSub)) * 100, 100) : (kpis.ticketNonSub > 0 ? 100 : 0)}%` }} />
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
                                        <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
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
                                            <div className={`h-2 rounded-full bg-muted`}>
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
                                                <div className={`flex-1 h-1.5 rounded-full bg-muted`}>
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
                                                <div className={`h-2 rounded-full flex-1 max-w-[100px] bg-muted`}>
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
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{sub.usesThisMonth}</span>
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
                                                    <td className="py-2 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc?.color}`}>{sc?.label}</span></td>
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
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
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
                                                        <div className={`h-2 rounded-full flex-1 max-w-[80px] bg-muted`}>
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
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
                                                            {p.name}
                                                        </div>
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-center font-bold ${textMain}`}>{p.totalServices}</td>
                                                    <td className={`py-2.5 px-3 text-center ${textMain}`}>{p.totalProducts}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-amber-500">{formatCurrency(extras)}</td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <div className={`h-2 rounded-full flex-1 max-w-[80px] bg-muted`}>
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
                        <CustomDropdown value={historyStatusFilter} onChange={v => setHistoryStatusFilter(v)} options={[{ value: 'all', label: 'Todos status' }, { value: 'active', label: 'Ativo' }, { value: 'pending_payment', label: 'Aguardando Pgto' }, { value: 'paused', label: 'Pausado' }, { value: 'cancelled', label: 'Cancelado' }, { value: 'overdue', label: 'Inadimplente' }]} isDarkMode={isDarkMode} />
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
                    <div className={`divide-y divide-border`}>
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
                                    <div key={sub.id} className={`px-5 py-4 flex items-center gap-4 hover:bg-muted/30`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.color} border`}><SI size={16} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium text-sm ${textMain} truncate`}>{sub.clientName || '—'}</p>
                                            <p className={`text-xs ${textSub}`}><Crown size={10} className="inline text-primary mr-1" />{sub.plan?.name || '—'} · Dia {sub.paymentDay}{sub.paymentMethod ? ` · ${methodLabels[sub.paymentMethod]}` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cfg.color}`}>{cfg.label}</span>
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
                                    <div className={`p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10`}>
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
                                    <div className={`p-3 rounded-lg bg-violet-500/5 border border-violet-500/10`}>
                                        <p className={`text-[11px] text-violet-500 font-medium`}><Info size={10} className="inline mr-1" />Ideal para alcance global</p>
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
                                    <div className={`p-3 rounded-lg bg-muted/30 border border-border`}>
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
                                        // 1. Save config locally
                                        const r = await saveBillingConfig(integrationConfig);
                                        if (!r.success) { toast.error('Erro', r.error || ''); return; }
                                        
                                        // 2. Auto-configure webhook in ASAAS
                                        if (integrationConfig.apiKey) {
                                            try {
                                                toast.info('Configurando webhook...', 'Registrando webhook automaticamente no ASAAS...');
                                                const appUrl = window.location.origin;
                                                if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
                                                    toast.success('Configuração salva!');
                                                    toast.warning('Webhook não registrado', 'Webhooks só funcionam em produção (URL pública). Em ambiente local, o ASAAS não consegue enviar notificações.');
                                                } else {
                                                const wh = await configureAsaasWebhook({ appUrl });
                                                if (wh.success && wh.webhookSecret) {
                                                    // Update local config with webhook data
                                                    const updatedConfig = { ...integrationConfig, webhookSecret: wh.webhookSecret, webhookUrl: wh.webhookUrl };
                                                    setIntegrationConfig(updatedConfig as any);
                                                    toast.success('Configuração salva!', `Webhook configurado: ${wh.webhookUrl}`);
                                                } else {
                                                    toast.success('Configuração salva!', 'Webhook não pôde ser configurado automaticamente.');
                                                }
                                                }
                                            } catch (whErr: any) {
                                                console.error('Webhook config error:', whErr);
                                                toast.success('Configuração salva!', `Webhook: ${whErr.message}. Configure manualmente no painel ASAAS.`);
                                            }
                                        } else {
                                            toast.success('Configuração salva!');
                                        }
                                    }}>
                                    Salvar Configuração
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Integration Status */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Gateway', value: integrationConfig.apiKey ? 'Asaas' : 'Não configurado', icon: Link, color: integrationConfig.apiKey ? 'text-emerald-500' : 'text-muted-foreground', bg: integrationConfig.apiKey ? 'bg-emerald-500/10' : 'bg-muted/50' },
                            { label: 'Cobranças Auto', value: integrationConfig.autoCharge ? 'Ativado' : 'Desativado', icon: Repeat, color: integrationConfig.autoCharge ? 'text-blue-500' : 'text-muted-foreground', bg: integrationConfig.autoCharge ? 'bg-blue-500/10' : 'bg-muted/50' },
                            { label: 'Ambiente', value: integrationConfig.environment === 'production' ? 'Produção' : 'Sandbox', icon: Shield, color: integrationConfig.environment === 'production' ? 'text-red-500' : 'text-amber-500', bg: integrationConfig.environment === 'production' ? 'bg-red-500/10' : 'bg-amber-500/10' },
                            { label: 'Notificações', value: integrationConfig.sendNotifications ? 'Ativado' : 'Desativado', icon: Zap, color: integrationConfig.sendNotifications ? 'text-emerald-500' : 'text-muted-foreground', bg: integrationConfig.sendNotifications ? 'bg-emerald-500/10' : 'bg-muted/50' },
                            { label: 'Webhook', value: (integrationConfig as any).webhookSecret ? 'Configurado' : 'Não configurado', icon: Activity, color: (integrationConfig as any).webhookSecret ? 'text-emerald-500' : 'text-red-500', bg: (integrationConfig as any).webhookSecret ? 'bg-emerald-500/10' : 'bg-red-500/10' },
                        ].map((s, i) => (
                            <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 ${shadowClass} flex items-center gap-3`}>
                                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon size={18} className={s.color} /></div>
                                <div><p className={`text-xs ${textSub}`}>{s.label}</p><p className={`text-sm font-bold ${s.color}`}>{s.value}</p></div>
                            </div>
                        ))}
                    </div>

                    {/* Section 4: Configuration Checklist */}
                    {integrationConfig.apiKey && (
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <p className={`text-sm font-bold ${textMain} mb-3 flex items-center gap-2`}><CheckCircle size={16} className="text-primary" /> Checklist de Configuração</p>
                            <div className="space-y-2">
                                {[
                                    { ok: !!integrationConfig.apiKey, label: 'API Key configurada', detail: integrationConfig.environment === 'production' ? 'Produção' : 'Sandbox' },
                                    { ok: !!(integrationConfig as any).webhookSecret, label: 'Webhook registrado', detail: (integrationConfig as any).webhookUrl || 'Clique em "Salvar Configuração" para registrar automaticamente' },
                                    { ok: integrationConfig.autoCharge, label: 'Cobrança automática ativa', detail: 'Cobranças serão geradas automaticamente ao criar assinaturas' },
                                    { ok: integrationConfig.sendNotifications, label: 'Notificações do ASAAS ativas', detail: 'Clientes receberão emails/SMS de cobrança do ASAAS' },
                                ].map((item, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${item.ok ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                                        {item.ok ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
                                        <div>
                                            <p className={`text-sm font-medium ${textMain}`}>{item.label}</p>
                                            <p className={`text-xs ${textSub}`}>{item.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};
