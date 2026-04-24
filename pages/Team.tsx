import React, { useState, useRef, useMemo } from 'react';
import { Search, Filter, Plus, X, User, Mail, Phone, Shield, Briefcase, Lock, Image as ImageIcon, Upload, Trash2, MoreHorizontal, Eye, EyeOff, CheckCircle2, Trophy, TrendingUp, CalendarClock, DollarSign, FileText, Percent, Loader2, Building2, CreditCard, Banknote, Wallet, Scissors, Crown, ShoppingBag, BarChart3, Star, Users, PieChart, Target, Download, ChevronDown, MapPin, Headset } from 'lucide-react';
import { TeamMember, Client, Contract, ClientReview, Comanda, Subscription, Unit } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useConfirm } from '../components/ConfirmModal';
import { usePasswordConfirm } from '../components/PasswordConfirmModal';
import { useToast } from '../components/Toast';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';
import { useSelectedUnit } from '../context/UnitContext';
import { uploadBase64Image, isBase64 } from '../lib/storage';
import { saveMember, deleteMember, saveUnitMembersBulk, saveUnitMember, removeUnitMemberByUser } from '../lib/dataService';
import { authService } from '../lib/auth';

interface TeamProps {
  members: TeamMember[];
  setMembers: (members: TeamMember[]) => void;
  clients: Client[];
  contracts: Contract[];
  isDarkMode: boolean;
  currentUser: TeamMember;
}

// ═══════════════════════════════════════════════
// INDICATORS TAB COMPONENT
// ═══════════════════════════════════════════════
const IndicatorsTab: React.FC<{
  memberId: string; isDarkMode: boolean; textMain: string; textSub: string;
  bgCard: string; borderCol: string; bgInput: string;
}> = ({ memberId, isDarkMode, textMain, textSub, bgCard, borderCol }) => {
  const { subscriptions } = useAppData();
  const { filteredClients: clients, filteredComandas: comandas } = useFilteredData();

  const stats = useMemo(() => {
    // Clientes da Cadeira
    const chairClients = clients.filter(c => c.preferredBarberId === memberId);

    // Comandas deste barbeiro (fechadas)
    const closedComandas = (comandas || []).filter((cm: any) => cm.barberId === memberId && cm.status === 'closed');
    const allComandas = (comandas || []).filter((cm: any) => cm.barberId === memberId);

    // Clientes por frequência
    const clientFreq: Record<string, number> = {};
    closedComandas.forEach((cm: any) => {
      if (cm.clientId) clientFreq[cm.clientId] = (clientFreq[cm.clientId] || 0) + 1;
    });
    const topClients = Object.entries(clientFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([clientId, count]) => ({
        name: clients.find(c => c.id === clientId)?.name || 'Cliente',
        count,
      }));

    // Planos vendidos
    const soldPlans = (subscriptions || []).filter((s: any) => s.soldBy === memberId);
    const activePlans = soldPlans.filter((s: any) => s.status === 'active' || s.status === 'ACTIVE' || s.status === 'pending_payment');

    // Taxa retenção
    const clientsWithComandas = new Set(closedComandas.map((cm: any) => cm.clientId).filter(Boolean));
    const clientsReturned = Object.values(clientFreq).filter(v => v > 1).length;
    const retentionRate = clientsWithComandas.size > 0 ? Math.round((clientsReturned / clientsWithComandas.size) * 100) : 0;

    // Vendas de produtos
    let productSales = 0;
    closedComandas.forEach((cm: any) => {
      const items = cm.items || [];
      items.forEach((item: any) => {
        if (item.type === 'product') productSales += Number(item.totalPrice || item.price || 0);
      });
    });

    // Ticket Médio
    const totalRevenue = closedComandas.reduce((sum: number, cm: any) => sum + Number(cm.total || 0), 0);
    const avgTicket = closedComandas.length > 0 ? totalRevenue / closedComandas.length : 0;

    // Comandas do mês
    const now = new Date();
    const monthComandas = closedComandas.filter((cm: any) => {
      const d = new Date(cm.closedAt || cm.openedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = monthComandas.reduce((sum: number, cm: any) => sum + Number(cm.total || 0), 0);

    // Assinantes vs Avulsos (entre clientes da cadeira)
    const subscriberIds = new Set((subscriptions || []).filter((s: any) => s.status === 'active' || s.status === 'ACTIVE' || s.status === 'pending_payment').map((s: any) => s.clientId));
    const chairSubscribers = chairClients.filter(c => subscriberIds.has(c.id)).length;
    const chairNonSubscribers = chairClients.length - chairSubscribers;

    return {
      chairClients: chairClients.length,
      topClients,
      soldPlans: soldPlans.length,
      activePlans: activePlans.length,
      retentionRate,
      productSales,
      avgTicket,
      monthComandas: monthComandas.length,
      monthTotal,
      chairSubscribers,
      chairNonSubscribers,
      totalComandas: closedComandas.length,
    };
  }, [memberId, clients, comandas, subscriptions]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Simple donut SVG
  const total = stats.chairSubscribers + stats.chairNonSubscribers;
  const subAngle = total > 0 ? (stats.chairSubscribers / total) * 360 : 0;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Hero Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Clientes da Cadeira', value: stats.chairClients, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Planos Vendidos', value: `${stats.activePlans}/${stats.soldPlans}`, icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Ticket Médio', value: fmt(stats.avgTicket), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Retenção', value: `${stats.retentionRate}%`, icon: Target, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map((card, i) => (
          <div key={i} className={`${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'} border rounded-xl p-3 flex flex-col gap-1`}>
            <div className={`p-1.5 rounded-lg ${card.bg} w-fit`}>
              <card.icon size={16} className={card.color} />
            </div>
            <p className={`text-xs ${textSub}`}>{card.label}</p>
            <p className={`font-bold text-lg ${textMain}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Comandas do Mês */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
          <h4 className={`text-xs font-semibold ${textSub} mb-3 flex items-center gap-1`}><BarChart3 size={14} /> Comandas do Mês</h4>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${textMain}`}>{stats.monthComandas}</span>
            <span className={`text-sm ${textSub}`}>comandas</span>
          </div>
          <p className={`text-sm font-medium text-emerald-500 mt-1`}>{fmt(stats.monthTotal)}</p>
        </div>

        {/* Vendas de Produtos */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
          <h4 className={`text-xs font-semibold ${textSub} mb-3 flex items-center gap-1`}><ShoppingBag size={14} /> Vendas de Produtos</h4>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${textMain}`}>{fmt(stats.productSales)}</span>
          </div>
          <p className={`text-xs ${textSub} mt-1`}>{stats.totalComandas} comandas fechadas no total</p>
        </div>
      </div>

      {/* Donut + Top Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
          <h4 className={`text-xs font-semibold ${textSub} mb-3 flex items-center gap-1`}><PieChart size={14} /> Assinantes vs Avulsos</h4>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="w-20 h-20">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="3.8" />
              {total > 0 && (
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3.8"
                  strokeDasharray={`${(subAngle / 360) * 100} ${100 - (subAngle / 360) * 100}`}
                  strokeDashoffset="25" strokeLinecap="round" />
              )}
              <text x="18" y="20" textAnchor="middle" className="fill-current text-[7px] font-bold" fill={isDarkMode ? '#f1f5f9' : '#0f172a'}>{total}</text>
            </svg>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className={textSub}>Assinantes: <span className={`font-bold ${textMain}`}>{stats.chairSubscribers}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`} />
                <span className={textSub}>Avulsos: <span className={`font-bold ${textMain}`}>{stats.chairNonSubscribers}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
          <h4 className={`text-xs font-semibold ${textSub} mb-3 flex items-center gap-1`}><Trophy size={14} /> Top Clientes (Frequência)</h4>
          {stats.topClients.length === 0 ? (
            <p className={`text-xs ${textSub} italic`}>Sem dados de comandas</p>
          ) : (
            <div className="space-y-2">
              {stats.topClients.map((tc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={`text-xs ${textMain} truncate flex-1`}>{tc.name}</span>
                  <span className="text-xs font-bold text-primary ml-2">{tc.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// REVIEWS TAB COMPONENT
// ═══════════════════════════════════════════════
const ReviewsTab: React.FC<{
  memberId: string; isDarkMode: boolean; textMain: string; textSub: string;
  bgCard: string; borderCol: string;
}> = ({ memberId, isDarkMode, textMain, textSub, borderCol }) => {
  const { clientReviews } = useAppData();
  const { filteredClients: clients } = useFilteredData();

  const barberReviews = useMemo(() =>
    (clientReviews || []).filter(r => r.barberId === memberId).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
    [clientReviews, memberId]
  );

  const avgRating = barberReviews.length > 0 ? barberReviews.reduce((s, r) => s + r.rating, 0) / barberReviews.length : 0;

  const distribution = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: barberReviews.filter(r => r.rating === n).length,
    pct: barberReviews.length > 0 ? (barberReviews.filter(r => r.rating === n).length / barberReviews.length) * 100 : 0,
  }));

  // Tags mais frequentes
  const tagCount: Record<string, number> = {};
  barberReviews.forEach(r => (r.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {barberReviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 opacity-50">
          <Star size={48} className="mb-3" />
          <p className={`text-sm ${textSub}`}>Nenhuma avaliação recebida ainda</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className={`text-3xl font-bold ${textMain}`}>{avgRating.toFixed(1)}</p>
                <div className="flex gap-0.5 mt-1 justify-center">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : (isDarkMode ? 'text-slate-600' : 'text-slate-300')} />
                  ))}
                </div>
                <p className={`text-xs ${textSub} mt-1`}>{barberReviews.length} avaliações</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {distribution.map(d => (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className={`w-3 ${textSub}`}>{d.star}</span>
                    <div className={`flex-1 h-2 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className={`w-6 text-right ${textSub}`}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          {topTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <span key={tag} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isDarkMode ? 'bg-dark-surface border-dark-border text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                  {tag} <span className="text-primary font-bold ml-1">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Recent Reviews */}
          <div className="space-y-2">
            <h4 className={`text-xs font-semibold ${textSub}`}>Avaliações Recentes</h4>
            {barberReviews.slice(0, 8).map(r => {
              const client = clients.find(c => c.id === r.clientId);
              return (
                <div key={r.id} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textMain}`}>{client?.name || 'Cliente'}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={12} className={s <= r.rating ? 'text-amber-400 fill-amber-400' : (isDarkMode ? 'text-slate-600' : 'text-slate-300')} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className={`text-xs ${textSub} mt-1`}>{r.comment}</p>}
                  {r.createdAt && (
                    <p className={`text-[10px] ${textSub} mt-1.5 opacity-60`}>
                      {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const Team: React.FC<TeamProps> = ({ members, setMembers, clients, contracts, isDarkMode, currentUser }) => {

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const confirm = useConfirm();
  const passwordConfirm = usePasswordConfirm();
  const toast = useToast();

  // Unit context
  const { selectedUnitId } = useSelectedUnit();
  const { units, unitMembers, setUnitMembers } = useAppData();
  const isFilteringUnit = selectedUnitId !== 'all';
  const selectedUnit = units.find(u => u.id === selectedUnitId);

  // Access Control
  const { permissions: contextPermissions } = useAppData();
  const { canCreate: canCreateTeam, canEdit: canEditTeam, canDelete: canDeleteTeam, isAdminOrManager, isAdmin } = usePermissions(currentUser, contextPermissions);
  const canAddMember = canCreateTeam('/team');
  const canEditMember = canEditTeam('/team');
  const canDeleteMember = canDeleteTeam('/team');

  // Non-admin/manager can only edit their own profile
  const isEditingSelf = editingId === currentUser.id;
  const canEditProtectedFields = isAdminOrManager; // role, status, admissionDate, contractType, paymentPreference

  // Theme Helpers
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-slate-50';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  // Form State
  const [activeTab, setActiveTab] = useState<'profile' | 'contract' | 'financial' | 'indicators' | 'reviews' | 'units'>('profile');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Sales Executive' as TeamMember['role'],
    phone: '',
    cpf: '',
    birthday: '',
    salary: 0,
    status: 'Active' as TeamMember['status'],
    image: '',
    joinDate: new Date().toISOString().split('T')[0],
    // New Fields
    contractType: 'CLT' as 'CLT' | 'PJ' | 'Estágio' | 'Informal',
    paymentPreference: 'Mensal' as 'Mensal' | 'Quinzenal',
    pixKey: '',
    bankInfo: {
      bank: '',
      agency: '',
      account: '',
      accountType: 'Corrente' as 'Corrente' | 'Poupança'
    },
    commissionRate: 0,
    subscriptionCommission: 0,
    productCommission: 0,
    admissionDate: '',
    // Barber-specific
    station: '',
    specialties: [] as string[],
  });
  // Initial form data to track changes
  const [initialFormData, setInitialFormData] = useState<typeof formData | null>(null);

  // Calculate Metrics Logic
  // Commission = 30% of Setup (Fechamento) + 20% of Monthly (Mensalidade) * Contract Duration
  const calculateMetrics = (memberId: string) => {
    // We now look at CONTRACTS for the sales data, not clients directly.
    const memberContracts = contracts.filter(c => c.salesExecutiveId === memberId && (c.status === 'Active' || c.status === 'Ended'));
    const activeContractsList = memberContracts.filter(c => c.status === 'Active');

    let totalSales = 0;
    let totalCommission = 0;

    memberContracts.forEach(contract => {
      const contractTotalValue = (contract.monthlyValue * contract.contractDuration) + contract.setupValue;

      // Total Sales (Revenue for Company generated by this person)
      totalSales += contractTotalValue;

      // Commission Calculation
      const setupCommission = (contract.setupValue || 0) * 0.30;
      const monthlyCommission = (contract.monthlyValue * contract.contractDuration) * 0.20;

      totalCommission += (setupCommission + monthlyCommission);
    });

    return {
      activeContracts: activeContractsList.length,
      totalSales,
      totalCommission
    };
  };

  // Filter Logic
  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return members.filter(member =>
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Form validation - required fields
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isFormValid = useMemo(() => {
    const nameOk = formData.name.trim().length >= 3;
    const emailOk = emailRegex.test(formData.email.trim());
    const phoneOk = !formData.phone || formData.phone.replace(/\D/g, '').length >= 10;
    const passwordOk = editingId ? true : formData.password.length >= 6;
    return nameOk && emailOk && phoneOk && passwordOk;
  }, [formData.name, formData.email, formData.phone, formData.password, editingId]);

  // Check if form has changes compared to initial data
  const hasChanges = useMemo(() => {
    if (!initialFormData) return true; // New member - always allow
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  // Helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const calculateTenure = (dateString: string) => {
    const start = new Date(dateString);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years > 0) {
      return `${years} ano${years > 1 ? 's' : ''}${months > 0 ? ` e ${months} m` : ''}`;
    }
    return `${months} mês${months !== 1 ? 'es' : ''}`;
  };

  const handleOpenModal = (member?: TeamMember) => {
    setShowPassword(false);
    if (member) {
      setEditingId(member.id);
      const memberData = {
        name: member.name,
        email: member.email,
        password: member.password || '',
        role: member.role,
        phone: member.phone || '',
        cpf: member.cpf || '',
        birthday: member.birthday || '',
        salary: member.salary || 0,
        status: member.status,
        image: member.image || '',
        joinDate: member.joinDate,
        contractType: member.contractType || 'CLT',
        paymentPreference: member.paymentPreference || 'Mensal',
        pixKey: member.pixKey || '',
        bankInfo: member.bankInfo || { bank: '', agency: '', account: '', accountType: 'Corrente' },
        commissionRate: member.commissionRate || 0,
        subscriptionCommission: member.subscriptionCommission || 0,
        productCommission: member.productCommission || 0,
        admissionDate: member.admissionDate || member.joinDate,
        station: member.station || '',
        specialties: member.specialties || [],
      };
      setFormData(memberData);
      setInitialFormData(memberData);
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'Sales Executive',
        phone: '',
        cpf: '',
        birthday: '',
        salary: 0,
        status: 'Active',
        image: '',
        joinDate: new Date().toISOString().split('T')[0],
        contractType: 'CLT',
        paymentPreference: 'Mensal',
        pixKey: '',
        bankInfo: { bank: '', agency: '', account: '', accountType: 'Corrente' },
        commissionRate: 0,
        subscriptionCommission: 0,
        productCommission: 0,
        admissionDate: '',
        station: '',
        specialties: [],
      });
      setInitialFormData(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let imageUrl = formData.image;

      // Se a imagem é base64, faz upload para Supabase Storage
      if (formData.image && isBase64(formData.image)) {
        const uploadedUrl = await uploadBase64Image(
          formData.image,
          'team',
          `${Date.now()}_${formData.name.replace(/[^a-zA-Z0-9]/g, '_')}`
        );
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          toast.warning('Aviso', 'Não foi possível salvar a foto. O colaborador será salvo sem imagem.');
          imageUrl = '';
        }
      }

      const memberData: TeamMember = {
        id: editingId || Date.now().toString(),
        name: formData.name,
        email: formData.email,
        password: formData.password,
        // Protected fields: preserve originals if non-admin is editing
        role: canEditProtectedFields ? formData.role : (members.find(m => m.id === editingId)?.role || formData.role),
        phone: formData.phone,
        cpf: formData.cpf,
        birthday: formData.birthday,
        salary: isAdminOrManager ? formData.salary : (members.find(m => m.id === editingId)?.salary || formData.salary),
        status: canEditProtectedFields ? formData.status : (members.find(m => m.id === editingId)?.status || formData.status),
        image: imageUrl,
        joinDate: formData.joinDate,
        // RH — protected for non-admin
        contractType: canEditProtectedFields ? formData.contractType : (members.find(m => m.id === editingId)?.contractType || formData.contractType),
        paymentPreference: canEditProtectedFields ? formData.paymentPreference : (members.find(m => m.id === editingId)?.paymentPreference || formData.paymentPreference),
        pixKey: formData.pixKey,
        bankInfo: formData.bankInfo,
        commissionRate: isAdminOrManager ? formData.commissionRate : (members.find(m => m.id === editingId)?.commissionRate || formData.commissionRate),
        subscriptionCommission: isAdminOrManager ? formData.subscriptionCommission : (members.find(m => m.id === editingId)?.subscriptionCommission || formData.subscriptionCommission),
        productCommission: isAdminOrManager ? formData.productCommission : (members.find(m => m.id === editingId)?.productCommission || formData.productCommission),
        admissionDate: canEditProtectedFields ? formData.admissionDate : (members.find(m => m.id === editingId)?.admissionDate || formData.admissionDate),
        // Barber fields
        station: formData.role === 'Barber' ? formData.station : undefined,
        specialties: formData.role === 'Barber' ? formData.specialties : undefined,
      };

      // Persistir no Supabase
      const result = await saveMember(memberData);

      console.log('Resultado do salvamento:', result); // Log para debug

      if (!result.success) {
        toast.error('Erro ao salvar', result.error || 'Erro desconhecido ao salvar no banco de dados.');
        return;
      }

      // Atualizar state local
      if (editingId) {
        setMembers(members.map(m => m.id === editingId ? memberData : m));
        toast.success('Colaborador atualizado', `${formData.name} foi atualizado com sucesso.`);
      } else {
        setMembers([...members, memberData]);
        toast.success('Colaborador adicionado', `${formData.name} foi adicionado à equipe.`);

        // Auto-link new member to selected unit
        if (isFilteringUnit && memberData.role !== 'Admin' && memberData.role !== 'Manager') {
          await saveUnitMember({
            id: `temp_${Date.now()}`,
            unitId: selectedUnitId,
            userId: memberData.id,
            role: 'member',
            isPrimary: true,
          });
          // Update local state instead of full refresh
          setUnitMembers(prev => [...prev, {
            id: `local_${Date.now()}`,
            unitId: selectedUnitId,
            userId: memberData.id,
            role: 'member',
            isPrimary: true,
            createdAt: new Date().toISOString(),
          }]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar colaborador:', err);
      toast.error('Erro', 'Ocorreu um erro ao salvar o colaborador.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const member = members.find(m => m.id === id);

    // Check if user is Admin
    if (!isAdmin) {
      toast.error('Sem permissão', 'Apenas administradores podem excluir colaboradores.');
      return;
    }

    // Confirm action with password
    const confirmDelete = await passwordConfirm({
      title: 'Excluir Colaborador',
      message: `Para remover "${member?.name || 'este colaborador'}", confirme sua senha. Esta ação não pode ser desfeita.`,
      action: 'Confirmar Exclusão',
      onValidate: async (password: string) => {
        const { error } = await authService.signIn(currentUser.email, password);
        return !error;
      }
    });

    if (!confirmDelete) return;

    // Persistir deleção no Supabase
    const result = await deleteMember(id);
    if (!result.success) {
      toast.error('Erro ao excluir', result.error || 'Erro desconhecido ao excluir.');
      return;
    }

    setMembers(members.filter(m => m.id !== id));
    toast.success('Colaborador removido', `${member?.name} foi removido da equipe.`);
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'Sales Executive': return 'bg-primary/10 text-primary border-primary/20';
      case 'Manager': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Barber': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Attendant': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  // Get current editing member metrics for Modal View
  const modalMetrics = editingId ? calculateMetrics(editingId) : { activeContracts: 0, totalSales: 0, totalCommission: 0 };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative">

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]`}>
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain}`}>
                {editingId ? 'Editar Colaborador' : 'Adicionar Colaborador'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className={`flex border-b ${borderCol} px-4 pt-2 gap-4 ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50/80'}`}>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Perfil
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('contract')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'contract' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Contrato & RH
              </button>
              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => setActiveTab('financial')}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'financial' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Financeiro
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={() => setActiveTab('indicators')}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'indicators' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Indicadores
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Avaliações
                </button>
              )}
              {editingId && isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => setActiveTab('units')}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'units' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Unidades
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">

              {activeTab === 'profile' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Photo Upload Section */}
                  <div className={`flex items-center gap-4 p-4 border rounded-lg ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-20 h-20 rounded-full border flex items-center justify-center overflow-hidden shrink-0 relative ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-200'}`}>
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={32} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className={`block text-sm font-bold ${textMain} mb-2`}>Foto de Perfil</label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={handleTriggerFileUpload}
                          className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                        >
                          <Upload size={14} /> Carregar Foto
                        </button>
                        {formData.image && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Nome Completo</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                        placeholder="Ex: Maria Silva"
                        required
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Phone size={12} /> Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                          if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
                          else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                          else if (v.length > 0) v = `(${v}`;
                          setFormData({ ...formData, phone: v });
                        }}
                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  {/* Access Info */}
                  <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-2"><Lock size={16} /> Credenciais de Acesso</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Mail size={12} /> Email (Login)</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                          placeholder="email@alphaflow.com"
                          required
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Lock size={12} /> Senha</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 pr-10 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSub} hover:${textMain}`}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isAdminOrManager && (
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><FileText size={12} /> CPF</label>
                        <input
                          type="text"
                          value={formData.cpf}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 11) {
                              value = value.replace(/(\d{3})(\d)/, '$1.$2');
                              value = value.replace(/(\d{3})(\d)/, '$1.$2');
                              value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                            }
                            setFormData({ ...formData, cpf: value });
                          }}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                      </div>
                    )}
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><CalendarClock size={12} /> Data de Nascimento</label>
                      <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contract' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="text-sm font-semibold text-blue-500 flex items-center gap-2"><Briefcase size={16} /> Detalhes do Contrato</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Briefcase size={12} /> Cargo / Função</label>
                        <CustomDropdown
                          value={formData.role}
                          onChange={v => setFormData({ ...formData, role: v as TeamMember['role'] })}
                          options={[
                            { value: 'Admin', label: 'Admin (Acesso Total)', icon: <Shield size={12} /> },
                            { value: 'Barber', label: 'Barbeiro / Profissional', icon: <Scissors size={12} /> },
                            { value: 'Attendant', label: 'Atendente', icon: <Headset size={12} /> },
                            { value: 'Sales Executive', label: 'Executivo de Vendas', icon: <Briefcase size={12} /> },
                            { value: 'Manager', label: 'Gerente de Projetos', icon: <Crown size={12} /> },
                            { value: 'Support', label: 'Suporte', icon: <User size={12} /> },
                          ]}
                          isDarkMode={isDarkMode}
                          disabled={!canEditProtectedFields}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><CheckCircle2 size={12} /> Status</label>
                        <CustomDropdown
                          value={formData.status}
                          onChange={v => setFormData({ ...formData, status: v as TeamMember['status'] })}
                          options={[
                            { value: 'Active', label: 'Ativo', dot: 'bg-emerald-500' },
                            { value: 'Inactive', label: 'Inativo', dot: 'bg-slate-400' },
                          ]}
                          isDarkMode={isDarkMode}
                          disabled={!canEditProtectedFields}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Shield size={12} /> Regime de Contratação</label>
                        <CustomDropdown
                          value={formData.contractType}
                          onChange={v => setFormData({ ...formData, contractType: v as any })}
                          options={[
                            { value: 'CLT', label: 'CLT (Carteira Assinada)' },
                            { value: 'PJ', label: 'PJ (Pessoa Jurídica)' },
                            { value: 'Estágio', label: 'Estágio' },
                            { value: 'Informal', label: 'Informal / Freelance' },
                          ]}
                          isDarkMode={isDarkMode}
                          disabled={!canEditProtectedFields}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><CalendarClock size={12} /> Data de Admissão</label>
                        <input
                          type="date"
                          value={formData.admissionDate || formData.joinDate}
                          onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                          disabled={!canEditProtectedFields}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}] ${!canEditProtectedFields ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isAdminOrManager && (
                        <div>
                          <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><DollarSign size={12} /> Salário Base (R$)</label>
                          <input
                            type="number"
                            value={formData.salary}
                            onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                            placeholder="0,00"
                          />
                        </div>
                      )}
                      {isAdminOrManager && (
                        <>
                          <div className="col-span-full">
                            <h4 className="text-xs font-semibold text-primary flex items-center gap-1 mb-2 mt-1"><Percent size={12} /> Comissões por Tipo</h4>
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Scissors size={12} /> Serviço (%)</label>
                            <input
                              type="number"
                              value={formData.commissionRate}
                              onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                              placeholder="50"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Crown size={12} /> Assinante (%)</label>
                            <input
                              type="number"
                              value={formData.subscriptionCommission}
                              onChange={(e) => setFormData({ ...formData, subscriptionCommission: parseFloat(e.target.value) || 0 })}
                              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                              placeholder="20"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><ShoppingBag size={12} /> Produto (%)</label>
                            <input
                              type="number"
                              value={formData.productCommission}
                              onChange={(e) => setFormData({ ...formData, productCommission: parseFloat(e.target.value) || 0 })}
                              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                              placeholder="10"
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><CalendarClock size={12} /> Frequência de Pagamento</label>
                        <CustomDropdown
                          value={formData.paymentPreference}
                          onChange={v => setFormData({ ...formData, paymentPreference: v as any })}
                          options={[
                            { value: 'Mensal', label: 'Mensal (Padrão)' },
                            { value: 'Quinzenal', label: 'Quinzenal' },
                          ]}
                          isDarkMode={isDarkMode}
                          disabled={!canEditProtectedFields}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Barber-specific Section */}
                  {formData.role === 'Barber' && (
                    <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                      <h4 className="text-sm font-semibold text-primary flex items-center gap-2"><Scissors size={16} /> Dados do Profissional</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Scissors size={12} /> Cadeira / Estação</label>
                          <input
                            type="text"
                            value={formData.station}
                            onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                            placeholder="Ex: Cadeira 1, Estação A"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${textSub} mb-1`}>Especialidades</label>
                          <input
                            type="text"
                            value={(formData.specialties || []).join(', ')}
                            onChange={(e) => setFormData({ ...formData, specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                            placeholder="Ex: Corte Degradê, Barba, Pigmentação (separar por vírgula)"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metrics Recap */}
                  <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="text-sm font-semibold text-emerald-500 flex items-center gap-2"><Trophy size={16} /> Performance Atual</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded border ${isDarkMode ? 'bg-dark' : 'bg-white'}`}>
                        <p className="text-xs text-slate-500">Contratos Ativos</p>
                        <p className="font-bold text-lg">{modalMetrics.activeContracts}</p>
                      </div>
                      <div className={`p-3 rounded border ${isDarkMode ? 'bg-dark' : 'bg-white'}`}>
                        <p className="text-xs text-slate-500">LTV Gerado</p>
                        <p className="font-bold text-lg">{formatCurrency(modalMetrics.totalSales)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financial' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="text-sm font-semibold text-emerald-500 flex items-center gap-2"><CreditCard size={16} /> Dados Bancários</h4>

                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><CreditCard size={12} /> Chave PIX</label>
                      <input
                        type="text"
                        value={formData.pixKey}
                        onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                        placeholder="CPF, Email, Telefone ou Aleatória"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building2 size={12} /> Banco</label>
                        <input
                          type="text"
                          value={formData.bankInfo.bank}
                          onChange={(e) => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, bank: e.target.value } })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                          placeholder="Ex: Nubank, Banco do Brasil"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building2 size={12} /> Agência</label>
                        <input
                          type="text"
                          value={formData.bankInfo.agency}
                          onChange={(e) => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, agency: e.target.value } })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                          placeholder="0000"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Banknote size={12} /> Conta</label>
                        <input
                          type="text"
                          value={formData.bankInfo.account}
                          onChange={(e) => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, account: e.target.value } })}
                          className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                          placeholder="00000-0"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Filter size={12} /> Tipo de Conta</label>
                        <CustomDropdown
                          value={formData.bankInfo.accountType}
                          onChange={v => setFormData({ ...formData, bankInfo: { ...formData.bankInfo, accountType: v as any } })}
                          options={[
                            { value: 'Corrente', label: 'Conta Corrente' },
                            { value: 'Poupança', label: 'Conta Poupança' },
                            { value: 'Pagamento', label: 'Conta Pagamento' },
                          ]}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ ABA INDICADORES ═══ */}
              {activeTab === 'indicators' && editingId && (
                <IndicatorsTab memberId={editingId} isDarkMode={isDarkMode} textMain={textMain} textSub={textSub} bgCard={bgCard} borderCol={borderCol} bgInput={bgInput} />
              )}

              {/* ═══ ABA AVALIAÇÕES ═══ */}
              {activeTab === 'reviews' && editingId && (
                <ReviewsTab memberId={editingId} isDarkMode={isDarkMode} textMain={textMain} textSub={textSub} bgCard={bgCard} borderCol={borderCol} />
              )}

              {/* TAB: Unidades */}
              {activeTab === 'units' && editingId && (() => {
                const editingMember = members.find(m => m.id === editingId);
                const isGlobalRole = editingMember?.role === 'Admin' || editingMember?.role === 'Manager';
                const memberLinks = unitMembers.filter(um => um.userId === editingId);
                const linkedUnitIds = new Set(memberLinks.map(um => um.unitId));

                const handleToggleUnit = async (unitId: string, isLinked: boolean) => {
                  try {
                    if (isLinked) {
                      await removeUnitMemberByUser(unitId, editingId);
                      // Update local state
                      setUnitMembers(prev => prev.filter(um => !(um.unitId === unitId && um.userId === editingId)));
                      toast.success('Removido', 'Colaborador desvinculado da unidade.');
                    } else {
                      await saveUnitMember({ id: `temp_${Date.now()}`, unitId, userId: editingId, role: 'member', isPrimary: false });
                      // Update local state
                      setUnitMembers(prev => [...prev, {
                        id: `local_${Date.now()}`,
                        unitId,
                        userId: editingId,
                        role: 'member',
                        isPrimary: false,
                        createdAt: new Date().toISOString(),
                      }]);
                      toast.success('Vinculado', 'Colaborador vinculado a unidade.');
                    }
                  } catch {
                    toast.error('Erro', 'Falha ao atualizar vinculo.');
                  }
                };

                return (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header info */}
                    <div className={`flex items-start gap-3 p-3.5 rounded-lg border ${isGlobalRole
                      ? isDarkMode ? 'bg-violet-500/5 border-violet-500/20' : 'bg-violet-50 border-violet-200'
                      : isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                      }`}>
                      {isGlobalRole ? (
                        <Shield size={18} className="text-violet-500 mt-0.5 shrink-0" />
                      ) : (
                        <Building2 size={18} className="text-blue-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm font-semibold ${textMain}`}>
                          {isGlobalRole ? 'Acesso global' : 'Vincular a unidades'}
                        </p>
                        <p className={`text-xs ${textSub} mt-0.5`}>
                          {isGlobalRole
                            ? 'Gestores (Admin/Manager) aparecem automaticamente em todas as unidades.'
                            : 'Selecione as unidades onde este colaborador deve atuar. Ele aparecera apenas nas unidades marcadas.'}
                        </p>
                      </div>
                    </div>

                    {/* Unit list */}
                    <div className="space-y-3">
                      {units.filter(u => u.status === 'active').map(unit => {
                        const isLinked = isGlobalRole || linkedUnitIds.has(unit.id);
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            disabled={isGlobalRole}
                            onClick={() => handleToggleUnit(unit.id, isLinked)}
                            className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${isLinked
                              ? isDarkMode
                                ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/10'
                                : 'bg-primary/5 border-primary/25 ring-1 ring-primary/10'
                              : isDarkMode
                                ? 'bg-dark border-dark-border hover:border-slate-500'
                                : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                              } ${isGlobalRole ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${isLinked ? 'bg-primary border-primary' : isDarkMode ? 'border-slate-600' : 'border-slate-300'
                              }`}>
                              {isLinked && <CheckCircle2 size={14} className="text-white" />}
                            </div>

                            {/* Unit logo */}
                            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border overflow-hidden ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-100 border-slate-200'
                              }`}>
                              {unit.profileImage ? (
                                <img src={unit.profileImage} alt={unit.name} className="w-full h-full object-cover" />
                              ) : (
                                <Building2 size={20} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className={`text-sm font-bold ${textMain} truncate`}>{unit.tradeName || unit.name}</p>
                                {isLinked && !isGlobalRole && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    Vinculado
                                  </span>
                                )}
                              </div>
                              {unit.tradeName && (
                                <p className={`text-xs ${textSub} truncate mb-1`}>{unit.tradeName}</p>
                              )}
                              <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${textSub}`}>
                                {unit.address && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin size={10} className="shrink-0" /> {unit.address} — {unit.city}/{unit.state}
                                  </span>
                                )}
                                {unit.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={10} className="shrink-0" /> {unit.phone}
                                  </span>
                                )}
                                {unit.managerName && (
                                  <span className="flex items-center gap-1">
                                    <User size={10} className="shrink-0" /> {unit.managerName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {units.filter(u => u.status === 'active').length === 0 && (
                      <div className={`text-center py-10 ${textSub}`}>
                        <Building2 size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Nenhuma unidade ativa cadastrada.</p>
                        <p className="text-xs mt-1">Cadastre unidades na tela de Unidades para vincular colaboradores.</p>
                      </div>
                    )}
                  </div>
                );
              })()}

            </form>

            {/* Footer — FORA do form, pinado no rodapé */}
            <div className={`p-5 border-t ${borderCol} mt-auto shrink-0 flex gap-3`}>
              {editingId && canDeleteMember && (
                <button
                  type="button"
                  onClick={() => { handleDelete(editingId); setIsModalOpen(false); }}
                  className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-lg transition-colors border border-red-500/30"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={handleSave as any}
                disabled={isUploading || !isFormValid || !hasChanges}
                className={`flex-1 py-3 font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 ${(isUploading || !isFormValid || !hasChanges) ? 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary-600 text-white shadow-primary/20'}`}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingId ? 'Salvar Alterações' : 'Criar Colaborador'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain}`}>Equipe</h1>
          <p className={`${textSub} text-sm`}>Gerencie os colaboradores, acessos e performance.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador..."
              className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full md:w-64 ${isDarkMode ? 'bg-dark border-dark-border text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>
          <button className={`p-2 border rounded-lg transition-colors ${isDarkMode ? 'bg-dark border-dark-border text-slate-400 hover:text-primary hover:border-primary' : 'bg-white border-slate-300 text-slate-500 hover:text-primary hover:border-primary'}`}>
            <Filter size={20} />
          </button>
          {canAddMember && (
            <div className="relative">
              <div className="flex">
                <button
                  onClick={() => handleOpenModal()}
                  className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg rounded-r-none text-sm transition-colors flex items-center gap-2"
                >
                  <Plus size={18} /> Adicionar
                </button>
                <button
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                  className="px-2 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg rounded-l-none border-l border-white/20 transition-colors"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              {showAddDropdown && (
                <div className={`absolute right-0 top-full mt-1 w-full min-w-max rounded-lg border shadow-xl z-50 overflow-hidden ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}>
                  <button
                    onClick={() => { setShowAddDropdown(false); handleOpenModal(); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap ${isDarkMode ? 'hover:bg-dark text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <Plus size={14} className="text-primary" /> Adicionar Membro
                  </button>
                  {isFilteringUnit && (
                    <button
                      onClick={() => { setShowAddDropdown(false); setIsImportModalOpen(true); setImportSearch(''); setImportSelected(new Set()); }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors border-t whitespace-nowrap ${isDarkMode ? 'hover:bg-dark text-slate-200 border-dark-border' : 'hover:bg-slate-50 text-slate-700 border-slate-100'}`}
                    >
                      <Download size={14} className="text-blue-500" /> Importar Membro
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredMembers.map((member) => {
          const stats = calculateMetrics(member.id);

          return (
            <div key={member.id} className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden hover:border-slate-400/50 transition-all group relative flex flex-col`}>

              {/* Top Status Bar */}
              <div className={`h-1 w-full ${member.status === 'Active' ? 'bg-primary' : 'bg-red-500'}`}></div>

              <div className="p-6 flex flex-col items-center text-center flex-1">
                {/* Avatar */}
                <div className="relative mb-3">
                  <div className={`w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-white border-slate-200'}`}>
                    {member.image ? (
                      <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`text-2xl font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{member.name.charAt(0)}</span>
                    )}
                  </div>
                  {member.role === 'Admin' && (
                    <div className={`absolute -bottom-1 -right-1 bg-violet-500 text-white p-1 rounded-full border-2 ${isDarkMode ? 'border-dark' : 'border-white'}`} title="Admin">
                      <Shield size={12} fill="currentColor" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className={`text-lg font-bold ${textMain} mb-1 leading-tight`}>{member.name}</h3>

                {/* Role Badge */}
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border mb-2 flex items-center gap-1.5 ${getRoleBadgeColor(member.role)}`}>
                  {member.role === 'Admin' ? <Shield size={10} /> : <Briefcase size={10} />}
                  {member.role}
                </div>

                {/* Unit Badges */}
                {(() => {
                  const memberUnits = unitMembers
                    .filter(um => um.userId === member.id)
                    .map(um => units.find(u => u.id === um.unitId))
                    .filter(Boolean) as Unit[];
                  const activeUnits = units.filter(u => u.status === 'active');
                  const isGlobal = member.role === 'Admin' || member.role === 'Manager';
                  const isInAllUnits = !isGlobal && activeUnits.length > 0 && memberUnits.length >= activeUnits.length;
                  return (isGlobal || memberUnits.length > 0) ? (
                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                      {(isGlobal || isInAllUnits) ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold ${isDarkMode ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>
                          <MapPin size={8} /> Todas as unidades
                        </span>
                      ) : memberUnits.map(u => (
                        <span key={u.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold ${isDarkMode ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                          <MapPin size={8} /> {u.tradeName || u.name}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Tenure (Time with Company) */}
                <div className={`text-xs ${textSub} mb-4 flex items-center gap-1`}>
                  <CalendarClock size={12} />
                  <span>{calculateTenure(member.joinDate)} de empresa</span>
                </div>

                {/* Contact Info */}
                <div className={`w-full space-y-1.5 text-xs mb-5 p-2.5 rounded-lg border ${isDarkMode ? 'bg-dark/50 border-dark-border/50 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                  <div className="flex items-center gap-2 justify-center">
                    <Mail size={12} /> <span className="truncate max-w-[180px]">{member.email}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-2 justify-center">
                      <Phone size={12} /> <span>{member.phone}</span>
                    </div>
                  )}
                </div>

                {/* Performance Stats - only visible for Admin/Manager */}
                {isAdminOrManager && (
                  <div className="w-full grid grid-cols-2 gap-2 mb-4">
                    <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-100 border-slate-200'}`}>
                      <span className={`text-[10px] ${textSub} block mb-0.5`}>Contratos</span>
                      <span className={`text-sm font-bold flex items-center justify-center gap-1 ${textMain}`}>
                        <FileText size={12} className="text-blue-500" /> {stats.activeContracts}
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-dark/50 border-dark-border' : 'bg-slate-100 border-slate-200'}`}>
                      <span className={`text-[10px] ${textSub} block mb-0.5`}>Comissão</span>
                      <span className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                        <TrendingUp size={12} /> {new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', style: 'currency', currency: 'BRL' }).format(stats.totalCommission)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto w-full">
                  <button
                    onClick={() => {
                      if (!isAdminOrManager && member.id !== currentUser.id) {
                        return; // Non-admin can only view their own details
                      }
                      handleOpenModal(member);
                    }}
                    className={`w-full py-2 font-medium rounded-lg text-xs transition-colors border flex items-center justify-center gap-2 ${isDarkMode ? 'bg-dark hover:bg-dark-surface text-slate-300 border-dark-border' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}
                  >
                    <MoreHorizontal size={14} /> {(!isAdminOrManager && member.id !== currentUser.id) ? 'Ver Informações' : 'Detalhes & Acesso'}
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className={`text-center py-16 ${textSub}`}>
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold mb-1">Nenhum colaborador nesta unidade</p>
          <p className="text-sm mb-4">Adicione um novo colaborador ou importe de outra unidade.</p>
          {isFilteringUnit && canAddMember && (
            <button
              onClick={() => { setIsImportModalOpen(true); setImportSearch(''); setImportSelected(new Set()); }}
              className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors inline-flex items-center gap-2"
            >
              <Download size={16} /> Importar Colaboradores
            </button>
          )}
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (() => {
        // Get members NOT in this unit (exclude Admin/Manager since they're global)
        const currentUnitMemberIds = new Set(unitMembers.filter(um => um.unitId === selectedUnitId).map(um => um.userId));
        const importableMembers = members.filter(m =>
          m.role !== 'Admin' && m.role !== 'Manager' &&
          !currentUnitMemberIds.has(m.id)
        );
        const filtered = importableMembers.filter(m =>
          m.name.toLowerCase().includes(importSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(importSearch.toLowerCase())
        );

        const handleImport = async () => {
          if (importSelected.size === 0) return;
          setImportLoading(true);
          try {
            const result = await saveUnitMembersBulk(selectedUnitId, Array.from(importSelected));
            if (result.success) {
              toast.success('Colaboradores importados', `${importSelected.size} colaborador(es) vinculado(s) a ${selectedUnit?.tradeName || selectedUnit?.name || 'esta unidade'}.`);
              // Update local state instead of full refresh
              const now = new Date().toISOString();
              const newLinks = Array.from(importSelected).map(userId => ({
                id: `local_${Date.now()}_${userId}`,
                unitId: selectedUnitId,
                userId,
                role: 'member',
                isPrimary: false,
                createdAt: now,
              }));
              setUnitMembers(prev => [...prev, ...newLinks]);
              setIsImportModalOpen(false);
            } else {
              toast.error('Erro', result.error || 'Falha ao importar.');
            }
          } catch {
            toast.error('Erro', 'Falha ao importar colaboradores.');
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
            setImportSelected(new Set(filtered.map(m => m.id)));
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]`}>
              {/* Header */}
              <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                <div>
                  <h3 className={`font-semibold text-lg ${textMain}`}>Importar Colaboradores</h3>
                  <p className={`text-xs ${textSub} mt-0.5`}>Selecione colaboradores de outras unidades para vincular a <strong>{selectedUnit?.tradeName || selectedUnit?.name}</strong></p>
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
                    placeholder="Buscar por nome ou email..."
                    className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-primary ${isDarkMode ? 'bg-dark border-dark-border text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                  />
                </div>
              </div>

              {/* Select all bar */}
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
                    <p className="text-sm">Nenhum colaborador disponivel para importar.</p>
                    <p className="text-xs mt-1">Todos ja estao vinculados a esta unidade.</p>
                  </div>
                ) : filtered.map(m => {
                  const isSelected = importSelected.has(m.id);
                  const memberUnits = unitMembers
                    .filter(um => um.userId === m.id)
                    .map(um => { const u = units.find(u => u.id === um.unitId); return u?.tradeName || u?.name; })
                    .filter(Boolean);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleSelect(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-left transition-colors ${isSelected
                        ? isDarkMode ? 'bg-primary/10 border border-primary/30' : 'bg-primary/5 border border-primary/20'
                        : isDarkMode ? 'hover:bg-dark border border-transparent' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : isDarkMode ? 'border-slate-600' : 'border-slate-300'
                        }`}>
                        {isSelected && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-dark border border-dark-border' : 'bg-slate-100 border border-slate-200'}`}>
                        {m.image ? (
                          <img src={m.image} alt={m.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className={`text-sm font-bold ${textSub}`}>{m.name.charAt(0)}</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${textMain} truncate`}>{m.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] ${textSub}`}>{m.role}</span>
                          {memberUnits.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-dark text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                              {memberUnits.join(', ')}
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
    </div>
  );
};