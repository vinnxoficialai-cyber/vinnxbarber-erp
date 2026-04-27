import React, { useMemo } from 'react';
import { Bell, Send, TrendingUp, AlertTriangle, Zap, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { PushAutomationConfig, PushLogEntry } from '../../types';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; shadowClass: string;
  logs: PushLogEntry[]; subsCount: number; automations: PushAutomationConfig[];
  onTabChange: (tab: string) => void;
  [k: string]: unknown;
}

const AUTO_LABELS: Record<string, { title: string; icon: React.ElementType }> = {
  reminder: { title: 'Lembretes', icon: Bell },
  review: { title: 'Avaliações', icon: Send },
  incomplete: { title: 'Cadastro', icon: Users },
  birthday: { title: 'Aniversário', icon: Zap },
  inactive: { title: 'Inativos', icon: AlertTriangle },
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export const DashboardTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, shadowClass, logs, subsCount, automations, onTabChange }) => {
  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), []);
  const recentLogs = useMemo(() => logs.filter(l => (l.createdAt || '') >= sevenDaysAgo), [logs, sevenDaysAgo]);
  const sentCount = recentLogs.filter(l => l.status === 'sent').length;
  const failedCount = recentLogs.filter(l => l.status === 'failed').length;
  const successRate = sentCount + failedCount > 0 ? Math.round((sentCount / (sentCount + failedCount)) * 100) : 100;

  // Bar chart: last 7 days
  const barData = useMemo(() => {
    const days: Record<string, { date: string; sent: number; failed: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      days[key] = { date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), sent: 0, failed: 0 };
    }
    recentLogs.forEach(l => {
      const key = (l.createdAt || '').split('T')[0];
      if (days[key]) { days[key][l.status === 'sent' ? 'sent' : 'failed']++; }
    });
    return Object.values(days);
  }, [recentLogs]);

  // Pie chart: by type
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => { map[l.type] = (map[l.type] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [logs]);

  const kpis = [
    { label: 'Inscritos', value: subsCount.toString(), icon: Users, color: 'text-primary' },
    { label: 'Enviados (7d)', value: sentCount.toString(), icon: Send, color: 'text-emerald-500' },
    { label: 'Taxa Sucesso', value: `${successRate}%`, icon: TrendingUp, color: successRate >= 90 ? 'text-emerald-500' : 'text-amber-500' },
    { label: 'Falhas (7d)', value: failedCount.toString(), icon: AlertTriangle, color: failedCount > 0 ? 'text-red-500' : 'text-slate-400' },
  ];

  const gridStroke = isDarkMode ? '#27272a' : '#e2e8f0';
  const tickFill = isDarkMode ? '#94a3b8' : '#64748b';
  const tooltipBg = isDarkMode ? '#18181b' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#27272a' : '#e2e8f0';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 flex items-center gap-3 ${shadowClass}`}>
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${kpi.color}`}><Icon size={18} /></div>
              <div><p className={`text-xs ${textSub}`}>{kpi.label}</p><p className={`font-bold ${textMain} text-lg`}>{kpi.value}</p></div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
          <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Send size={16} className="text-primary" /> Envios — Últimos 7 dias</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: tickFill, fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: tickFill, fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderRadius: '8px', border: `1px solid ${tooltipBorder}`, color: isDarkMode ? '#fff' : '#1e293b', fontSize: 12 }} />
                <Bar dataKey="sent" name="Enviados" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Falhas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
          <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Zap size={16} className="text-primary" /> Distribuição por Tipo</h3>
          {pieData.length === 0 ? (
            <div className={`h-56 flex items-center justify-center ${textSub}`}>Sem dados ainda</div>
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderRadius: '8px', border: `1px solid ${tooltipBorder}`, color: isDarkMode ? '#fff' : '#1e293b', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className={`text-xs ${textSub} flex-1`}>{d.name}</span>
                    <span className={`text-xs font-bold ${textMain}`}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Automations Status */}
      <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass}`}>
        <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Zap size={16} className="text-primary" /> Status das Automações</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {automations.map(a => {
            const meta = AUTO_LABELS[a.id];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={a.id} className={`p-3 rounded-xl border ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'} flex items-center gap-3`}>
                <div className={`p-2 rounded-lg ${a.enabled ? 'bg-emerald-500/10 text-emerald-500' : `${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} ${textSub}`}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className={`text-xs font-medium ${textMain}`}>{meta.title}</p>
                  <p className={`text-[10px] font-bold ${a.enabled ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {a.enabled ? '● Ativo' : '○ Desativado'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => onTabChange('composer')}
          className="px-4 py-3 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
          <Send size={16} /> Nova Campanha
        </button>
        <button onClick={() => onTabChange('automations')}
          className={`px-4 py-3 border ${borderCol} ${textMain} font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 hover:border-primary/50`}>
          <Zap size={16} /> Gerenciar Automações
        </button>
      </div>
    </div>
  );
};
