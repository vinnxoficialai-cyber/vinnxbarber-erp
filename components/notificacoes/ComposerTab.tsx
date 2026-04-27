import React, { useState, useRef } from 'react';
import { Send, Upload, X, Image as ImageIcon, Users, User, Filter, Loader2, Eye, Smartphone } from 'lucide-react';
import type { Client, TeamMember } from '../../types';
import { supabase } from '../../lib/supabase';
import { uploadImage, deleteImage } from '../../lib/storage';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; bgInput: string; shadowClass: string; inputCls: string; labelCls: string;
  clients: Client[]; currentUser: TeamMember;
  toast: { success: (t: string, m: string) => void; error: (t: string, m: string) => void; warning?: (t: string, m: string) => void };
  onReload: () => void;
  [k: string]: unknown;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VALID_GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];

export const ComposerTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, bgInput, shadowClass, inputCls, labelCls, clients, currentUser, toast, onReload }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('/#/site');
  const [sendMode, setSendMode] = useState<'all' | 'filter' | 'individual'>('all');
  const [filterGender, setFilterGender] = useState('');
  const [filterMinVisits, setFilterMinVisits] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled' | 'recurring'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recType, setRecType] = useState<'weekly' | 'monthly'>('weekly');
  const [recDay, setRecDay] = useState('1');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredClientsList = clientSearch.trim()
    ? clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : [];

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Formato inválido. Use JPG, PNG ou WebP.';
    if (file.size > MAX_FILE_SIZE) return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máx 2MB.`;
    return null;
  };

  const handleUpload = async (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error('Upload', err); return; }
    setUploading(true);
    const url = await uploadImage(file, 'push-images');
    if (url) { setImageUrl(url); toast.success('Upload', 'Imagem enviada!'); }
    else { toast.error('Upload', 'Falha no upload'); }
    setUploading(false);
  };

  const removeImage = async () => {
    if (imageUrl) { await deleteImage(imageUrl); setImageUrl(''); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const sendTestNotification = () => {
    if (!('Notification' in window)) { toast.error('Erro', 'Browser sem suporte a notificações'); return; }
    if (!title.trim()) { toast.error('Erro', 'Preencha o título'); return; }
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        new Notification(title, { body: body || '', icon: '/pwa_icon_192.png' });
        toast.success('Preview', 'Notificação de teste enviada');
      } else { toast.error('Permissão', 'Habilite notificações no browser'); }
    });
  };

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Erro', 'Preencha o título'); return; }
    if (sendMode === 'individual' && !selectedClientId) { toast.error('Erro', 'Selecione um cliente'); return; }
    if (scheduleMode === 'scheduled' && !scheduledAt) { toast.error('Erro', 'Selecione data/hora'); return; }
    setSending(true);

    try {
      if (scheduleMode === 'now') {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) { toast.error('Sessão', 'Faça login novamente'); setSending(false); return; }

        if (sendMode === 'individual') {
          // Send to single client
          const res = await fetch('/api/push-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ clientId: selectedClientId, title, body, image: imageUrl || undefined, url: targetUrl }),
          });
          const data = await res.json();
          if (res.ok) {
            if (data.sent === 0 && data.message) { toast.warning ? toast.warning('Aviso', data.message) : toast.error('Aviso', data.message); }
            else toast.success('Enviado!', `${data.sent} sucesso, ${data.failed || 0} falha(s)`);
          } else toast.error('Erro', data.error || 'Falha');
        } else {
          // Broadcast (all or filtered)
          const filterCriteria = sendMode === 'filter' ? {
            ...(filterGender ? { gender: filterGender } : {}),
            ...(filterMinVisits ? { minVisits: parseInt(filterMinVisits) } : {}),
          } : undefined;

          const res = await fetch('/api/push-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title, body, image: imageUrl || undefined, url: targetUrl, filterCriteria }),
          });
          const data = await res.json();
          if (res.ok) toast.success('Enviado!', `${data.sent} sucesso, ${data.failed || 0} falha(s)`);
          else toast.error('Erro', data.error || 'Falha');
        }
      } else {
        // Save as campaign
        const status = scheduleMode === 'recurring' ? 'recurring' : 'scheduled';
        const recurrence = scheduleMode === 'recurring' ? `${recType}:${recDay}` : null;
        const { error: insertErr } = await supabase.from('push_campaigns').insert({
          type: 'campaign', title, body,
          imageUrl: imageUrl || null, targetUrl,
          segment: sendMode === 'all' ? 'all' : sendMode,
          filterCriteria: sendMode === 'filter' ? { gender: filterGender || undefined, minVisits: filterMinVisits ? parseInt(filterMinVisits) : undefined } : null,
          targetClientId: sendMode === 'individual' ? selectedClientId : null,
          recurrence, scheduledAt: scheduleMode === 'scheduled' ? scheduledAt : null,
          status, enabled: true, createdBy: currentUser.id,
        });
        if (insertErr) { toast.error('Erro', insertErr.message); setSending(false); return; }
        toast.success('Campanha criada', `${status === 'recurring' ? 'Recorrente' : 'Agendada'} com sucesso!`);
      }

      setTitle(''); setBody(''); setImageUrl(''); setScheduleMode('now'); setSendMode('all');
      setSelectedClientId(''); setClientSearch(''); setFilterGender(''); setFilterMinVisits('');
      onReload();
    } catch (e: any) {
      toast.error('Erro', e.message);
    }
    setSending(false);
  };

  const DAYS_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form — 3 cols */}
      <div className="lg:col-span-3 space-y-4">
        <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass} space-y-4`}>
          <h3 className={`text-sm font-bold ${textMain} flex items-center gap-2`}><Send size={16} className="text-primary" /> Compor Notificação</h3>

          {/* Title */}
          <div>
            <label className={labelCls}>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Ex: Promoção de verão!" maxLength={100} />
          </div>

          {/* Body */}
          <div>
            <label className={labelCls}>Mensagem</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Corpo da notificação..." maxLength={300} />
            <p className={`text-[10px] mt-1 ${textSub}`}>{body.length}/300</p>
          </div>

          {/* Image Upload */}
          <div>
            <label className={labelCls}><ImageIcon size={12} /> Imagem (opcional)</label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="preview" className={`h-24 rounded-lg border ${borderCol} object-cover`} />
                <button onClick={removeImage} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"><X size={12} /></button>
              </div>
            ) : (
              <div
                onDrop={handleDrop} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed ${borderCol} rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors`}>
                {uploading ? <Loader2 size={24} className="animate-spin text-primary mx-auto" /> : (
                  <>
                    <Upload size={24} className={`mx-auto mb-2 ${textSub}`} />
                    <p className={`text-xs ${textSub}`}>Arraste ou clique para enviar</p>
                    <p className={`text-[10px] ${textSub} mt-1`}>JPG, PNG ou WebP • Máx 2MB</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          </div>

          {/* Target URL */}
          <div>
            <label className={labelCls}>URL de destino</label>
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className={inputCls} placeholder="/#/site" />
          </div>
        </div>

        {/* Segmentation */}
        <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass} space-y-4`}>
          <h3 className={`text-sm font-bold ${textMain} flex items-center gap-2`}><Filter size={16} className="text-primary" /> Segmentação</h3>
          <div className="flex flex-wrap gap-2">
            {([['all', 'Todos', Users], ['filter', 'Filtro Avançado', Filter], ['individual', 'Cliente Específico', User]] as const).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setSendMode(mode)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                  sendMode === mode ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {sendMode === 'filter' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gênero</label>
                <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  {VALID_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Visitas mínimas</label>
                <input type="number" value={filterMinVisits} onChange={e => setFilterMinVisits(e.target.value)} className={inputCls} placeholder="0" min="0" />
              </div>
            </div>
          )}

          {sendMode === 'individual' && (
            <div className="relative">
              <label className={labelCls}>Buscar cliente</label>
              <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setSelectedClientId(''); }}
                className={inputCls} placeholder="Digite o nome do cliente..." />
              {filteredClientsList.length > 0 && !selectedClientId && (
                <div className={`absolute z-10 w-full mt-1 ${bgCard} border ${borderCol} rounded-lg shadow-lg max-h-48 overflow-y-auto`}>
                  {filteredClientsList.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name || c.id); }}
                      className={`w-full text-left px-3 py-2 text-sm ${textMain} hover:bg-primary/10 transition-colors flex items-center gap-2`}>
                      <User size={14} className={textSub} /> {c.name || c.id}
                    </button>
                  ))}
                </div>
              )}
              {selectedClientId && <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">✓ Cliente selecionado</p>}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className={`${bgCard} border ${borderCol} p-6 rounded-xl ${shadowClass} space-y-4`}>
          <h3 className={`text-sm font-bold ${textMain}`}>Modo de envio</h3>
          <div className="flex flex-wrap gap-2">
            {([['now', 'Enviar agora'], ['scheduled', 'Agendar'], ['recurring', 'Recorrente']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => setScheduleMode(mode)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  scheduleMode === mode ? 'bg-primary text-white border-primary' : `${borderCol} ${textSub} hover:border-primary/50`}`}>
                {label}
              </button>
            ))}
          </div>

          {scheduleMode === 'scheduled' && (
            <div>
              <label className={labelCls}>Data e hora</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={inputCls} />
            </div>
          )}

          {scheduleMode === 'recurring' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Frequência</label>
                <select value={recType} onChange={e => setRecType(e.target.value as any)} className={inputCls}>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{recType === 'weekly' ? 'Dia da semana' : 'Dia do mês'}</label>
                <select value={recDay} onChange={e => setRecDay(e.target.value)} className={inputCls}>
                  {recType === 'weekly'
                    ? DAYS_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)
                    : Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)
                  }
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSend} disabled={sending || !title.trim()}
              className={`flex-1 py-3 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                title.trim() ? 'bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/20' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {scheduleMode === 'now' ? 'Enviar Agora' : scheduleMode === 'scheduled' ? 'Agendar' : 'Criar Recorrência'}
            </button>
            <button onClick={sendTestNotification} title="Preview no browser"
              className={`px-4 py-3 rounded-lg border ${borderCol} ${textSub} hover:text-primary hover:border-primary/50 transition-colors`}>
              <Eye size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Preview — 2 cols */}
      <div className="lg:col-span-2">
        <div className="sticky top-4">
          <h3 className={`text-sm font-bold ${textMain} mb-3 flex items-center gap-2`}><Smartphone size={16} className="text-primary" /> Preview</h3>
          <div className={`rounded-2xl overflow-hidden border ${borderCol} ${shadowClass}`}
            style={{ background: isDarkMode ? '#1a1a2e' : '#f8fafc' }}>
            {/* Phone header bar */}
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: isDarkMode ? '#16162a' : '#e2e8f0' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`text-[10px] font-medium ${textSub}`}>VINNX Barber</span>
              <span className={`text-[10px] ${textSub} ml-auto`}>agora</span>
            </div>
            {/* Notification card */}
            <div className="p-4">
              <div className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white'} rounded-xl p-4 border ${borderCol} space-y-2`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Send size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${textMain} truncate`}>{title || 'Título da notificação'}</p>
                    <p className={`text-xs ${textSub} mt-0.5 line-clamp-3`}>{body || 'Corpo da mensagem aparecerá aqui...'}</p>
                  </div>
                </div>
                {imageUrl && (
                  <img src={imageUrl} alt="preview" className="w-full h-32 object-cover rounded-lg mt-2" />
                )}
              </div>
            </div>
          </div>
          {/* Info */}
          <div className={`mt-3 p-3 rounded-lg border ${borderCol} ${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
            <p className={`text-[10px] ${textSub}`}>
              <strong>Modo:</strong> {sendMode === 'all' ? 'Todos' : sendMode === 'filter' ? 'Filtro avançado' : 'Individual'} •
              <strong> Envio:</strong> {scheduleMode === 'now' ? 'Imediato' : scheduleMode === 'scheduled' ? 'Agendado' : 'Recorrente'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
