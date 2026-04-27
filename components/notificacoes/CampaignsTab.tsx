import React, { useState } from 'react';
import { Calendar, Trash2, Copy, Pause, Play, Send, Loader2, Filter } from 'lucide-react';
import type { PushCampaign, TeamMember } from '../../types';
import { supabase } from '../../lib/supabase';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; bgInput: string; shadowClass: string; inputCls: string;
  campaigns: PushCampaign[]; members: TeamMember[];
  confirm: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
  toast: { success: (t: string, m: string) => void; error: (t: string, m: string) => void };
  onReload: () => void; onEdit: () => void;
  [k: string]: unknown;
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  scheduled: { label: 'Agendada', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  recurring: { label: 'Recorrente', cls: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  sent: { label: 'Enviada', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  failed: { label: 'Falhou', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

export const CampaignsTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, bgInput, shadowClass, inputCls, campaigns, members, confirm, toast, onReload, onEdit }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = statusFilter === 'all' ? campaigns : campaigns.filter(c => c.status === statusFilter);

  const getCreatedByName = (id?: string) => {
    if (!id) return 'Sistema';
    const m = members.find(m => m.id === id);
    return m?.name || 'Sistema';
  };

  const handleDelete = async (c: PushCampaign) => {
    const ok = await confirm({ title: 'Excluir campanha', message: `Tem certeza que deseja excluir "${c.title}"?`, confirmText: 'Excluir', danger: true });
    if (!ok) return;
    setDeleting(c.id);
    const { error } = await supabase.from('push_campaigns').delete().eq('id', c.id);
    if (error) { toast.error('Erro', error.message); setDeleting(null); return; }
    toast.success('Excluída', 'Campanha removida');
    onReload();
    setDeleting(null);
  };

  const toggleEnabled = async (c: PushCampaign) => {
    const { error } = await supabase.from('push_campaigns').update({ enabled: !c.enabled, status: !c.enabled ? 'recurring' : 'draft' }).eq('id', c.id);
    if (error) { toast.error('Erro', error.message); return; }
    toast.success(c.enabled ? 'Pausada' : 'Ativada', c.title);
    onReload();
  };

  const duplicateCampaign = async (c: PushCampaign) => {
    const { id, sentCount, failedCount, sentAt, createdAt, ...rest } = c;
    const { error } = await supabase.from('push_campaigns').insert({ ...rest, title: `${c.title} (cópia)`, status: 'draft', sentCount: 0, failedCount: 0 });
    if (error) { toast.error('Erro', error.message); return; }
    toast.success('Duplicada', 'Campanha copiada como rascunho');
    onReload();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-primary" />
        {['all', 'draft', 'scheduled', 'recurring', 'sent', 'failed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
            {s === 'all' ? 'Todas' : STATUS_BADGES[s]?.label || s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={`p-12 text-center ${textSub}`}>
          <Calendar size={48} className="mx-auto mb-3 opacity-20" />
          <p>Nenhuma campanha {statusFilter !== 'all' ? `com status "${STATUS_BADGES[statusFilter]?.label}"` : 'criada'}.</p>
          <button onClick={onEdit} className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Send size={14} className="inline mr-1" /> Criar Campanha
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => {
              const badge = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
              return (
                <div key={c.id} className={`${bgCard} border ${borderCol} rounded-xl p-4 ${shadowClass}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold ${textMain} truncate`}>{c.title}</h4>
                      <p className={`text-xs ${textSub} truncate`}>{c.body}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ml-2 whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className={`flex items-center gap-3 text-[10px] ${textSub} mb-3`}>
                    <span>✓ {c.sentCount || 0} | ✗ {c.failedCount || 0}</span>
                    <span>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : ''}</span>
                    <span>{getCreatedByName(c.createdBy)}</span>
                  </div>
                  <div className="flex gap-2">
                    {(c.status === 'recurring' || c.status === 'scheduled') && (
                      <button onClick={() => toggleEnabled(c)} className={`p-2 rounded-lg border ${borderCol} ${textSub} hover:text-primary`}>
                        {c.enabled ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    <button onClick={() => duplicateCampaign(c)} className={`p-2 rounded-lg border ${borderCol} ${textSub} hover:text-primary`}><Copy size={14} /></button>
                    <button onClick={() => handleDelete(c)} disabled={deleting === c.id}
                      className={`p-2 rounded-lg border ${borderCol} text-red-500 hover:bg-red-500/10`}>
                      {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className={`hidden md:block ${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
            <table className="w-full text-left text-sm">
              <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium text-xs`}>
                <tr>
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Enviados/Falhas</th>
                  <th className="px-5 py-3">Criado por</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {filtered.map(c => {
                  const badge = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
                  return (
                    <tr key={c.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                      <td className={`px-5 py-3 font-medium ${textMain}`}>
                        <p className="truncate max-w-[200px]">{c.title}</p>
                        <p className={`text-[10px] ${textSub} truncate max-w-[200px]`}>{c.body}</p>
                      </td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span></td>
                      <td className={`px-5 py-3 text-xs ${textSub}`}>{c.sentCount || 0} / {c.failedCount || 0}</td>
                      <td className={`px-5 py-3 text-xs ${textSub}`}>{getCreatedByName(c.createdBy)}</td>
                      <td className={`px-5 py-3 text-xs ${textSub}`}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(c.status === 'recurring' || c.status === 'scheduled') && (
                            <button onClick={() => toggleEnabled(c)} className={`p-1.5 rounded ${textSub} hover:text-primary`} title={c.enabled ? 'Pausar' : 'Ativar'}>
                              {c.enabled ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                          )}
                          <button onClick={() => duplicateCampaign(c)} className={`p-1.5 rounded ${textSub} hover:text-primary`} title="Duplicar"><Copy size={14} /></button>
                          <button onClick={() => handleDelete(c)} disabled={deleting === c.id}
                            className="p-1.5 rounded text-red-500 hover:text-red-400" title="Excluir">
                            {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
