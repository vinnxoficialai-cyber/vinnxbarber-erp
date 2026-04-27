import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Loader2, RefreshCw, BarChart3, Send, Zap, Calendar, Clock, Users
} from 'lucide-react';
import type { PushCampaign, PushAutomationConfig, PushLogEntry, TeamMember } from '../types';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { useFilteredData } from '../hooks/useFilteredData';
import { DashboardTab } from '../components/notificacoes/DashboardTab';
import { ComposerTab } from '../components/notificacoes/ComposerTab';
import { AutomationsTab } from '../components/notificacoes/AutomationsTab';
import { CampaignsTab } from '../components/notificacoes/CampaignsTab';
import { HistoryTab } from '../components/notificacoes/HistoryTab';
import { SubscribersTab } from '../components/notificacoes/SubscribersTab';

interface NotificacoesProps { isDarkMode: boolean; currentUser: TeamMember; }
type PageTab = 'dashboard' | 'composer' | 'automations' | 'campaigns' | 'history' | 'subscribers';

const TABS: { key: PageTab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'composer', label: 'Compor', icon: Send },
  { key: 'automations', label: 'Automações', icon: Zap },
  { key: 'campaigns', label: 'Campanhas', icon: Calendar },
  { key: 'history', label: 'Histórico', icon: Clock },
  { key: 'subscribers', label: 'Inscritos', icon: Users },
];

export const Notificacoes: React.FC<NotificacoesProps> = ({ isDarkMode, currentUser }) => {
  const { filteredClients: clients, filteredMembers: members } = useFilteredData();
  const confirm = useConfirm();
  const toast = useToast();

  // Theme tokens (same as Assinaturas.tsx)
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
  const shadowClass = isDarkMode ? '' : 'shadow-sm';
  const inputCls = `w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`;
  const labelCls = `block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`;

  const [activeTab, setActiveTab] = useState<PageTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<PushAutomationConfig[]>([]);
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [logs, setLogs] = useState<PushLogEntry[]>([]);
  const [subsCount, setSubsCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [autoRes, campRes, logRes, subsRes] = await Promise.all([
        supabase.from('push_automation_config').select('*'),
        supabase.from('push_campaigns').select('*').order('createdAt', { ascending: false }).limit(50),
        supabase.from('push_log').select('*').order('createdAt', { ascending: false }).limit(200),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      ]);
      setAutomations(autoRes.data || []);
      setCampaigns(campRes.data || []);
      setLogs(logRes.data || []);
      setSubsCount(subsRes.count || 0);
    } catch (e) {
      console.error('[Notificacoes] load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Shared theme props for sub-components
  const theme = { isDarkMode, textMain, textSub, bgCard, borderCol, bgInput, shadowClass, inputCls, labelCls };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
            <Bell size={24} className="text-primary" /> Notificações
          </h1>
          <p className={`${textSub} text-sm`}>Campanhas, automações e engajamento por push.</p>
        </div>
        <button onClick={load} className={`p-2 rounded-lg border ${borderCol} ${textSub} hover:text-primary transition-colors`}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-6 p-1 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} max-w-full overflow-x-auto`}>
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? `${bgCard} ${textMain} shadow-sm`
                  : `${textSub} hover:${textMain}`
              }`}>
              <TabIcon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab {...theme} logs={logs} subsCount={subsCount} automations={automations} onTabChange={setActiveTab} />
      )}
      {activeTab === 'composer' && (
        <ComposerTab {...theme} clients={clients} currentUser={currentUser} toast={toast} onReload={load} />
      )}
      {activeTab === 'automations' && (
        <AutomationsTab {...theme} automations={automations} setAutomations={setAutomations} toast={toast} />
      )}
      {activeTab === 'campaigns' && (
        <CampaignsTab {...theme} campaigns={campaigns} members={members} confirm={confirm} toast={toast} onReload={load} onEdit={() => setActiveTab('composer')} />
      )}
      {activeTab === 'history' && (
        <HistoryTab {...theme} logs={logs} clients={clients} />
      )}
      {activeTab === 'subscribers' && (
        <SubscribersTab {...theme} clients={clients} toast={toast} confirm={confirm} onReload={load} />
      )}
    </div>
  );
};
