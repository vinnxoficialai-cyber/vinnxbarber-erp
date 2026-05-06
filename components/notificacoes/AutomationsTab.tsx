import React, { useState, useRef } from 'react';
import { Clock, Star, UserPlus, Gift, UserMinus, Loader2, Upload, X, Image as ImageIcon, Save, ChevronUp, ChevronDown } from 'lucide-react';
import type { PushAutomationConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import { uploadImage, deleteImage } from '../../lib/storage';

interface Props {
  isDarkMode: boolean; textMain: string; textSub: string; bgCard: string;
  borderCol: string; bgInput: string; shadowClass: string; inputCls: string; labelCls: string;
  automations: PushAutomationConfig[];
  setAutomations: React.Dispatch<React.SetStateAction<PushAutomationConfig[]>>;
  toast: { success: (t: string, m: string) => void; error: (t: string, m: string) => void };
  [k: string]: unknown;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FieldDef = { key: string; label: string; type: 'number' | 'duration'; min: number; max: number; unit?: string };

const AUTO_META: Record<string, {
  title: string; desc: string; icon: React.ElementType; color: string;
  fields: FieldDef[];
  variables: string[];
}> = {
  reminder: {
    title: 'Lembrete de Agendamento', desc: 'Notifica antes do horário agendado', icon: Clock, color: '#3b82f6',
    fields: [{ key: 'reminderMinutes', label: 'Antecedência', type: 'duration', min: 5, max: 1440 }],
    variables: ['{servico}', '{hora}'],
  },
  review: {
    title: 'Avaliação Pós-Atendimento', desc: 'Notifica automaticamente ao fim do horário agendado. Fallback: solicita avaliação após conclusão manual.', icon: Star, color: '#f59e0b',
    fields: [{ key: 'reviewDelayMinutes', label: 'Tempo após conclusão (fallback)', type: 'duration', min: 5, max: 2880 }],
    variables: ['{servico}'],
  },
  incomplete: {
    title: 'Cadastro Incompleto', desc: 'Incentiva clientes a completar o perfil', icon: UserPlus, color: '#8b5cf6',
    fields: [
      { key: 'intervalDays', label: 'Intervalo entre envios', type: 'number', min: 1, max: 30, unit: 'dias' },
      { key: 'maxAttempts', label: 'Máx. tentativas', type: 'number', min: 1, max: 10, unit: '' },
    ],
    variables: [],
  },
  birthday: {
    title: 'Aniversário', desc: 'Parabéns + oferta especial no dia', icon: Gift, color: '#ec4899',
    fields: [{ key: 'discountPercent', label: 'Desconto (%)', type: 'number', min: 0, max: 100, unit: '%' }],
    variables: ['{nome}', '{desconto}'],
  },
  inactive: {
    title: 'Clientes Inativos', desc: 'Reengajamento de clientes que não visitam há muito', icon: UserMinus, color: '#ef4444',
    fields: [
      { key: 'inactiveDays', label: 'Dias de inatividade', type: 'number', min: 15, max: 90, unit: 'dias' },
      { key: 'maxNudgesPerMonth', label: 'Máx. nudges/mês', type: 'number', min: 1, max: 5, unit: '' },
    ],
    variables: [],
  },
};


export const AutomationsTab: React.FC<Props> = ({ isDarkMode, textMain, textSub, bgCard, borderCol, bgInput, shadowClass, inputCls, labelCls, automations, setAutomations, toast }) => {
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const updateLocal = (id: string, patch: Partial<PushAutomationConfig>) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    setSaving(id);
    const { error } = await supabase.from('push_automation_config').update({ enabled, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro', error.message); setSaving(null); return; }
    updateLocal(id, { enabled });
    toast.success(enabled ? 'Ativado' : 'Desativado', AUTO_META[id]?.title || id);
    setSaving(null);
  };

  const saveAutomation = async (a: PushAutomationConfig) => {
    if (!a.messageTemplate?.trim()) { toast.error('Erro', 'Preencha o template de mensagem'); return; }
    setSaving(a.id);
    const { error } = await supabase.from('push_automation_config').update({
      config: a.config, messageTemplate: a.messageTemplate, imageUrl: a.imageUrl || null, updatedAt: new Date().toISOString(),
    }).eq('id', a.id);
    if (error) { toast.error('Erro', error.message); setSaving(null); return; }
    toast.success('Salvo', `${AUTO_META[a.id]?.title || a.id} atualizado`);
    setSaving(null);
  };

  const handleImageUpload = async (autoId: string, file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) { toast.error('Upload', 'Formato inválido'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error('Upload', 'Arquivo muito grande (max 2MB)'); return; }
    setUploading(autoId);
    const url = await uploadImage(file, 'push-images');
    if (url) { updateLocal(autoId, { imageUrl: url }); toast.success('Upload', 'Imagem enviada'); }
    else { toast.error('Upload', 'Falha'); }
    setUploading(null);
  };

  const removeImage = async (autoId: string, url: string) => {
    await deleteImage(url);
    updateLocal(autoId, { imageUrl: undefined });
  };

  return (
    <div className="space-y-4">
      <p className={`text-sm ${textSub} mb-2`}>Configure automações de push para engajar clientes automaticamente.</p>
      {automations.map(a => {
        const meta = AUTO_META[a.id];
        if (!meta) return null;
        const Icon = meta.icon;
        const config = (a.config || {}) as Record<string, unknown>;

        return (
          <div key={a.id} className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
            {/* Header */}
            <div className={`px-5 py-4 flex items-center justify-between border-b ${borderCol}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color + '18' }}>
                  <Icon size={18} style={{ color: meta.color }} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${textMain}`}>{meta.title}</h3>
                  <p className={`text-[10px] ${textSub}`}>{meta.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  a.enabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : `${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} ${textSub} ${borderCol}`
                }`}>{a.enabled ? '● Ativo' : '○ Desativado'}</span>
                <button onClick={() => toggleEnabled(a.id, !a.enabled)} disabled={saving === a.id}
                  className={`relative w-11 h-6 rounded-full transition-colors ${a.enabled ? 'bg-emerald-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: a.enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Config Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {meta.fields.map(f => (
                  <div key={f.key}>
                    <label className={labelCls}>
                      {f.label}
                      {f.type === 'number' && f.unit && <span className={`text-[10px] ${textSub}`}>({f.unit})</span>}
                    </label>
                    {f.type === 'duration' ? (() => {
                      const total = (config[f.key] as number) || 0;
                      const dH = Math.floor(total / 60);
                      const dM = total % 60;
                      const setDuration = (h: number, m: number) => {
                        const clamped = Math.max(0, Math.min(f.max, h * 60 + m));
                        updateLocal(a.id, { config: { ...config, [f.key]: clamped } });
                      };
                      const stepH = (dir: number) => setDuration(Math.max(0, dH + dir), dM);
                      const stepM = (dir: number) => {
                        let newM = dM + dir * 5;
                        let newH = dH;
                        if (newM >= 60) { newM = 0; newH++; }
                        if (newM < 0) { newM = 55; newH = Math.max(0, newH - 1); }
                        setDuration(newH, newM);
                      };
                      const chevronCls = `p-0.5 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-600 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'}`;
                      const boxCls = `flex items-center gap-1 px-3 py-2 rounded-lg border ${borderCol} ${bgInput}`;
                      return (
                        <div className="flex items-center gap-2">
                          {/* Hours */}
                          <div className={boxCls}>
                            <span className={`text-2xl font-bold tabular-nums ${textMain}`} style={{ minWidth: '2ch', textAlign: 'center' }}>
                              {String(dH).padStart(2, '0')}
                            </span>
                            <div className="flex flex-col">
                              <button type="button" onClick={() => stepH(1)} className={chevronCls}><ChevronUp size={14} /></button>
                              <button type="button" onClick={() => stepH(-1)} className={chevronCls}><ChevronDown size={14} /></button>
                            </div>
                            <span className={`text-[10px] font-medium ${textSub}`}>h</span>
                          </div>
                          <span className={`text-xl font-bold ${textSub}`}>:</span>
                          {/* Minutes */}
                          <div className={boxCls}>
                            <span className={`text-2xl font-bold tabular-nums ${textMain}`} style={{ minWidth: '2ch', textAlign: 'center' }}>
                              {String(dM).padStart(2, '0')}
                            </span>
                            <div className="flex flex-col">
                              <button type="button" onClick={() => stepM(1)} className={chevronCls}><ChevronUp size={14} /></button>
                              <button type="button" onClick={() => stepM(-1)} className={chevronCls}><ChevronDown size={14} /></button>
                            </div>
                            <span className={`text-[10px] font-medium ${textSub}`}>min</span>
                          </div>
                        </div>
                      );
                    })() : (
                      <input type="number" value={(config[f.key] as number) || f.min}
                        onChange={e => updateLocal(a.id, { config: { ...config, [f.key]: parseInt(e.target.value) || f.min } })}
                        min={f.min} max={f.max} className={inputCls} />
                    )}
                  </div>
                ))}
              </div>

              {/* Message Template */}
              <div>
                <label className={labelCls}><MessageSquare size={12} /> Template da mensagem</label>
                <textarea value={a.messageTemplate || ''} rows={2}
                  onChange={e => updateLocal(a.id, { messageTemplate: e.target.value })}
                  className={`${inputCls} resize-none`} placeholder="Ex: Olá! Seu horário é amanhã às {hora}" />
                {meta.variables.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {meta.variables.map(v => (
                      <button key={v} onClick={() => updateLocal(a.id, { messageTemplate: (a.messageTemplate || '') + ' ' + v })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${borderCol} ${textSub} hover:text-primary hover:border-primary/50 transition-colors`}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Image */}
              <div>
                <label className={labelCls}><ImageIcon size={12} /> Imagem (opcional)</label>
                {a.imageUrl ? (
                  <div className="relative inline-block">
                    <img src={a.imageUrl} alt="" className={`h-16 rounded-lg border ${borderCol} object-cover`} />
                    <button onClick={() => removeImage(a.id, a.imageUrl!)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"><X size={10} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRefs.current[a.id]?.click()} disabled={uploading === a.id}
                    className={`px-3 py-2 border ${borderCol} rounded-lg text-xs ${textSub} hover:border-primary/50 transition-colors flex items-center gap-1.5`}>
                    {uploading === a.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
                  </button>
                )}
                <input ref={el => { fileRefs.current[a.id] = el; }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(a.id, f); e.target.value = ''; }} />
              </div>

              {/* Save */}
              <div className="flex items-center justify-between pt-2">
                <span className={`text-[10px] ${textSub}`}>{a.updatedAt ? `Última alteração: ${new Date(a.updatedAt).toLocaleString('pt-BR')}` : ''}</span>
                <button onClick={() => saveAutomation(a)} disabled={saving === a.id}
                  className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5">
                  {saving === a.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
