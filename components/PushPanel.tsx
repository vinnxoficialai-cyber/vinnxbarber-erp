import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Send, Smartphone, ToggleLeft, ToggleRight, RefreshCw,
  MessageSquare, Loader2, Check, X, Clock, Users, Image as ImageIcon,
  Calendar, ChevronDown, ChevronUp, Trash2, Eye
} from 'lucide-react';
import type { PushAutomationConfig, PushCampaign, PushLogEntry } from '../types';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════
// Push Notifications Admin Panel
// ═══════════════════════════════════════════

interface PushPanelProps {
  isDarkMode: boolean;
  textMain: string;
  textSub: string;
  bgInput: string;
  borderCol: string;
}

const AUTOMATION_LABELS: Record<string, { title: string; icon: React.ReactNode; desc: string }> = {
  reminder: { title: 'Lembrete de Agendamento', icon: <Clock size={16} />, desc: 'Notifica o cliente X horas antes do horário' },
  review: { title: 'Pedir Avaliação', icon: <MessageSquare size={16} />, desc: 'Pede avaliação após o serviço concluído' },
  incomplete: { title: 'Cadastro Incompleto', icon: <Users size={16} />, desc: 'Nudge periódico para completar o perfil' },
  birthday: { title: 'Aniversário', icon: <Calendar size={16} />, desc: 'Parabéns + desconto no aniversário do cliente' },
};

export function PushPanel({ isDarkMode, textMain, textSub, bgInput, borderCol }: PushPanelProps) {
  const cardBg = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const accentGreen = '#10b981';

  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<PushAutomationConfig[]>([]);
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [logs, setLogs] = useState<PushLogEntry[]>([]);
  const [subsCount, setSubsCount] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Campaign composer state
  const [compTitle, setCompTitle] = useState('');
  const [compBody, setCompBody] = useState('');
  const [compImage, setCompImage] = useState('');
  const [compSegment, setCompSegment] = useState('all');
  const [compSchedule, setCompSchedule] = useState('now');
  const [compScheduleAt, setCompScheduleAt] = useState('');
  const [compRecurrence, setCompRecurrence] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [autoRes, campRes, logRes, subsRes] = await Promise.all([
        supabase.from('push_automation_config').select('*'),
        supabase.from('push_campaigns').select('*').order('createdAt', { ascending: false }).limit(20),
        supabase.from('push_log').select('*').order('createdAt', { ascending: false }).limit(50),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      ]);
      setAutomations(autoRes.data || []);
      setCampaigns(campRes.data || []);
      setLogs(logRes.data || []);
      setSubsCount(subsRes.count || 0);
    } catch (e) {
      console.error('[PushPanel] load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAutomation = async (id: string, enabled: boolean) => {
    setSaving(id);
    await supabase.from('push_automation_config').update({ enabled, updatedAt: new Date().toISOString() }).eq('id', id);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled } : a));
    setSaving(null);
  };

  const updateAutomationConfig = async (id: string, config: Record<string, unknown>, messageTemplate: string) => {
    setSaving(id);
    await supabase.from('push_automation_config').update({ config, messageTemplate, updatedAt: new Date().toISOString() }).eq('id', id);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, config, messageTemplate } : a));
    setSaving(null);
  };

  const handleSendCampaign = async () => {
    if (!compTitle.trim()) return;
    setSending(true);

    try {
      if (compSchedule === 'now') {
        // Send immediately via API
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch('/api/push-broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: compTitle, body: compBody, image: compImage || undefined }),
        });
        const data = await res.json();
        if (res.ok) {
          alert(`✅ Enviado! ${data.sent} sucesso, ${data.failed} falhas`);
        } else {
          alert(`❌ Erro: ${data.error}`);
        }
      } else {
        // Save as scheduled/recurring campaign
        const status = compRecurrence ? 'recurring' : 'scheduled';
        await supabase.from('push_campaigns').insert({
          type: 'campaign',
          title: compTitle,
          body: compBody,
          imageUrl: compImage || null,
          segment: compSegment,
          recurrence: compRecurrence || null,
          scheduledAt: compSchedule === 'scheduled' ? compScheduleAt : null,
          status,
          enabled: true,
        });
        alert(`✅ Campanha ${status === 'recurring' ? 'recorrente' : 'agendada'} criada!`);
      }

      setCompTitle(''); setCompBody(''); setCompImage(''); setCompSchedule('now');
      setShowComposer(false);
      load();
    } catch (e: any) {
      alert('❌ Erro: ' + e.message);
    }
    setSending(false);
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Deletar esta campanha?')) return;
    await supabase.from('push_campaigns').delete().eq('id', id);
    load();
  };

  if (loading) {
    return (
      <div className={`border-t ${borderCol} pt-6 mt-6`}>
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-emerald-500" />
          <span className={textSub}>Carregando Push Notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-t ${borderCol} pt-6 mt-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${textMain} flex items-center gap-2`}>
          <Smartphone size={16} style={{ color: accentGreen }} /> Push Notifications
        </h3>
        <button onClick={load} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${textSub}`}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-3 text-center`}>
          <p className="text-2xl font-bold" style={{ color: accentGreen }}>{subsCount}</p>
          <p className={`text-xs ${textSub}`}>Inscritos</p>
        </div>
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-3 text-center`}>
          <p className="text-2xl font-bold" style={{ color: accentGreen }}>
            {logs.filter(l => l.status === 'sent').length}
          </p>
          <p className={`text-xs ${textSub}`}>Enviados (recentes)</p>
        </div>
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-3 text-center`}>
          <p className="text-2xl font-bold text-red-500">
            {logs.filter(l => l.status === 'failed').length}
          </p>
          <p className={`text-xs ${textSub}`}>Falhas</p>
        </div>
      </div>

      {/* Automations */}
      <h4 className={`text-xs font-semibold ${textSub} uppercase tracking-wider mb-3`}>Automações</h4>
      <div className="space-y-2 mb-5">
        {automations.map(auto => {
          const label = AUTOMATION_LABELS[auto.id];
          if (!label) return null;
          return (
            <AutomationRow
              key={auto.id}
              auto={auto}
              label={label}
              saving={saving === auto.id}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              cardBorder={cardBorder}
              textMain={textMain}
              textSub={textSub}
              bgInput={bgInput}
              borderCol={borderCol}
              onToggle={(enabled) => toggleAutomation(auto.id, enabled)}
              onSave={(config, template) => updateAutomationConfig(auto.id, config, template)}
            />
          );
        })}
      </div>

      {/* Quick Send */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all"
          style={{ background: `linear-gradient(135deg, ${accentGreen}, #059669)` }}
        >
          <Send size={14} /> {showComposer ? 'Fechar Composer' : 'Nova Campanha'}
        </button>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${cardBorder} ${textMain}`}
        >
          <Eye size={14} /> {showLogs ? 'Ocultar Histórico' : 'Ver Histórico'}
        </button>
      </div>

      {/* Composer */}
      {showComposer && (
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-4 mb-4`}>
          <h4 className={`text-sm font-semibold ${textMain} mb-3`}>Compor Notificação</h4>
          <div className="space-y-3">
            <input
              value={compTitle}
              onChange={e => setCompTitle(e.target.value)}
              placeholder="Título da notificação"
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
            />
            <textarea
              value={compBody}
              onChange={e => setCompBody(e.target.value)}
              placeholder="Corpo da mensagem..."
              rows={3}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none resize-none`}
            />
            <input
              value={compImage}
              onChange={e => setCompImage(e.target.value)}
              placeholder="URL da imagem (opcional)"
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-emerald-500 outline-none`}
            />

            {/* Schedule options */}
            <div className="flex flex-wrap gap-2">
              {[
                { v: 'now', l: '📤 Enviar Agora' },
                { v: 'scheduled', l: '⏰ Agendar' },
                { v: 'recurring', l: '🔄 Recorrente' },
              ].map(o => (
                <button
                  key={o.v}
                  onClick={() => setCompSchedule(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    compSchedule === o.v
                      ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                      : `${borderCol} ${textSub}`
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {compSchedule === 'scheduled' && (
              <input
                type="datetime-local"
                value={compScheduleAt}
                onChange={e => setCompScheduleAt(e.target.value)}
                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain}`}
              />
            )}

            {compSchedule === 'recurring' && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'weekly:1', l: 'Segunda' }, { v: 'weekly:2', l: 'Terça' },
                  { v: 'weekly:3', l: 'Quarta' }, { v: 'weekly:4', l: 'Quinta' },
                  { v: 'weekly:5', l: 'Sexta' }, { v: 'weekly:6', l: 'Sábado' },
                  { v: 'monthly:1', l: 'Dia 1' }, { v: 'monthly:15', l: 'Dia 15' },
                ].map(r => (
                  <button
                    key={r.v}
                    onClick={() => setCompRecurrence(r.v)}
                    className={`px-2 py-1 rounded text-xs border transition-all ${
                      compRecurrence === r.v
                        ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                        : `${borderCol} ${textSub}`
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleSendCampaign}
              disabled={!compTitle.trim() || sending}
              className="w-full py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-50 transition-all"
              style={{ background: `linear-gradient(135deg, ${accentGreen}, #059669)` }}
            >
              {sending ? <Loader2 size={16} className="mx-auto animate-spin" /> :
                compSchedule === 'now' ? '📤 Enviar Agora' :
                compSchedule === 'scheduled' ? '⏰ Agendar Envio' : '🔄 Criar Recorrência'}
            </button>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length > 0 && (
        <div className="mb-4">
          <h4 className={`text-xs font-semibold ${textSub} uppercase tracking-wider mb-2`}>Campanhas</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {campaigns.map(c => (
              <div key={c.id} className={`${cardBg} border ${cardBorder} rounded-lg p-3 flex items-center justify-between`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${textMain} truncate`}>{c.title}</p>
                  <p className={`text-xs ${textSub}`}>
                    {c.status === 'sent' ? `✅ Enviado ${c.sentCount}` :
                     c.status === 'scheduled' ? `⏰ ${new Date(c.scheduledAt!).toLocaleString('pt-BR')}` :
                     c.status === 'recurring' ? `🔄 ${c.recurrence}` :
                     `📝 ${c.status}`}
                  </p>
                </div>
                <button onClick={() => deleteCampaign(c.id)} className="p-1.5 text-red-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {showLogs && (
        <div>
          <h4 className={`text-xs font-semibold ${textSub} uppercase tracking-wider mb-2`}>Histórico de Envios</h4>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.length === 0 && <p className={`text-xs ${textSub}`}>Nenhum envio registrado</p>}
            {logs.map(l => (
              <div key={l.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <span className={`w-2 h-2 rounded-full ${l.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className={`text-xs font-medium ${textMain} truncate flex-1`}>{l.title}</span>
                <span className={`text-[10px] ${textSub}`}>{l.type}</span>
                <span className={`text-[10px] ${textSub}`}>
                  {l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Automation Row Component
// ═══════════════════════════════════════════

function AutomationRow({
  auto, label, saving, isDarkMode, cardBg, cardBorder, textMain, textSub, bgInput, borderCol,
  onToggle, onSave
}: {
  key?: React.Key;
  auto: PushAutomationConfig;
  label: { title: string; icon: React.ReactNode; desc: string };
  saving: boolean;
  isDarkMode: boolean;
  cardBg: string; cardBorder: string; textMain: string; textSub: string; bgInput: string; borderCol: string;
  onToggle: (enabled: boolean) => void;
  onSave: (config: Record<string, unknown>, template: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [template, setTemplate] = useState(auto.messageTemplate);
  const [configStr, setConfigStr] = useState(JSON.stringify(auto.config, null, 2));

  return (
    <div className={`${cardBg} border ${cardBorder} rounded-xl overflow-hidden`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-emerald-500">{label.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textMain}`}>{label.title}</p>
          <p className={`text-xs ${textSub} truncate`}>{label.desc}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!auto.enabled); }}
          className="shrink-0"
        >
          {saving ? <Loader2 size={20} className="animate-spin text-emerald-500" /> :
            auto.enabled ?
              <ToggleRight size={24} className="text-emerald-500" /> :
              <ToggleLeft size={24} className={textSub} />
          }
        </button>
        {expanded ? <ChevronUp size={14} className={textSub} /> : <ChevronDown size={14} className={textSub} />}
      </div>

      {expanded && (
        <div className={`border-t ${borderCol} p-3 space-y-3`}>
          <div>
            <label className={`text-xs font-medium ${textSub} block mb-1`}>Mensagem</label>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={2}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2 text-sm ${textMain} resize-none focus:ring-1 focus:ring-emerald-500 outline-none`}
            />
            <p className={`text-[10px] ${textSub} mt-1`}>Variáveis: {'{servico}'}, {'{hora}'}, {'{nome}'}, {'{desconto}'}</p>
          </div>
          <div>
            <label className={`text-xs font-medium ${textSub} block mb-1`}>Configuração (JSON)</label>
            <textarea
              value={configStr}
              onChange={e => setConfigStr(e.target.value)}
              rows={3}
              className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2 text-xs font-mono ${textMain} resize-none focus:ring-1 focus:ring-emerald-500 outline-none`}
            />
          </div>
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(configStr);
                onSave(parsed, template);
              } catch { alert('JSON inválido'); }
            }}
            className="px-4 py-1.5 rounded-lg text-white text-xs font-medium bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  );
}
