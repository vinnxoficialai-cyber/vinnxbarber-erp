import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Users, User, AlertCircle, Clock, Cake, Calendar,
  ChevronRight, TrendingDown, TrendingUp, BarChart3,
  Zap, UserPlus, Receipt, Scissors, ShoppingBag,
  Package, Crown, ClipboardList, CalendarCheck,
  AlertTriangle, Wallet, Target, ArrowUpRight, ArrowDownRight,
  Cloud, Sun, MapPin, Thermometer, ChevronLeft
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../utils';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useSelectedUnit } from '../context/UnitContext';
import { getSubscriptions } from '../lib/dataService';
import { TeamMember, Subscription } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { getWeatherData } from '../lib/weatherService';

interface DashboardProps {
  currentUser?: TeamMember | null;
}

type PeriodFilter = 'today' | '7d' | 'month' | '30d';

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Este Mês' },
  { key: '30d', label: '30 dias' },
];

export const Dashboard: React.FC<DashboardProps> = ({ currentUser: userProp }) => {
  const navigate = useNavigate();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long' });
  const todayStr = now.toISOString().split('T')[0];

  // ===== DATA FROM CENTRALIZED CONTEXT =====
  const {
    clients, transactions, calendarEvents: events, members,
    bankAccounts, permissions, loading, comandas, products,
    recurringExpenses, refresh,
  } = useAppData();

  // Multi-unit context
  const { selectedUnitId, isFiltering: isUnitFiltering } = useSelectedUnit();

  // Refresh data on Dashboard mount
  useEffect(() => { refresh(true); }, []);

  // ===== Subscriptions (fetched separately — not in AppDataContext) =====
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const s = await getSubscriptions();
        setSubscriptions(s);
      } catch { /* silent */ }
    })();
  }, []);

  // ===== LIVE CLOCK =====
  const [clockTime, setClockTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ===== WEATHER =====
  const [weather, setWeather] = useState<{ temperature: number; description: string; icon: string; cityName: string } | null>(null);
  useEffect(() => {
    getWeatherData().then(w => { if (w) setWeather(w); }).catch(() => { });
  }, []);

  // Current User
  const currentUser = useMemo(() => {
    if (userProp) return userProp;
    const userData = localStorage.getItem('erp_current_user');
    if (userData) {
      try { return JSON.parse(userData) as TeamMember; } catch { return null; }
    }
    return null;
  }, [userProp]);

  const { isAdminOrManager } = usePermissions(currentUser, permissions);

  // ===== FILTERS =====
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [insightsTab, setInsightsTab] = useState<'assinantes' | 'avulsos'>('assinantes');

  // Active barbers for the filter dropdown
  const activeBarbers = useMemo(() =>
    members.filter(m => m.status === 'Active'),
    [members]);

  // Date range helper — month-based, with optional day filter
  const dateRange = useMemo(() => {
    const n = new Date();
    let from: Date;
    let to: Date;
    if (selectedDay !== null) {
      from = new Date(selectedYear, selectedMonth, selectedDay);
      to = new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999);
    } else {
      from = new Date(selectedYear, selectedMonth, 1);
      to = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    }
    return { from, to, now: n };
  }, [selectedMonth, selectedYear, selectedDay]);

  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= dateRange.from && d <= dateRange.to;
  };

  // Previous period for % comparison (previous month)
  const prevRange = useMemo(() => {
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const from = new Date(prevYear, prevMonth, 1);
    const to = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }, [selectedMonth, selectedYear]);

  const inPrevPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= prevRange.from && d <= prevRange.to;
  };

  // Unit-filtered comandas
  const filteredComandas = useMemo(() => {
    let c = comandas;
    if (isUnitFiltering && selectedUnitId !== 'all') {
      c = c.filter(x => x.unitId === selectedUnitId);
    }
    return c;
  }, [comandas, isUnitFiltering, selectedUnitId]);

  // ===== 🏆 CAMADA 1: HERO KPIs =====

  // Faturamento (período)
  const periodRevenue = useMemo(() => {
    return filteredComandas
      .filter(c => c.status === 'closed' && inPeriod(c.closedAt || c.openedAt))
      .reduce((acc, c) => acc + c.finalAmount, 0);
  }, [filteredComandas, dateRange]);

  const prevPeriodRevenue = useMemo(() => {
    return filteredComandas
      .filter(c => c.status === 'closed' && inPrevPeriod(c.closedAt || c.openedAt))
      .reduce((acc, c) => acc + c.finalAmount, 0);
  }, [filteredComandas, prevRange]);

  const revenueChange = prevPeriodRevenue > 0
    ? ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100 : 0;

  // Atendimentos (período)
  const periodAtendimentos = useMemo(() => {
    return filteredComandas
      .filter(c => ['closed', 'in_progress', 'open'].includes(c.status) && inPeriod(c.openedAt))
      .length;
  }, [filteredComandas, dateRange]);

  const prevAtendimentos = useMemo(() => {
    return filteredComandas
      .filter(c => ['closed', 'in_progress', 'open'].includes(c.status) && inPrevPeriod(c.openedAt))
      .length;
  }, [filteredComandas, prevRange]);

  const atendimentosChange = prevAtendimentos > 0
    ? ((periodAtendimentos - prevAtendimentos) / prevAtendimentos) * 100 : 0;

  // Ticket Médio
  const periodClosedComandas = useMemo(() =>
    filteredComandas.filter(c => c.status === 'closed' && inPeriod(c.closedAt || c.openedAt)),
    [filteredComandas, dateRange]);

  const ticketMedio = periodClosedComandas.length > 0
    ? periodRevenue / periodClosedComandas.length : 0;

  const prevClosedComandas = useMemo(() =>
    filteredComandas.filter(c => c.status === 'closed' && inPrevPeriod(c.closedAt || c.openedAt)),
    [filteredComandas, prevRange]);

  const prevTicket = prevClosedComandas.length > 0
    ? prevPeriodRevenue / prevClosedComandas.length : 0;

  const ticketChange = prevTicket > 0 ? ((ticketMedio - prevTicket) / prevTicket) * 100 : 0;

  // Comandas Abertas (tempo real, sem filtro de período)
  const openComandas = useMemo(() =>
    filteredComandas.filter(c => c.status === 'open' || c.status === 'in_progress').length,
    [filteredComandas]);

  // ===== 📊 CAMADA 2: OPERACIONAIS =====

  // Novos Clientes
  const newClientsCount = useMemo(() =>
    clients.filter(c => {
      const dateField = c.lastVisit || (c as any).createdAt;
      return dateField && inPeriod(dateField);
    }).length,
    [clients, dateRange]);

  // Clientes em risco (ativos sem comanda no período)
  const atRiskClients = useMemo(() => {
    const clientsWithComanda = new Set(
      periodClosedComandas.map(c => c.clientId).filter(Boolean)
    );
    return clients.filter(c => c.status === 'Active' && !clientsWithComanda.has(c.id)).length;
  }, [clients, periodClosedComandas]);

  // Assinantes Ativos
  const activeSubscribers = useMemo(() =>
    subscriptions.filter(s => s.status === 'active').length,
    [subscriptions]);

  // Produtos com Estoque Baixo
  const lowStockProducts = useMemo(() =>
    products.filter(p => p.active && (p.stock ?? 0) <= (p.minStock ?? 5)),
    [products]);

  // ===== 💰 CAMADA 3: FINANCEIRO =====

  // Faturamento do Mês (comandas + transactions)
  const monthRevenue = useMemo(() => {
    const comandaRev = comandas
      .filter(c => c.status === 'closed' && c.closedAt && new Date(c.closedAt).getMonth() === currentMonth && new Date(c.closedAt).getFullYear() === currentYear)
      .reduce((acc, c) => acc + c.finalAmount, 0);
    const txRev = transactions
      .filter(t => {
        if (t.type !== 'income') return false;
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, t) => acc + t.amount, 0);
    return comandaRev + txRev;
  }, [comandas, transactions, currentMonth, currentYear]);

  // Despesas do Mês
  const monthExpenses = useMemo(() =>
    transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    [transactions, currentMonth, currentYear]);

  // MRR (from subscriptions — plan is already joined by getSubscriptions)
  const mrr = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active');
    return active.reduce((acc, sub) => acc + (sub.plan?.price || 0), 0);
  }, [subscriptions]);

  // Contas Pendentes + Atrasadas
  const pendingAmount = useMemo(() =>
    transactions
      .filter(t => t.status === 'Pending' || t.status === 'Overdue')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    [transactions]);

  const overdueCount = useMemo(() =>
    transactions.filter(t => t.status === 'Overdue').length,
    [transactions]);

  // ===== 🔍 CAMADA 4: DETALHES =====

  // Cash Flow Chart (12 months)
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((name, index) => {
      const monthTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });
      const receita = monthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const despesa = monthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(t.amount), 0);
      // Add comanda revenue for each month
      const monthComandaRev = comandas
        .filter(c => c.status === 'closed' && c.closedAt && new Date(c.closedAt).getMonth() === index && new Date(c.closedAt).getFullYear() === currentYear)
        .reduce((acc, c) => acc + c.finalAmount, 0);
      return { name, receita: (receita + monthComandaRev) / 1000, despesa: despesa / 1000 };
    });
  }, [transactions, comandas, currentYear]);

  // Próximos Agendamentos
  const upcomingAppointments = useMemo(() =>
    events
      .filter(event => {
        const eventDate = new Date(event.year, event.month, event.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return eventDate >= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.year, a.month, a.date);
        const dateB = new Date(b.year, b.month, b.date);
        if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
        return (a.startTime || '').localeCompare(b.startTime || '');
      })
      .slice(0, 5),
    [events, now]);

  // Performance por Barbeiro
  const barberPerformance = useMemo(() => {
    const closed = periodClosedComandas;
    const perf = activeBarbers.map(m => {
      const mc = closed.filter(c => c.barberId === m.id);
      const revenue = mc.reduce((s, c) => s + c.finalAmount, 0);
      return { id: m.id, name: m.name, count: mc.length, revenue };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    return perf;
  }, [periodClosedComandas, activeBarbers]);

  const maxBarberRevenue = barberPerformance.length > 0 ? barberPerformance[0].revenue : 1;

  // Upcoming Recurring Expenses
  const upcomingExpenses = useMemo(() => {
    const todayDate = now.getDate();
    return recurringExpenses
      .filter(e => {
        if (e.status !== 'active') return false;
        if (e.lastPaidAt) {
          const paid = new Date(e.lastPaidAt);
          if (paid.getMonth() === currentMonth && paid.getFullYear() === currentYear) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aOverdue = a.dueDay < todayDate ? 0 : 1;
        const bOverdue = b.dueDay < todayDate ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return a.dueDay - b.dueDay;
      })
      .slice(0, 5);
  }, [recurringExpenses, currentMonth, currentYear, now]);

  // Birthdays
  const birthdays = useMemo(() => {
    const teamBirthdays = members
      .filter(m => m.birthday && new Date(m.birthday).getMonth() === currentMonth)
      .map(m => ({ id: m.id, name: m.name, company: 'Equipe', birthday: m.birthday!, isTeamMember: true }));
    const clientBirthdays = clients
      .filter(c => c.birthday && new Date(c.birthday).getMonth() === currentMonth)
      .map(c => ({ id: c.id, name: c.name, company: c.company || 'Cliente', birthday: c.birthday!, isTeamMember: false }));
    return [...teamBirthdays, ...clientBirthdays].sort((a, b) =>
      new Date(a.birthday).getDate() - new Date(b.birthday).getDate()
    );
  }, [members, clients, currentMonth]);

  // Total Bank Balance
  const totalBankBalance = useMemo(() =>
    bankAccounts.filter(a => !a.archived).reduce((acc, a) => acc + (a.balance || 0), 0),
    [bankAccounts]);

  // Quick Actions (barbershop-focused)
  const quickActions = [
    { label: 'Nova Comanda', icon: ClipboardList, path: '/comanda', color: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Novo Cliente', icon: UserPlus, path: '/clients', color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Agendar', icon: CalendarCheck, path: '/agenda', color: 'text-violet-500 bg-violet-500/10' },
    { label: 'Financeiro', icon: DollarSign, path: '/finance', color: 'text-amber-500 bg-amber-500/10', adminOnly: true },
  ].filter(a => !a.adminOnly || isAdminOrManager);

  // ===== RENDER =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Period label for headers
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const periodLabel = selectedDay !== null
    ? `${selectedDay}/${selectedMonth + 1}`
    : monthNames[selectedMonth];

  const handlePrevMonth = () => {
    setSelectedDay(null);
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    setSelectedDay(null);
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  return (
    <div className="pb-16 md:pb-0 animate-in fade-in duration-300 dashboard-wrapper">

      {/* Page Title + Month Selector */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visão geral do seu negócio.</p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg px-2 py-1.5">
          <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-dark transition-colors">
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-white min-w-[120px] text-center">
            {monthNames[selectedMonth]} {selectedYear}
          </span>
          <button onClick={handleNextMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-dark transition-colors">
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* ===== MASTER 2-COLUMN GRID (Aniq UI layout) ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* ===== LEFT COLUMN (8/12) ===== */}
        <div className="xl:col-span-8 space-y-5">

          {/* Hero Header (enterprise premium) */}
          <div className="hero-header bg-white dark:bg-dark-surface">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left: greeting + clock */}
              <div>
                <h1 className="hero-title text-slate-900 dark:text-white">
                  {currentUser
                    ? `Que bom ver você, ${currentUser.name.split(' ')[0]}!`
                    : 'Dashboard'}
                </h1>
                <p className="hero-subtitle text-slate-400 dark:text-slate-400 mt-2">
                  Pronto pra mais um dia produtivo?
                </p>
                <p className="hero-clock text-slate-900 dark:text-white mt-4">
                  {clockTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  <span className="hero-clock-suffix text-slate-400 dark:text-white/80">{clockTime.getHours() >= 12 ? 'PM' : 'AM'}</span>
                </p>
              </div>
              {/* Right: weather (no card, just content) */}
              {weather ? (
                <div className="text-right weather-glow">
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-4xl">{weather.icon}</span>
                    <span className="text-5xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">{weather.temperature}°C</span>
                  </div>
                  <p className="relative z-10 hero-weather-line text-slate-400 dark:text-slate-400 mt-1">{weather.description}</p>
                  <p className="relative z-10 hero-weather-line text-slate-400 dark:text-slate-400 mt-0.5 flex items-center justify-end gap-1">
                    <MapPin size={11} /> {weather.cityName}
                  </p>
                  <p className="relative z-10 hero-weather-line text-slate-400 dark:text-slate-400 mt-0.5 capitalize">
                    {clockTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="hero-weather-line text-slate-400 capitalize">
                    {clockTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`Faturamento (${periodLabel})`}
              value={formatCurrency(periodRevenue)}
              trend={Math.abs(Math.round(revenueChange))}
              trendDirection={revenueChange >= 0 ? 'up' : 'down'}
              Icon={DollarSign}
              subtitle={prevPeriodRevenue > 0 ? `vs. ${formatCurrency(prevPeriodRevenue)} anterior` : undefined}
            />
            <StatCard
              label={`Atendimentos (${periodLabel})`}
              value={periodAtendimentos.toString()}
              trend={Math.abs(Math.round(atendimentosChange))}
              trendDirection={atendimentosChange >= 0 ? 'up' : 'down'}
              Icon={Scissors}
              color="text-violet-500"
              bgIconColor="bg-violet-50 dark:bg-violet-500/10"
              subtitle={periodClosedComandas.length > 0 ? `${periodClosedComandas.length} finalizado${periodClosedComandas.length > 1 ? 's' : ''}` : undefined}
            />
            <StatCard
              label="Ticket Médio"
              value={formatCurrency(ticketMedio)}
              trend={Math.abs(Math.round(ticketChange))}
              trendDirection={ticketChange >= 0 ? 'up' : 'down'}
              Icon={TrendingUp}
              color="text-amber-500"
              bgIconColor="bg-amber-50 dark:bg-amber-500/10"
            />
            <div className="dash-card bg-white dark:bg-dark-surface p-4 flex flex-col h-full">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Comandas Abertas</p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{openComandas}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">em atendimento agora</p>
                </div>
                <ClipboardList size={20} className={`${openComandas > 0 ? 'text-emerald-500' : 'text-slate-400'} opacity-60`} />
              </div>
              {openComandas > 0 && (
                <button onClick={() => navigate('/comanda')} className="mt-auto pt-2.5 text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  Ver comandas <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ===== QUICK TASKS + MINI CALENDAR (Aniq style) ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Tasks */}
            <div className="dash-card bg-white dark:bg-dark-surface p-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Zap size={18} className="text-primary" /> Ações Rápidas
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {quickActions.map(action => (
                  <button key={action.label} onClick={() => navigate(action.path)}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-dark border border-slate-100 dark:border-dark-border rounded-xl hover:shadow-md transition-all group">
                    <div className={`p-2 rounded-lg ${action.color}`}><action.icon size={18} /></div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
              {/* Inline mini KPIs */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-dark-border">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/5">
                  <UserPlus size={14} className="text-blue-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Novos Clientes</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white ml-auto">{newClientsCount}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 dark:bg-red-500/5">
                  <AlertTriangle size={14} className={atRiskClients > 0 ? 'text-red-500' : 'text-slate-400'} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Em Risco</span>
                  <span className={`text-xs font-bold ml-auto ${atRiskClients > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>{atRiskClients}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-50/50 dark:bg-violet-500/5">
                  <Crown size={14} className="text-violet-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Assinantes</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white ml-auto">{activeSubscribers}</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-500/5">
                  <Package size={14} className={lowStockProducts.length > 0 ? 'text-amber-500' : 'text-slate-400'} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Estoque Baixo</span>
                  <span className={`text-xs font-bold ml-auto ${lowStockProducts.length > 0 ? 'text-amber-500' : 'text-slate-800 dark:text-white'}`}>{lowStockProducts.length}</span>
                </div>
              </div>
            </div>

            {/* Mini Calendar — day filter synced with month selector */}
            <div className="dash-card bg-white dark:bg-dark-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-primary" /> {monthNames[selectedMonth]}
                </h2>
                {selectedDay !== null && (
                  <button onClick={() => setSelectedDay(null)}
                    className="text-[10px] text-primary font-semibold hover:underline">
                    Ver mês todo
                  </button>
                )}
              </div>
              {(() => {
                const calYear = selectedYear;
                const calMonth = selectedMonth;
                const firstDay = new Date(calYear, calMonth, 1).getDay();
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const dayNames = ['Do', 'Se', 'Te', 'Qa', 'Qi', 'Se', 'Sa'];
                const todayDate = now.getDate();
                const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear();
                const eventDays = new Set(
                  events
                    .filter(e => e.month === calMonth && e.year === calYear)
                    .map(e => e.date)
                );
                return (
                  <div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {dayNames.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const isSelected = selectedDay === day;
                        const isToday = isCurrentMonth && day === todayDate;
                        const hasEvent = eventDays.has(day);
                        const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;
                        return (
                          <button key={day}
                            onClick={() => setSelectedDay(isSelected ? null : day)}
                            className={`relative text-center py-2 rounded-lg text-xs font-semibold transition-all ${isSelected
                              ? 'bg-primary text-white shadow-sm'
                              : isToday
                                ? 'ring-1 ring-primary text-primary font-bold hover:bg-primary/10'
                                : isWeekend
                                  ? 'text-primary/70 dark:text-primary/50 hover:bg-slate-50 dark:hover:bg-dark'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark'
                              }`}>
                            {day}
                            {hasEvent && !isSelected && (
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Cash Flow Chart */}
          {isAdminOrManager && (
            <div className="dash-card bg-white dark:bg-dark-surface p-6 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Fluxo de Caixa — {currentYear}</h2>
                <button onClick={() => navigate('/relatorios')} className="text-sm text-primary hover:text-primary-600 font-medium flex items-center gap-1">
                  Relatórios <ChevronRight size={14} />
                </button>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00bf62" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#00bf62" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`R$ ${(value * 1000).toLocaleString('pt-BR')}`, '']}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#00bf62" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" name="Receita" />
                    <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesa)" name="Despesa" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Performance por Barbeiro */}
          <div className="dash-card bg-white dark:bg-dark-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Target size={20} className="text-primary" /> Performance ({periodLabel})
              </h2>
              <button onClick={() => navigate('/relatorios')} className="text-sm text-primary hover:text-primary-600 font-medium flex items-center gap-1">
                Ver detalhado <ChevronRight size={14} />
              </button>
            </div>
            {barberPerformance.length > 0 ? (
              <div className="space-y-3">
                {barberPerformance.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-dark text-slate-400'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{b.name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-slate-400">{b.count} atend.</span>
                          <span className="text-sm font-bold text-emerald-500">{formatCurrency(b.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(b.revenue / maxBarberRevenue) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Scissors size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum atendimento finalizado no período.</p>
              </div>
            )}
          </div>
        </div>  {/* end left column xl:col-span-8 */}

        {/* ===== RIGHT COLUMN (4/12) ===== */}
        <div className="xl:col-span-4 space-y-6">

          {/* Insights Card (Aniq style — 3 concentric rings + toggle) */}
          {isAdminOrManager && (() => {
            const subscriberClientIds = new Set(
              subscriptions.filter(s => s.status === 'active').map(s => s.clientId)
            );
            const closedInPeriod = filteredComandas.filter(c => c.status === 'closed' && inPeriod(c.closedAt || c.openedAt));
            const subComandas = closedInPeriod.filter(c => c.clientId && subscriberClientIds.has(c.clientId));
            const avulsoComandas = closedInPeriod.filter(c => !c.clientId || !subscriberClientIds.has(c.clientId));
            const totalRevenue = closedInPeriod.reduce((a, c) => a + c.finalAmount, 0);
            const totalCount = closedInPeriod.length;
            const totalTicket = totalCount > 0 ? totalRevenue / totalCount : 0;
            const isAssinantes = insightsTab === 'assinantes';
            const groupComandas = isAssinantes ? subComandas : avulsoComandas;
            const groupRevenue = groupComandas.reduce((a, c) => a + c.finalAmount, 0);
            const groupCount = groupComandas.length;
            const groupTicket = groupCount > 0 ? groupRevenue / groupCount : 0;
            const receitaPct = totalRevenue > 0 ? Math.round((groupRevenue / totalRevenue) * 100) : 0;
            const atendPct = totalCount > 0 ? Math.round((groupCount / totalCount) * 100) : 0;
            const ticketPct = totalTicket > 0 ? Math.min(Math.round((groupTicket / totalTicket) * 100), 100) : 0;
            const RingEl = ({ pct, radius, color, sw = 10 }: { pct: number; radius: number; color: string; sw?: number }) => {
              const circ = 2 * Math.PI * radius;
              const off = circ - (pct / 100) * circ;
              return (
                <>
                  <circle cx="75" cy="75" r={radius} fill="none" stroke="currentColor" strokeWidth={sw}
                    className="text-slate-200 dark:text-slate-700/50" />
                  <circle cx="75" cy="75" r={radius} fill="none" stroke={color} strokeWidth={sw}
                    strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
                    transform="rotate(-90 75 75)" className="transition-all duration-700" />
                </>
              );
            };
            return (
              <div className="dash-card bg-white dark:bg-dark-surface p-5">
                <h2 className="text-base font-bold text-slate-800 dark:text-white mb-0.5">Insights</h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">Performance analytics</p>
                {/* Toggle with sliding indicator */}
                <div className="relative flex bg-slate-100 dark:bg-dark rounded-lg p-1 mb-4">
                  <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-dark-surface rounded-md shadow-sm transition-transform duration-300 ease-out ${insightsTab === 'avulsos' ? 'translate-x-[calc(100%+8px)]' : 'translate-x-0'}`} />
                  <button onClick={() => setInsightsTab('assinantes')}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-200 ${insightsTab === 'assinantes' ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Crown size={12} /> Assinantes
                  </button>
                  <button onClick={() => setInsightsTab('avulsos')}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-200 ${insightsTab === 'avulsos' ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Users size={12} /> Avulsos
                  </button>
                </div>
                {/* Rings + Metrics — rings animate via stroke transition */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <svg width="150" height="150" viewBox="0 0 150 150">
                      <RingEl pct={receitaPct} radius={64} color="#10b981" sw={10} />
                      <RingEl pct={atendPct} radius={49} color="#3b82f6" sw={9} />
                      <RingEl pct={ticketPct} radius={36} color="#6b7280" sw={7} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-extrabold text-slate-800 dark:text-white">{receitaPct}%</span>
                      <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider">receita</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3.5 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-emerald-500/10 rounded shrink-0"><TrendingUp size={13} className="text-emerald-500" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-white truncate">Receita</span>
                          <span className="text-[11px] font-extrabold text-emerald-500">{receitaPct}%</span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">do faturamento total</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-blue-500/10 rounded shrink-0"><CalendarCheck size={13} className="text-blue-500" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-white truncate">Atendimentos</span>
                          <span className="text-[11px] font-extrabold text-blue-500">{atendPct}%</span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">das comandas no período</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-slate-500/10 rounded shrink-0"><Target size={13} className="text-slate-500" /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-white truncate">Ticket Médio</span>
                          <span className="text-[11px] font-extrabold text-slate-500">{ticketPct}%</span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">vs ticket geral</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Revenue Analytics (Aniq style) */}
          {isAdminOrManager && (() => {
            const serviceRev = filteredComandas
              .filter(c => c.status === 'closed' && inPeriod(c.closedAt || c.openedAt))
              .reduce((acc, c) => {
                const sItems = (c.items || []).filter(i => i.type === 'service');
                return acc + sItems.reduce((s, i) => s + i.totalPrice, 0);
              }, 0);
            const productRev = filteredComandas
              .filter(c => c.status === 'closed' && inPeriod(c.closedAt || c.openedAt))
              .reduce((acc, c) => {
                const pItems = (c.items || []).filter(i => i.type === 'product');
                return acc + pItems.reduce((s, i) => s + i.totalPrice, 0);
              }, 0);
            const subRev = mrr;
            const maxRev = Math.max(serviceRev, productRev, subRev, 1);
            const categories = [
              { label: 'Serviços', value: serviceRev, color: 'bg-primary' },
              { label: 'Produtos', value: productRev, color: 'bg-amber-500' },
              { label: 'Assinaturas', value: subRev, color: 'bg-violet-500' },
            ];
            const totalRev = serviceRev + productRev + subRev;
            return (
              <div className="dash-card bg-white dark:bg-dark-surface p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Receita por Categoria</h2>
                    <p className="text-xs text-slate-400">Distribuição no período</p>
                  </div>
                </div>
                <div className="space-y-3 mb-4">
                  {categories.map(cat => (
                    <div key={cat.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">{cat.label}</span>
                        <span className="font-bold text-slate-700 dark:text-white">{formatCurrency(cat.value)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-dark rounded-full overflow-hidden">
                        <div className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                          style={{ width: `${(cat.value / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-dark-border">
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{formatCurrency(totalRev)}</p>
                    <p className="text-[10px] text-slate-400">Total Receita</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary">{totalRev > 0 ? `${Math.round((serviceRev / totalRev) * 100)}%` : '0%'}</p>
                    <p className="text-[10px] text-slate-400">Serviços</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{activeSubscribers}</p>
                    <p className="text-[10px] text-slate-400">Assinantes</p>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="dash-card bg-white dark:bg-dark-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Próximos Agendamentos</h2>
              <button onClick={() => navigate('/agenda')} className="text-sm text-primary hover:text-primary-600 font-medium flex items-center gap-1">
                Agenda <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {upcomingAppointments.length > 0 ? upcomingAppointments.map(event => {
                const eventDate = new Date(event.year, event.month, event.date);
                const isToday = eventDate.toDateString() === now.toDateString();
                return (
                  <div key={event.id} onClick={() => navigate('/agenda')}
                    className="flex gap-3 p-3 rounded-lg border border-slate-100 dark:border-dark-border hover:border-primary/50 transition-colors cursor-pointer">
                    <div className={`flex flex-col items-center min-w-[44px] p-1.5 rounded-lg ${isToday ? 'bg-primary/10 text-primary' : 'bg-slate-50 dark:bg-dark text-slate-500'}`}>
                      <span className="text-[9px] font-bold uppercase">{eventDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                      <span className="text-lg font-bold leading-none">{event.date}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-white truncate">{event.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock size={12} />
                        {event.startTime} — {event.endTime}
                      </div>
                      {event.client && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                          <Users size={10} /> {event.client}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-dark-border rounded-xl">
                  <Calendar size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-400">Nenhum agendamento futuro.</p>
                  <button onClick={() => navigate('/agenda')} className="mt-2 text-primary font-medium text-xs hover:underline">Agendar agora</button>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Bills */}
          {isAdminOrManager && (
            <div className="dash-card bg-white dark:bg-dark-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Próximas Contas</h2>
                <button onClick={() => navigate('/contas-pagar')} className="text-sm text-primary hover:text-primary-600 font-medium flex items-center gap-1">
                  Ver todas <ChevronRight size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {upcomingExpenses.length > 0 ? upcomingExpenses.map(expense => {
                  const isOverdue = expense.dueDay < now.getDate();
                  return (
                    <div key={expense.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5' : 'border-slate-100 dark:border-dark-border'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{expense.name}</p>
                        <p className="text-[10px] text-slate-400">Dia {expense.dueDay}{isOverdue ? ' • Atrasada' : ''}</p>
                      </div>
                      <span className={`text-sm font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>-{formatCurrency(expense.amount)}</span>
                    </div>
                  );
                }) : (
                  <div className="text-center py-4 text-slate-400 text-sm">Nenhuma conta pendente</div>
                )}
              </div>
            </div>
          )}

          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <div className="dash-card bg-white dark:bg-dark-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" /> Estoque Baixo
                </h2>
                <button onClick={() => navigate('/products')} className="text-sm text-primary hover:text-primary-600 font-medium flex items-center gap-1">
                  Estoque <ChevronRight size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border last:border-0">
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(p.stock ?? 0) <= 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {(p.stock ?? 0) <= 0 ? 'Esgotado' : `${p.stock} un.`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Birthdays */}
          <div className="bg-primary dark:bg-primary-700 p-6 rounded-xl shadow-md text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Cake size={100} /></div>
            <div className="relative z-10">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Cake size={20} /> Aniversariantes</h2>
              <div className="space-y-3">
                {birthdays.length > 0 ? birthdays.slice(0, 3).map(person => (
                  <div key={person.id} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center font-bold text-xs">{person.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-xs truncate">{person.name}</p></div>
                    <div className="text-xs font-bold">{new Date(person.birthday).getDate()}/{currentMonth + 1}</div>
                  </div>
                )) : <div className="text-sm opacity-90">Ninguém este mês</div>}
              </div>
            </div>
          </div>

          {/* Bank Balance Summary (Admin) */}
          {isAdminOrManager && (
            <div className="dash-card bg-white dark:bg-dark-surface p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-500"><Wallet size={20} /></div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo Bancário Total</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(totalBankBalance)}</p>
                  <p className="text-[10px] text-slate-400">{bankAccounts.filter(a => !a.archived).length} conta{bankAccounts.filter(a => !a.archived).length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};