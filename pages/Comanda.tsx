import React, { useState, useMemo, useEffect } from 'react';
import {
    ClipboardList, Plus, Trash2, X, Search, User, DollarSign,
    Scissors, Package, ShoppingCart, CheckCircle, Receipt,
    CreditCard, Banknote, QrCode, XCircle, Timer, RotateCcw,
    CalendarDays, Store, Crown, Percent, Split, TrendingUp,
    Filter, AlertTriangle, Star, History, BarChart3, CalendarRange,
    Settings, ToggleLeft, Clock, Zap, ShieldCheck, FileSpreadsheet,
    MessageSquare, Award, ArrowUpRight, ArrowDownRight, Save
} from 'lucide-react';
import { Comanda, ComandaItem, Service, Product, TeamMember, CalendarEvent, Client } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { usePasswordConfirm } from '../components/PasswordConfirmModal';
import { authService } from '../lib/auth';
import { useToast } from '../components/Toast';
import { saveComanda, deleteComanda, saveComandaItem, deleteComandaItem, closeComanda, reopenComanda, saveCalendarEvent, createComandaFromAppointment, saveSubscriptionUsageLog, deleteSubscriptionUsageLogByItem, getServiceUsageCount, incrementSubscriptionUses } from '../lib/dataService';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';
import { CustomDropdown } from '../components/CustomDropdown';
import { StatCard } from '../components/StatCard';
import { formatCurrency as formatCurrencyUtil } from '../utils';
import { safeParseJsonArray } from '../lib/utils';

interface ComandaPageProps {
    isDarkMode: boolean;
    currentUser: TeamMember;
}

const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string; icon: React.ElementType }> = {
    open: { label: 'Aberta', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', darkColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: ClipboardList },
    in_progress: { label: 'Em Atendimento', color: 'bg-blue-50 text-blue-700 border-blue-200', darkColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Timer },
    closed: { label: 'Finalizada', color: 'bg-slate-100 text-slate-600 border-slate-200', darkColor: 'bg-slate-700 text-slate-300 border-slate-600', icon: CheckCircle },
    cancelled: { label: 'Cancelada', color: 'bg-red-50 text-red-600 border-red-200', darkColor: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
};

const PAYMENT_METHODS = [
    { value: 'pix', label: 'PIX', icon: QrCode },
    { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
    { value: 'credito', label: 'Credito', icon: CreditCard },
    { value: 'debito', label: 'Debito', icon: CreditCard },
];

const ORIGIN_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
    agenda: { label: 'Agenda', icon: CalendarDays },
    balcao: { label: 'Balcao', icon: Store },
    clube: { label: 'Clube', icon: Crown },
    manual: { label: 'Manual', icon: ClipboardList },
};

const SERVICE_CATEGORIES = [
    { value: 'all', label: 'Todos' },
    { value: 'corte', label: 'Cortes' },
    { value: 'barba', label: 'Barba' },
    { value: 'combo', label: 'Combos' },
    { value: 'tratamento', label: 'Tratamentos' },
    { value: 'sobrancelha', label: 'Sobrancelha' },
];

export const ComandaPage: React.FC<ComandaPageProps> = ({ isDarkMode, currentUser }) => {
    const {
        setComandas, setCalendarEvents, subscriptions,
        permissions: contextPermissions
    } = useAppData();
    const {
        filteredServices: services, filteredClients: clients, filteredMembers: members,
        filteredComandas: comandas, filteredProducts: products,
        filteredCalendarEvents: calendarEvents, selectedUnitId
    } = useFilteredData();
    const { canCreate, canEdit, canDelete } = usePermissions(currentUser, contextPermissions);
    const confirm = useConfirm();
    const toast = useToast();
    const passwordConfirm = usePasswordConfirm();

    // â”€â”€ Theme Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const bgMuted = isDarkMode ? 'bg-dark' : 'bg-slate-50';
    const bgToggleOff = isDarkMode ? 'bg-dark-border' : 'bg-slate-300';


    // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [activeTab, setActiveTab] = useState<'atendimentos' | 'historico' | 'configuracoes'>('atendimentos');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [barberFilter, setBarberFilter] = useState<string>('all');
    const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);



    // â”€â”€ Comanda Settings (localStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const SETTINGS_KEY = 'comanda_settings_v1';

    const defaultSettings = {

        autoStatusEnabled: true,

        autoCreateComanda: true,

        autoCompleteEnabled: true,

        noShowToleranceMin: 15,

        defaultPaymentMethod: 'pix',

        autoCloseTimerMin: 0,

        requireClientForComanda: false,

        allowReopenClosed: true,

        showProductSuggestions: true,

    };

    type ComandaSettings = typeof defaultSettings;

    const [comandaSettings, setComandaSettings] = useState<ComandaSettings>(() => {

        try {

            const saved = localStorage.getItem(SETTINGS_KEY);

            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;

        } catch { return defaultSettings; }

    });

    const updateSetting = <K extends keyof ComandaSettings>(key: K, value: ComandaSettings[K]) => {

        setComandaSettings(prev => {

            const next = { ...prev, [key]: value };

            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

            return next;

        });

    };



    // â”€â”€ Auto-Status Engine (runs every 60s) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    useEffect(() => {

        if (!comandaSettings.autoStatusEnabled) return;

        const tick = () => {

            const now = new Date();

            const todayEvents = calendarEvents.filter(e => {

                const evDate = new Date(e.year, e.month, e.date);

                return evDate.toDateString() === now.toDateString();

            });

            todayEvents.forEach(ev => {

                if (!ev.startTime || ev.status === 'completed' || ev.status === 'cancelled' || ev.status === 'no_show') return;

                const [sh, sm] = ev.startTime.split(':').map(Number);

                const startMin = sh * 60 + sm;

                const nowMin = now.getHours() * 60 + now.getMinutes();

                const duration = ev.duration || 30;

                const endMin = startMin + duration;



                // Rule 1: Auto "in_service" + create comanda

                if ((ev.status === 'confirmed' || ev.status === 'arrived') && nowMin >= startMin && nowMin < endMin) {

                    const updated = { ...ev, status: 'in_service' as const };

                    saveCalendarEvent(updated);

                    setCalendarEvents((prev: CalendarEvent[]) => prev.map(e => e.id === ev.id ? updated : e));

                    // Auto-create comanda

                    if (comandaSettings.autoCreateComanda && !ev.comandaId) {

                        const clientSub = ev.clientId ? getClientSubscription(ev.clientId) : null;
                        createComandaFromAppointment(ev, services, clients, currentUser.id, clientSub || undefined, clientSub?.plan || undefined).then(res => {

                            if (res.success && res.comanda) {

                                setComandas((prev: Comanda[]) => [...prev, res.comanda!]);

                                setCalendarEvents((prev: CalendarEvent[]) => prev.map(e => e.id === ev.id ? { ...e, status: 'in_service' as const, comandaId: res.comanda!.id } : e));

                            }

                        });

                    }

                }



                // Rule 2: Auto "completed"

                if (comandaSettings.autoCompleteEnabled && ev.status === 'in_service' && nowMin >= endMin) {

                    const updated = { ...ev, status: 'completed' as const };

                    saveCalendarEvent(updated);

                    setCalendarEvents((prev: CalendarEvent[]) => prev.map(e => e.id === ev.id ? updated : e));

                }



                // Rule 3: Auto "no_show"

                if (ev.status === 'confirmed' && nowMin >= startMin + comandaSettings.noShowToleranceMin && nowMin < endMin) {

                    const updated = { ...ev, status: 'no_show' as const };

                    saveCalendarEvent(updated);

                    setCalendarEvents((prev: CalendarEvent[]) => prev.map(e => e.id === ev.id ? updated : e));

                }

            });

        };

        tick(); // run once immediately

        const interval = setInterval(tick, 60000);

        return () => clearInterval(interval);

    }, [comandaSettings.autoStatusEnabled, comandaSettings.autoCompleteEnabled, comandaSettings.autoCreateComanda, comandaSettings.noShowToleranceMin, calendarEvents, services, clients, currentUser.id]);
    // Historico filters
    const [histDateFrom, setHistDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [histDateTo, setHistDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [histBarber, setHistBarber] = useState('all');
    const [histService, setHistService] = useState('all');
    const [histSearchQuery, setHistSearchQuery] = useState('');
    const [histPayment, setHistPayment] = useState('all');
    const [histProduct, setHistProduct] = useState('all');
    const [detailComanda, setDetailComanda] = useState<Comanda | null>(null);

    // New Comanda Modal
    const [isNewComandaOpen, setIsNewComandaOpen] = useState(false);
    const [selectedBarberId, setSelectedBarberId] = useState(currentUser.id);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [walkInName, setWalkInName] = useState('');

    // Quick-Add Panel
    const [quickAddTab, setQuickAddTab] = useState<'service' | 'product'>('service');
    const [quickAddSearch, setQuickAddSearch] = useState('');
    const [quickAddCategory, setQuickAddCategory] = useState('all');

    // Checkout Modal
    const [showCheckout, setShowCheckout] = useState(false);
    const [closePaymentMethod, setClosePaymentMethod] = useState('pix');
    const [closeDiscount, setCloseDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [tipAmount, setTipAmount] = useState(0);
    const [splitEnabled, setSplitEnabled] = useState(false);
    const [splitMethod2, setSplitMethod2] = useState('dinheiro');
    const [splitAmount1, setSplitAmount1] = useState(0);

    // Live timer
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // History pagination
    const HIST_PAGE_SIZE = 50;
    const [histVisibleCount, setHistVisibleCount] = useState(HIST_PAGE_SIZE);

    // Notes editing
    const [editingNotes, setEditingNotes] = useState<string | null>(null);
    const [notesValue, setNotesValue] = useState('');

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const formatElapsed = (openedAt: string) => {
        const diff = Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000);
        if (diff < 1) return 'agora';
        if (diff < 60) return `${diff}min`;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };

    const getTimerColor = (openedAt: string) => {
        const min = Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000);
        if (min < 30) return 'text-emerald-500';
        if (min < 60) return 'text-amber-500';
        return 'text-red-500';
    };

    const handleExportCSV = () => {
        if (historyComandas.length === 0) return;
        const header = 'Cliente,Barbeiro,Data,Itens,Pagamento,Origem,Valor\n';
        const rows = historyComandas.map(c =>
            `"${c.clientName || 'Avulso'}","${c.barberName}","${new Date(c.closedAt || c.openedAt).toLocaleDateString('pt-BR')}","${c.items?.length || 0}","${c.paymentMethod || '--'}","${c.origin || 'manual'}","${c.finalAmount.toFixed(2)}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `comandas_${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('CSV exportado!');
    };

    const handleSaveNotes = async (comandaId: string, notes: string) => {
        const comanda = comandas.find(c => c.id === comandaId);
        if (!comanda) return;
        const updated = { ...comanda, notes };
        const result = await saveComanda(updated);
        if (!result.success) { toast.error('Erro ao salvar notas'); return; }
        setComandas((prev: Comanda[]) => prev.map(c => c.id === comandaId ? { ...c, notes } : c));
        setDetailComanda(prev => prev?.id === comandaId ? { ...prev, notes } : prev);
        setEditingNotes(null);
        toast.success('Notas salvas!');
    };

    const barbers = useMemo(() =>
        members.filter(m => ['Admin', 'Manager', 'Barber', 'Sales Executive'].includes(m.role) && m.status === 'Active'),
        [members]
    );

    const filteredComandas = useMemo(() => {
        return comandas
            .filter(c => {
                if (statusFilter !== 'all' && c.status !== statusFilter) return false;
                if (barberFilter !== 'all' && c.barberId !== barberFilter) return false;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return (c.clientName?.toLowerCase().includes(q) ||
                        c.barberName?.toLowerCase().includes(q) ||
                        c.id.toLowerCase().includes(q));
                }
                return true;
            })
            .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    }, [comandas, statusFilter, barberFilter, searchQuery]);

    const stats = useMemo(() => {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const todayComandas = comandas.filter(c => new Date(c.openedAt).toDateString() === today);
        const yesterdayComandas = comandas.filter(c => new Date(c.openedAt).toDateString() === yesterday);
        const openCount = comandas.filter(c => c.status === 'open' || c.status === 'in_progress').length;
        const todayClosed = todayComandas.filter(c => c.status === 'closed');
        const yesterdayClosed = yesterdayComandas.filter(c => c.status === 'closed');
        const todayRevenue = todayClosed.reduce((sum, c) => sum + c.finalAmount, 0);
        const yesterdayRevenue = yesterdayClosed.reduce((sum, c) => sum + c.finalAmount, 0);
        const avgTicket = todayClosed.length > 0 ? todayRevenue / todayClosed.length : 0;
        const openComandas = comandas.filter(c => c.status === 'open' || c.status === 'in_progress');
        const avgTime = openComandas.length > 0
            ? Math.floor(openComandas.reduce((sum, c) => sum + (now.getTime() - new Date(c.openedAt).getTime()), 0) / openComandas.length / 60000)
            : 0;
        // Payment breakdown
        const paymentBreakdown: Record<string, number> = {};
        todayClosed.forEach(c => {
            const method = c.paymentMethod || 'outro';
            paymentBreakdown[method] = (paymentBreakdown[method] || 0) + c.finalAmount;
        });
        // Barber ranking
        const barberStats: Record<string, { name: string; revenue: number; count: number }> = {};
        todayClosed.forEach(c => {
            if (!barberStats[c.barberId]) barberStats[c.barberId] = { name: c.barberName || '?', revenue: 0, count: 0 };
            barberStats[c.barberId].revenue += c.finalAmount;
            barberStats[c.barberId].count++;
        });
        const barberRanking = Object.entries(barberStats)
            .map(([id, d]) => ({ id, ...d, avgTicket: d.count > 0 ? d.revenue / d.count : 0 }))
            .sort((a, b) => b.revenue - a.revenue);
        const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;
        return { openCount, todayRevenue, todayClosed: todayClosed.length, avgTicket, avgTime, paymentBreakdown, barberRanking, revenueChange };
    }, [comandas, now]);

    // History filtered comandas
    const historyComandas = useMemo(() => {
        const from = new Date(histDateFrom + 'T00:00:00');
        const to = new Date(histDateTo + 'T23:59:59');
        return comandas
            .filter(c => {
                if (c.status !== 'closed' && c.status !== 'cancelled') return false;
                const d = new Date(c.closedAt || c.openedAt);
                if (d < from || d > to) return false;
                if (histBarber !== 'all' && c.barberId !== histBarber) return false;
                if (histService !== 'all') {
                    const hasService = c.items?.some(i => i.type === 'service' && i.itemId === histService);
                    if (!hasService) return false;
                }
                if (histPayment !== 'all' && c.paymentMethod !== histPayment) return false;
                if (histProduct !== 'all') {
                    const hasProduct = c.items?.some(i => i.type === 'product' && i.itemId === histProduct);
                    if (!hasProduct) return false;
                }
                if (histSearchQuery) {
                    const q = histSearchQuery.toLowerCase();
                    if (!c.clientName?.toLowerCase().includes(q) && !c.barberName?.toLowerCase().includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime());
    }, [comandas, histDateFrom, histDateTo, histBarber, histService, histPayment, histProduct, histSearchQuery]);

    const historyStats = useMemo(() => {
        const total = historyComandas.reduce((sum, c) => sum + c.finalAmount, 0);
        const avg = historyComandas.length > 0 ? total / historyComandas.length : 0;
        return { count: historyComandas.length, total, avg };
    }, [historyComandas]);

    const visibleHistoryComandas = useMemo(() => historyComandas.slice(0, histVisibleCount), [historyComandas, histVisibleCount]);
    const hasMoreHistory = histVisibleCount < historyComandas.length;

    useEffect(() => {
        setHistVisibleCount(HIST_PAGE_SIZE);
    }, [histDateFrom, histDateTo, histBarber, histService, histPayment, histProduct, histSearchQuery]);

    const selectedComanda = selectedComandaId ? comandas.find(c => c.id === selectedComandaId) : null;

    // Quick-Add filtered items
    const quickAddItems = useMemo(() => {
        const q = quickAddSearch.toLowerCase();
        if (quickAddTab === 'service') {
            return services.filter(s => {
                if (!s.active) return false;
                if (q && !s.name.toLowerCase().includes(q)) return false;
                if (quickAddCategory !== 'all' && s.category !== quickAddCategory) return false;
                return true;
            });
        }
        return products.filter(p => {
            if (!p.active) return false;
            if (q && !p.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [quickAddTab, quickAddSearch, quickAddCategory, services, products]);

    // Smart suggestions: client's most frequent service
    const clientSuggestions = useMemo(() => {
        if (!selectedComanda?.clientId) return { topService: null, lastVisit: null, totalSpent: 0, visitCount: 0 };
        const clientComandas = comandas.filter(c => c.clientId === selectedComanda.clientId && c.status === 'closed');
        const totalSpent = clientComandas.reduce((sum, c) => sum + c.finalAmount, 0);
        const visitCount = clientComandas.length;
        const lastVisit = clientComandas.length > 0
            ? new Date(clientComandas.sort((a, b) => new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime())[0].closedAt || clientComandas[0].openedAt)
            : null;
        // Count service frequency
        const svcCount: Record<string, { name: string; count: number; id: string }> = {};
        clientComandas.forEach(c => {
            c.items?.forEach(item => {
                if (item.type === 'service') {
                    if (!svcCount[item.itemId]) svcCount[item.itemId] = { name: item.name, count: 0, id: item.itemId };
                    svcCount[item.itemId].count++;
                }
            });
        });
        const topService = Object.values(svcCount).sort((a, b) => b.count - a.count)[0] || null;
        return { topService, lastVisit, totalSpent, visitCount };
    }, [selectedComanda?.clientId, comandas]);

    const getClientSubscription = (clientId?: string) => {
        if (!clientId) return null;
        const unitId = selectedUnitId !== 'all' ? selectedUnitId : undefined;
        return subscriptions.find(s =>
            s.clientId === clientId &&
            s.status === 'active' &&
            (!s.unitId || !unitId || s.unitId === unitId)
        ) || null;
    };

    // Discount calculation
    const computedDiscount = useMemo(() => {
        if (!selectedComanda) return 0;
        if (discountType === 'percent') return (selectedComanda.totalAmount * closeDiscount) / 100;
        return closeDiscount;
    }, [selectedComanda, closeDiscount, discountType]);

    const computedFinal = useMemo(() => {
        if (!selectedComanda) return 0;
        return Math.max(0, selectedComanda.totalAmount - computedDiscount + tipAmount);
    }, [selectedComanda, computedDiscount, tipAmount]);

    // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleCreateComanda = async () => {
        if (!selectedBarberId) { toast.error('Selecione um profissional'); return; }
        const client = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
        const barber = members.find(m => m.id === selectedBarberId);
        const newComanda: Comanda = {
            id: crypto.randomUUID(),
            clientId: selectedClientId || undefined,
            clientName: client?.name || walkInName || 'Cliente Avulso',
            barberId: selectedBarberId,
            barberName: barber?.name || currentUser.name,
            status: 'open',
            totalAmount: 0, discountAmount: 0, finalAmount: 0,
            openedAt: new Date().toISOString(),
            items: [], origin: 'balcao', openedBy: currentUser.id,
            unitId: selectedUnitId !== 'all' ? selectedUnitId : undefined,
        };
        const result = await saveComanda(newComanda);
        if (!result.success) { toast.error('Erro ao abrir comanda', result.error || 'Erro desconhecido'); return; }
        setComandas((prev: Comanda[]) => [newComanda, ...prev]);
        toast.success('Comanda aberta!');
        setIsNewComandaOpen(false);
        setSelectedClientId(''); setWalkInName('');
        setSelectedComandaId(newComanda.id);
    };

    const handleAddItem = async (comanda: Comanda, itemType: 'service' | 'product', item: Service | Product) => {
        try {
            // Low stock warning
            if (itemType === 'product' && (item as Product).stock <= (item as Product).minStock) {
                toast.warning('Estoque baixo', `${item.name}: apenas ${(item as Product).stock} unidades restantes`);
            }
            const newItem: ComandaItem = {
                id: crypto.randomUUID(), comandaId: comanda.id, type: itemType, itemId: item.id, name: item.name, quantity: 1,
                unitPrice: itemType === 'service' ? (item as Service).price : (item as Product).sellPrice,
                totalPrice: itemType === 'service' ? (item as Service).price : (item as Product).sellPrice,
            };

            // ═══ SUBSCRIPTION DISCOUNT LOGIC (Decisões #1, #5, #6, #8) ═══
            const sub = getClientSubscription(comanda.clientId);
            if (sub?.status === 'active' && sub.plan) {
                const planAllowed = sub.plan.unitScope === 'all' ||
                    safeParseJsonArray(sub.plan.allowedUnitIds).includes(selectedUnitId !== 'all' ? selectedUnitId : '');

                if (planAllowed) {
                    const rules = safeParseJsonArray(itemType === 'service' ? sub.plan.planServices : sub.plan.planProducts);
                    const rule = rules.find((r: any) =>
                        itemType === 'service' ? r.serviceId === item.id : r.productId === item.id
                    );

                    if (rule && rule.discount > 0) {
                        let shouldApplyDiscount = false;
                        if (!rule.monthlyLimit) {
                            shouldApplyDiscount = true;
                        } else {
                            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                            const usageCount = await getServiceUsageCount(sub.id, item.id, monthStart);
                            if (usageCount < rule.monthlyLimit) {
                                shouldApplyDiscount = true;
                            } else {
                                toast.info('Limite atingido', `Uso ${usageCount}/${rule.monthlyLimit} neste mês. Cobrado preço integral.`);
                            }
                        }
                        if (shouldApplyDiscount) {
                            newItem.originalPrice = newItem.unitPrice;
                            newItem.unitPrice = +(newItem.unitPrice * (1 - rule.discount / 100)).toFixed(2);
                            newItem.totalPrice = newItem.unitPrice * newItem.quantity;
                            newItem.subscriptionDiscount = rule.discount;
                        }
                    }
                }
            }

            const result = await saveComandaItem(newItem);
            if (!result.success) { toast.error('Erro ao adicionar item', result.error || 'Erro desconhecido'); return; }

            // Register usage log + increment cache (Decisões #1, #6)
            if (newItem.subscriptionDiscount && sub) {
                await saveSubscriptionUsageLog({
                    id: crypto.randomUUID(),
                    subscriptionId: sub.id,
                    comandaId: comanda.id,
                    comandaItemId: newItem.id,
                    itemId: item.id,
                    type: itemType,
                    discountApplied: newItem.subscriptionDiscount,
                    originalPrice: newItem.originalPrice,
                    finalPrice: newItem.unitPrice,
                });
                await incrementSubscriptionUses(sub.id, 1);
            }

            setComandas(prev => prev.map(c => {
                if (c.id === comanda.id) {
                    const items = [...(c.items || []), newItem];
                    const total = items.reduce((sum, i) => sum + i.totalPrice, 0);
                    return { ...c, items, totalAmount: total, finalAmount: total - (c.discountAmount || 0) };
                }
                return c;
            }));
            toast.success(`${item.name} adicionado!${newItem.subscriptionDiscount ? ` (${newItem.subscriptionDiscount}% desc. plano)` : ''}`);
        } catch (err: any) {
            console.error('[handleAddItem] Error:', err);
            toast.error('Erro ao adicionar item', err?.message || 'Erro inesperado');
        }
    };

    const handleRemoveItem = async (comanda: Comanda, itemId: string) => {
        const removedItem = (comanda.items || []).find(i => i.id === itemId);
        const itemName = removedItem?.name || 'este item';
        const ok = await confirm({ title: 'Remover Item', message: `Deseja remover "${itemName}" da comanda?`, variant: 'danger', confirmLabel: 'Remover', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await deleteComandaItem(itemId);
        if (!result.success) { toast.error('Erro ao remover item', result.error || ''); return; }

        // Decisão #2: Reverter usage log ao remover item com desconto
        if (removedItem?.subscriptionDiscount) {
            await deleteSubscriptionUsageLogByItem(removedItem.id);
            const sub = getClientSubscription(comanda.clientId);
            if (sub) await incrementSubscriptionUses(sub.id, -1);
        }

        setComandas(prev => prev.map(c => {
            if (c.id === comanda.id) {
                const items = (c.items || []).filter(i => i.id !== itemId);
                const total = items.reduce((sum, i) => sum + i.totalPrice, 0);
                return { ...c, items, totalAmount: total, finalAmount: total - (c.discountAmount || 0) };
            }
            return c;
        }));
        toast.success('Item removido');
    };

    const handleCloseComanda = async () => {
        if (!selectedComandaId) return;
        const result = await closeComanda(selectedComandaId, closePaymentMethod, computedDiscount, currentUser.id);
        if (!result.success) { toast.error('Erro ao finalizar', result.error || ''); return; }
        const closedNow = new Date().toISOString();
        setComandas(prev => prev.map(c => {
            if (c.id === selectedComandaId) {
                const finalAmount = Math.max(0, c.totalAmount - computedDiscount);
                return { ...c, status: 'closed' as const, paymentMethod: closePaymentMethod, discountAmount: computedDiscount, finalAmount, closedAt: closedNow, closedBy: currentUser.id };
            }
            return c;
        }));
        toast.success('Comanda finalizada!');
        setShowCheckout(false); setCloseDiscount(0); setTipAmount(0);
        setSplitEnabled(false); setSelectedComandaId(null);
    };

    const handleDeleteComanda = async (id: string) => {
        const ok = await confirm({ title: 'Excluir Comanda', message: 'Tem certeza? Todos os itens serao excluidos.', variant: 'danger', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await deleteComanda(id);
        if (!result.success) { toast.error('Erro ao excluir', result.error || ''); return; }
        setComandas((prev: Comanda[]) => prev.filter(c => c.id !== id));
        toast.success('Comanda excluida');
        if (selectedComandaId === id) setSelectedComandaId(null);
    };

    const handleReopenComanda = async (id: string) => {
        const ok = await confirm({ title: 'Reabrir Comanda', message: 'Deseja reabrir esta comanda? O status voltara para "Aberta" e os campos de pagamento serao limpos.', variant: 'danger', confirmLabel: 'Reabrir', cancelLabel: 'Cancelar' });
        if (!ok) return;
        const result = await reopenComanda(id);
        if (!result.success) { toast.error('Erro ao reabrir', result.error || ''); return; }
        setComandas(prev => prev.map(c => {
            if (c.id === id) return { ...c, status: 'open' as const, closedAt: undefined, closedBy: undefined, paymentMethod: undefined, discountAmount: 0, finalAmount: c.totalAmount };
            return c;
        }));
        setDetailComanda(null);
        toast.success('Comanda reaberta!');
    };
    // â”€â”€ Suggest top service for client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleSuggestService = () => {
        if (!selectedComanda || !clientSuggestions.topService) return;
        const svc = services.find(s => s.id === clientSuggestions.topService!.id);
        if (svc) handleAddItem(selectedComanda, 'service', svc);
    };

    // â”€â”€ Origin Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const OriginBadge: React.FC<{ origin?: string; size?: 'sm' | 'md' }> = ({ origin, size = 'sm' }) => {
        const o = origin || 'manual';
        const cfg = ORIGIN_CONFIG[o] || ORIGIN_CONFIG.manual;
        const Icon = cfg.icon;
        const colorMap: Record<string, string> = {
            agenda: isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200',
            balcao: isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200',
            clube: isDarkMode ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200',
            manual: isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200',
        };
        const cls = colorMap[o] || colorMap.manual;
        if (size === 'md') return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls}`}><Icon size={12} />{cfg.label}</span>;
        return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${cls}`}><Icon size={9} />{cfg.label}</span>;
    };

    const isComandaActive = (c: Comanda) => c.status === 'open' || c.status === 'in_progress';

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // â–ˆâ–ˆ  RENDER  â–ˆâ–ˆ
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    return (
        <div className="animate-in fade-in duration-500 h-full flex flex-col pb-16 md:pb-0">

            {/* ===================== NEW COMANDA MODAL ===================== */}
            {isNewComandaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewComandaOpen(false)}>
                    <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className={`px-6 py-4 border-b ${borderCol} ${bgMuted}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Store size={20} className="text-primary" />
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-base ${textMain}`}>Nova Comanda</h3>
                                        <p className={`text-[11px] ${textSub}`}>Atendimento de balcao</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsNewComandaOpen(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${textSub} hover:bg-red-500/10 hover:text-red-500 transition-colors`}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Barber */}
                            <div>
                                <label className={`block text-[11px] font-bold ${textSub} uppercase tracking-wider mb-2`}>
                                    Profissional
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {barbers.slice(0, 6).map(b => (
                                        <button key={b.id} type="button" onClick={() => setSelectedBarberId(b.id)}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${selectedBarberId === b.id ? 'border-primary bg-primary/5 shadow-sm' : `${borderCol} hover:border-primary/30`}`}>
                                            {b.image ? (
                                                <img src={b.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                                            ) : (
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${selectedBarberId === b.id ? 'bg-primary text-white' : `${bgMuted} text-primary`}`}>
                                                    {b.name[0]}
                                                </div>
                                            )}
                                            <span className={`text-[10px] font-semibold truncate w-full ${selectedBarberId === b.id ? 'text-primary' : textMain}`}>
                                                {b.name.split(' ')[0]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client */}
                            <div>
                                <label className={`block text-[11px] font-bold ${textSub} uppercase tracking-wider mb-2`}>
                                    Cliente <span className={`font-normal normal-case ${textSub}`}>(opcional)</span>
                                </label>
                                <CustomDropdown
                                    value={selectedClientId}
                                    onChange={setSelectedClientId}
                                    options={[{ value: '', label: 'Sem cliente vinculado' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Buscar cliente..."
                                />
                            </div>

                            {/* Walk-in name */}
                            {!selectedClientId && (
                                <div>
                                    <label className={`block text-[11px] font-bold ${textSub} uppercase tracking-wider mb-2`}>
                                        Identificacao
                                    </label>
                                    <input
                                        type="text"
                                        value={walkInName}
                                        onChange={e => setWalkInName(e.target.value)}
                                        placeholder="Ex: Joao (cadeira 2)"
                                        className={`w-full h-10 ${bgInput} border ${borderCol} rounded-xl px-3 text-sm ${textMain} focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all`}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={`px-6 py-4 border-t ${borderCol} ${bgMuted}`}>
                            <button
                                onClick={handleCreateComanda}
                                disabled={!selectedBarberId}
                                className={`w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${selectedBarberId ? 'bg-primary hover:bg-primary-600 text-white' : `${bgMuted} ${textSub} cursor-not-allowed border ${borderCol}`}`}
                            >
                                <Plus size={18} /> Abrir Comanda
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== CHECKOUT MODAL ===================== */}
            {showCheckout && selectedComanda && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${bgMuted}`}>
                            <div className="flex items-center gap-2">
                                <Receipt size={18} className="text-emerald-500" />
                                <h3 className={`font-bold text-lg ${textMain}`}>Finalizar Pagamento</h3>
                            </div>
                            <button onClick={() => setShowCheckout(false)} className={`${textSub}`}><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Order Summary */}
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                                <p className={`text-xs font-semibold ${textSub} uppercase tracking-wider mb-2`}>Resumo</p>
                                {selectedComanda.items?.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm mb-1">
                                        <span className={textSub}>{item.quantity}x {item.name}</span>
                                        <span className={textMain}>{formatCurrency(item.totalPrice)}</span>
                                    </div>
                                ))}
                                <div className={`flex justify-between pt-2 mt-2 border-t ${borderCol}`}>
                                    <span className={`text-sm font-bold ${textMain}`}>Subtotal</span>
                                    <span className={`font-bold ${textMain}`}>{formatCurrency(selectedComanda.totalAmount)}</span>
                                </div>
                            </div>

                            {/* Discount */}
                            <div>
                                <label className={`block text-xs font-semibold ${textSub} mb-2`}>Desconto</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input type="number" value={closeDiscount} onChange={e => setCloseDiscount(Math.max(0, parseFloat(e.target.value) || 0))} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} min="0" step="0.01" />
                                    </div>
                                    <div className="flex rounded-lg border overflow-hidden shrink-0">
                                        <button type="button" onClick={() => setDiscountType('fixed')} className={`px-3 py-2 text-xs font-bold transition-colors ${discountType === 'fixed' ? 'bg-primary text-white' : `${bgInput} ${textSub}`}`}>R$</button>
                                        <button type="button" onClick={() => setDiscountType('percent')} className={`px-3 py-2 text-xs font-bold transition-colors ${discountType === 'percent' ? 'bg-primary text-white' : `${bgInput} ${textSub}`}`}><Percent size={12} /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Tip */}
                            <div>
                                <label className={`block text-xs font-semibold ${textSub} mb-2`}>Gorjeta (opcional)</label>
                                <div className="flex gap-2">
                                    {[0, 5, 10, 15].map(v => (
                                        <button key={v} type="button" onClick={() => setTipAmount(v === 0 ? 0 : (selectedComanda.totalAmount * v / 100))} className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${tipAmount > 0 && selectedComanda.totalAmount > 0 && Math.round(tipAmount / selectedComanda.totalAmount * 100) === v ? 'border-primary bg-primary/10 text-primary' : `${borderCol} ${textSub}`}`}>
                                            {v === 0 ? 'Sem' : `${v}%`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`text-xs font-semibold ${textSub}`}>Forma de Pagamento</label>
                                    <button type="button" onClick={() => setSplitEnabled(!splitEnabled)} className={`text-[10px] font-bold flex items-center gap-1 ${splitEnabled ? 'text-primary' : textSub}`}>
                                        <Split size={10} /> Dividir
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {PAYMENT_METHODS.map(m => {
                                        const Icon = m.icon;
                                        return (
                                            <button key={m.value} type="button" onClick={() => setClosePaymentMethod(m.value)} className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${closePaymentMethod === m.value ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
                                                <Icon size={16} />{m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {splitEnabled && (
                                    <div className={`mt-3 p-3 rounded-lg border ${borderCol} space-y-2`}>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className={`block text-[10px] ${textSub} mb-1`}>Valor em {PAYMENT_METHODS.find(m => m.value === closePaymentMethod)?.label}</label>
                                                <input type="number" value={splitAmount1} onChange={e => setSplitAmount1(Math.max(0, parseFloat(e.target.value) || 0))} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                            </div>
                                            <div className="flex-1">
                                                <label className={`block text-[10px] ${textSub} mb-1`}>Restante em</label>
                                                <select value={splitMethod2} onChange={e => setSplitMethod2(e.target.value)} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain}`}>
                                                    {PAYMENT_METHODS.filter(m => m.value !== closePaymentMethod).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Final Total */}
                            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                                {computedDiscount > 0 && <div className="flex justify-between mb-1"><span className={`text-xs ${textSub}`}>Desconto</span><span className="text-sm text-red-500">-{formatCurrency(computedDiscount)}</span></div>}
                                {tipAmount > 0 && <div className="flex justify-between mb-1"><span className={`text-xs ${textSub}`}>Gorjeta</span><span className={`text-sm ${textMain}`}>+{formatCurrency(tipAmount)}</span></div>}
                                <div className="flex justify-between"><span className={`font-bold ${textMain}`}>Total</span><span className="font-black text-xl text-emerald-500">{formatCurrency(computedFinal)}</span></div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-emerald-500/20">
                            <button onClick={handleCloseComanda} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                                <CheckCircle size={18} /> Finalizar - {formatCurrency(computedFinal)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== PAGE HEADER ===================== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Frente de Caixa</h1>
                    <p className={`${textSub} text-sm`}>Comandas e atendimentos da barbearia</p>
                </div>
                {canCreate('/comanda') && (
                    <button onClick={() => setIsNewComandaOpen(true)} className="h-10 px-4 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2 whitespace-nowrap">
                        <Plus size={18} /> Nova Comanda
                    </button>
                )}
            </div>

            {/* ===================== KPI CARDS (Dashboard pattern) ===================== */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard label="Comandas Abertas" value={String(stats.openCount)} Icon={ClipboardList} color="text-emerald-500" bgIconColor="bg-emerald-50 dark:bg-emerald-500/10" subtitle="em atendimento agora" />
                <StatCard label="Faturado Hoje" value={formatCurrency(stats.todayRevenue)} Icon={DollarSign} subtitle={`${stats.todayClosed} atendimentos`} />
                <StatCard label="Ticket Medio" value={formatCurrency(stats.avgTicket)} Icon={Receipt} color="text-amber-500" bgIconColor="bg-amber-50 dark:bg-amber-500/10" />
                <StatCard label="Tempo Medio" value={stats.avgTime > 0 ? `${stats.avgTime} min` : '--'} Icon={Timer} color="text-blue-500" bgIconColor="bg-blue-50 dark:bg-blue-500/10" subtitle="das comandas abertas" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-5">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Award size={16} className="text-amber-500" />
                            <h2 className={`text-sm font-bold ${textMain}`}>Ranking de barbeiros hoje</h2>
                        </div>
                        {stats.revenueChange !== 0 && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${stats.revenueChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {stats.revenueChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {Math.abs(stats.revenueChange).toFixed(0)}% vs ontem
                            </span>
                        )}
                    </div>
                    {stats.barberRanking.length === 0 ? (
                        <p className={`text-xs ${textSub}`}>Nenhuma comanda finalizada hoje.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.barberRanking.slice(0, 4).map((barber, index) => (
                                <div key={barber.id} className={`flex items-center justify-between rounded-lg ${bgMuted} px-3 py-2`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">{index + 1}</span>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-bold ${textMain} truncate`}>{barber.name}</p>
                                            <p className={`text-[10px] ${textSub}`}>{barber.count} atend. • ticket {formatCurrency(barber.avgTicket)}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-emerald-500">{formatCurrency(barber.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Banknote size={16} className="text-emerald-500" />
                        <h2 className={`text-sm font-bold ${textMain}`}>Resumo de caixa hoje</h2>
                    </div>
                    {Object.keys(stats.paymentBreakdown).length === 0 ? (
                        <p className={`text-xs ${textSub}`}>Nenhum pagamento registrado hoje.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map(method => {
                                const amount = stats.paymentBreakdown[method.value] || 0;
                                const Icon = method.icon;
                                return (
                                    <div key={method.value} className={`rounded-lg ${bgMuted} px-3 py-2`}>
                                        <div className={`flex items-center gap-1.5 text-[10px] ${textSub} mb-1`}>
                                            <Icon size={11} /> {method.label}
                                        </div>
                                        <p className={`text-sm font-black ${amount > 0 ? 'text-emerald-500' : textMain}`}>{formatCurrency(amount)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ===================== TAB SWITCHER ===================== */}
            <div className={`flex items-center gap-1 mb-4 border-b ${borderCol}`}>
                <button onClick={() => setActiveTab('atendimentos')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'atendimentos' ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>
                    <ClipboardList size={16} /> Atendimentos
                </button>
                <button onClick={() => setActiveTab('historico')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'historico' ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>
                    <History size={16} /> Historico
                </button>
                <button onClick={() => setActiveTab('configuracoes')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'configuracoes' ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary/70`}`}>
                    <Settings size={16} /> Configuracoes
                </button>
            </div>

            {/* ===================== TAB: ATENDIMENTOS ===================== */}
            {activeTab === 'atendimentos' && (<>

                {/* BARBER FILTER PILLS */}
                <div className={`flex items-center gap-2 mb-4 overflow-x-auto pb-1`}>
                    <button onClick={() => setBarberFilter('all')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all ${barberFilter === 'all' ? 'bg-primary text-white border-primary shadow-sm' : `${borderCol} ${textSub} hover:border-primary/40`}`}>
                        <Filter size={11} /> Todos
                    </button>
                    {barbers.map(b => (
                        <button key={b.id} onClick={() => setBarberFilter(barberFilter === b.id ? 'all' : b.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all ${barberFilter === b.id ? 'bg-primary text-white border-primary shadow-sm' : `${borderCol} ${textSub} hover:border-primary/40`}`}>
                            {b.image ? <img src={b.image} alt="" className="w-4 h-4 rounded-full object-cover" /> : <User size={11} />}
                            {b.name.split(' ')[0]}
                        </button>
                    ))}
                </div>

                {/* ===================== 2-COLUMN LAYOUT ===================== */}
                <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">

                    {/* LEFT: Comanda List */}
                    <div className={`lg:w-[340px] xl:w-[380px] flex flex-col ${bgCard} rounded-xl border ${borderCol} overflow-hidden shrink-0`}>
                        <div className={`p-3 border-b ${borderCol} space-y-3`}>
                            <div className="relative">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={15} />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar cliente, barbeiro..." className={`w-full pl-9 pr-3 py-2 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                            </div>
                            <div className="flex gap-1.5 overflow-x-auto">
                                {[{ value: 'all', label: 'Todas' }, { value: 'open', label: 'Abertas' }, { value: 'in_progress', label: 'Atend.' }, { value: 'closed', label: 'Fechadas' }].map(f => (
                                    <button key={f.value} onClick={() => setStatusFilter(f.value)} className={`px-3 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-all ${statusFilter === f.value ? 'bg-primary text-white border-primary shadow-sm' : `${borderCol} ${textSub} hover:border-primary/40`}`}>{f.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {filteredComandas.length === 0 ? (
                                <div className={`text-center py-12 ${textSub}`}>
                                    <ClipboardList size={36} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">Nenhuma comanda</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1.5">
                                    {filteredComandas.map(c => {
                                        const s = STATUS_MAP[c.status] || STATUS_MAP.open;
                                        const isSelected = selectedComandaId === c.id;
                                        const elapsed = isComandaActive(c) ? formatElapsed(c.openedAt) : undefined;
                                        return (
                                            <button key={c.id} onClick={() => { setSelectedComandaId(c.id); setShowCheckout(false); }} className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10' : `${borderCol} hover:border-primary/30 hover:bg-muted/50`}`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isSelected ? 'bg-primary text-white' : `${bgMuted} text-primary`}`}>
                                                            {(c.clientName || 'A')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`font-semibold text-xs truncate ${textMain}`}>{c.clientName || 'Cliente Avulso'}</p>
                                                            <p className={`text-[10px] ${textSub} truncate`}>{c.barberName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0 gap-1">
                                                        <span className={`font-bold text-xs ${c.status === 'closed' ? 'text-emerald-500' : textMain}`}>{formatCurrency(c.finalAmount || c.totalAmount)}</span>
                                                        {elapsed && (
                                                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${getTimerColor(c.openedAt)}`}>
                                                                <Timer size={9} /> {elapsed}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <OriginBadge origin={c.origin} />
                                                        {c.items && c.items.length > 0 && <span className={`text-[10px] ${textSub}`}>{c.items.length} {c.items.length === 1 ? 'item' : 'itens'}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {isComandaActive(c) && c.items && c.items.length > 0 && (
                                                            <span onClick={(e) => { e.stopPropagation(); setSelectedComandaId(c.id); setShowCheckout(true); setCloseDiscount(0); setTipAmount(0); setSplitEnabled(false); }} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 transition-colors">
                                                                <Receipt size={8} /> Finalizar
                                                            </span>
                                                        )}
                                                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${isDarkMode ? s.darkColor : s.color}`}>{s.label}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* â”€â”€â”€ RIGHT: Detail + Quick-Add â”€â”€â”€ */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {!selectedComanda ? (
                            <div className={`flex-1 flex items-center justify-center ${bgCard} rounded-xl border ${borderCol}`}>
                                <div className={`text-center ${textSub}`}>
                                    <Receipt size={48} className="mx-auto mb-3 opacity-15" />
                                    <p className="text-sm font-medium mb-1">Selecione uma comanda</p>
                                    <p className="text-xs opacity-60">Clique em uma comanda na listagem ao lado</p>
                                </div>
                            </div>
                        ) : (
                            <div className={`flex-1 flex flex-col ${bgCard} rounded-xl border ${borderCol} overflow-hidden`}>
                                {/* Detail Header */}
                                <div className={`p-4 border-b ${borderCol} flex items-center justify-between shrink-0`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-primary text-white shrink-0">
                                            {(selectedComanda.clientName || 'A')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className={`font-bold text-sm ${textMain}`}>{selectedComanda.clientName || 'Cliente Avulso'}</h3>
                                            <p className={`text-xs ${textSub} mt-0.5`}>
                                                <span className="font-mono text-[10px] opacity-50">#{selectedComanda.id.slice(0, 8)}</span>
                                                {' • '}{selectedComanda.barberName}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                <OriginBadge origin={selectedComanda.origin} size="sm" />
                                                {(() => { const unitId = selectedUnitId !== 'all' ? selectedUnitId : undefined; const sub = subscriptions.find(s => s.clientId === selectedComanda.clientId && s.status !== 'cancelled' && (!s.unitId || !unitId || s.unitId === unitId)); if (!sub) return null; const isOverdue = sub.status === 'overdue'; const isPending = sub.status === 'pending_payment'; return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${isOverdue ? (isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200') : isPending ? (isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200') : (isDarkMode ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200')}`}><Crown size={9} />{isOverdue ? 'Inadimplente' : isPending ? 'Aguardando Pgto' : 'Assinante'}</span>; })()}
                                                {isComandaActive(selectedComanda) && (
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                        <Timer size={9} />{formatElapsed(selectedComanda.openedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {(() => { const s = STATUS_MAP[selectedComanda.status] || STATUS_MAP.open; const StatusIcon = s.icon; return <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${isDarkMode ? s.darkColor : s.color}`}><StatusIcon size={12} />{s.label}</div>; })()}
                                    </div>
                                </div>

                                {/* Smart Client Info Banner */}
                                {selectedComanda.clientId && clientSuggestions.visitCount > 0 && (
                                    <div className={`px-4 py-2.5 border-b ${borderCol} flex items-center gap-4 ${bgMuted}`}>
                                        <div className="flex items-center gap-1.5">
                                            <History size={11} className={textSub} />
                                            <span className={`text-[10px] ${textSub}`}>{clientSuggestions.visitCount} visitas</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp size={11} className={textSub} />
                                            <span className={`text-[10px] ${textSub}`}>Total: {formatCurrency(clientSuggestions.totalSpent)}</span>
                                        </div>
                                        {clientSuggestions.lastVisit && (
                                            <div className="flex items-center gap-1.5">
                                                <CalendarDays size={11} className={textSub} />
                                                <span className={`text-[10px] ${textSub}`}>Ultima: {clientSuggestions.lastVisit.toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        )}
                                        {clientSuggestions.topService && isComandaActive(selectedComanda) && (!selectedComanda.items || selectedComanda.items.length === 0) && (
                                            <button onClick={handleSuggestService} className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 text-primary text-[10px] font-bold hover:bg-primary/5 transition-colors">
                                                <Star size={10} /> Sugerir: {clientSuggestions.topService.name}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Items List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="p-4">
                                        <h4 className={`text-xs font-semibold ${textSub} uppercase tracking-wider mb-3`}>Itens da Comanda</h4>
                                        {(!selectedComanda.items || selectedComanda.items.length === 0) ? (
                                            <div className={`text-center py-8 ${textSub}`}>
                                                <ShoppingCart size={32} className="mx-auto mb-2 opacity-15" />
                                                <p className="text-xs">Nenhum item adicionado</p>
                                                {isComandaActive(selectedComanda) && <p className="text-[10px] opacity-60 mt-1">Use o painel abaixo para adicionar</p>}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedComanda.items.map(item => (
                                                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${borderCol} transition-colors hover:border-primary/20`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${item.type === 'service' ? (isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary') : (isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-500')}`}>
                                                                {item.type === 'service' ? <Scissors size={14} /> : <Package size={14} />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-medium ${textMain}`}>{item.name}</p>
                                                                <p className={`text-xs ${textSub}`}>{item.quantity}x {formatCurrency(item.unitPrice)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-sm font-bold ${textMain}`}>{formatCurrency(item.totalPrice)}</span>
                                                            {isComandaActive(selectedComanda) && (
                                                                <button onClick={() => handleRemoveItem(selectedComanda, item.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick-Add Panel (inline) */}
                                    {isComandaActive(selectedComanda) && (
                                        <div className={`mx-4 mb-4 rounded-xl border ${borderCol} overflow-hidden`}>
                                            <div className={`flex items-center border-b ${borderCol}`}>
                                                <button onClick={() => { setQuickAddTab('service'); setQuickAddCategory('all'); }} className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${quickAddTab === 'service' ? 'text-primary border-b-2 border-primary' : textSub}`}>
                                                    <Scissors size={12} /> Servicos
                                                </button>
                                                <button onClick={() => setQuickAddTab('product')} className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${quickAddTab === 'product' ? 'text-amber-500 border-b-2 border-amber-500' : textSub}`}>
                                                    <Package size={12} /> Produtos
                                                </button>
                                            </div>
                                            <div className="p-3">
                                                <div className="flex gap-2 mb-3">
                                                    <div className="relative flex-1">
                                                        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textSub}`} size={13} />
                                                        <input type="text" value={quickAddSearch} onChange={e => setQuickAddSearch(e.target.value)} placeholder={`Buscar ${quickAddTab === 'service' ? 'servico' : 'produto'}...`} className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                                    </div>
                                                </div>
                                                {quickAddTab === 'service' && (
                                                    <div className="flex gap-1 mb-3 overflow-x-auto">
                                                        {SERVICE_CATEGORIES.map(cat => (
                                                            <button key={cat.value} onClick={() => setQuickAddCategory(cat.value)} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-all ${quickAddCategory === cat.value ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub}`}`}>{cat.label}</button>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                    {quickAddItems.length === 0 && <p className={`col-span-full text-center py-4 ${textSub} text-xs`}>Nenhum item encontrado</p>}
                                                    {quickAddItems.map((item: any) => {
                                                        const isService = quickAddTab === 'service';
                                                        const price = isService ? (item as Service).price : (item as Product).sellPrice;
                                                        const lowStock = !isService && (item as Product).stock <= (item as Product).minStock;
                                                        return (
                                                            <button key={item.id} onClick={() => handleAddItem(selectedComanda, quickAddTab, item)} className={`p-2.5 rounded-lg border ${borderCol} hover:border-primary/50 transition-all text-left group relative`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className={`p-1.5 rounded-md ${isService ? (isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary') : (isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-500')}`}>
                                                                        {isService ? <Scissors size={11} /> : <Package size={11} />}
                                                                    </div>
                                                                    {lowStock && <AlertTriangle size={10} className="text-amber-500" />}
                                                                </div>
                                                                <p className={`text-xs font-medium ${textMain} truncate`}>{item.name}</p>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <span className="text-xs font-bold text-primary">{formatCurrency(price)}</span>
                                                                    {isService && (item as Service).duration && <span className={`text-[9px] ${textSub}`}>{(item as Service).duration}min</span>}
                                                                    {!isService && <span className={`text-[9px] ${lowStock ? 'text-amber-500 font-bold' : textSub}`}>Est: {(item as Product).stock}</span>}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom: Totals + Actions */}
                                <div className={`p-4 border-t ${borderCol} shrink-0`}>
                                    <div className={`p-3 rounded-xl ${bgMuted} mb-3`}>
                                        <div className="flex justify-between mb-1">
                                            <span className={`text-xs ${textSub}`}>Subtotal</span>
                                            <span className={`text-sm font-medium ${textMain}`}>{formatCurrency(selectedComanda.totalAmount)}</span>
                                        </div>
                                        {selectedComanda.discountAmount > 0 && (
                                            <div className="flex justify-between mb-1">
                                                <span className={`text-xs ${textSub}`}>Desconto</span>
                                                <span className="text-sm font-medium text-red-500">-{formatCurrency(selectedComanda.discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className={`flex justify-between pt-2 border-t ${borderCol}`}>
                                            <span className={`text-sm font-bold ${textMain}`}>Total</span>
                                            <span className="text-lg font-black text-emerald-500">{formatCurrency(selectedComanda.finalAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {isComandaActive(selectedComanda) && selectedComanda.items && selectedComanda.items.length > 0 && (
                                            <button onClick={() => { setShowCheckout(true); setCloseDiscount(0); setTipAmount(0); setSplitEnabled(false); }} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                                <Receipt size={16} /> Finalizar Pagamento
                                            </button>
                                        )}
                                        {selectedComanda.status === 'open' && canDelete('/comanda') && (
                                            <button onClick={() => handleDeleteComanda(selectedComanda.id)} className={`px-4 py-3 rounded-xl border transition-colors ${isDarkMode ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </>)}

            {/* ===================== TAB: HISTORICO ===================== */}
            {activeTab === 'historico' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className={`${bgCard} rounded-xl border ${borderCol} p-4 mb-4`}>
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>De</label>
                                <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)} className={`${bgInput} border ${borderCol} rounded-lg px-3 py-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                            </div>
                            <div>
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Ate</label>
                                <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)} className={`${bgInput} border ${borderCol} rounded-lg px-3 py-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                            </div>
                            <div className="min-w-[150px]">
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Barbeiro</label>
                                <CustomDropdown value={histBarber} onChange={setHistBarber} options={[{ value: 'all', label: 'Todos' }, ...barbers.map(b => ({ value: b.id, label: b.name }))]} isDarkMode={isDarkMode} />
                            </div>
                            <div className="min-w-[150px]">
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Servico</label>
                                <CustomDropdown value={histService} onChange={setHistService} options={[{ value: 'all', label: 'Todos' }, ...services.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))]} isDarkMode={isDarkMode} />
                            </div>
                            <div className="min-w-[140px]">
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Pagamento</label>
                                <CustomDropdown value={histPayment} onChange={setHistPayment} options={[{ value: 'all', label: 'Todos' }, { value: 'pix', label: 'PIX' }, { value: 'credito', label: 'Credito' }, { value: 'debito', label: 'Debito' }, { value: 'dinheiro', label: 'Dinheiro' }]} isDarkMode={isDarkMode} />
                            </div>
                            <div className="min-w-[150px]">
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Produto</label>
                                <CustomDropdown value={histProduct} onChange={setHistProduct} options={[{ value: 'all', label: 'Todos' }, ...products.filter(p => p.active).map(p => ({ value: p.id, label: p.name }))]} isDarkMode={isDarkMode} />
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className={`block text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-1`}>Buscar</label>
                                <div className="relative">
                                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textSub}`} size={13} />
                                    <input type="text" value={histSearchQuery} onChange={e => setHistSearchQuery(e.target.value)} placeholder="Cliente ou barbeiro..." className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                </div>
                            </div>
                        </div>
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t ${borderCol}`}>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={13} className="text-primary" />
                                    <span className={`text-xs ${textSub}`}>Resultados:</span>
                                    <span className={`text-xs font-bold ${textMain}`}>{historyStats.count} comandas</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign size={13} className="text-emerald-500" />
                                    <span className={`text-xs ${textSub}`}>Total:</span>
                                    <span className="text-xs font-bold text-emerald-500">{formatCurrency(historyStats.total)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Receipt size={13} className="text-amber-500" />
                                    <span className={`text-xs ${textSub}`}>Ticket Medio:</span>
                                    <span className={`text-xs font-bold ${textMain}`}>{formatCurrency(historyStats.avg)}</span>
                                </div>
                            </div>
                            <button type="button" onClick={handleExportCSV} disabled={historyComandas.length === 0} className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${historyComandas.length === 0 ? `${borderCol} ${textSub} opacity-50 cursor-not-allowed` : `border-primary/30 text-primary hover:bg-primary/5`}`}>
                                <FileSpreadsheet size={14} /> Exportar CSV
                            </button>
                        </div>
                    </div>
                    <div className={`flex-1 ${bgCard} rounded-xl border ${borderCol} overflow-hidden flex flex-col`}>
                        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className={`sticky top-0 z-10 ${bgMuted}`}>
                                    <tr className={`border-b ${borderCol}`}>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Cliente</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Barbeiro</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Data</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Itens</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Pagamento</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider`}>Origem</th>
                                        <th className={`px-4 py-3 text-[10px] font-bold ${textSub} uppercase tracking-wider text-right`}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyComandas.length === 0 ? (
                                        <tr><td colSpan={7} className={`text-center py-12 ${textSub}`}>
                                            <CalendarRange size={32} className="mx-auto mb-2 opacity-15" />
                                            <p className="text-xs">Nenhuma comanda encontrada neste periodo</p>
                                        </td></tr>
                                    ) : visibleHistoryComandas.map(c => (
                                        <tr key={c.id} onClick={() => setDetailComanda(c)} className={`border-b ${borderCol} hover:bg-muted/50 transition-colors cursor-pointer`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${bgMuted} text-primary`}>
                                                        {(c.clientName || 'A')[0].toUpperCase()}
                                                    </div>
                                                    <span className={`text-xs font-medium ${textMain} truncate max-w-[140px]`}>{c.clientName || 'Avulso'}</span>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 text-xs ${textSub}`}>{c.barberName}</td>
                                            <td className={`px-4 py-3 text-xs ${textSub}`}>{new Date(c.closedAt || c.openedAt).toLocaleDateString('pt-BR')}</td>
                                            <td className={`px-4 py-3 text-xs ${textSub}`}>{c.items?.length || 0} itens</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${bgMuted} ${textSub}`}>
                                                    {c.paymentMethod || '--'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><OriginBadge origin={c.origin} /></td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-bold ${c.status === 'cancelled' ? 'text-red-500 line-through' : 'text-emerald-500'}`}>{formatCurrency(c.finalAmount)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {hasMoreHistory && (
                            <div className={`p-3 border-t ${borderCol} flex justify-center`}>
                                <button type="button" onClick={() => setHistVisibleCount(count => count + HIST_PAGE_SIZE)} className={`px-4 py-2 rounded-lg border ${borderCol} ${textSub} hover:text-primary hover:border-primary/40 text-xs font-bold transition-colors`}>
                                    Carregar mais ({historyComandas.length - histVisibleCount} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}



            {/* ===================== TAB: CONFIGURACOES ===================== */}

            {activeTab === 'configuracoes' && (

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4">



                    {/* Card: Auto-Status */}

                    <div className={`${bgCard} rounded-xl border ${borderCol} p-5`}>

                        <div className="flex items-center gap-3 mb-4">

                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>

                                <Zap size={18} className="text-blue-500" />

                            </div>

                            <div>

                                <h3 className={`text-sm font-bold ${textMain}`}>Automacao de Status</h3>

                                <p className={`text-xs ${textSub}`}>Transicoes automaticas de status com base no horario dos agendamentos</p>

                            </div>

                        </div>

                        <div className="space-y-3">

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.autoStatusEnabled ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Auto-transicao de status</p>

                                        <p className={`text-[10px] ${textSub}`}>Muda status automaticamente com base no horario</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('autoStatusEnabled', !comandaSettings.autoStatusEnabled)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.autoStatusEnabled ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.autoStatusEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.autoCompleteEnabled ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Auto-conclusao</p>

                                        <p className={`text-[10px] ${textSub}`}>Muda para "Concluido" ao fim da duracao do servico</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('autoCompleteEnabled', !comandaSettings.autoCompleteEnabled)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.autoCompleteEnabled ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.autoCompleteEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <Clock size={16} className={textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Tolerancia para "Nao Compareceu"</p>

                                        <p className={`text-[10px] ${textSub}`}>Minutos apos o horario agendado para marcar no-show</p>

                                    </div>

                                </div>

                                <div className="flex items-center gap-2">

                                    <input type="number" min={5} max={60} value={comandaSettings.noShowToleranceMin} onChange={e => updateSetting('noShowToleranceMin', Number(e.target.value) || 15)} className={`w-16 text-center ${bgInput} border ${borderCol} rounded-lg px-2 py-1.5 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />

                                    <span className={`text-[10px] ${textSub}`}>min</span>

                                </div>

                            </div>

                        </div>

                    </div>



                    {/* Card: Comanda */}

                    <div className={`${bgCard} rounded-xl border ${borderCol} p-5`}>

                        <div className="flex items-center gap-3 mb-4">

                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>

                                <ClipboardList size={18} className="text-emerald-500" />

                            </div>

                            <div>

                                <h3 className={`text-sm font-bold ${textMain}`}>Comandas</h3>

                                <p className={`text-xs ${textSub}`}>Regras de criacao e gerenciamento de comandas</p>

                            </div>

                        </div>

                        <div className="space-y-3">

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.autoCreateComanda ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Criar comanda automaticamente</p>

                                        <p className={`text-[10px] ${textSub}`}>Gera comanda ao mudar para "Em Atendimento"</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('autoCreateComanda', !comandaSettings.autoCreateComanda)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.autoCreateComanda ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.autoCreateComanda ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.requireClientForComanda ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Exigir cliente para abrir comanda</p>

                                        <p className={`text-[10px] ${textSub}`}>Bloqueia criacao de comanda sem cliente vinculado</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('requireClientForComanda', !comandaSettings.requireClientForComanda)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.requireClientForComanda ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.requireClientForComanda ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <CreditCard size={16} className={textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Metodo de pagamento padrao</p>

                                        <p className={`text-[10px] ${textSub}`}>Pre-seleciona no checkout de comanda</p>

                                    </div>

                                </div>

                                <div className="min-w-[140px]"><CustomDropdown value={comandaSettings.defaultPaymentMethod} onChange={v => updateSetting('defaultPaymentMethod', v)} options={[{ value: 'pix', label: 'PIX' }, { value: 'credito', label: 'Credito' }, { value: 'debito', label: 'Debito' }, { value: 'dinheiro', label: 'Dinheiro' }]} isDarkMode={isDarkMode} /></div>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <Clock size={16} className={textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Auto-fechar comanda</p>

                                        <p className={`text-[10px] ${textSub}`}>Fecha automaticamente X min apos conclusao (0 = desativado)</p>

                                    </div>

                                </div>

                                <div className="flex items-center gap-2">

                                    <input type="number" min={0} max={120} value={comandaSettings.autoCloseTimerMin} onChange={e => updateSetting('autoCloseTimerMin', Number(e.target.value) || 0)} className={`w-16 text-center ${bgInput} border ${borderCol} rounded-lg px-2 py-1.5 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`} />

                                    <span className={`text-[10px] ${textSub}`}>min</span>

                                </div>

                            </div>

                        </div>

                    </div>



                    {/* Card: Permissoes e UX */}

                    <div className={`${bgCard} rounded-xl border ${borderCol} p-5`}>

                        <div className="flex items-center gap-3 mb-4">

                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>

                                <ShieldCheck size={18} className="text-amber-500" />

                            </div>

                            <div>

                                <h3 className={`text-sm font-bold ${textMain}`}>Permissoes e Experiencia</h3>

                                <p className={`text-xs ${textSub}`}>Controle de acesso e sugestoes inteligentes</p>

                            </div>

                        </div>

                        <div className="space-y-3">

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.allowReopenClosed ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Permitir reabrir comandas finalizadas</p>

                                        <p className={`text-[10px] ${textSub}`}>Exibe botao "Reabrir" no historico</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('allowReopenClosed', !comandaSettings.allowReopenClosed)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.allowReopenClosed ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.allowReopenClosed ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                            <div className={`flex items-center justify-between p-3 rounded-xl ${bgMuted}`}>

                                <div className="flex items-center gap-3">

                                    <ToggleLeft size={16} className={comandaSettings.showProductSuggestions ? 'text-emerald-500' : textSub} />

                                    <div>

                                        <p className={`text-xs font-semibold ${textMain}`}>Sugestoes de produtos (cross-sell)</p>

                                        <p className={`text-[10px] ${textSub}`}>Sugere produtos com base no historico do cliente</p>

                                    </div>

                                </div>

                                <button onClick={() => updateSetting('showProductSuggestions', !comandaSettings.showProductSuggestions)} className={`relative w-11 h-6 rounded-full transition-colors ${comandaSettings.showProductSuggestions ? 'bg-emerald-500' : bgToggleOff}`}>

                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${comandaSettings.showProductSuggestions ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />

                                </button>

                            </div>

                        </div>

                    </div>



                    {/* Info Banner */}

                    <div className={`rounded-xl border ${borderCol} p-4 flex items-start gap-3 ${isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>

                        <AlertTriangle size={16} className="text-blue-500 shrink-0 mt-0.5" />

                        <div>

                            <p className={`text-xs font-semibold ${textMain} mb-1`}>Como funciona a automacao?</p>

                            <p className={`text-[10px] leading-relaxed ${textSub}`}>

                                O sistema verifica a cada 60 segundos os agendamentos do dia. Ao atingir o horario de inicio, o status muda para "Em Atendimento" e a comanda e criada automaticamente. Ao fim da duracao, o status muda para "Concluido". Se o cliente nao comparecer dentro da tolerancia, e marcado como "Nao Compareceu". Todas as regras podem ser ativadas/desativadas individualmente.

                            </p>

                        </div>

                    </div>

                </div>

            )}
            {/* ===================== DETAIL MODAL ===================== */}
            {detailComanda && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailComanda(null)}>
                    <div className={`${bgCard} rounded-2xl border ${borderCol} shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className={`flex items-center justify-between p-5 border-b ${borderCol}`}>
                            <div>
                                <h2 className={`text-lg font-bold ${textMain}`}>Detalhes da Comanda</h2>
                                <p className={`text-xs ${textSub}`}>#{detailComanda.id.slice(0, 8)}</p>
                            </div>
                            <button onClick={() => setDetailComanda(null)} className={`p-2 rounded-lg hover:bg-muted/50 transition-colors`}><X size={18} className={textSub} /></button>
                        </div>

                        {/* Info Grid */}
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Cliente</p>
                                    <p className={`text-sm font-bold ${textMain}`}>{detailComanda.clientName || 'Avulso'}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Barbeiro</p>
                                    <p className={`text-sm font-bold ${textMain}`}>{detailComanda.barberName}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Abertura</p>
                                    <p className={`text-sm font-bold ${textMain}`}>{new Date(detailComanda.openedAt).toLocaleString('pt-BR')}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Fechamento</p>
                                    <p className={`text-sm font-bold ${textMain}`}>{detailComanda.closedAt ? new Date(detailComanda.closedAt).toLocaleString('pt-BR') : '--'}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Pagamento</p>
                                    <p className={`text-sm font-bold ${textMain} capitalize`}>{detailComanda.paymentMethod || '--'}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${bgMuted}`}>
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-0.5`}>Origem</p>
                                    <div className="mt-0.5"><OriginBadge origin={detailComanda.origin} /></div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider mb-2`}>Itens ({detailComanda.items?.length || 0})</p>
                                <div className={`rounded-xl border ${borderCol} overflow-hidden`}>
                                    <table className="w-full text-left">
                                        <thead className={bgMuted}>
                                            <tr className={`border-b ${borderCol}`}>
                                                <th className={`px-3 py-2 text-[10px] font-bold ${textSub} uppercase`}>Tipo</th>
                                                <th className={`px-3 py-2 text-[10px] font-bold ${textSub} uppercase`}>Nome</th>
                                                <th className={`px-3 py-2 text-[10px] font-bold ${textSub} uppercase text-center`}>Qtd</th>
                                                <th className={`px-3 py-2 text-[10px] font-bold ${textSub} uppercase text-right`}>Unit.</th>
                                                <th className={`px-3 py-2 text-[10px] font-bold ${textSub} uppercase text-right`}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(detailComanda.items || []).map(item => (
                                                <tr key={item.id} className={`border-b last:border-b-0 ${borderCol}`}>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${item.type === 'service' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                                                            {item.type === 'service' ? <Scissors size={10} /> : <Package size={10} />}
                                                            {item.type === 'service' ? 'Servico' : 'Produto'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-3 py-2 text-xs font-medium ${textMain}`}>{item.name}</td>
                                                    <td className={`px-3 py-2 text-xs ${textSub} text-center`}>{item.quantity}</td>
                                                    <td className={`px-3 py-2 text-xs ${textSub} text-right`}>{formatCurrency(item.unitPrice)}</td>
                                                    <td className={`px-3 py-2 text-xs font-bold ${textMain} text-right`}>{formatCurrency(item.totalPrice)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className={`rounded-xl border ${borderCol} p-4 space-y-2`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${textSub}`}>Subtotal</span>
                                    <span className={`text-xs font-medium ${textMain}`}>{formatCurrency(detailComanda.totalAmount)}</span>
                                </div>
                                {detailComanda.discountAmount > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs ${textSub}`}>Desconto</span>
                                        <span className="text-xs font-medium text-red-500">-{formatCurrency(detailComanda.discountAmount)}</span>
                                    </div>
                                )}
                                <div className={`flex justify-between items-center pt-2 border-t ${borderCol}`}>
                                    <span className={`text-sm font-bold ${textMain}`}>Total Final</span>
                                    <span className={`text-sm font-bold ${detailComanda.status === 'cancelled' ? 'text-red-500 line-through' : 'text-emerald-500'}`}>{formatCurrency(detailComanda.finalAmount)}</span>
                                </div>
                            </div>

                            <div className={`p-3 rounded-xl ${bgMuted}`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className={`text-[10px] font-semibold ${textSub} uppercase tracking-wider flex items-center gap-1`}>
                                        <MessageSquare size={11} /> Observacoes
                                    </p>
                                    {editingNotes !== detailComanda.id && (
                                        <button type="button" onClick={() => { setEditingNotes(detailComanda.id); setNotesValue(detailComanda.notes || ''); }} className="text-[10px] font-bold text-primary hover:text-primary-600">
                                            Editar
                                        </button>
                                    )}
                                </div>
                                {editingNotes === detailComanda.id ? (
                                    <div className="space-y-2">
                                        <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={3} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`} placeholder="Anote preferencias, ajustes ou observacoes internas..." />
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setEditingNotes(null)} className={`px-3 py-1.5 rounded-lg border ${borderCol} ${textSub} text-[10px] font-bold`}>Cancelar</button>
                                            <button type="button" onClick={() => handleSaveNotes(detailComanda.id, notesValue)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold flex items-center gap-1">
                                                <Save size={11} /> Salvar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={`text-xs ${detailComanda.notes ? textMain : textSub}`}>{detailComanda.notes || 'Sem observacoes registradas.'}</p>
                                )}
                            </div>

                            {(comandaSettings.allowReopenClosed && (detailComanda.status === 'closed' || detailComanda.status === 'cancelled')) && (
                                <button onClick={() => handleReopenComanda(detailComanda.id)} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${isDarkMode ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'}`}>
                                    <RotateCcw size={16} />
                                    Reabrir Comanda
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
