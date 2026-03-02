import React, { useState, useMemo } from 'react';
import {
    ClipboardList, Plus, Trash2, X, Search, User, Clock, DollarSign,
    Scissors, Package, ShoppingCart, CheckCircle, AlertCircle, Receipt,
    CreditCard, Banknote, QrCode, XCircle, ChevronDown, ChevronUp, Timer,
    CalendarDays, Store, Crown, ArrowRight, Hash, LayoutGrid, List
} from 'lucide-react';
import { Comanda, ComandaItem, Service, Product, TeamMember, Client } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveComanda, deleteComanda, saveComandaItem, deleteComandaItem, closeComanda } from '../lib/dataService';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { CustomDropdown } from '../components/CustomDropdown';

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
    { value: 'credito', label: 'Crédito', icon: CreditCard },
    { value: 'debito', label: 'Débito', icon: CreditCard },
];

const ORIGIN_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
    agenda: { label: 'Agenda', icon: CalendarDays },
    balcao: { label: 'Balcão', icon: Store },
    clube: { label: 'Clube', icon: Crown },
    manual: { label: 'Manual', icon: ClipboardList },
};

export const ComandaPage: React.FC<ComandaPageProps> = ({ isDarkMode, currentUser }) => {
    const {
        services, clients, members, comandas, setComandas, products,
        subscriptions, calendarEvents
    } = useAppData();
    const { permissions: contextPermissions } = useAppData();
    const { canCreate, canEdit, canDelete } = usePermissions(currentUser, contextPermissions);
    const confirm = useConfirm();
    const toast = useToast();

    // ── Theme Tokens ─────────────────────────────────────────
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const bgPanel = isDarkMode ? 'bg-[#0f1117]' : 'bg-slate-50';

    // ── State ────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);

    // New Comanda Modal
    const [isNewComandaOpen, setIsNewComandaOpen] = useState(false);
    const [selectedBarberId, setSelectedBarberId] = useState(currentUser.id);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [walkInName, setWalkInName] = useState('');

    // Detail View — Add Item
    const [addItemType, setAddItemType] = useState<'service' | 'product' | null>(null);
    const [itemSearch, setItemSearch] = useState('');

    // Close / Payment
    const [showPayment, setShowPayment] = useState(false);
    const [closePaymentMethod, setClosePaymentMethod] = useState('pix');
    const [closeDiscount, setCloseDiscount] = useState(0);

    // ── Helpers ──────────────────────────────────────────────
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const barbers = useMemo(() =>
        members.filter(m => ['Admin', 'Manager', 'Barber', 'Sales Executive'].includes(m.role) && m.status === 'Active'),
        [members]
    );

    const filteredComandas = useMemo(() => {
        return comandas
            .filter(c => {
                if (statusFilter !== 'all' && c.status !== statusFilter) return false;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return (c.clientName?.toLowerCase().includes(q) ||
                        c.barberName?.toLowerCase().includes(q) ||
                        c.id.toLowerCase().includes(q));
                }
                return true;
            })
            .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    }, [comandas, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        const today = new Date().toDateString();
        const todayComandas = comandas.filter(c => new Date(c.openedAt).toDateString() === today);
        const openCount = comandas.filter(c => c.status === 'open' || c.status === 'in_progress').length;
        const todayClosed = todayComandas.filter(c => c.status === 'closed');
        const todayRevenue = todayClosed.reduce((sum, c) => sum + c.finalAmount, 0);
        const avgTicket = todayClosed.length > 0 ? todayRevenue / todayClosed.length : 0;
        return { openCount, todayRevenue, todayClosed: todayClosed.length, avgTicket };
    }, [comandas]);

    const selectedComanda = selectedComandaId ? comandas.find(c => c.id === selectedComandaId) : null;

    const filteredAddItems = useMemo(() => {
        if (!addItemType) return [];
        const q = itemSearch.toLowerCase();
        if (addItemType === 'service') {
            return services.filter(s => s.active && s.name.toLowerCase().includes(q));
        }
        return products.filter(p => p.active && p.stock > 0 && p.name.toLowerCase().includes(q));
    }, [addItemType, itemSearch, services, products]);

    const getClientSubscription = (clientId?: string) => {
        if (!clientId) return null;
        return subscriptions.find(s => s.clientId === clientId && s.status === 'active') || null;
    };

    // ── Actions ──────────────────────────────────────────────
    const handleCreateComanda = async () => {
        const client = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
        const barber = members.find(m => m.id === selectedBarberId);
        const newComanda: Comanda = {
            id: crypto.randomUUID(),
            clientId: selectedClientId || undefined,
            clientName: client?.name || walkInName || 'Cliente Avulso',
            barberId: selectedBarberId,
            barberName: barber?.name || currentUser.name,
            status: 'open',
            totalAmount: 0,
            discountAmount: 0,
            finalAmount: 0,
            openedAt: new Date().toISOString(),
            items: [],
            origin: 'balcao',
            openedBy: currentUser.id,
        };

        const result = await saveComanda(newComanda);
        if (!result.success) {
            toast.error('Erro ao abrir comanda', result.error || 'Erro desconhecido');
            return;
        }
        setComandas((prev: Comanda[]) => [newComanda, ...prev]);
        toast.success('Comanda aberta!');
        setIsNewComandaOpen(false);
        setSelectedClientId('');
        setWalkInName('');
        setSelectedComandaId(newComanda.id);
    };

    const handleAddItem = async (comanda: Comanda, itemType: 'service' | 'product', item: Service | Product) => {
        const newItem: ComandaItem = {
            id: crypto.randomUUID(),
            comandaId: comanda.id,
            type: itemType,
            itemId: item.id,
            name: item.name,
            quantity: 1,
            unitPrice: itemType === 'service' ? (item as Service).price : (item as Product).sellPrice,
            totalPrice: itemType === 'service' ? (item as Service).price : (item as Product).sellPrice,
        };

        const result = await saveComandaItem(newItem);
        if (!result.success) {
            toast.error('Erro ao adicionar item', result.error || 'Erro desconhecido');
            return;
        }

        setComandas(prev => prev.map(c => {
            if (c.id === comanda.id) {
                const items = [...(c.items || []), newItem];
                const total = items.reduce((sum, i) => sum + i.totalPrice, 0);
                return { ...c, items, totalAmount: total, finalAmount: total - (c.discountAmount || 0) };
            }
            return c;
        }));
        toast.success(`${item.name} adicionado!`);
        setAddItemType(null);
        setItemSearch('');
    };

    const handleRemoveItem = async (comanda: Comanda, itemId: string) => {
        const result = await deleteComandaItem(itemId);
        if (!result.success) {
            toast.error('Erro ao remover item', result.error || '');
            return;
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
        const result = await closeComanda(selectedComandaId, closePaymentMethod, closeDiscount, currentUser.id);
        if (!result.success) {
            toast.error('Erro ao finalizar', result.error || '');
            return;
        }
        const now = new Date().toISOString();
        setComandas(prev => prev.map(c => {
            if (c.id === selectedComandaId) {
                const finalAmount = Math.max(0, c.totalAmount - closeDiscount);
                return { ...c, status: 'closed' as const, paymentMethod: closePaymentMethod, discountAmount: closeDiscount, finalAmount, closedAt: now, closedBy: currentUser.id };
            }
            return c;
        }));
        toast.success('Comanda finalizada!');
        setShowPayment(false);
        setCloseDiscount(0);
        setSelectedComandaId(null);
    };

    const handleDeleteComanda = async (id: string) => {
        const ok = await confirm({
            title: 'Excluir Comanda',
            message: 'Tem certeza? Todos os itens serão excluídos.',
            variant: 'danger',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
        });
        if (!ok) return;
        const result = await deleteComanda(id);
        if (!result.success) {
            toast.error('Erro ao excluir', result.error || '');
            return;
        }
        setComandas((prev: Comanda[]) => prev.filter(c => c.id !== id));
        toast.success('Comanda excluída');
        if (selectedComandaId === id) setSelectedComandaId(null);
    };

    // ── Origin Badge ─────────────────────────────────────────
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
        if (size === 'md') {
            return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
                    <Icon size={12} />{cfg.label}
                </span>
            );
        }
        return (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${cls}`}>
                <Icon size={9} />{cfg.label}
            </span>
        );
    };

    // ══════════════════════════════════════════════════════════
    // ██  RENDER  ██
    // ══════════════════════════════════════════════════════════
    return (
        <div className="animate-in fade-in duration-500 h-full flex flex-col pb-16 md:pb-0">

            {/* ===================== NEW COMANDA MODAL ===================== */}
            {isNewComandaOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-2">
                                <Store size={18} className="text-primary" />
                                <h3 className={`font-semibold text-lg ${textMain}`}>Nova Comanda (Balcão)</h3>
                            </div>
                            <button onClick={() => setIsNewComandaOpen(false)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Barbeiro</label>
                                <CustomDropdown
                                    value={selectedBarberId}
                                    onChange={setSelectedBarberId}
                                    options={barbers.map(b => ({ value: b.id, label: b.name, icon: <User size={12} /> }))}
                                    isDarkMode={isDarkMode}
                                    placeholder="Selecionar barbeiro"
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Cliente (opcional)</label>
                                <CustomDropdown
                                    value={selectedClientId}
                                    onChange={setSelectedClientId}
                                    options={[
                                        { value: '', label: '-- Selecionar cliente --' },
                                        ...clients.map(c => ({ value: c.id, label: c.name, icon: <User size={12} /> }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                />
                            </div>
                            {!selectedClientId && (
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome Avulso</label>
                                    <input
                                        type="text"
                                        value={walkInName}
                                        onChange={e => setWalkInName(e.target.value)}
                                        placeholder="Ex: João (cadeira 2)"
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    />
                                </div>
                            )}
                            <button
                                onClick={handleCreateComanda}
                                className="w-full py-3 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Store size={16} /> Abrir Comanda
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== ADD ITEM MODAL ===================== */}
            {addItemType && selectedComanda && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>
                                {addItemType === 'service' ? '+ Serviço' : '+ Produto'}
                            </h3>
                            <button onClick={() => { setAddItemType(null); setItemSearch(''); }} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <div className="p-4">
                            <div className="relative mb-4">
                                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={16} />
                                <input
                                    type="text"
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    placeholder={`Buscar ${addItemType === 'service' ? 'serviço' : 'produto'}...`}
                                    className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {filteredAddItems.length === 0 && (
                                    <p className={`text-center py-4 ${textSub} text-sm`}>Nenhum item encontrado.</p>
                                )}
                                {filteredAddItems.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddItem(selectedComanda, addItemType, item)}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border ${borderCol} hover:border-primary/50 transition-colors group`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark text-primary' : 'bg-slate-100 text-primary'}`}>
                                                {addItemType === 'service' ? <Scissors size={16} /> : <Package size={16} />}
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-medium text-sm ${textMain}`}>{item.name}</p>
                                                <p className={`text-xs ${textSub}`}>
                                                    {addItemType === 'service'
                                                        ? `${(item as Service).duration || 30} min`
                                                        : `Estoque: ${(item as Product).stock}`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-primary text-sm">
                                            {formatCurrency(addItemType === 'service' ? (item as Service).price : (item as Product).sellPrice)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== KPI HEADER ===================== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Frente de Caixa</h1>
                    <p className={`${textSub} text-sm`}>Comandas e atendimentos da barbearia</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Mini KPIs */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                <ClipboardList size={14} className="text-emerald-500" />
                            </div>
                            <div>
                                <p className={`text-[10px] ${textSub} uppercase tracking-wider font-medium`}>Abertas</p>
                                <p className={`font-bold text-sm ${textMain}`}>{stats.openCount}</p>
                            </div>
                        </div>
                        <div className={`w-px h-8 ${isDarkMode ? 'bg-dark-border' : 'bg-slate-200'}`} />
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'}`}>
                                <DollarSign size={14} className="text-primary" />
                            </div>
                            <div>
                                <p className={`text-[10px] ${textSub} uppercase tracking-wider font-medium`}>Faturado Hoje</p>
                                <p className={`font-bold text-sm ${textMain}`}>{formatCurrency(stats.todayRevenue)}</p>
                            </div>
                        </div>
                        <div className={`w-px h-8 ${isDarkMode ? 'bg-dark-border' : 'bg-slate-200'}`} />
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                                <Receipt size={14} className="text-amber-500" />
                            </div>
                            <div>
                                <p className={`text-[10px] ${textSub} uppercase tracking-wider font-medium`}>Ticket Médio</p>
                                <p className={`font-bold text-sm ${textMain}`}>{formatCurrency(stats.avgTicket)}</p>
                            </div>
                        </div>
                    </div>
                    {canCreate('/comanda') && (
                        <button
                            onClick={() => setIsNewComandaOpen(true)}
                            className="px-4 py-2.5 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-primary/20"
                        >
                            <Plus size={18} /> <span className="hidden sm:inline">Nova Comanda</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ===================== 3-COLUMN LAYOUT ===================== */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">

                {/* ─── LEFT: Comanda List ─── */}
                <div className={`lg:w-[340px] xl:w-[380px] flex flex-col ${bgCard} rounded-xl border ${borderCol} overflow-hidden shrink-0`}>
                    {/* Search + Filter */}
                    <div className={`p-3 border-b ${borderCol} space-y-3`}>
                        <div className="relative">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={15} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar cliente, barbeiro..."
                                className={`w-full pl-9 pr-3 py-2 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto">
                            {[
                                { value: 'all', label: 'Todas' },
                                { value: 'open', label: 'Abertas' },
                                { value: 'in_progress', label: 'Atend.' },
                                { value: 'closed', label: 'Fechadas' },
                            ].map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setStatusFilter(f.value)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-all ${statusFilter === f.value
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : `${borderCol} ${textSub} hover:border-primary/40`
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comanda Cards List */}
                    <div className="flex-1 overflow-y-auto">
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
                                    const timeStr = new Date(c.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedComandaId(c.id);
                                                setShowPayment(false);
                                                setAddItemType(null);
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected
                                                ? `border-primary ${isDarkMode ? 'bg-primary/5' : 'bg-primary/5'} shadow-sm shadow-primary/10`
                                                : `${borderCol} hover:border-primary/30 ${isDarkMode ? 'hover:bg-dark/50' : 'hover:bg-slate-50'}`
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                                                        ${isSelected
                                                            ? 'bg-primary text-white'
                                                            : isDarkMode ? 'bg-dark text-primary' : 'bg-primary/10 text-primary'
                                                        }`}
                                                    >
                                                        {(c.clientName || 'A')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`font-semibold text-xs truncate ${textMain}`}>{c.clientName || 'Cliente Avulso'}</p>
                                                        <p className={`text-[10px] ${textSub} truncate`}>{c.barberName} • {timeStr}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className={`font-bold text-xs ${c.status === 'closed' ? 'text-emerald-500' : textMain}`}>
                                                        {formatCurrency(c.finalAmount || c.totalAmount)}
                                                    </span>
                                                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${isDarkMode ? s.darkColor : s.color}`}>
                                                        {s.label}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <OriginBadge origin={c.origin} />
                                                {c.items && c.items.length > 0 && (
                                                    <span className={`text-[10px] ${textSub}`}>{c.items.length} {c.items.length === 1 ? 'item' : 'itens'}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── CENTER + RIGHT: Detail & Payment ─── */}
                <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">

                    {/* ─── CENTER: Comanda Detail ─── */}
                    <div className={`flex-1 flex flex-col ${bgCard} rounded-xl border ${borderCol} overflow-hidden`}>
                        {!selectedComanda ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className={`text-center ${textSub}`}>
                                    <Receipt size={48} className="mx-auto mb-3 opacity-15" />
                                    <p className="text-sm font-medium mb-1">Selecione uma comanda</p>
                                    <p className="text-xs opacity-60">Clique em uma comanda na listagem ao lado</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Detail Header */}
                                <div className={`p-4 border-b ${borderCol} flex items-center justify-between`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-primary text-white`}>
                                            {(selectedComanda.clientName || 'A')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-bold text-sm ${textMain}`}>{selectedComanda.clientName || 'Cliente Avulso'}</h3>
                                                <OriginBadge origin={selectedComanda.origin} size="md" />
                                                {(() => {
                                                    const clientSub = getClientSubscription(selectedComanda.clientId);
                                                    if (!clientSub) return null;
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDarkMode ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>
                                                            <Crown size={10} />Assinante
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <p className={`text-xs ${textSub}`}>
                                                <span className="font-mono text-[10px] opacity-50">#{selectedComanda.id.slice(0, 8)}</span>
                                                {' • '}{selectedComanda.barberName}
                                                {selectedComanda.appointmentId && ' • Agendamento vinculado'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const s = STATUS_MAP[selectedComanda.status] || STATUS_MAP.open;
                                            const StatusIcon = s.icon;
                                            return (
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${isDarkMode ? s.darkColor : s.color}`}>
                                                    <StatusIcon size={12} />
                                                    {s.label}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className={`text-xs font-semibold ${textSub} uppercase tracking-wider`}>Itens da Comanda</h4>
                                        {(selectedComanda.status === 'open' || selectedComanda.status === 'in_progress') && (
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => setAddItemType('service')}
                                                    className="px-2.5 py-1 rounded-lg border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/5 transition-colors flex items-center gap-1"
                                                >
                                                    <Scissors size={11} /> Serviço
                                                </button>
                                                <button
                                                    onClick={() => setAddItemType('product')}
                                                    className="px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-500 text-[11px] font-semibold hover:bg-amber-500/5 transition-colors flex items-center gap-1"
                                                >
                                                    <Package size={11} /> Produto
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {(!selectedComanda.items || selectedComanda.items.length === 0) ? (
                                        <div className={`text-center py-10 ${textSub}`}>
                                            <ShoppingCart size={32} className="mx-auto mb-2 opacity-15" />
                                            <p className="text-xs">Nenhum item adicionado</p>
                                            {(selectedComanda.status === 'open' || selectedComanda.status === 'in_progress') && (
                                                <p className="text-[10px] opacity-60 mt-1">Use os botões acima para adicionar serviços ou produtos</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedComanda.items.map(item => (
                                                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${borderCol} transition-colors hover:border-primary/20`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${item.type === 'service'
                                                            ? (isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary')
                                                            : (isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-500')
                                                            }`}>
                                                            {item.type === 'service' ? <Scissors size={14} /> : <Package size={14} />}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-medium ${textMain}`}>{item.name}</p>
                                                            <p className={`text-xs ${textSub}`}>{item.quantity}x {formatCurrency(item.unitPrice)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-bold ${textMain}`}>{formatCurrency(item.totalPrice)}</span>
                                                        {(selectedComanda.status === 'open' || selectedComanda.status === 'in_progress') && (
                                                            <button
                                                                onClick={() => handleRemoveItem(selectedComanda, item.id)}
                                                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Actions */}
                                <div className={`p-4 border-t ${borderCol}`}>
                                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-dark/60' : 'bg-slate-50'} mb-3`}>
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
                                        <div className={`flex justify-between pt-2 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                                            <span className={`text-sm font-bold ${textMain}`}>Total</span>
                                            <span className="text-lg font-black text-emerald-500">{formatCurrency(selectedComanda.finalAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {(selectedComanda.status === 'open' || selectedComanda.status === 'in_progress') && selectedComanda.items && selectedComanda.items.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setShowPayment(true);
                                                    setCloseDiscount(0);
                                                }}
                                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                            >
                                                <Receipt size={16} /> Finalizar Pagamento
                                            </button>
                                        )}
                                        {selectedComanda.status === 'open' && canDelete('/comanda') && (
                                            <button
                                                onClick={() => handleDeleteComanda(selectedComanda.id)}
                                                className={`px-4 py-3 rounded-xl border transition-colors ${isDarkMode ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-500 hover:bg-red-50'}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ─── RIGHT: Payment Panel (conditionally shown) ─── */}
                    {showPayment && selectedComanda && (
                        <div className={`lg:w-[320px] flex flex-col ${bgCard} rounded-xl border ${borderCol} overflow-hidden shrink-0 animate-in slide-in-from-right-2 duration-200`}>
                            <div className={`p-4 border-b ${borderCol} flex items-center justify-between`}>
                                <div className="flex items-center gap-2">
                                    <DollarSign size={18} className="text-emerald-500" />
                                    <h3 className={`font-bold text-sm ${textMain}`}>Pagamento</h3>
                                </div>
                                <button onClick={() => setShowPayment(false)} className={`${textSub} hover:${textMain}`}><X size={18} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                                {/* Amount Summary */}
                                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-xs ${textSub}`}>Subtotal</span>
                                        <span className={textMain}>{formatCurrency(selectedComanda.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-xs ${textSub}`}>Desconto</span>
                                        <span className="text-red-500">-{formatCurrency(closeDiscount)}</span>
                                    </div>
                                    <div className={`flex justify-between pt-2 border-t ${borderCol}`}>
                                        <span className={`font-bold ${textMain}`}>Total</span>
                                        <span className="font-black text-xl text-emerald-500">{formatCurrency(Math.max(0, selectedComanda.totalAmount - closeDiscount))}</span>
                                    </div>
                                </div>

                                {/* Discount */}
                                <div>
                                    <label className={`block text-xs font-semibold ${textSub} mb-2`}>Desconto (R$)</label>
                                    <input
                                        type="number"
                                        value={closeDiscount}
                                        onChange={e => setCloseDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-xl p-3 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className={`block text-xs font-semibold ${textSub} mb-2`}>Forma de Pagamento</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PAYMENT_METHODS.map(m => {
                                            const Icon = m.icon;
                                            return (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setClosePaymentMethod(m.value)}
                                                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${closePaymentMethod === m.value
                                                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                                                        : `${borderCol} ${textSub} hover:border-primary/50`
                                                        }`}
                                                >
                                                    <Icon size={16} />
                                                    {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Finalize Button */}
                            <div className="p-4 border-t border-emerald-500/20">
                                <button
                                    onClick={handleCloseComanda}
                                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 text-sm"
                                >
                                    <CheckCircle size={18} />
                                    Finalizar — {formatCurrency(Math.max(0, selectedComanda.totalAmount - closeDiscount))}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
