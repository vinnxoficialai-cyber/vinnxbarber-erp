import React, { useState, useEffect } from 'react';
import { Users, Trash2, Smartphone, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { Client } from '../../types';
import { supabase } from '../../lib/supabase';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; shadowClass: string;
  clients: Client[];
  toast: { success: (t: string, m: string) => void; error: (t: string, m: string) => void };
  confirm: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
  onReload: () => void;
  [k: string]: unknown;
}

interface PushSub {
  id: string; clientId?: string; userAgent?: string; createdAt?: string;
}

const parseUA = (ua?: string): string => {
  if (!ua) return 'Desconhecido';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Chrome')) return 'Chrome/Desktop';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Outro';
};

export const SubscribersTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, shadowClass, clients, toast, confirm, onReload }) => {
  const [subs, setSubs] = useState<PushSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadSubs = async () => {
    setLoading(true);
    const { data } = await supabase.from('push_subscriptions').select('*').order('createdAt', { ascending: false });
    setSubs(data || []);
    setLoading(false);
  };

  useEffect(() => { loadSubs(); }, []);

  const getClientName = (id?: string) => {
    if (!id) return 'Anônimo';
    const c = clients.find(c => c.id === id);
    return c?.name || id.slice(0, 8);
  };

  const handleDelete = async (sub: PushSub) => {
    const ok = await confirm({ title: 'Remover inscrição', message: 'O dispositivo não receberá mais notificações push.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    setDeleting(sub.id);
    const { error } = await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    if (error) {
      toast.error('Erro', 'Não foi possível remover. Verifique permissões RLS.');
      setDeleting(null);
      return;
    }
    setSubs(prev => prev.filter(s => s.id !== sub.id));
    toast.success('Removido', 'Inscrição excluída');
    onReload();
    setDeleting(null);
  };

  const isOld = (date?: string) => {
    if (!date) return false;
    return Date.now() - new Date(date).getTime() > 60 * 24 * 60 * 60 * 1000; // >60 days
  };

  const sendTestLocal = () => {
    if (!('Notification' in window)) { toast.error('Erro', 'Browser sem suporte'); return; }
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        new Notification('VINNX Barber — Teste', { body: 'Se você viu isso, as notificações estão funcionando! ✅', icon: '/pwa_icon_192.png' });
        toast.success('Teste', 'Notificação enviada');
      } else { toast.error('Permissão', 'Habilite notificações no browser'); }
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${textSub}`}>{subs.length} dispositivo(s) inscrito(s)</p>
        <div className="flex gap-2">
          <button onClick={sendTestLocal}
            className={`px-3 py-2 rounded-lg border ${borderCol} text-xs font-medium ${textSub} hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5`}>
            <Smartphone size={14} /> Testar no meu dispositivo
          </button>
          <button onClick={loadSubs} className={`p-2 rounded-lg border ${borderCol} ${textSub} hover:text-primary transition-colors`}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className={`p-12 text-center ${textSub}`}>
          <Users size={48} className="mx-auto mb-3 opacity-20" />
          <p>Nenhum dispositivo inscrito.</p>
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
            Se você esperava ver inscritos, verifique se a RLS policy foi executada.
          </p>
        </div>
      ) : (
        <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
          {/* Mobile */}
          <div className="md:hidden divide-y" style={{ borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
            {subs.map(s => (
              <div key={s.id} className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} text-primary`}>
                  <Smartphone size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${textMain} truncate`}>{getClientName(s.clientId)}</p>
                  <div className={`flex items-center gap-2 text-[10px] ${textSub}`}>
                    <span>{parseUA(s.userAgent)}</span>
                    <span>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : ''}</span>
                    {isOld(s.createdAt) && <AlertTriangle size={10} className="text-amber-500" />}
                  </div>
                </div>
                <button onClick={() => handleDelete(s)} disabled={deleting === s.id}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                  {deleting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium text-xs`}>
              <tr>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Dispositivo</th>
                <th className="px-5 py-3">Inscrito em</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {subs.map(s => (
                <tr key={s.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <td className={`px-5 py-3 font-medium ${textMain}`}>{getClientName(s.clientId)}</td>
                  <td className={`px-5 py-3 text-xs ${textSub}`}>{parseUA(s.userAgent)}</td>
                  <td className={`px-5 py-3 text-xs ${textSub}`}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-5 py-3">
                    {isOld(s.createdAt) ? (
                      <span className="flex items-center gap-1 text-xs text-amber-500"><AlertTriangle size={12} /> Antigo</span>
                    ) : (
                      <span className="text-xs text-emerald-500">Ativo</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(s)} disabled={deleting === s.id}
                      className="p-1.5 rounded text-red-500 hover:text-red-400">
                      {deleting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
