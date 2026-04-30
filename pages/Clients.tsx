import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Filter, Mail, Pencil, Plus, X, User, Briefcase, Phone, MessageCircle, Calendar, DollarSign, Target, Image as ImageIcon, Upload, Trash2, Lock, Tag, Loader2, Users, TrendingUp, Gift, CreditCard, ChevronDown, ChevronUp, Crown, AlertTriangle, AlertCircle, BarChart3, Shield, HelpCircle, UserCheck, UserMinus, Clock, Settings, RotateCcw, Info, ToggleRight, Play, Download, MapPin, CheckCircle2, ArrowUpDown, Flame, FileSpreadsheet, Zap, Heart } from 'lucide-react';
import { Client, TeamMember, Contract, Subscription, SubscriptionPlan, ClientUnitSettings } from '../types';
import { useClientReassignment, getClientUnitSettings, saveClientUnitSettings } from '../hooks/useClientReassignment';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveClient, deleteClient, saveSubscription } from '../lib/dataService';
import { uploadBase64Image, isBase64 } from '../lib/storage';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';

type ClientFilter = 'all' | 'active' | 'subscribers' | 'noPlan' | 'birthday' | 'inactive' | 'noVisit';
type ClientSort = 'name' | 'visits_desc' | 'lastVisit_desc' | 'lastVisit_asc' | 'ltv_desc';
type EngagementLevel = 'loyal' | 'frequent' | 'occasional' | 'at_risk' | 'lost';

const PAGE_SIZE = 30;

const ENGAGEMENT_CONFIG: Record<EngagementLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  loyal:      { label: 'Fiel',       color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <Heart size={10} /> },
  frequent:   { label: 'Frequente',  color: 'text-blue-500',    bg: 'bg-blue-500/10',    icon: <Zap size={10} /> },
  occasional: { label: 'Ocasional',  color: 'text-slate-400',   bg: 'bg-muted',          icon: <Clock size={10} /> },
  at_risk:    { label: 'Em risco',   color: 'text-amber-500',   bg: 'bg-amber-500/10',   icon: <AlertTriangle size={10} /> },
  lost:       { label: 'Perdido',    color: 'text-red-500',     bg: 'bg-red-500/10',     icon: <AlertCircle size={10} /> },
};

interface ClientsProps {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  members: TeamMember[];
  contracts: Contract[];
  globalSearchTerm?: string;
  isDarkMode?: boolean;
  currentUser: TeamMember;
}

export const Clients: React.FC<ClientsProps> = ({ clients, setClients, members, contracts, globalSearchTerm, isDarkMode: _isDarkMode, currentUser }) => {
  const isDarkMode = _isDarkMode ?? document.documentElement.classList.contains('dark');

  // Permissions
  const { permissions: contextPermissions, subscriptions, subscriptionPlans } = useAppData();
  const { selectedUnitId, filteredComandas: comandas } = useFilteredData();
  const { canViewAllData, canDelete } = usePermissions(currentUser, contextPermissions);
  const viewAll = canViewAllData('/clients');
  const canDeleteClient = canDelete('/clients');

  // Search & Modal State
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'clients' | 'indicators' | 'settings'>('clients');
  const [unitSettings, setUnitSettings] = useState<ClientUnitSettings>(getClientUnitSettings);
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);
  const [subSectionOpen, setSubSectionOpen] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  // ═══ NEW: Pagination, Filter, Sort state ═══
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeFilter, setActiveFilter] = useState<ClientFilter>('all');
  const [sortBy, setSortBy] = useState<ClientSort>('name');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Unit context
  const { units } = useAppData();
  const isFilteringUnit = selectedUnitId !== 'all';
  const selectedUnit = units.find(u => u.id === selectedUnitId);

  // Unit-filtered subscriptions
  const unitClientIds = useMemo(() => new Set(clients.map(c => c.id)), [clients]);
  const unitSubscriptions = useMemo(() =>
    isFilteringUnit ? subscriptions.filter(s => unitClientIds.has(s.clientId)) : subscriptions,
    [subscriptions, unitClientIds, isFilteringUnit]);

  // ALL clients (unfiltered -- for import modal)
  const { clients: allClients } = useAppData();

  // Theme Helpers (semantic tokens)
  const textMain = 'text-foreground';
  const textSub = 'text-muted-foreground';
  const bgCard = 'bg-card';
  const borderCol = 'border-border';
  const bgInput = 'bg-transparent';
  const shadowClass = 'shadow-sm dark:shadow-none';
  const inputCls = 'bg-transparent border border-input text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none';
  const labelCls = 'text-muted-foreground';

  // ═══ Engagement Score Helper ═══
  const getEngagement = useCallback((client: Client): EngagementLevel => {
    const now = Date.now();
    const DAY = 86400000;
    const daysSince = client.lastVisit ? (now - new Date(client.lastVisit).getTime()) / DAY : 999;
    const hasSub = subscriptions.some(s => s.clientId === client.id && s.status === 'active');
    const visits = client.totalVisits || 0;
    if (daysSince > 90) return 'lost';
    if (daysSince > 30) return 'at_risk';
    if (hasSub && visits >= 4) return 'loyal';
    if (visits >= 2) return 'frequent';
    return 'occasional';
  }, [subscriptions]);



  // Sync Global Search with Local Search
  useEffect(() => {
    if (globalSearchTerm !== undefined) {
      setSearchQuery(globalSearchTerm);
    }
  }, [globalSearchTerm]);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    status: 'Active' as Client['status'],
    origin: '',
    email: '',
    phone: '',
    segment: '',
    image: '',
    salesExecutiveId: '',
    // Barbershop fields
    birthday: '',
    gender: '' as string,
    cpfCnpj: '',
    preferredBarberId: '',
  });

  // Subscription form state
  const [subFormData, setSubFormData] = useState({
    planId: '',
    status: 'active' as Subscription['status'],
    paymentMethod: '' as string,
    cardBrand: '',
    cardLast4: '',
    billingEmail: '',
    paymentDay: 5,
    autoRenew: true,
    startDate: new Date().toISOString().split('T')[0],
  });

  // Derived Contract Data for display in Modal
  const activeContracts = useMemo(() => {
    if (!editingId) return [];
    return contracts.filter(c => c.clientId === editingId && c.status === 'Active');
  }, [editingId, contracts]);

  const contractSummary = useMemo(() => {
    if (activeContracts.length === 0) return { monthly: 0, setup: 0, months: 0, ltv: 0 };
    let monthly = 0, setup = 0, totalLTV = 0, maxDuration = 0;
    activeContracts.forEach(c => {
      monthly += c.monthlyValue;
      setup += c.setupValue;
      maxDuration = Math.max(maxDuration, c.contractDuration);
      totalLTV += (c.monthlyValue * c.contractDuration) + c.setupValue;
    });
    return { monthly, setup, months: maxDuration, ltv: totalLTV };
  }, [activeContracts]);

  // Client's subscription
  const clientSubscription = useMemo(() => {
    if (!editingId) return null;
    return subscriptions.find(s => s.clientId === editingId) || null;
  }, [editingId, subscriptions]);

  // Filter Logic
  const filteredClients = useMemo(() => {
    let data = clients;
    if (!viewAll) {
      data = data.filter(client => client.salesExecutiveId === currentUser.id);
    }
    // Text search
    const query = searchQuery.toLowerCase();
    if (query) {
      data = data.filter(client =>
        (client.name || '').toLowerCase().includes(query) ||
        (client.company || '').toLowerCase().includes(query) ||
        (client.email || '').toLowerCase().includes(query) ||
        (client.phone || '').includes(query) ||
        (client.cpfCnpj || '').includes(query)
      );
    }
    // Smart filters
    const now = Date.now();
    const DAY = 86400000;
    if (activeFilter === 'active') data = data.filter(c => c.status === 'Active');
    else if (activeFilter === 'subscribers') data = data.filter(c => subscriptions.some(s => s.clientId === c.id && s.status === 'active'));
    else if (activeFilter === 'noPlan') data = data.filter(c => !subscriptions.some(s => s.clientId === c.id && (s.status === 'active' || s.status === 'pending_payment')));
    else if (activeFilter === 'birthday') {
      const month = new Date().getMonth();
      data = data.filter(c => {
        if (!c.birthday) return false;
        const bMonth = new Date(c.birthday + 'T00:00:00').getMonth();
        return bMonth === new Date().getMonth();
      });
    }
    else if (activeFilter === 'inactive') data = data.filter(c => { const d = c.lastVisit ? (now - new Date(c.lastVisit).getTime()) / DAY : 999; return d > 90; });
    else if (activeFilter === 'noVisit') data = data.filter(c => !c.totalVisits || c.totalVisits === 0);
    // Sorting
    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'visits_desc': return (b.totalVisits || 0) - (a.totalVisits || 0);
        case 'lastVisit_desc': return new Date(b.lastVisit || 0).getTime() - new Date(a.lastVisit || 0).getTime();
        case 'lastVisit_asc': return new Date(a.lastVisit || 0).getTime() - new Date(b.lastVisit || 0).getTime();
        case 'ltv_desc': {
          const ltvA = contracts.filter(c => c.clientId === a.id && c.status === 'Active').reduce((acc, c) => acc + c.monthlyValue * c.contractDuration + c.setupValue, 0);
          const ltvB = contracts.filter(c => c.clientId === b.id && c.status === 'Active').reduce((acc, c) => acc + c.monthlyValue * c.contractDuration + c.setupValue, 0);
          return ltvB - ltvA;
        }
        default: return 0;
      }
    });
    return data;
  }, [clients, searchQuery, viewAll, currentUser.id, activeFilter, sortBy, subscriptions, contracts]);

  // Reset pagination on search/filter/sort change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, activeFilter, sortBy]);

  // Visible (paginated) clients
  const visibleClients = useMemo(() => filteredClients.slice(0, visibleCount), [filteredClients, visibleCount]);

  // ═══ CSV Export Helper ═══
  const handleExportCSV = useCallback(() => {
    const headers = ['Nome', 'Telefone', 'Email', 'CPF/CNPJ', 'Status', 'Gênero', 'Plano', 'Última Visita', 'Total Visitas', 'Engajamento'];
    const rows = filteredClients.map(c => {
      const sub = subscriptions.find(s => s.clientId === c.id && s.status === 'active');
      const plan = sub ? subscriptionPlans.find(p => p.id === sub.planId) : null;
      const eng = getEngagement(c);
      return [
        c.name || '', c.phone || '', c.email || '', c.cpfCnpj || '',
        c.status || '', c.gender || '', plan?.name || 'Sem plano',
        c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('pt-BR') : 'Nunca',
        String(c.totalVisits || 0), ENGAGEMENT_CONFIG[eng].label,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exportado', `${rows.length} clientes exportados para CSV.`);
  }, [filteredClients, subscriptions, subscriptionPlans, getEngagement, toast]);

  // Form validation - required fields
  const isFormValid = useMemo(() => {
    return formData.name.trim() !== '' && formData.phone.trim() !== '';
  }, [formData.name, formData.phone]);

  // KPI calculations
  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const currentMonth = now.getMonth();

    const activeClients = clients.filter(c => c.status === 'Active').length;
    const newClients30d = clients.filter(c => {
      // Approximate: no createdAt on Client type, so use all
      return c.status === 'Active' || c.status === 'Lead';
    }).length;

    const activeSubs = unitSubscriptions.filter(s => s.status === 'active');
    const mrr = activeSubs.reduce((acc, s) => {
      const plan = subscriptionPlans.find(p => p.id === s.planId);
      return acc + (plan?.price || 0);
    }, 0);

    const birthdaysThisMonth = clients.filter(c => {
      if (!c.birthday) return false;
      const bMonth = new Date(c.birthday + 'T00:00:00').getMonth();
      return bMonth === currentMonth;
    }).length;

    return { total: clients.length, activeClients, activeSubs: activeSubs.length, mrr, birthdaysThisMonth };
  }, [clients, unitSubscriptions, subscriptionPlans]);

  // Helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingId(client.id);
      setFormData({
        name: client.name,
        company: client.company,
        status: client.status,
        origin: client.origin || '',
        email: client.email,
        phone: client.phone,
        segment: client.segment || '',
        image: client.image || '',
        salesExecutiveId: client.salesExecutiveId?.toString() || '',
        birthday: client.birthday || '',
        gender: client.gender || '',
        cpfCnpj: client.cpfCnpj || '',
        preferredBarberId: client.preferredBarberId || '',
      });
      // Load subscription data
      const sub = subscriptions.find(s => s.clientId === client.id);
      if (sub) {
        setSubSectionOpen(true);
        setSubFormData({
          planId: sub.planId,
          status: sub.status,
          paymentMethod: sub.paymentMethod || '',
          cardBrand: sub.cardBrand || '',
          cardLast4: sub.cardLast4 || '',
          billingEmail: sub.billingEmail || '',
          paymentDay: sub.paymentDay || 5,
          autoRenew: sub.autoRenew ?? true,
          startDate: sub.startDate ? sub.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        });
      } else {
        setSubSectionOpen(false);
        setSubFormData({ planId: '', status: 'active', paymentMethod: '', cardBrand: '', cardLast4: '', billingEmail: '', paymentDay: 5, autoRenew: true, startDate: new Date().toISOString().split('T')[0] });
      }
    } else {
      setEditingId(null);
      setFormData({ name: '', company: '', status: 'Active', origin: '', email: '', phone: '', segment: '', image: '', salesExecutiveId: '', birthday: '', gender: '', cpfCnpj: '', preferredBarberId: '' });
      setSubSectionOpen(false);
      setSubFormData({ planId: '', status: 'active', paymentMethod: '', cardBrand: '', cardLast4: '', billingEmail: '', paymentDay: 5, autoRenew: true, startDate: new Date().toISOString().split('T')[0] });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let imageUrl = formData.image;
    if (formData.image && isBase64(formData.image)) {
      const uploadedUrl = await uploadBase64Image(formData.image, 'clients', `${Date.now()}_${formData.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
      if (uploadedUrl) imageUrl = uploadedUrl;
      else imageUrl = '';
    }

    const existing = editingId ? clients.find(c => c.id === editingId) : null;
    const clientData: Client = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      company: formData.company,
      status: formData.status,
      monthlyValue: existing?.monthlyValue || 0,
      setupValue: existing?.setupValue || 0,
      monthsActive: existing?.monthsActive || 0,
      totalValue: existing?.totalValue || 0,
      revenue: existing?.revenue || 0,
      origin: formData.origin,
      email: formData.email,
      phone: formData.phone,
      segment: formData.segment,
      lastContact: new Date().toISOString(),
      image: imageUrl,
      salesExecutiveId: formData.salesExecutiveId || undefined,
      birthday: formData.birthday || undefined,
      gender: (formData.gender as Client['gender']) || undefined,
      cpfCnpj: formData.cpfCnpj || undefined,
      preferredBarberId: formData.preferredBarberId || undefined,
      lastVisit: existing?.lastVisit,
      totalVisits: existing?.totalVisits || 0,
      unitId: existing?.unitId || (selectedUnitId !== 'all' ? selectedUnitId : undefined),
    };

    const result = await saveClient(clientData);
    if (!result.success) { toast.error('Erro ao salvar', result.error || 'Erro desconhecido'); return; }

    // Save subscription if section is open and planId is selected
    if (subSectionOpen && subFormData.planId) {
      // CPF validation for subscriptions
      if (!formData.cpfCnpj?.trim()) {
        toast.error('CPF obrigatório', 'Para ativar um plano de assinatura, o CPF/CNPJ é obrigatório.');
        return;
      }
      // Errata E3: Unit validation
      if (!selectedUnitId || selectedUnitId === 'all') {
        toast.error('Selecione uma unidade', 'É necessário selecionar uma unidade específica para criar uma assinatura.');
        return;
      }
      const existingSub = subscriptions.find(s => s.clientId === clientData.id);
      const subData: Subscription = {
        id: existingSub?.id || crypto.randomUUID(),
        planId: subFormData.planId,
        clientId: clientData.id,
        clientName: clientData.name,
        status: subFormData.status,
        startDate: subFormData.startDate,
        usesThisMonth: existingSub?.usesThisMonth || 0,
        paymentDay: subFormData.paymentDay,
        paymentMethod: (subFormData.paymentMethod as Subscription['paymentMethod']) || undefined,
        cardBrand: subFormData.cardBrand || undefined,
        cardLast4: subFormData.cardLast4 || undefined,
        billingEmail: subFormData.billingEmail || undefined,
        autoRenew: subFormData.autoRenew,
        unitId: selectedUnitId !== 'all' ? selectedUnitId : clientData.unitId,
      };
      await saveSubscription(subData);
      // F15: Warn that manual sub from Clients page doesn't trigger ASAAS billing
      if (!existingSub) {
        toast.info('Assinatura manual',
          'Esta assinatura foi criada localmente sem cobrança automática. Para cobranças via cartão/pix/boleto, use a tela de Assinaturas com integração ASAAS.');
      }
    }

    if (editingId) {
      setClients(clients.map(c => c.id === editingId ? clientData : c));
      toast.success('Cliente atualizado');
    } else {
      setClients([clientData, ...clients]);
      toast.success('Cliente adicionado');
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Cliente',
      message: 'Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      // Persistir no Supabase
      const result = await deleteClient(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      setClients(clients.filter(c => c.id !== id));
      toast.success('Cliente excluído');
    }
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  // Image Upload Handlers
  const handleTriggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative">

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center shrink-0 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>{editingId ? 'Editar Cliente' : 'Adicionar Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} id="client-form" className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col lg:flex-row">
                {/* LEFT COLUMN - 60% */}
                <div className="flex-1 lg:w-[60%] p-6 space-y-4">
                  {/* Image */}
                  <div className={`flex items-center gap-4 p-4 border rounded-lg ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-16 h-16 rounded-full border flex items-center justify-center overflow-hidden shrink-0 ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-200'}`}>
                      {formData.image ? <img src={formData.image} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-slate-500" />}
                    </div>
                    <div className="flex-1">
                      <label className={`block text-sm font-bold ${textMain} mb-1`}>Foto de Perfil</label>
                      <div className="flex gap-2">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={handleTriggerFileUpload} className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"><Upload size={12} /> Carregar</button>
                        {formData.image && <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"><Trash2 size={12} /> Remover</button>}
                      </div>
                    </div>
                  </div>

                  {/* Name / CPF */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Nome *</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="Ex: Joao Silva" required />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Shield size={12} /> CPF / CNPJ</label>
                      <input type="text" value={formData.cpfCnpj} onChange={e => setFormData({ ...formData, cpfCnpj: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="000.000.000-00" />
                    </div>
                  </div>

                  {/* Email / Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Mail size={12} /> Email</label>
                      <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="email@exemplo.com" />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Phone size={12} /> WhatsApp / Telefone *</label>
                      <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="(11) 99999-9999" required />
                    </div>
                  </div>

                  {/* Birthday / Gender */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Gift size={12} /> Data de Nascimento</label>
                      <input type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Genero</label>
                      <CustomDropdown
                        value={formData.gender}
                        onChange={v => setFormData({ ...formData, gender: v })}
                        options={[
                          { value: '', label: 'Selecione...' },
                          { value: 'M', label: 'Masculino' },
                          { value: 'F', label: 'Feminino' },
                          { value: 'O', label: 'Outro' },
                        ]}
                        isDarkMode={isDarkMode}
                        placeholder="Selecione..."
                      />
                    </div>
                  </div>

                  {/* Preferred Barber / Company */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Profissional Preferido</label>
                      <CustomDropdown
                        value={formData.preferredBarberId}
                        onChange={v => setFormData({ ...formData, preferredBarberId: v })}
                        options={[
                          { value: '', label: 'Nenhum' },
                          ...members.filter(m => m.role === 'Barber' || m.role === 'Admin').map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
                        ]}
                        isDarkMode={isDarkMode}
                        placeholder="Nenhum"
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Briefcase size={12} /> Empresa</label>
                      <input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="Ex: Empresa Ltda" />
                    </div>
                  </div>

                  {/* Status / Sales Exec */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1`}>Status</label>
                      <CustomDropdown
                        value={formData.status}
                        onChange={v => setFormData({ ...formData, status: v as Client['status'] })}
                        options={[
                          { value: 'Active', label: 'Ativo', dot: 'bg-emerald-500' },
                          { value: 'Lead', label: 'Lead (Potencial)', dot: 'bg-blue-500' },
                          { value: 'Inactive', label: 'Inativo', dot: 'bg-slate-400' },
                          { value: 'Churned', label: 'Cancelado (Churn)', dot: 'bg-red-500' },
                        ]}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Executivo de Vendas</label>
                      <CustomDropdown
                        value={formData.salesExecutiveId}
                        onChange={v => setFormData({ ...formData, salesExecutiveId: v })}
                        options={[
                          { value: '', label: 'Selecione...' },
                          ...members.map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
                        ]}
                        isDarkMode={isDarkMode}
                        placeholder="Selecione..."
                      />
                    </div>
                  </div>

                  {/* Origin / Segment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Target size={12} /> Origem</label>
                      <input type="text" value={formData.origin} onChange={e => setFormData({ ...formData, origin: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="Ex: Google Ads" />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Tag size={12} /> Segmento</label>
                      <input type="text" value={formData.segment} onChange={e => setFormData({ ...formData, segment: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="Ex: Varejo, Saude..." />
                    </div>
                  </div>

                  {/* SUBSCRIPTION SECTION - Collapsible */}
                  <div className={`rounded-xl border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                    <button type="button" onClick={() => setSubSectionOpen(!subSectionOpen)} className={`w-full flex items-center justify-between p-4 ${isDarkMode ? 'hover:bg-dark/50' : 'hover:bg-slate-50'} rounded-xl transition-colors`}>
                      <span className="text-sm font-bold text-primary flex items-center gap-2"><CreditCard size={16} /> Assinatura / Plano</span>
                      {subSectionOpen ? <ChevronUp size={16} className={textSub} /> : <ChevronDown size={16} className={textSub} />}
                    </button>
                    {subSectionOpen && (
                      <div className={`px-4 pb-4 space-y-3 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                        <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Plano</label>
                            <CustomDropdown
                              value={subFormData.planId}
                              onChange={v => setSubFormData({ ...subFormData, planId: v })}
                              options={[
                                { value: '', label: 'Selecione um plano...' },
                                ...subscriptionPlans.filter(p => p.active).map(p => ({ value: p.id, label: `${p.name} - ${formatCurrency(p.price)}` }))
                              ]}
                              isDarkMode={isDarkMode}
                              placeholder="Selecione um plano..."
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Status</label>
                            <CustomDropdown
                              value={subFormData.status}
                              onChange={v => setSubFormData({ ...subFormData, status: v as Subscription['status'] })}
                              options={[
                                { value: 'active', label: 'Ativo', dot: 'bg-emerald-500' },
                                { value: 'paused', label: 'Pausado', dot: 'bg-amber-500' },
                                { value: 'cancelled', label: 'Cancelado', dot: 'bg-red-500' },
                                { value: 'overdue', label: 'Inadimplente', dot: 'bg-red-400' },
                              ]}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Forma de Pagamento</label>
                            <CustomDropdown
                              value={subFormData.paymentMethod}
                              onChange={v => setSubFormData({ ...subFormData, paymentMethod: v })}
                              options={[
                                { value: '', label: 'Selecione...' },
                                { value: 'credit', label: 'Cartao de Credito' },
                                { value: 'boleto', label: 'Boleto' },
                                { value: 'pix', label: 'PIX' },
                              ]}
                              isDarkMode={isDarkMode}
                              placeholder="Selecione..."
                            />
                          </div>
                          {subFormData.paymentMethod === 'credit' && (
                            <>
                              <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Bandeira</label>
                                <CustomDropdown
                                  value={subFormData.cardBrand}
                                  onChange={v => setSubFormData({ ...subFormData, cardBrand: v })}
                                  options={[
                                    { value: '', label: 'Selecione...' },
                                    { value: 'visa', label: 'Visa' },
                                    { value: 'mastercard', label: 'Mastercard' },
                                    { value: 'elo', label: 'Elo' },
                                    { value: 'amex', label: 'Amex' },
                                  ]}
                                  isDarkMode={isDarkMode}
                                  placeholder="Selecione..."
                                />
                              </div>
                              <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Ultimos 4 digitos</label>
                                <input type="text" maxLength={4} value={subFormData.cardLast4} onChange={e => setSubFormData({ ...subFormData, cardLast4: e.target.value.replace(/\D/g, '') })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="0000" />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Email de Cobranca</label>
                            <input type="email" value={subFormData.billingEmail} onChange={e => setSubFormData({ ...subFormData, billingEmail: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} placeholder="cobranca@email.com" />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Dia de Pagamento</label>
                            <input type="number" min={1} max={28} value={subFormData.paymentDay} onChange={e => setSubFormData({ ...subFormData, paymentDay: Number(e.target.value) })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1`}>Inicio</label>
                            <input type="date" value={subFormData.startDate} onChange={e => setSubFormData({ ...subFormData, startDate: e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input type="checkbox" checked={subFormData.autoRenew} onChange={e => setSubFormData({ ...subFormData, autoRenew: e.target.checked })} className="w-4 h-4 rounded border-slate-400 text-primary focus:ring-primary" />
                          <span className={`text-sm ${textMain}`}>Renovacao automatica</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN - 40% */}
                <div className={`lg:w-[40%] p-6 space-y-4 border-l ${isDarkMode ? 'border-dark-border bg-dark/30' : 'border-slate-200 bg-slate-50/50'}`}>
                  {/* Metrics (edit only) */}
                  {editingId && (() => {
                    const c = clients.find(cl => cl.id === editingId);
                    const sub = subscriptions.find(s => s.clientId === editingId);
                    const plan = sub ? subscriptionPlans.find(p => p.id === sub.planId) : null;
                    return (
                      <div className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-white border-slate-200'}`}>
                        <h4 className="text-sm font-bold text-primary flex items-center gap-2"><BarChart3 size={14} /> Resumo do Cliente</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm"><span className={textSub}>Total Visitas</span><span className={`font-semibold ${textMain}`}>{c?.totalVisits || 0}</span></div>
                          <div className="flex justify-between text-sm"><span className={textSub}>Ultima Visita</span><span className={`font-semibold ${textMain}`}>{c?.lastVisit ? new Date(c.lastVisit).toLocaleDateString('pt-BR') : 'Nunca'}</span></div>
                          {sub && plan && (
                            <>
                              <div className={`my-2 border-t ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`} />
                              <div className="flex justify-between text-sm"><span className={textSub}>Plano</span><span className="font-semibold text-primary">{plan.name}</span></div>
                              <div className="flex justify-between text-sm"><span className={textSub}>Valor</span><span className={`font-semibold ${textMain}`}>{formatCurrency(plan.price)}/mes</span></div>
                              <div className="flex justify-between text-sm"><span className={textSub}>Status</span><span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${sub.status === 'active' ? 'bg-primary/10 text-primary' : sub.status === 'pending_payment' ? 'bg-blue-500/10 text-blue-500' : sub.status === 'overdue' ? 'bg-red-500/10 text-red-500' : sub.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-slate-500/10 text-slate-500'}`}>{sub.status === 'active' ? 'Ativo' : sub.status === 'pending_payment' ? 'Aguardando Pgto' : sub.status === 'overdue' ? 'Inadimplente' : sub.status === 'paused' ? 'Pausado' : 'Cancelado'}</span></div>
                              {sub.cardBrand && <div className="flex justify-between text-sm"><span className={textSub}>Cartao</span><span className={`font-semibold ${textMain}`}>{sub.cardBrand.toUpperCase()} *{sub.cardLast4}</span></div>}
                              <div className="flex justify-between text-sm"><span className={textSub}>Usos no mes</span><span className={`font-semibold ${textMain}`}>{Number(sub.usesThisMonth) % 1 === 0 ? sub.usesThisMonth : Number(sub.usesThisMonth).toFixed(1)}{plan.maxUsesPerMonth ? `/${plan.maxUsesPerMonth}` : ''}</span></div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Contract Data - Read Only */}
                  <div className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-2"><DollarSign size={14} /> Contrato</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${isDarkMode ? 'bg-dark text-slate-400 border-dark-border' : 'bg-white text-slate-500 border-slate-200'}`}><Lock size={8} /> Leitura</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className={`text-xs ${textSub} block`}>Mensal</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(editingId ? contractSummary.monthly : 0)}</span></div>
                      <div><span className={`text-xs ${textSub} block`}>Setup</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(editingId ? contractSummary.setup : 0)}</span></div>
                    </div>
                    <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                      <span className={`text-xs ${textSub} block`}>LTV Estimado</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(editingId ? contractSummary.ltv : 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer — outside form, always pinned */}
            <div className={`p-4 border-t ${borderCol} flex gap-3 justify-end shrink-0 bg-card`}>
              <button type="button" onClick={() => setIsModalOpen(false)} className={`px-6 py-2.5 rounded-lg text-sm font-medium border ${borderCol} ${textSub} hover:bg-muted/50 transition-colors`}>Cancelar</button>
              <button type="submit" form="client-form" disabled={!isFormValid} className={`px-6 py-2.5 font-bold rounded-lg text-sm transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>{editingId ? 'Salvar Alteracoes' : 'Cadastrar Cliente'}</button>
            </div>
          </div>
        </div>
      )}


      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Clientes', value: kpis.total, sub: `${kpis.activeClients} ativos`, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Assinantes Ativos', value: kpis.activeSubs, sub: 'com plano ativo', icon: Crown, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'MRR', value: formatCurrency(kpis.mrr), sub: 'receita recorrente', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Aniversariantes', value: kpis.birthdaysThisMonth, sub: 'neste mes', icon: Gift, color: 'text-pink-500', bg: 'bg-pink-500/10' },
        ].map((kpi, i) => (
          <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3 ${shadowClass}`}>
            <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon size={20} className={kpi.color} /></div>
            <div>
              <div className={`text-lg font-bold ${textMain}`}>{kpi.value}</div>
              <div className={`text-[10px] ${textSub} uppercase tracking-wide`}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-6 border-b ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
        {[
          { key: 'clients' as const, label: 'Clientes', icon: Users },
          { key: 'indicators' as const, label: 'Indicadores', icon: BarChart3 },
          { key: 'settings' as const, label: 'Configurações', icon: Settings },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key ? 'border-primary text-primary' : `border-transparent ${textSub} hover:text-primary`}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Clientes */}
      {activeTab === 'clients' && (<>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className={`text-2xl font-bold ${textMain}`}>Clientes</h1>
            <p className={`${textSub} text-sm`}>Gerencie seu relacionamento e veja o valor gerado.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Search */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={16} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar" className={`pl-9 pr-4 h-10 border ${borderCol} rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-40 md:w-52 text-sm ${bgCard} ${textMain} placeholder:text-muted-foreground`} />
            </div>
            {/* Sort */}
            <div className="relative">
              <button onClick={() => setShowSortDropdown(!showSortDropdown)} className={`h-10 px-3 border ${borderCol} rounded-lg text-sm flex items-center gap-2 transition-colors ${bgCard} ${textSub} hover:text-primary`}>
                <ArrowUpDown size={15} />
                <span className="hidden md:inline">Ordenar</span>
              </button>
              {showSortDropdown && (
                <div className={`absolute right-0 top-full mt-1 w-48 rounded-lg border ${borderCol} shadow-xl z-50 overflow-hidden ${bgCard}`}>
                  {([
                    { value: 'name' as ClientSort, label: 'Nome A→Z' },
                    { value: 'visits_desc' as ClientSort, label: 'Mais visitas' },
                    { value: 'lastVisit_desc' as ClientSort, label: 'Última visita (recente)' },
                    { value: 'lastVisit_asc' as ClientSort, label: 'Última visita (antigo)' },
                    { value: 'ltv_desc' as ClientSort, label: 'Maior LTV' },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors whitespace-nowrap ${sortBy === opt.value ? 'text-primary font-semibold bg-primary/5' : `${textSub} hover:bg-muted/50`}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Export CSV */}
            <button onClick={handleExportCSV} className={`h-10 px-3 border ${borderCol} rounded-lg text-sm flex items-center gap-2 transition-colors ${bgCard} ${textSub} hover:text-primary`} title="Exportar para CSV">
              <FileSpreadsheet size={16} />
              <span className="hidden md:inline">Exportar</span>
            </button>
            {/* Add */}
            <div className="relative">
              <div className="flex">
                <button onClick={() => handleOpenModal()} className="h-10 px-4 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg rounded-r-none text-sm transition-colors flex items-center gap-2">
                  <Plus size={18} /> Adicionar
                </button>
                <button
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                  className="h-10 px-2 bg-primary hover:bg-primary-600 text-white rounded-lg rounded-l-none border-l border-white/20 transition-colors"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              {showAddDropdown && (
                <div className={`absolute right-0 top-full mt-1 w-full min-w-max rounded-lg border ${borderCol} shadow-xl z-50 overflow-hidden ${bgCard}`}>
                  <button
                    onClick={() => { setShowAddDropdown(false); handleOpenModal(); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap ${textSub} hover:bg-muted/50 hover:text-primary`}
                  >
                    <Plus size={14} className="text-primary" /> Adicionar Cliente
                  </button>
                  {isFilteringUnit && (
                    <button
                      onClick={() => { setShowAddDropdown(false); setIsImportModalOpen(true); setImportSearch(''); setImportSelected(new Set()); }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors border-t ${borderCol} whitespace-nowrap ${textSub} hover:bg-muted/50 hover:text-primary`}
                    >
                      <Download size={14} className="text-blue-500" /> Importar Cliente
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Smart Filter Pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { key: 'all' as ClientFilter, label: 'Todos', icon: <Users size={13} />, count: clients.length },
            { key: 'active' as ClientFilter, label: 'Ativos', icon: <UserCheck size={13} />, count: clients.filter(c => c.status === 'Active').length },
            { key: 'subscribers' as ClientFilter, label: 'Assinantes', icon: <Crown size={13} />, count: subscriptions.filter(s => s.status === 'active').length },
            { key: 'noPlan' as ClientFilter, label: 'Sem plano', icon: <UserMinus size={13} /> },
            { key: 'birthday' as ClientFilter, label: 'Aniversariantes', icon: <Gift size={13} />, count: kpis.birthdaysThisMonth },
            { key: 'inactive' as ClientFilter, label: 'Inativos (+90d)', icon: <AlertCircle size={13} /> },
            { key: 'noVisit' as ClientFilter, label: 'Sem visita', icon: <Clock size={13} /> },
          ]).map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                activeFilter === f.key
                  ? 'bg-primary text-white border-primary'
                  : `${bgCard} ${textSub} ${borderCol} hover:border-primary/50 hover:text-primary`
              }`}>
              {f.icon} {f.label} {f.count !== undefined && <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeFilter === f.key ? 'bg-white/20' : 'bg-muted'}`}>{f.count}</span>}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className={`flex items-center justify-between mb-4 ${textSub} text-xs`}>
          <span>Mostrando <strong className={textMain}>{Math.min(visibleCount, filteredClients.length)}</strong> de <strong className={textMain}>{filteredClients.length}</strong> clientes</span>
          {activeFilter !== 'all' && (
            <button onClick={() => setActiveFilter('all')} className="text-primary hover:underline flex items-center gap-1">
              <X size={12} /> Limpar filtro
            </button>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleClients.map((client) => {
            const salesExec = members.find(m => m.id === client.salesExecutiveId);
            const clientSub = subscriptions.find(s => s.clientId === client.id && (s.status === 'active' || s.status === 'pending_payment'));
            const clientPlan = clientSub ? subscriptionPlans.find(p => p.id === clientSub.planId) : null;
            const clientContracts = contracts.filter(c => c.clientId === client.id && c.status === 'Active');
            const totalLTV = clientContracts.reduce((acc, curr) => acc + (curr.monthlyValue * curr.contractDuration) + curr.setupValue, 0);
            const preferredBarber = client.preferredBarberId ? members.find(m => m.id === client.preferredBarberId) : null;

            const isBirthdayWeek = (() => {
              if (!client.birthday) return false;
              const now = new Date();
              const bd = new Date(client.birthday + 'T00:00:00');
              bd.setFullYear(now.getFullYear());
              const diff = (bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
              return diff >= -1 && diff <= 7;
            })();

            const engagement = getEngagement(client);
            const engCfg = ENGAGEMENT_CONFIG[engagement];
            const hasActiveSub = !!clientSub;

            return (
              <div key={client.id} className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col h-full animate-in fade-in duration-300`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`relative ${hasActiveSub ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-card rounded-full' : ''}`}>
                      {client.image ? (
                        <img src={client.image} alt={client.name || 'Cliente'} className={`w-11 h-11 rounded-full object-cover border shadow-sm ${borderCol}`} />
                      ) : (
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-primary font-bold border shadow-sm text-base from-muted to-card ${borderCol}`}>
                          {(client.name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className={`font-bold ${textMain} text-sm leading-tight flex items-center gap-1.5`}>
                        {client.name || 'Sem nome'}
                        {isBirthdayWeek && <Gift size={13} className="text-pink-500" />}
                      </h3>
                      <p className={`text-[11px] ${textSub} flex items-center gap-1 mt-0.5`}>
                        {client.phone && <><Phone size={9} /> {client.phone}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleOpenModal(client)} className={`p-1.5 rounded-lg transition-colors ${textSub} hover:text-primary hover:bg-muted/50`}><Pencil size={14} /></button>
                    {canDeleteClient && <button onClick={() => handleDelete(client.id)} className={`p-1.5 rounded-lg transition-colors ${textSub} hover:text-red-500 hover:bg-muted/50`}><Trash2 size={14} /></button>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {/* Engagement badge */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${engCfg.bg} ${engCfg.color}`}>
                    {engCfg.icon} {engCfg.label}
                  </span>
                  {/* Status */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${client.status === 'Active' ? 'bg-primary/10 text-primary' : client.status === 'Lead' ? 'bg-blue-500/10 text-blue-500' : client.status === 'Churned' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                    {client.status === 'Active' ? 'Ativo' : client.status === 'Lead' ? 'Lead' : client.status === 'Churned' ? 'Churned' : 'Inativo'}
                  </span>
                  {(() => {
                    const unit = client.unitId ? units.find(u => u.id === client.unitId) : null;
                    return unit ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-primary/10 text-primary">
                        <MapPin size={8} /> {unit.tradeName || unit.name}
                      </span>
                    ) : null;
                  })()}
                  {clientPlan ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 flex items-center gap-1"><Crown size={9} /> {clientPlan.name}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Sem plano</span>
                  )}
                  {client.gender && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{client.gender === 'M' ? 'Masc' : client.gender === 'F' ? 'Fem' : 'Outro'}</span>}
                </div>

                <div className="space-y-2 flex-1 mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg border border-border bg-muted/30 text-center">
                      <span className={`text-[10px] ${textSub} block`}>Visitas</span>
                      <span className={`text-sm font-bold ${textMain}`}>{client.totalVisits || 0}</span>
                    </div>
                    <div className="p-2 rounded-lg border border-border bg-muted/30 text-center">
                      <span className={`text-[10px] ${textSub} block`}>LTV</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(totalLTV)}</span>
                    </div>
                  </div>
                  {preferredBarber && (
                    <div className={`flex items-center gap-1.5 text-[11px] ${textSub} px-1`}>
                      <User size={10} /> Preferido: <span className={textMain}>{(preferredBarber.name || '').split(' ')[0]}</span>
                    </div>
                  )}
                  {salesExec && (
                    <div className={`flex items-center gap-1.5 text-[11px] ${textSub} px-1`}>
                      <Briefcase size={10} /> Vendedor: <span className={textMain}>{(salesExec.name || '').split(' ')[0]}</span>
                    </div>
                  )}
                </div>

                <div className={`flex gap-2 pt-2 border-t ${borderCol}`}>
                  <button onClick={() => window.location.href = `mailto:${client.email}`} className={`flex-1 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border ${borderCol} bg-muted/30 hover:bg-muted/60 ${textSub}`}>
                    <Mail size={13} /> Email
                  </button>
                  <button onClick={() => handleWhatsApp(client.phone)} className="flex-1 py-2 bg-primary hover:bg-primary-600 rounded-lg text-xs text-white font-bold transition-colors flex items-center justify-center gap-1.5">
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button onClick={() => { window.location.hash = `/agenda?clientId=${client.id}`; }} className={`px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border ${borderCol} bg-muted/30 hover:bg-muted/60 ${textSub}`} title="Agendar">
                    <Calendar size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredClients.length === 0 && (
            <div className={`col-span-full py-16 text-center ${textSub}`}>
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold mb-1">Nenhum cliente encontrado</p>
              <p className="text-sm mb-4">{activeFilter !== 'all' ? 'Tente outro filtro ou limpe a busca.' : 'Adicione um novo cliente ou importe de outra unidade.'}</p>
              {activeFilter !== 'all' && (
                <button onClick={() => { setActiveFilter('all'); setSearchQuery(''); }} className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors inline-flex items-center gap-2">
                  <X size={16} /> Limpar filtros
                </button>
              )}
              {activeFilter === 'all' && isFilteringUnit && (
                <button
                  onClick={() => { setIsImportModalOpen(true); setImportSearch(''); setImportSelected(new Set()); }}
                  className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors inline-flex items-center gap-2"
                >
                  <Download size={16} /> Importar Clientes
                </button>
              )}
            </div>
          )}
        </div>

        {/* Load More */}
        {visibleCount < filteredClients.length && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
              className={`px-6 py-3 rounded-xl border ${borderCol} ${bgCard} ${textSub} hover:text-primary hover:border-primary/50 font-semibold text-sm transition-all flex items-center gap-2`}
            >
              <ChevronDown size={18} /> Carregar mais ({filteredClients.length - visibleCount} restantes)
            </button>
          </div>
        )}

        {/* Import Client Modal */}
        {isImportModalOpen && (() => {
          // Clients NOT in this unit
          const importableClients = allClients.filter(c => c.unitId !== selectedUnitId);
          const filtered = importableClients.filter(c =>
            (c.name || '').toLowerCase().includes(importSearch.toLowerCase()) ||
            (c.phone && c.phone.includes(importSearch)) ||
            (c.email && c.email.toLowerCase().includes(importSearch.toLowerCase()))
          );

          const handleImport = async () => {
            if (importSelected.size === 0) return;
            setImportLoading(true);
            try {
              const clientsToUpdate = allClients.filter(c => importSelected.has(c.id));
              let successCount = 0;
              for (const c of clientsToUpdate) {
                const result = await saveClient({ ...c, unitId: selectedUnitId });
                if (result.success) successCount++;
              }
              if (successCount > 0) {
                // Update local state
                setClients(allClients.map(c => importSelected.has(c.id) ? { ...c, unitId: selectedUnitId } : c));
                toast.success('Clientes importados', `${successCount} cliente(s) movido(s) para ${selectedUnit?.tradeName || selectedUnit?.name || 'esta unidade'}.`);
                setIsImportModalOpen(false);
              }
            } catch {
              toast.error('Erro', 'Falha ao importar clientes.');
            } finally {
              setImportLoading(false);
            }
          };

          const toggleSelect = (id: string) => {
            const next = new Set(importSelected);
            if (next.has(id)) next.delete(id); else next.add(id);
            setImportSelected(next);
          };

          const toggleAll = () => {
            if (importSelected.size === filtered.length) {
              setImportSelected(new Set());
            } else {
              setImportSelected(new Set(filtered.map(c => c.id)));
            }
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]`}>
                {/* Header */}
                <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                  <div>
                    <h3 className={`font-semibold text-lg ${textMain}`}>Importar Clientes</h3>
                    <p className={`text-xs ${textSub} mt-0.5`}>Mover clientes de outras unidades para <strong>{selectedUnit?.tradeName || selectedUnit?.name}</strong></p>
                  </div>
                  <button onClick={() => setIsImportModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                    <X size={20} />
                  </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b" style={{ borderColor: isDarkMode ? 'rgb(55,65,81)' : 'rgb(226,232,240)' }}>
                  <div className="relative">
                    <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                    <input
                      type="text"
                      value={importSearch}
                      onChange={e => setImportSearch(e.target.value)}
                      placeholder="Buscar por nome, telefone ou email..."
                      className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-primary ${isDarkMode ? 'bg-dark border-dark-border text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                    />
                  </div>
                </div>

                {/* Select all */}
                {filtered.length > 0 && (
                  <div className={`px-4 py-2 flex items-center justify-between border-b text-xs ${isDarkMode ? 'border-dark-border' : 'border-slate-100'}`}>
                    <button onClick={toggleAll} className={`font-medium ${textSub} hover:text-primary transition-colors`}>
                      {importSelected.size === filtered.length ? 'Desmarcar todos' : `Selecionar todos (${filtered.length})`}
                    </button>
                    {importSelected.size > 0 && (
                      <span className="text-primary font-semibold">{importSelected.size} selecionado(s)</span>
                    )}
                  </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                  {filtered.length === 0 ? (
                    <div className={`text-center py-10 ${textSub}`}>
                      <Users size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum cliente disponivel para importar.</p>
                    </div>
                  ) : filtered.map(c => {
                    const isSelected = importSelected.has(c.id);
                    const fromUnit = c.unitId ? units.find(u => u.id === c.unitId) : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleSelect(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-left transition-colors ${isSelected
                          ? isDarkMode ? 'bg-primary/10 border border-primary/30' : 'bg-primary/5 border border-primary/20'
                          : isDarkMode ? 'hover:bg-dark border border-transparent' : 'hover:bg-slate-50 border border-transparent'
                          }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : isDarkMode ? 'border-slate-600' : 'border-slate-300'
                          }`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-dark border border-dark-border' : 'bg-slate-100 border border-slate-200'}`}>
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className={`text-sm font-bold ${textSub}`}>{(c.name || '?').charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${textMain} truncate`}>{c.name}</p>
                          <div className="flex items-center gap-2">
                            {c.phone && <span className={`text-[10px] ${textSub}`}>{c.phone}</span>}
                            {fromUnit && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-dark text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                {fromUnit.name}
                              </span>
                            )}
                            {!fromUnit && !c.unitId && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-dark text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                Sem unidade
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${borderCol} flex justify-end gap-3 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isDarkMode ? 'border-dark-border text-slate-400 hover:text-white' : 'border-slate-300 text-slate-600 hover:text-slate-800'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importSelected.size === 0 || importLoading}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2 ${importSelected.size === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-600'
                      }`}
                  >
                    {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Importar {importSelected.size > 0 ? `(${importSelected.size})` : ''}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </>)}

      {/* TAB: Indicadores */}
      {activeTab === 'indicators' && (() => {
        const activeSubs = unitSubscriptions.filter(s => s.status === 'active');
        const pendingSubs = unitSubscriptions.filter(s => s.status === 'pending_payment');
        const pausedSubs = unitSubscriptions.filter(s => s.status === 'paused');
        const cancelledSubs = unitSubscriptions.filter(s => s.status === 'cancelled');
        const overdueSubs = unitSubscriptions.filter(s => s.status === 'overdue');
        const subscriberIds = new Set(activeSubs.map(s => s.clientId));
        const subscriberClients = clients.filter(c => subscriberIds.has(c.id));
        const nonSubscriberClients = clients.filter(c => !subscriberIds.has(c.id));
        const totalSubs = unitSubscriptions.length;
        const churnRate = totalSubs > 0 ? ((cancelledSubs.length / totalSubs) * 100).toFixed(1) : '0';
        const returnRate = clients.length > 0 ? ((clients.filter(c => (c.totalVisits || 0) > 1).length / clients.length) * 100).toFixed(1) : '0';
        const genderM = clients.filter(c => c.gender === 'M').length;
        const genderF = clients.filter(c => c.gender === 'F').length;
        const genderO = clients.filter(c => c.gender === 'O').length;
        const genderNone = clients.filter(c => !c.gender).length;
        const avgVisitsSub = subscriberClients.length > 0 ? (subscriberClients.reduce((a, c) => a + (c.totalVisits || 0), 0) / subscriberClients.length).toFixed(1) : '0';
        const avgVisitsNonSub = nonSubscriberClients.length > 0 ? (nonSubscriberClients.reduce((a, c) => a + (c.totalVisits || 0), 0) / nonSubscriberClients.length).toFixed(1) : '0';
        const subPct = clients.length > 0 ? Math.round((subscriberClients.length / clients.length) * 100) : 0;

        const planDist = subscriptionPlans.map(p => ({
          name: p.name, count: activeSubs.filter(s => s.planId === p.id).length, price: p.price,
        })).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

        const topClients = [...clients].map(c => {
          const cContracts = contracts.filter(ct => ct.clientId === c.id && ct.status === 'Active');
          const ltv = cContracts.reduce((acc, curr) => acc + (curr.monthlyValue * curr.contractDuration) + curr.setupValue, 0);
          return { ...c, ltv };
        }).sort((a, b) => b.ltv - a.ltv).slice(0, 10);
        const maxLTV = topClients.length > 0 ? topClients[0].ltv : 1;

        const birthdaysWeek = clients.filter(c => {
          if (!c.birthday) return false;
          const now = new Date(); const bd = new Date(c.birthday + 'T00:00:00'); bd.setFullYear(now.getFullYear());
          const diff = (bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diff >= -1 && diff <= 7;
        });

        const originDist: Record<string, number> = {};
        clients.forEach(c => { const o = c.origin || 'Não informada'; originDist[o] = (originDist[o] || 0) + 1; });
        const origins = Object.entries(originDist).sort((a, b) => b[1] - a[1]);
        const maxOrigin = origins[0]?.[1] || 1;

        const maxGender = Math.max(genderM, genderF, genderO, genderNone, 1);
        const maxSubStatus = Math.max(activeSubs.length, pendingSubs.length, pausedSubs.length, cancelledSubs.length, overdueSubs.length, 1);

        // ===== Client Status Classification (based on last closed comanda) =====
        const now = new Date();
        const DAY_MS = 86400000;
        const classifyClient = (c: Client) => {
          // Prefer lastVisit from client, fallback to last closed comanda
          let lastDate: Date | null = null;
          if (c.lastVisit) {
            lastDate = new Date(c.lastVisit);
          } else {
            const clientComandas = comandas
              .filter(cm => cm.clientId === c.id && cm.status === 'closed' && cm.closedAt)
              .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
            if (clientComandas.length > 0) lastDate = new Date(clientComandas[0].closedAt!);
          }
          if (!lastDate) return 'inactive' as const;
          const diffDays = (now.getTime() - lastDate.getTime()) / DAY_MS;
          if (diffDays <= 30) return 'active' as const;
          if (diffDays <= 90) return 'semi' as const;
          return 'inactive' as const;
        };
        const clientStatuses = clients.map(c => ({ client: c, status: classifyClient(c) }));
        const activeClients = clientStatuses.filter(c => c.status === 'active').length;
        const semiActiveClients = clientStatuses.filter(c => c.status === 'semi').length;
        const inactiveClients = clientStatuses.filter(c => c.status === 'inactive').length;

        return (
          <div className="space-y-6">

            {/* Status Info Modal */}
            {statusInfoOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setStatusInfoOpen(false)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><HelpCircle size={20} className="text-primary" /> Classificação de Status</h3>
                    <button onClick={() => setStatusInfoOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark transition-colors"><X size={18} /></button>
                  </div>
                  <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="flex gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 shrink-0 h-fit"><UserCheck size={20} /></div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">Cliente Ativo</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Realizou pelo menos <strong>uma visita nos últimos 30 dias</strong>. Indica base saudável, recorrência e fidelização. Impacta diretamente o faturamento e a ocupação.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500 shrink-0 h-fit"><Clock size={20} /></div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">Cliente Semi-ativo</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Última visita entre <strong>30 e 90 dias atrás</strong>. Zona de atenção — forte indicativo de risco de churn. Ideal para ações de reativação (mensagens, ofertas, lembretes).</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 shrink-0 h-fit"><UserMinus size={20} /></div>
                      <div>
                        <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Cliente Inativo</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Há <strong>mais de 90 dias sem visitar</strong> o estabelecimento. Não contribui para receita atual. Importante para campanhas de recuperação e base histórica.</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-dark border border-slate-100 dark:border-dark-border">
                      <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Regra de Última Visita</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Considera a data da <strong>última comanda fechada</strong>. Clientes sem comandas fechadas são considerados inativos independentemente do cadastro.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Client Status Cards — 4 cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Clientes</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{clients.length}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">cadastrados no sistema</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary/10 text-primary"><Users size={24} /></div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ativos</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{activeClients}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">visita nos últimos 30 dias</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500"><UserCheck size={24} /></div>
                    <button onClick={() => setStatusInfoOpen(true)} className="text-slate-400 hover:text-primary transition-colors" title="O que é cliente ativo?"><HelpCircle size={14} /></button>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Semi-ativos</p>
                    <h3 className={`text-2xl font-bold mt-2 ${semiActiveClients > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>{semiActiveClients}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{semiActiveClients > 0 ? 'em zona de atenção' : 'nenhum em risco'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`p-3 rounded-lg ${semiActiveClients > 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' : 'bg-slate-50 dark:bg-slate-500/10 text-slate-400'}`}><Clock size={24} /></div>
                    <button onClick={() => setStatusInfoOpen(true)} className="text-slate-400 hover:text-primary transition-colors" title="O que é semi-ativo?"><HelpCircle size={14} /></button>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inativos</p>
                    <h3 className={`text-2xl font-bold mt-2 ${inactiveClients > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{inactiveClients}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{inactiveClients > 0 ? `+90 dias sem visita` : 'todos ativos'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`p-3 rounded-lg ${inactiveClients > 0 ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-slate-50 dark:bg-slate-500/10 text-slate-400'}`}><UserMinus size={24} /></div>
                    <button onClick={() => setStatusInfoOpen(true)} className="text-slate-400 hover:text-primary transition-colors" title="O que é inativo?"><HelpCircle size={14} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription KPIs — 4 cards following StatCard style */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Assinantes Ativos</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{activeSubs.length}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subPct}% da base</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500"><Crown size={24} /></div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Churn Rate</p>
                    <h3 className={`text-2xl font-bold mt-2 ${Number(churnRate) > 10 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{churnRate}%</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{cancelledSubs.length} cancelamentos</p>
                  </div>
                  <div className={`p-3 rounded-lg ${Number(churnRate) > 10 ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}><TrendingUp size={24} /></div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Taxa de Retorno</p>
                    <h3 className="text-2xl font-bold text-primary mt-2">{returnRate}%</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">clientes com +1 visita</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary/10 text-primary"><Users size={24} /></div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inadimplentes</p>
                    <h3 className={`text-2xl font-bold mt-2 ${overdueSubs.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-white'}`}>{overdueSubs.length}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{overdueSubs.length > 0 ? 'requer atenção' : 'tudo em dia'}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${overdueSubs.length > 0 ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-500' : 'bg-slate-50 dark:bg-slate-500/10 text-slate-400'}`}><AlertCircle size={24} /></div>
                </div>
              </div>
            </div>

            {/* Detail Sections — 2/3 + 1/3 layout like Dashboard */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Left Column (2/3) */}
              <div className="xl:col-span-2 space-y-6">

                {/* Assinantes vs Avulsos — Performance-style */}
                <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-5">
                    <Crown size={20} className="text-amber-500" /> Assinantes vs Avulsos
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Donut */}
                    <div className="flex items-center gap-6">
                      <div className="relative w-28 h-28 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" className="stroke-slate-100 dark:stroke-dark" strokeWidth="3.5" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray={`${subPct * 0.88} ${88 - subPct * 0.88}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-slate-800 dark:text-white">{subPct}%</span>
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">assinantes</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{subscriberClients.length}</p>
                            <p className="text-[10px] text-slate-400">Assinantes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{nonSubscriberClients.length}</p>
                            <p className="text-[10px] text-slate-400">Avulsos</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Frequency Comparison */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Frequência Média</h3>
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium text-slate-800 dark:text-white">Assinantes</span>
                          <span className="text-sm font-bold text-amber-500">{avgVisitsSub} visitas</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(Number(avgVisitsSub) * 10, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium text-slate-800 dark:text-white">Avulsos</span>
                          <span className="text-sm font-bold text-slate-500">{avgVisitsNonSub} visitas</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(Number(avgVisitsNonSub) * 10, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Clients (LTV) — Performance bar style */}
                <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <Target size={20} className="text-primary" /> Top 10 Clientes (LTV)
                  </h2>
                  {topClients.length > 0 ? (
                    <div className="space-y-3">
                      {topClients.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-dark text-slate-400'}`}>{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.name}</span>
                              <span className="text-sm font-bold text-emerald-500 shrink-0 ml-3">{formatCurrency(c.ltv)}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(c.ltv / maxLTV) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Users size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum cliente com contratos ativos.</p>
                    </div>
                  )}
                </div>

                {/* Distribution Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Gênero */}
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Distribuição por Gênero</h2>
                    <div className="space-y-3">
                      {([
                        { label: 'Masculino', value: genderM, color: 'bg-blue-500', textColor: 'text-blue-500' },
                        { label: 'Feminino', value: genderF, color: 'bg-pink-500', textColor: 'text-pink-500' },
                        { label: 'Outro', value: genderO, color: 'bg-purple-500', textColor: 'text-purple-500' },
                        { label: 'Não informado', value: genderNone, color: 'bg-slate-300 dark:bg-slate-600', textColor: 'text-slate-400' },
                      ] as const).map(g => (
                        <div key={g.label}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{g.label}</span>
                            <span className={`text-sm font-bold ${g.textColor}`}>{g.value}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                            <div className={`h-full ${g.color} rounded-full transition-all duration-500`} style={{ width: `${(g.value / maxGender) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Origem */}
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Origem dos Clientes</h2>
                    {origins.length > 0 ? (
                      <div className="space-y-3">
                        {origins.slice(0, 6).map(([origin, count]) => (
                          <div key={origin}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{origin}</span>
                              <span className="text-sm font-bold text-primary shrink-0 ml-2">{count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(count / maxOrigin) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-sm">Nenhuma origem cadastrada</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (1/3) */}
              <div className="space-y-6">

                {/* Status das Assinaturas */}
                <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Status das Assinaturas</h2>
                  <div className="space-y-3">
                    {([
                      { label: 'Ativas', value: activeSubs.length, color: 'bg-emerald-500', icon: '●', textColor: 'text-emerald-500' },
                      { label: 'Aguardando Pgto', value: pendingSubs.length, color: 'bg-blue-500', icon: '●', textColor: 'text-blue-500' },
                      { label: 'Pausadas', value: pausedSubs.length, color: 'bg-yellow-500', icon: '●', textColor: 'text-yellow-500' },
                      { label: 'Canceladas', value: cancelledSubs.length, color: 'bg-red-500', icon: '●', textColor: 'text-red-500' },
                      { label: 'Inadimplentes', value: overdueSubs.length, color: 'bg-orange-500', icon: '●', textColor: 'text-orange-500' },
                    ] as const).map(s => (
                      <div key={s.label}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                          </div>
                          <span className={`text-sm font-bold ${s.textColor}`}>{s.value}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full transition-all duration-500`} style={{ width: `${(s.value / maxSubStatus) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Distribuição por Plano */}
                <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Distribuição por Plano</h2>
                  {planDist.length > 0 ? (
                    <div className="space-y-3">
                      {planDist.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{formatCurrency(p.price)}/mês</p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">{p.count} assinantes</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-sm">Nenhum plano com assinantes</div>
                  )}
                </div>

                {/* Aniversariantes — Premium style like Dashboard */}
                <div className="bg-primary dark:bg-primary-700 p-6 rounded-xl shadow-md text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Gift size={100} /></div>
                  <div className="relative z-10">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Gift size={20} /> Aniversariantes</h2>
                    <div className="space-y-3">
                      {birthdaysWeek.length > 0 ? birthdaysWeek.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                          <div className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center font-bold text-xs">{(c.name || '?').charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate">{c.name}</p>
                            <p className="text-[10px] opacity-80">{c.birthday ? new Date(c.birthday + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : ''}</p>
                          </div>
                        </div>
                      )) : <div className="text-sm opacity-90">Nenhum aniversariante esta semana</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: Configuracoes */}
      {activeTab === 'settings' && (() => {
        const handleSettingChange = <K extends keyof ClientUnitSettings>(key: K, value: ClientUnitSettings[K]) => {
          const updated = { ...unitSettings, [key]: value };
          setUnitSettings(updated);
          saveClientUnitSettings(updated);
        };

        const SettingToggle = ({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) => (
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex-1">
              <p className={`text-sm font-medium ${textMain}`}>{label}</p>
              <p className={`text-xs ${textSub} mt-0.5`}>{description}</p>
            </div>
            <button type="button" onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        );

        const SettingNumber = ({ label, description, value, onChange, min, max, suffix }: { label: string; description: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix: string }) => (
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className={`text-sm font-medium ${textMain}`}>{label}</p>
                <p className={`text-xs ${textSub} mt-0.5`}>{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={value}
                  onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
                  min={min}
                  max={max}
                  className={`w-20 ${bgInput} border ${borderCol} rounded-lg px-3 py-1.5 text-sm ${textMain} text-center focus:ring-1 focus:ring-primary outline-none`}
                />
                <span className={`text-xs ${textSub} min-w-[30px]`}>{suffix}</span>
              </div>
            </div>
          </div>
        );

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Info Banner */}
            <div className={`flex gap-3 p-4 rounded-xl border ${isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
              <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Reatribuição Inteligente de Clientes</p>
                <p className={`text-xs ${isDarkMode ? 'text-blue-500/80' : 'text-blue-600'} mt-1 leading-relaxed`}>
                  Cada cliente pertence a uma unidade principal. Se ele frequentar mais outra unidade dentro da janela configurada,
                  o sistema automaticamente transfere o cliente para essa unidade. Isso permite um controle preciso de qual
                  unidade cada cliente pertence, baseado em comportamento real.
                </p>
              </div>
            </div>

            {/* Settings Card */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden ${shadowClass}`}>
              <div className={`px-5 py-4 border-b ${borderCol} flex items-center gap-3 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                <RotateCcw size={18} className="text-primary" />
                <div>
                  <h3 className={`font-semibold ${textMain}`}>Regras de Reatribuição</h3>
                  <p className={`text-xs ${textSub}`}>Configure quando e como clientes devem ser reatribuídos entre unidades</p>
                </div>
              </div>

              <div className={`px-5 divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-100'}`}>
                <SettingToggle
                  label="Auto-reatribuição ativa"
                  description="Quando ativado, o sistema analisa periodicamente os agendamentos e reatribui clientes automaticamente"
                  value={unitSettings.autoReassignEnabled}
                  onChange={v => handleSettingChange('autoReassignEnabled', v)}
                />

                {unitSettings.autoReassignEnabled && (
                  <>
                    <SettingNumber
                      label="Janela de avaliação"
                      description="Período em dias para analisar os agendamentos do cliente"
                      value={unitSettings.reassignWindowDays}
                      onChange={v => handleSettingChange('reassignWindowDays', v)}
                      min={7}
                      max={365}
                      suffix="dias"
                    />

                    <SettingNumber
                      label="Mínimo de agendamentos"
                      description="Quantidade mínima de agendamentos na outra unidade para considerar a troca"
                      value={unitSettings.reassignMinAppointments}
                      onChange={v => handleSettingChange('reassignMinAppointments', v)}
                      min={1}
                      max={50}
                      suffix="agend."
                    />

                    <SettingNumber
                      label="Percentual mínimo"
                      description="Percentual de agendamentos na outra unidade em relação ao total para disparar a troca"
                      value={unitSettings.reassignThresholdPercent}
                      onChange={v => handleSettingChange('reassignThresholdPercent', v)}
                      min={10}
                      max={100}
                      suffix="%"
                    />

                    <SettingToggle
                      label="Notificar ao reatribuir"
                      description="Exibe uma notificação cada vez que um cliente for automaticamente transferido de unidade"
                      value={unitSettings.notifyOnReassign}
                      onChange={v => handleSettingChange('notifyOnReassign', v)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* How it works Card */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden ${shadowClass}`}>
              <div className={`px-5 py-4 border-b ${borderCol} flex items-center gap-3 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                <HelpCircle size={18} className="text-primary" />
                <h3 className={`font-semibold ${textMain}`}>Como funciona</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { step: '1', title: 'Análise periódica', desc: 'A cada 5 minutos, o sistema analisa os agendamentos dos clientes dentro da janela configurada.' },
                  { step: '2', title: 'Contagem por unidade', desc: 'Para cada cliente, conta quantos agendamentos ele tem em cada unidade.' },
                  { step: '3', title: 'Verificação de thresholds', desc: 'Se outra unidade tem mais agendamentos que a atual, e atinge os limites configurados, o cliente é reatribuído.' },
                  { step: '4', title: 'Atualização automática', desc: 'O campo unitId do cliente é atualizado no banco de dados e a mudança reflete imediatamente no sistema.' },
                ].map(item => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${textMain}`}>{item.title}</p>
                      <p className={`text-xs ${textSub} mt-0.5`}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset to defaults */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const defaults: ClientUnitSettings = {
                    autoReassignEnabled: true,
                    reassignWindowDays: 60,
                    reassignMinAppointments: 3,
                    reassignThresholdPercent: 60,
                    notifyOnReassign: true,
                  };
                  setUnitSettings(defaults);
                  saveClientUnitSettings(defaults);
                  toast.success('Configurações restauradas', 'Valores padrão aplicados.');
                }}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${isDarkMode ? 'border-dark-border text-slate-400 hover:text-white hover:bg-dark-surface' : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                Restaurar Padrões
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
