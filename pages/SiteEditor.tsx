import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Globe, Eye, Save, Palette, Type, Clock, Scissors, Link2, ToggleLeft, ToggleRight,
    Loader2, MapPin, Phone, MessageCircle, Instagram, BarChart3, Star, Users, Tag,
    Image as ImageIcon, Upload, X, Check, AlertCircle, ExternalLink
} from 'lucide-react';
import { TeamMember, SiteSettings, Service } from '../types';
import { getSiteSettings, saveSiteSettings } from '../lib/dataService';
import { uploadBase64Image, isBase64, isUrl } from '../lib/storage';
import { useToast } from '../components/Toast';
import { useAppData } from '../context/AppDataContext';
import { useSelectedUnit } from '../context/UnitContext';
import { SitePreview } from '../components/SitePreview';

interface SiteEditorProps {
    isDarkMode: boolean;
    currentUser: TeamMember;
}

const TABS = [
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'texts', label: 'Textos', icon: Type },
    { id: 'hours', label: 'Horários', icon: Clock },
    { id: 'services', label: 'Serviços', icon: Scissors },
    { id: 'integrations', label: 'Integrações', icon: Link2 },
] as const;

type TabId = typeof TABS[number]['id'];

const COLOR_PRESETS = [
    '#00bf62', '#3b82f6', '#6366f1', '#8b5cf6',
    '#ec4899', '#ef4444', '#f97316', '#14b8a6',
];

const DEFAULT_SETTINGS: SiteSettings = {
    id: 'default',
    isActive: false,
    primaryColor: '#00bf62',
    sectionsVisible: { reviews: true, team: true, promotions: false, social: true },
    ctaButtonText: 'Agendar Agora',
    businessHours: [
        { day: 'segunda', open: true, start: '09:00', end: '19:00' },
        { day: 'terça', open: true, start: '09:00', end: '19:00' },
        { day: 'quarta', open: true, start: '09:00', end: '19:00' },
        { day: 'quinta', open: true, start: '09:00', end: '19:00' },
        { day: 'sexta', open: true, start: '09:00', end: '19:00' },
        { day: 'sábado', open: true, start: '09:00', end: '15:00' },
        { day: 'domingo', open: false, start: '09:00', end: '13:00' },
    ],
    visibleServiceIds: [],
    whatsappEnabled: false,
};

export const SiteEditor: React.FC<SiteEditorProps> = ({ isDarkMode, currentUser }) => {
    const { services } = useAppData();
    const { selectedUnit, units } = useSelectedUnit();
    const toast = useToast();

    // ── Theme Tokens (checklist) ─────────────────────────
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';

    // ── State ────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('appearance');
    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    // Image upload refs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const heroInputRef = useRef<HTMLInputElement>(null);
    const didAutoPopulate = useRef(false);

    // ── Load site settings from DB ───────────────────────
    useEffect(() => {
        (async () => {
            const data = await getSiteSettings();
            if (data) setSettings(data);
            setLoading(false);
        })();
    }, []);

    // ── Auto-populate empty fields from Unit data ────────
    // Runs when units become available (they load async from Supabase)
    useEffect(() => {
        if (didAutoPopulate.current || loading) return;
        const unit = selectedUnit || units[0];
        if (!unit) return;

        didAutoPopulate.current = true;
        setSettings(prev => {
            let next = { ...prev };
            let changed = false;

            if (!next.businessName && (unit.tradeName || unit.name)) {
                next.businessName = unit.tradeName || unit.name;
                changed = true;
            }
            if (!next.address && unit.address) {
                const parts = [unit.address, unit.city, unit.state].filter(Boolean);
                next.address = parts.join(', ');
                changed = true;
            }
            if (!next.phone && unit.phone) {
                next.phone = unit.phone;
                changed = true;
            }
            if (!next.logoUrl && unit.image) {
                next.logoUrl = unit.image;
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [units, selectedUnit, loading]);

    // ── Update helpers ───────────────────────────────────
    const update = useCallback(<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const updateSection = useCallback((key: keyof SiteSettings['sectionsVisible'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            sectionsVisible: { ...prev.sectionsVisible, [key]: value },
        }));
        setHasChanges(true);
    }, []);

    const updateHour = useCallback((index: number, field: string, value: any) => {
        setSettings(prev => {
            const hours = [...prev.businessHours];
            hours[index] = { ...hours[index], [field]: value };
            return { ...prev, businessHours: hours };
        });
        setHasChanges(true);
    }, []);

    // ── Image Upload ─────────────────────────────────────
    const handleImageUpload = useCallback(async (
        e: React.ChangeEvent<HTMLInputElement>,
        field: 'logoUrl' | 'heroImageUrl'
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result as string;
            if (isBase64(base64)) {
                const url = await uploadBase64Image(base64, 'site', `${field}_${Date.now()}`);
                if (url) {
                    update(field, url);
                    toast.success('Imagem carregada!');
                } else {
                    toast.error('Erro no upload', 'Tente novamente');
                }
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [update, toast]);

    // ── Save ─────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        const result = await saveSiteSettings(settings, currentUser.id);
        setSaving(false);
        if (result.success) {
            toast.success('Site publicado!', 'As alterações foram salvas com sucesso.');
            setHasChanges(false);
        } else {
            toast.error('Erro ao salvar', result.error || '');
        }
    };

    // ── Toggle Component ─────────────────────────────────
    const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex items-center gap-2 group"
        >
            <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            {label && <span className={`text-sm ${textMain}`}>{label}</span>}
        </button>
    );

    // ── Loading ──────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    // ██  RENDER  ██
    // ════════════════════════════════════════════════════════
    return (
        <div className="animate-in fade-in duration-500 h-full flex flex-col">

            {/* ═══ HEADER ═══ */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6`}>
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2.5`}>
                        <Globe size={22} className="text-primary" />
                        Editor do Site
                    </h1>
                    <p className={`${textSub} text-sm mt-0.5`}>Configure o site público de agendamento online da sua barbearia.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Toggle Active */}
                    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${borderCol} ${bgCard}`}>
                        <span className={`text-xs font-medium ${textSub}`}>Site ativo</span>
                        <Toggle checked={settings.isActive} onChange={(v) => update('isActive', v)} />
                        <div className={`w-2 h-2 rounded-full ${settings.isActive ? 'bg-emerald-500 animate-pulse' : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`} />
                    </div>
                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center gap-2 shadow-lg shadow-primary/20
              ${hasChanges
                                ? 'bg-primary hover:bg-primary-600'
                                : 'bg-slate-400 cursor-not-allowed opacity-60'
                            }`}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar e Publicar
                    </button>
                </div>
            </div>

            {/* ═══ MAIN 2-COLUMN LAYOUT ═══ */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">

                {/* ─── LEFT: Config Panel ─── */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                    {/* Tabs */}
                    <div className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} mb-4 overflow-x-auto`}>
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                    ${isActive
                                            ? `${bgCard} text-primary shadow-sm border ${borderCol}`
                                            : `${textSub} hover:text-primary`
                                        }`}
                                >
                                    <Icon size={14} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className={`flex-1 overflow-y-auto ${bgCard} rounded-xl border ${borderCol} p-5 custom-scrollbar`}>

                        {/* ═══ TAB: APARÊNCIA ═══ */}
                        {activeTab === 'appearance' && (
                            <div className="animate-in fade-in duration-300">
                                {/* Primary Color */}
                                <div className="pb-5">
                                    <label className={`text-xs font-semibold ${textSub} mb-2.5 flex items-center gap-1.5 uppercase tracking-wider`}>
                                        <Palette size={12} className="text-primary" /> Cor Primária
                                    </label>
                                    <div className="grid grid-cols-4 gap-2.5 mt-2.5 max-w-[200px]">
                                        {COLOR_PRESETS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => update('primaryColor', c)}
                                                className={`w-10 h-10 rounded-xl transition-all border-2 hover:scale-110 ${settings.primaryColor === c ? 'border-white shadow-lg ring-2 ring-primary scale-110' : 'border-transparent'}`}
                                                style={{ background: c }}
                                            />
                                        ))}
                                    </div>
                                    {/* Custom color */}
                                    <div className="mt-3 flex items-center gap-2.5">
                                        <label className="relative">
                                            <div className={`w-10 h-10 rounded-xl border-2 border-dashed ${borderCol} flex items-center justify-center cursor-pointer hover:scale-110 transition-transform`} style={{ background: settings.primaryColor }}>
                                                <Palette size={14} className="text-white mix-blend-difference" />
                                            </div>
                                            <input
                                                type="color"
                                                value={settings.primaryColor}
                                                onChange={e => update('primaryColor', e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </label>
                                        <span className={`text-xs ${textSub}`}>Cor personalizada</span>
                                    </div>
                                </div>

                                <div className={`border-t ${borderCol}`} />

                                {/* Logo Upload */}
                                <div className="py-5">
                                    <label className={`text-xs font-semibold ${textSub} mb-1.5 flex items-center gap-1.5 uppercase tracking-wider`}>
                                        <ImageIcon size={12} className="text-primary" /> Logo do Salão
                                    </label>
                                    <div className="flex items-center gap-3 mt-2.5">
                                        <div className={`w-20 h-20 rounded-xl border-2 border-dashed ${borderCol} flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                            {settings.logoUrl ? (
                                                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <ImageIcon size={24} className={textSub} />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => logoInputRef.current?.click()}
                                                className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                                            >
                                                <Upload size={12} /> Carregar Imagem
                                            </button>
                                            {settings.logoUrl && (
                                                <button
                                                    onClick={() => update('logoUrl', undefined)}
                                                    className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-500 text-xs font-semibold hover:bg-red-500/5 transition-colors flex items-center gap-1.5"
                                                >
                                                    <X size={12} /> Remover
                                                </button>
                                            )}
                                        </div>
                                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'logoUrl')} />
                                    </div>
                                </div>

                                <div className={`border-t ${borderCol}`} />

                                {/* Hero Image Upload */}
                                <div className="py-5">
                                    <label className={`text-xs font-semibold ${textSub} mb-1.5 flex items-center gap-1.5 uppercase tracking-wider`}>
                                        <ImageIcon size={12} className="text-primary" /> Imagem do Banner (Hero)
                                    </label>
                                    <div className="mt-2.5">
                                        <div className={`w-full h-32 rounded-xl border-2 border-dashed ${borderCol} flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                            {settings.heroImageUrl ? (
                                                <img src={settings.heroImageUrl} alt="Hero" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <ImageIcon size={28} className={textSub} />
                                                    <span className={`text-[10px] ${textSub}`}>Imagem de fundo do topo</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => heroInputRef.current?.click()}
                                                className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                                            >
                                                <Upload size={12} /> Carregar Banner
                                            </button>
                                            {settings.heroImageUrl && (
                                                <button
                                                    onClick={() => update('heroImageUrl', undefined)}
                                                    className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-500 text-xs font-semibold hover:bg-red-500/5 transition-colors flex items-center gap-1.5"
                                                >
                                                    <X size={12} /> Remover
                                                </button>
                                            )}
                                        </div>
                                        <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'heroImageUrl')} />
                                    </div>
                                </div>

                                <div className={`border-t ${borderCol}`} />

                                {/* Visible Sections */}
                                <div className="pt-5">
                                    <label className={`text-xs font-semibold ${textSub} mb-2.5 flex items-center gap-1.5 uppercase tracking-wider`}>
                                        <Eye size={12} className="text-primary" /> Seções Visíveis
                                    </label>
                                    <div className="space-y-2.5 mt-2.5">
                                        {[
                                            { key: 'reviews' as const, label: 'Avaliações de clientes', icon: Star },
                                            { key: 'team' as const, label: 'Nossa equipe', icon: Users },
                                            { key: 'promotions' as const, label: 'Promoções', icon: Tag },
                                            { key: 'social' as const, label: 'Redes sociais', icon: Link2 },
                                        ].map(s => {
                                            const Icon = s.icon;
                                            return (
                                                <div key={s.key} className={`flex items-center justify-between p-3 rounded-xl border ${borderCol} ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50/50'} transition-colors`}>
                                                    <div className="flex items-center gap-2.5">
                                                        <Icon size={14} className="text-primary" />
                                                        <span className={`text-sm ${textMain}`}>{s.label}</span>
                                                    </div>
                                                    <Toggle checked={settings.sectionsVisible[s.key]} onChange={(v) => updateSection(s.key, v)} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ TAB: TEXTOS ═══ */}
                        {activeTab === 'texts' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Type size={12} /> Nome do estabelecimento</label>
                                    <input type="text" value={settings.businessName || ''} onChange={e => update('businessName', e.target.value)} placeholder="Ex: Barbearia Premium" className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Type size={12} /> Slogan</label>
                                    <input type="text" value={settings.slogan || ''} onChange={e => update('slogan', e.target.value)} placeholder="Ex: Tradição e estilo desde 2015" className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><MapPin size={12} /> Endereço</label>
                                    <input type="text" value={settings.address || ''} onChange={e => update('address', e.target.value)} placeholder="Rua Exemplo, 123 - Centro" className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Phone size={12} /> Telefone</label>
                                    <input type="text" value={settings.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="(11) 99999-9999" className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Type size={12} /> Sobre o salão</label>
                                    <textarea value={settings.aboutText || ''} onChange={e => update('aboutText', e.target.value)} rows={4} placeholder="Conte sobre o seu salão, diferenciais, experiência..." className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1 resize-none custom-scrollbar`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Type size={12} /> Texto do Botão CTA</label>
                                    <input type="text" value={settings.ctaButtonText || ''} onChange={e => update('ctaButtonText', e.target.value)} placeholder="Agendar Agora" className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none mt-1`} />
                                </div>
                            </div>
                        )}

                        {/* ═══ TAB: HORÁRIOS ═══ */}
                        {activeTab === 'hours' && (
                            <div className="animate-in fade-in duration-300">
                                <label className={`text-xs font-medium ${textSub} mb-3 flex items-center gap-1`}>
                                    <Clock size={12} /> Horários de Funcionamento
                                </label>
                                <div className="space-y-2 mt-3">
                                    {settings.businessHours.map((h, i) => (
                                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${borderCol} ${!h.open ? 'opacity-40' : ''} transition-opacity`}>
                                            <Toggle checked={h.open} onChange={(v) => updateHour(i, 'open', v)} />
                                            <span className={`text-sm font-medium ${textMain} w-20 capitalize`}>{h.day}</span>
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className="relative flex-1">
                                                    <Clock size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textSub}`} />
                                                    <input
                                                        type="time"
                                                        value={h.start}
                                                        onChange={e => updateHour(i, 'start', e.target.value)}
                                                        disabled={!h.open}
                                                        className={`w-full pl-8 pr-2 py-1.5 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none disabled:cursor-not-allowed`}
                                                    />
                                                </div>
                                                <span className={textSub}>—</span>
                                                <div className="relative flex-1">
                                                    <Clock size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textSub}`} />
                                                    <input
                                                        type="time"
                                                        value={h.end}
                                                        onChange={e => updateHour(i, 'end', e.target.value)}
                                                        disabled={!h.open}
                                                        className={`w-full pl-8 pr-2 py-1.5 border rounded-lg text-xs ${bgInput} ${borderCol} ${textMain} focus:ring-1 focus:ring-primary outline-none disabled:cursor-not-allowed`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══ TAB: SERVIÇOS ═══ */}
                        {activeTab === 'services' && (
                            <div className="animate-in fade-in duration-300">
                                <label className={`text-xs font-medium ${textSub} mb-3 flex items-center gap-1`}>
                                    <Scissors size={12} /> Selecione quais serviços aparecem no site
                                </label>
                                <div className="space-y-2 mt-3">
                                    {services.filter(s => s.active).length === 0 ? (
                                        <div className={`text-center py-10 ${textSub}`}>
                                            <Scissors size={48} className="mx-auto mb-2 opacity-20" />
                                            <p className="text-sm">Nenhum serviço cadastrado</p>
                                            <p className="text-xs opacity-60 mt-1">Cadastre serviços na página de Serviços</p>
                                        </div>
                                    ) : (
                                        services.filter(s => s.active).map(svc => {
                                            const isVisible = settings.visibleServiceIds.includes(svc.id);
                                            return (
                                                <button
                                                    key={svc.id}
                                                    onClick={() => {
                                                        const ids = isVisible
                                                            ? settings.visibleServiceIds.filter(id => id !== svc.id)
                                                            : [...settings.visibleServiceIds, svc.id];
                                                        update('visibleServiceIds', ids);
                                                    }}
                                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                            ${isVisible
                                                            ? `border-primary/40 ${isDarkMode ? 'bg-primary/5' : 'bg-primary/5'}`
                                                            : `${borderCol} hover:border-primary/20`
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isVisible ? 'bg-primary border-primary' : `${borderCol}`}`}>
                                                            {isVisible && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-medium ${textMain}`}>{svc.name}</p>
                                                            <p className={`text-xs ${textSub}`}>
                                                                {svc.duration || 30} min • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(svc.price)}
                                                                {svc.category && ` • ${svc.category}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══ TAB: INTEGRAÇÕES ═══ */}
                        {activeTab === 'integrations' && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                {/* WhatsApp */}
                                <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                                                <MessageCircle size={18} className="text-green-500" />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-semibold ${textMain}`}>WhatsApp Business</p>
                                                <p className={`text-[10px] ${textSub}`}>Botão de contato rápido no site</p>
                                            </div>
                                        </div>
                                        <Toggle checked={settings.whatsappEnabled} onChange={(v) => update('whatsappEnabled', v)} />
                                    </div>
                                    {settings.whatsappEnabled && (
                                        <input
                                            type="text"
                                            value={settings.whatsappNumber || ''}
                                            onChange={e => update('whatsappNumber', e.target.value)}
                                            placeholder="5511999999999"
                                            className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        />
                                    )}
                                </div>

                                {/* Instagram */}
                                <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                            <Instagram size={18} className="text-pink-500" />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold ${textMain}`}>Instagram</p>
                                            <p className={`text-[10px] ${textSub}`}>Link do perfil no site</p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${textSub}`}>@</span>
                                        <input
                                            type="text"
                                            value={settings.instagramHandle || ''}
                                            onChange={e => update('instagramHandle', e.target.value)}
                                            placeholder="seuperfil"
                                            className={`w-full pl-7 ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        />
                                    </div>
                                </div>

                                {/* Google Maps */}
                                <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                            <MapPin size={18} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold ${textMain}`}>Google Maps</p>
                                            <p className={`text-[10px] ${textSub}`}>Link para localização no Maps</p>
                                        </div>
                                    </div>
                                    <input
                                        type="url"
                                        value={settings.googleMapsUrl || ''}
                                        onChange={e => update('googleMapsUrl', e.target.value)}
                                        placeholder="https://maps.google.com/..."
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    />
                                </div>

                                {/* Google Analytics */}
                                <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                            <BarChart3 size={18} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold ${textMain}`}>Google Analytics</p>
                                            <p className={`text-[10px] ${textSub}`}>Rastreamento de acessos</p>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={settings.googleAnalyticsId || ''}
                                        onChange={e => update('googleAnalyticsId', e.target.value)}
                                        placeholder="G-XXXXXXXXXX"
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    />
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ─── RIGHT: Preview Panel ─── */}
                <div className="hidden lg:flex flex-col items-center shrink-0 w-[320px]">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className={`text-[10px] font-bold ${textSub} uppercase tracking-[0.15em]`}>Preview do Site</span>
                    </div>
                    <SitePreview settings={settings} services={services} />
                </div>

            </div>
        </div>
    );
};
