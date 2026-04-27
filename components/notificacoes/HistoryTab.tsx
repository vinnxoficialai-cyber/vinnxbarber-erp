import React, { useState, useMemo } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import type { PushLogEntry, Client } from '../../types';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; bgInput: string; shadowClass: string; inputCls: string;
  logs: PushLogEntry[]; clients: Client[];
  [k: string]: unknown;
}

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  broadcast: { label: 'Broadcast', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  transactional: { label: 'Transacional', cls: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  birthday: { label: 'Aniversário', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  inactive: { label: 'Inativo', cls: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  manual: { label: 'Manual', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  reminder: { label: 'Lembrete', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  review: { label: 'Avaliação', cls: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  campaign: { label: 'Campanha', cls: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
};

export const HistoryTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, bgInput, shadowClass, inputCls, logs, clients }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('7');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const cutoff = periodFilter === 'all' ? '' : new Date(Date.now() - parseInt(periodFilter) * 24 * 60 * 60 * 1000).toISOString();
    return logs.filter(l => {
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (cutoff && (l.createdAt || '') < cutoff) return false;
      return true;
    });
  }, [logs, typeFilter, statusFilter, periodFilter]);

  const getClientName = (id?: string) => {
    if (!id) return '—';
    const c = clients.find(c => c.id === id);
    return c?.name || id.slice(0, 8);
  };

  const parseErrorDetail = (detail?: string): string => {
    if (!detail) return '';
    try { return JSON.stringify(JSON.parse(detail), null, 2); }
    catch { return detail; }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={`${bgCard} border ${borderCol} p-4 rounded-xl ${shadowClass}`}>
        <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-primary" /><span className={`text-xs font-bold ${textMain}`}>Filtros</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputCls}>
            <option value="all">Todos os tipos</option>
            {Object.entries(TYPE_BADGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="all">Todos os status</option>
            <option value="sent">Enviado</option>
            <option value="failed">Falhou</option>
          </select>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className={inputCls}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className={`text-xs ${textSub}`}>{filtered.length} registro(s)</p>

      {filtered.length === 0 ? (
        <div className={`p-12 text-center ${textSub}`}>
          <Clock size={48} className="mx-auto mb-3 opacity-20" />
          <p>Nenhum log encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
          {/* Mobile */}
          <div className="md:hidden divide-y" style={{ borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
            {filtered.slice(0, 50).map(l => {
              const badge = TYPE_BADGES[l.type] || TYPE_BADGES.manual;
              const statusCls = l.status === 'sent' ? 'text-emerald-500' : 'text-red-500';
              return (
                <div key={l.id} className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className={`text-sm font-medium ${textMain} truncate flex-1`}>{l.title}</p>
                    <span className={`text-xs font-bold ${statusCls} ml-2`}>{l.status === 'sent' ? '✓' : '✗'}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-[10px] ${textSub} flex-wrap`}>
                    <span className={`px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                    <span>{getClientName(l.clientId)}</span>
                    <span>{l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  {l.errorDetail && (
                    <button onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}
                      className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> Ver detalhes {expandedLog === l.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}
                  {expandedLog === l.id && l.errorDetail && (
                    <pre className={`text-[10px] p-2 mt-1 rounded overflow-x-auto ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'}`}>
                      {parseErrorDetail(l.errorDetail)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium text-xs`}>
              <tr>
                <th className="px-5 py-3">Título</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {filtered.slice(0, 100).map(l => {
                const badge = TYPE_BADGES[l.type] || TYPE_BADGES.manual;
                return (
                  <React.Fragment key={l.id}>
                    <tr className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                      <td className={`px-5 py-3 ${textMain}`}>
                        <p className="truncate max-w-[250px] font-medium">{l.title}</p>
                        {l.body && <p className={`text-[10px] ${textSub} truncate max-w-[250px]`}>{l.body}</p>}
                      </td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          l.status === 'sent' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>{l.status === 'sent' ? 'Enviado' : 'Falhou'}</span>
                      </td>
                      <td className={`px-5 py-3 text-xs ${textSub}`}>{getClientName(l.clientId)}</td>
                      <td className={`px-5 py-3 text-xs ${textSub}`}>{l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-5 py-3">
                        {l.errorDetail && (
                          <button onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}
                            className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                            <AlertTriangle size={12} /> {expandedLog === l.id ? 'Fechar' : 'Detalhes'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLog === l.id && l.errorDetail && (
                      <tr><td colSpan={6} className="px-5 py-2">
                        <pre className={`text-xs p-3 rounded-lg overflow-x-auto ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'}`}>
                          {parseErrorDetail(l.errorDetail)}
                        </pre>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
