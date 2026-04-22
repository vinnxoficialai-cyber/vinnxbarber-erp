import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Building2, Plus, Users, DollarSign, TrendingUp, MapPin,
    Target, Pencil, Trash2, X, Trophy, Star, Award,
    Clock, BarChart3, Loader2, CheckCircle, ArrowUpRight,
    LayoutGrid, List, Lock, AlertTriangle, Activity,
} from 'lucide-react';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { CustomDropdown } from '../components/CustomDropdown';
import { TeamMember, Unit, UnitMember } from '../types';
import { useAppData } from '../context/AppDataContext';
import { saveUnit, deleteUnit } from '../lib/dataService';
import { supabase } from '../lib/supabase';

interface UnidadesProps {
    isDarkMode: boolean;
    currentUser: TeamMember | null;
}

type SubTab = 'overview' | 'ranking' | 'details';

const STATUS_CONFIG: Record<Unit['status'], { label: string; color: string; bg: string }> = {
    active: { label: 'Ativa', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    inactive: { label: 'Inativa', color: 'text-red-500', bg: 'bg-red-500/10' },
    opening: { label: 'Em Abertura', color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

export const Unidades: React.FC<UnidadesProps> = ({ isDarkMode, currentUser }) => {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';

    const { units, setUnits, comandas, members, refresh } = useAppData();
    const [subTab, setSubTab] = useState<SubTab>('overview');
    const [showModal, setShowModal] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteMode, setDeleteMode] = useState<'deactivate' | 'permanent'>('deactivate');
    const initialFormRef = useRef<string>('');
    const confirm = useConfirm();
    const toast = useToast();

    const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ===================== UNIT KPIs FROM REAL DATA =====================
    const unitKpis = useMemo(() => {
        return units.map(unit => {
            const unitComandas = comandas.filter(c => c.unitId === unit.id && c.status === 'closed');
            const revenue = unitComandas.reduce((s, c) => s + (Number(c.finalAmount) || 0), 0);
            const atendimentos = unitComandas.length;
            const uniqueClients = new Set(unitComandas.filter(c => c.clientId).map(c => c.clientId)).size;
            const ticket = atendimentos > 0 ? revenue / atendimentos : 0;
            // Count professionals assigned (unit_members or fallback to barberId on comandas)
            const uniqueBarbers = new Set(unitComandas.map(c => c.barberId)).size;
            return {
                unitId: unit.id,
                revenue,
                atendimentos,
                customers: uniqueClients,
                professionals: uniqueBarbers || (unit as any).professionals || 0,
                ticket,
                expenses: 0, // Expenses would come from transactions with unitId
            };
        });
    }, [units, comandas]);

    // ===================== AGGREGATED KPIs =====================
    const globalKpis = useMemo(() => {
        const activeUnits = units.filter(u => u.status === 'active');
        const activeKpis = unitKpis.filter(k => activeUnits.some(u => u.id === k.unitId));
        const totalRevenue = activeKpis.reduce((s, k) => s + k.revenue, 0);
        const totalExpenses = activeKpis.reduce((s, k) => s + k.expenses, 0);
        const totalCustomers = activeKpis.reduce((s, k) => s + k.customers, 0);
        const totalAtendimentos = activeKpis.reduce((s, k) => s + k.atendimentos, 0);
        const totalProfessionals = activeKpis.reduce((s, k) => s + k.professionals, 0);
        const ticketMedio = totalAtendimentos > 0 ? totalRevenue / totalAtendimentos : 0;
        const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
        return { totalRevenue, totalExpenses, totalCustomers, totalAtendimentos, totalProfessionals, ticketMedio, profitMargin, activeCount: activeUnits.length };
    }, [units, unitKpis]);

    // ===================== RANKINGS =====================
    const rankings = useMemo(() => {
        const active = units.filter(u => u.status === 'active');
        const withKpis = active.map(u => {
            const kpi = unitKpis.find(k => k.unitId === u.id) || { revenue: 0, atendimentos: 0, customers: 0, ticket: 0, expenses: 0, professionals: 0 };
            return { ...u, ...kpi, margin: kpi.revenue > 0 ? ((kpi.revenue - kpi.expenses) / kpi.revenue) * 100 : 0 };
        });
        const byRevenue = [...withKpis].sort((a, b) => b.revenue - a.revenue);
        const byTicket = [...withKpis].sort((a, b) => b.ticket - a.ticket);
        const byMargin = [...withKpis].sort((a, b) => b.margin - a.margin);
        const byCustomers = [...withKpis].sort((a, b) => b.customers - a.customers);
        return { byRevenue, byTicket, byMargin, byCustomers };
    }, [units, unitKpis]);

    // ===================== MODAL FORM =====================
    const defaultForm: Partial<Unit> = { name: '', address: '', city: '', state: 'SP', phone: '', email: '', status: 'active', maxCapacity: 6, operatingHours: '09:00 - 20:00' };
    const [form, setForm] = useState<Partial<Unit>>(defaultForm);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const formatCnpjInput = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 14);
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    };

    const cleanCnpj = (cnpj: string) => cnpj.replace(/\D/g, '');

    const lastLookedUpCnpj = useRef<string>('');

    const handleCnpjLookup = useCallback(async (cnpjRaw: string) => {
        const cnpjDigits = cleanCnpj(cnpjRaw);
        if (cnpjDigits.length !== 14 || cnpjDigits === lastLookedUpCnpj.current) return;
        lastLookedUpCnpj.current = cnpjDigits;
        setCnpjLoading(true);
        setCnpjStatus('idle');
        try {
            const res = await fetch(`https://open.cnpja.com/office/${cnpjDigits}`);
            if (!res.ok) throw new Error('Erro ao consultar CNPJ');
            const data = await res.json();
            const addr = data.address;
            const street = addr?.street ? `${addr.street}${addr.number ? `, ${addr.number}` : ''}` : '';
            const district = addr?.district || '';
            const fullAddress = [street, district].filter(Boolean).join(' — ');
            setForm(prev => ({
                ...prev,
                name: data.company?.name || prev.name,
                tradeName: data.alias || data.company?.name || prev.tradeName,
                address: fullAddress || prev.address,
                city: addr?.city || prev.city,
                state: addr?.state || prev.state,
                zip: addr?.zip ? addr.zip.replace(/(\d{5})(\d{3})/, '$1-$2') : prev.zip,
                phone: data.phones?.[0]?.number ? data.phones[0].area + data.phones[0].number : prev.phone,
                email: data.emails?.[0]?.address || prev.email,
            }));
            setCnpjStatus('success');
            toast.success('Dados preenchidos automaticamente!');
        } catch {
            setCnpjStatus('error');
        }
        setCnpjLoading(false);
    }, [toast]);

    const handleCnpjChange = (value: string) => {
        const formatted = formatCnpjInput(value);
        setForm(prev => ({ ...prev, cnpj: formatted }));
        setCnpjStatus('idle');
        const digits = cleanCnpj(formatted);
        if (digits.length === 14) {
            handleCnpjLookup(formatted);
        }
    };
    // Image upload — compress via canvas then store as small base64
    const coverInputRef = useRef<HTMLInputElement>(null);
    const profileInputRef = useRef<HTMLInputElement>(null);

    const compressImage = (file: File, maxW: number, maxH: number, quality = 0.7): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * (maxW / w); w = maxW; }
                if (h > maxH) { w = w * (maxH / h); h = maxH; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleImageUpload = async (file: File, field: 'coverImage' | 'profileImage') => {
        if (!file || !file.type.startsWith('image/')) return;
        // Compress: profile 200x200, cover 800x300
        const maxW = field === 'profileImage' ? 200 : 800;
        const maxH = field === 'profileImage' ? 200 : 300;
        const compressed = await compressImage(file, maxW, maxH);
        setForm(prev => ({ ...prev, [field]: compressed }));
    };

    // Cleanup on modal close
    useEffect(() => {
        if (!showModal) {
            setCnpjStatus('idle');
            lastLookedUpCnpj.current = '';
        }
    }, [showModal]);

    // Build map URL from address — memoized to prevent iframe re-renders
    const mapSrc = useMemo(() => {
        const parts = [form.address, form.city, form.state].filter(Boolean);
        if (parts.length < 2) return null;
        const q = encodeURIComponent(parts.join(', ') + ', Brasil');
        return `https://maps.google.com/maps?q=${q}&output=embed&z=16`;
    }, [form.address, form.city, form.state]);

    // Dirty tracking — compare current form with initial snapshot
    const isDirty = useMemo(() => {
        return JSON.stringify(form) !== initialFormRef.current;
    }, [form]);

    // Close confirmation — only if dirty
    const handleCloseModal = async () => {
        if (isDirty) {
            const ok = await confirm({
                title: 'Descartar alterações?',
                message: 'Você tem dados preenchidos. Se fechar, perderá o progresso.',
            });
            if (!ok) return;
        }
        setShowModal(false);
    };

    // Required fields validation + dirty check for edit mode
    const canSave = !!(form.name && form.address && form.city && form.phone) && isDirty;

    function renderModal() {
        if (!showModal) return null;
        const inputClass = `w-full px-3 py-2 rounded-lg border ${borderCol} ${isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white'} text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors`;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className={`w-full max-w-2xl ${isDarkMode ? 'bg-zinc-900' : 'bg-white'} rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}>
                    {/* ═══ Cover Image Banner ═══ */}
                    <div className="relative flex-shrink-0">
                        <div
                            className={`h-28 rounded-t-2xl relative overflow-hidden cursor-pointer group ${form.coverImage
                                ? ''
                                : isDarkMode
                                    ? 'bg-gradient-to-r from-primary/30 via-zinc-800 to-zinc-800'
                                    : 'bg-gradient-to-r from-primary/20 via-slate-50 to-slate-100'
                                }`}
                            onClick={() => coverInputRef.current?.click()}
                        >
                            {form.coverImage && (
                                <img src={form.coverImage} alt="Capa" className="absolute inset-0 w-full h-full object-cover" />
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-1">
                                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <Plus size={16} className="text-white" />
                                    </div>
                                    <span className="text-[10px] text-white font-medium">Imagem de Capa</span>
                                </div>
                            </div>
                            {/* Close button on cover */}
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCloseModal(); }}
                                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-colors text-white/80 hover:text-white z-10">
                                <X size={14} />
                            </button>
                            {/* Profile image inside cover */}
                            <div className="absolute bottom-3 left-4 flex items-end gap-3 z-10" onClick={e => e.stopPropagation()}>
                                <div
                                    className={`w-14 h-14 rounded-xl border-2 ${form.coverImage ? 'border-white/30' : isDarkMode ? 'border-zinc-600' : 'border-slate-300'} ${isDarkMode ? 'bg-zinc-800' : 'bg-white'} cursor-pointer group/pf relative overflow-hidden shadow-lg flex-shrink-0`}
                                    onClick={() => profileInputRef.current?.click()}
                                >
                                    {form.profileImage ? (
                                        <img src={form.profileImage} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Building2 size={20} className={isDarkMode ? 'text-zinc-600' : 'text-slate-300'} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover/pf:bg-black/40 transition-all flex items-center justify-center">
                                        <Plus size={12} className="text-white opacity-0 group-hover/pf:opacity-100 transition-all" />
                                    </div>
                                </div>
                                <div className="pb-0.5">
                                    <h2 className={`text-sm font-bold ${form.coverImage ? 'text-white drop-shadow-md' : isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                        {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
                                    </h2>
                                    <p className={`text-[10px] ${form.coverImage ? 'text-white/60' : isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                                        Preencha os dados da unidade
                                    </p>
                                </div>
                            </div>
                            <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                                onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'coverImage')} />
                            <input ref={profileInputRef} type="file" accept="image/*" className="hidden"
                                onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'profileImage')} />
                        </div>
                    </div>

                    {/* ═══ Scrollable Form Body ═══ */}
                    <form id="unit-form" onSubmit={handleSave} className="flex-1 overflow-y-auto pt-4 pb-4">
                        <div className="px-5 space-y-5">

                            {/* ─── CNPJ Section ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>CNPJ</label>
                                <div className="relative">
                                    <input type="text" value={form.cnpj || ''} onChange={e => handleCnpjChange(e.target.value)}
                                        className={`${inputClass} font-mono pr-9`}
                                        placeholder="00.000.000/0000-00"
                                        maxLength={18} />
                                    {cnpjLoading && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 size={14} className="animate-spin text-primary" />
                                        </div>
                                    )}
                                    {cnpjStatus === 'success' && !cnpjLoading && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <CheckCircle size={14} className="text-emerald-500" />
                                        </div>
                                    )}
                                </div>
                                {cnpjStatus === 'success' && (
                                    <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                                        <CheckCircle size={9} /> Dados preenchidos automaticamente
                                    </p>
                                )}
                                {cnpjStatus === 'error' && (
                                    <p className="text-[10px] text-red-400 mt-1">CNPJ não encontrado</p>
                                )}
                            </div>

                            {/* ─── Identificação ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Identificação</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Razão Social *</label>
                                        <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })}
                                            className={inputClass} placeholder="VINNX Barbearia LTDA" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Nome Fantasia</label>
                                        <input type="text" value={form.tradeName || ''} onChange={e => setForm({ ...form, tradeName: e.target.value })}
                                            className={inputClass} placeholder="VINNX Barbearia — Filial Centro" />
                                    </div>
                                </div>
                            </div>

                            {/* ─── Endereço ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Endereço</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Logradouro *</label>
                                        <input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })}
                                            className={inputClass} placeholder="Rua/Av, número — Bairro" />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Cidade *</label>
                                        <input type="text" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })}
                                            className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>UF</label>
                                            <input type="text" value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })}
                                                maxLength={2} className={`${inputClass} uppercase`} />
                                        </div>
                                        <div>
                                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>CEP</label>
                                            <input type="text" value={form.zip || ''} onChange={e => setForm({ ...form, zip: e.target.value })}
                                                className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                {/* ─── Auto Map ─── */}
                                {mapSrc && (
                                    <div className={`mt-3 rounded-xl overflow-hidden border ${borderCol}`}>
                                        <iframe
                                            className="w-full h-[160px] border-0"
                                            src={mapSrc}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            allowFullScreen
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ─── Contato ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Contato</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Telefone *</label>
                                        <input type="text" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })}
                                            className={inputClass} placeholder="(11) 99999-0000" />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Email</label>
                                        <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })}
                                            className={inputClass} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Gerente Responsável</label>
                                        <input type="text" value={form.managerName || ''} onChange={e => setForm({ ...form, managerName: e.target.value })}
                                            className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            {/* ─── Operação ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Operação</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Status</label>
                                        <CustomDropdown
                                            value={form.status || 'active'}
                                            onChange={v => setForm({ ...form, status: v as Unit['status'] })}
                                            options={[
                                                { value: 'active', label: 'Ativa', dot: 'bg-emerald-500' },
                                                { value: 'inactive', label: 'Inativa', dot: 'bg-slate-400' },
                                                { value: 'opening', label: 'Em Abertura', dot: 'bg-amber-500' },
                                            ]}
                                            isDarkMode={isDarkMode}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Capacidade</label>
                                        <input type="number" value={form.maxCapacity || ''} onChange={e => setForm({ ...form, maxCapacity: parseInt(e.target.value) || 0 })}
                                            className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Horário</label>
                                        <input type="text" value={form.operatingHours || ''} onChange={e => setForm({ ...form, operatingHours: e.target.value })}
                                            className={inputClass} placeholder="09:00 - 20:00" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* ═══ Sticky Footer ═══ */}
                    <div className={`flex items-center justify-between p-4 border-t ${borderCol} flex-shrink-0`}>
                        {!canSave && (
                            <p className={`text-[10px] ${textSub}`}>Preencha Nome, Endereço, Cidade e Telefone</p>
                        )}
                        {canSave && <div />}
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handleCloseModal}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDarkMode ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                Cancelar
                            </button>
                            <button type="submit" form="unit-form" disabled={saving || !canSave}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? 'Salvando...' : editingUnit ? 'Salvar Alterações' : 'Criar Unidade'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    const handleOpenModal = (unit?: Unit) => {
        lastLookedUpCnpj.current = '';
        if (unit) {
            setEditingUnit(unit);
            const formData = { ...unit };
            setForm(formData);
            initialFormRef.current = JSON.stringify(formData);
        } else {
            setEditingUnit(null);
            const formData = { ...defaultForm };
            setForm(formData);
            initialFormRef.current = JSON.stringify(formData);
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.address || !form.city || !form.phone) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }
        setSaving(true);
        try {
            const unitData: Unit = {
                id: editingUnit?.id || '',
                name: form.name || '',
                tradeName: form.tradeName,
                cnpj: form.cnpj,
                address: form.address || '',
                city: form.city || '',
                state: form.state || 'SP',
                zip: form.zip,
                phone: form.phone || '',
                email: form.email,
                managerId: form.managerId,
                managerName: form.managerName,
                status: (form.status as Unit['status']) || 'active',
                image: form.image,
                coverImage: form.coverImage,
                profileImage: form.profileImage,
                openingDate: form.openingDate,
                maxCapacity: form.maxCapacity ?? 6,
                operatingHours: form.operatingHours || '09:00 - 20:00',
                notes: form.notes,
            };
            const result = await saveUnit(unitData);
            if (result.success) {
                toast.success(editingUnit ? 'Unidade atualizada!' : 'Unidade criada!');
                await refresh(true);
                setShowModal(false);
            } else {
                toast.error(result.error || 'Erro ao salvar unidade.');
            }
        } catch (err) {
            toast.error('Erro ao salvar unidade.');
        }
        setSaving(false);
    };

    const handleDelete = (id: string) => {
        setDeletePassword('');
        setDeleteMode('deactivate');
        setShowDeleteModal(id);
    };

    const confirmDelete = async () => {
        if (!showDeleteModal || !deletePassword) return;
        setDeleteLoading(true);
        try {
            // Verify password via Supabase auth
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('Usuário não encontrado');
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: deletePassword,
            });
            if (authError) {
                toast.error('Senha incorreta.');
                setDeleteLoading(false);
                return;
            }

            if (deleteMode === 'permanent') {
                // Hard delete — remove unit_members links first, then delete the unit
                await supabase.from('unit_members').delete().eq('unitId', showDeleteModal);
                const result = await deleteUnit(showDeleteModal);
                if (!result.success) throw new Error(result.error);
                toast.success('Unidade excluída permanentemente.');
            } else {
                // Soft delete — set status inactive + deletedAt
                const now = new Date().toISOString();
                const { error } = await supabase.from('units').update({
                    status: 'inactive',
                    deletedAt: now,
                    updatedAt: now,
                }).eq('id', showDeleteModal);
                if (error) throw error;
                toast.success('Unidade desativada com sucesso.');
            }
            await refresh(true);
            setShowDeleteModal(null);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao processar exclusão.');
        }
        setDeleteLoading(false);
    };

    const renderKpi = (label: string, value: string, icon: React.ElementType, color: string, bg: string) => {
        const Icon = icon;
        return (
            <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${bg}`}><Icon size={18} className={color} /></div>
                </div>
                <p className={`text-2xl font-bold ${textMain} mb-0.5`}>{value}</p>
                <p className={`text-[10px] ${textSub}`}>{label}</p>
            </div>
        );
    };

    const renderRankBar = (pct: number, color: string) => (
        <div className="flex items-center gap-2">
            <div className={`h-2 rounded-full flex-1 max-w-[100px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
        </div>
    );

    // Empty state
    if (units.length === 0 && subTab === 'overview') {
        return (
            <div className="animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                            <Building2 size={24} className="text-primary" /> Unidades
                        </h1>
                        <p className={`text-sm ${textSub}`}>Gestão multi-unidades da rede</p>
                    </div>
                    <button onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                        <Plus size={14} /> Nova Unidade
                    </button>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-12 text-center ${shadowClass}`}>
                    <Building2 size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    <h3 className={`text-lg font-bold ${textMain} mb-2`}>Nenhuma unidade cadastrada</h3>
                    <p className={`text-sm ${textSub} mb-6 max-w-md mx-auto`}>
                        Comece cadastrando sua primeira unidade.  Cada unidade terá seus próprios KPIs, profissionais e atendimentos.
                    </p>
                    <button onClick={() => handleOpenModal()}
                        className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                        <Plus size={16} className="inline mr-2" /> Criar Primeira Unidade
                    </button>
                </div>
                {/* Modal below */}
                {renderModal()}
            </div>
        );
    }


    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Building2 size={24} className="text-primary" /> Unidades
                    </h1>
                    <p className={`text-sm ${textSub}`}>Gestão multi-unidades da rede</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        {(['overview', 'ranking', 'details'] as const).map(t => (
                            <button key={t} onClick={() => setSubTab(t)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${subTab === t ? 'bg-primary text-white' : `${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}`}>
                                {t === 'overview' ? 'Visão Geral' : t === 'ranking' ? 'Rankings' : 'Detalhes'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                        <Plus size={14} /> Nova Unidade
                    </button>
                </div>
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {subTab === 'overview' && (
                <div className="space-y-6">
                    {/* Global KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Faturamento Global', formatCurrency(globalKpis.totalRevenue), DollarSign, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                        {renderKpi('Total Clientes', globalKpis.totalCustomers.toString(), Users, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Ticket Médio', formatCurrency(globalKpis.ticketMedio), TrendingUp, 'text-violet-500', isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50')}
                        {renderKpi('Margem de Lucro', `${globalKpis.profitMargin.toFixed(1)}%`, Target, globalKpis.profitMargin >= 30 ? 'text-emerald-500' : 'text-amber-500', globalKpis.profitMargin >= 30 ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'))}
                    </div>

                    {/* Unit Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {units.map(unit => {
                            const kpi = unitKpis.find(k => k.unitId === unit.id) || { revenue: 0, atendimentos: 0, customers: 0, professionals: 0, expenses: 0, ticket: 0 };
                            const profit = kpi.revenue - kpi.expenses;
                            const margin = kpi.revenue > 0 ? (profit / kpi.revenue) * 100 : 0;
                            const statusCfg = STATUS_CONFIG[unit.status];
                            const revPct = globalKpis.totalRevenue > 0 ? (kpi.revenue / globalKpis.totalRevenue) * 100 : 0;
                            return (
                                <div key={unit.id} className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden group transition-all hover:border-primary/30`}>
                                    {/* Card Header */}
                                    <div className="p-5 pb-3">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'} flex items-center justify-center overflow-hidden`}>
                                                    {unit.profileImage ? (
                                                        <img src={unit.profileImage} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Building2 size={20} className="text-primary" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className={`text-sm font-bold ${textMain}`}>{unit.tradeName || unit.name}</h3>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <MapPin size={10} className={textSub} />
                                                        <span className={`text-[10px] ${textSub}`}>{unit.city}/{unit.state}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                                        </div>

                                        {/* Mini KPIs */}
                                        {unit.status === 'active' && (
                                            <div className="grid grid-cols-3 gap-3 mb-3">
                                                <div>
                                                    <p className={`text-xs font-bold text-emerald-500`}>{formatCurrency(kpi.revenue)}</p>
                                                    <p className={`text-[9px] ${textSub}`}>Faturamento</p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold ${textMain}`}>{kpi.atendimentos}</p>
                                                    <p className={`text-[9px] ${textSub}`}>Atendimentos</p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold ${margin >= 30 ? 'text-emerald-500' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{margin.toFixed(0)}%</p>
                                                    <p className={`text-[9px] ${textSub}`}>Margem</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Revenue participation bar */}
                                        {unit.status === 'active' && (
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className={`text-[9px] ${textSub}`}>Participação na rede</span>
                                                    <span className={`text-[9px] font-bold ${textMain}`}>{revPct.toFixed(1)}%</span>
                                                </div>
                                                <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${revPct}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        {unit.status === 'opening' && !unit.deletedAt && (
                                            <div className={`flex items-center gap-2 p-3 rounded-lg ${isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50'}`}>
                                                <Clock size={14} className="text-blue-500" />
                                                <div>
                                                    <p className={`text-[10px] ${textSub}`}>Inauguração prevista</p>
                                                    <p className="text-xs font-bold text-blue-500">{unit.openingDate ? new Date(unit.openingDate).toLocaleDateString('pt-BR') : 'A definir'}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Soft-delete warning */}
                                        {unit.deletedAt && (
                                            <div className={`flex items-center gap-2 p-3 rounded-lg ${isDarkMode ? 'bg-red-500/5' : 'bg-red-50'} border ${isDarkMode ? 'border-red-500/10' : 'border-red-100'}`}>
                                                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                                <div>
                                                    <p className={`text-[10px] font-bold text-red-500`}>Exclusão agendada</p>
                                                    <p className={`text-[10px] ${textSub}`}>Será removida permanentemente em {(() => {
                                                        const del = new Date(unit.deletedAt!);
                                                        del.setDate(del.getDate() + 7);
                                                        const diff = Math.max(0, Math.ceil((del.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                                        return `${diff} dia${diff !== 1 ? 's' : ''}`;
                                                    })()}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Footer */}
                                    <div className={`flex items-center justify-between px-5 py-3 border-t ${borderCol} ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50/50'}`}>
                                        <div className="flex items-center gap-1.5">
                                            <Users size={12} className={textSub} />
                                            <span className={`text-[10px] ${textSub}`}>{kpi.professionals} profissionais</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(unit)} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} transition-all`}>
                                                <Pencil size={12} className={textSub} />
                                            </button>
                                            <button onClick={() => handleDelete(unit.id)} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'} transition-all`}>
                                                <Trash2 size={12} className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ RANKINGS ═══ */}
            {subTab === 'ranking' && (
                <div className="space-y-6">
                    {/* Global KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderKpi('Unidades Ativas', globalKpis.activeCount.toString(), Building2, 'text-primary', isDarkMode ? 'bg-primary/10' : 'bg-primary/5')}
                        {renderKpi('Total Profissionais', globalKpis.totalProfessionals.toString(), Users, 'text-violet-500', isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50')}
                        {renderKpi('Total Atendimentos', globalKpis.totalAtendimentos.toString(), Activity, 'text-amber-500', isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50')}
                        {renderKpi('Lucro Global', formatCurrency(globalKpis.totalRevenue - globalKpis.totalExpenses), TrendingUp, 'text-emerald-500', isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50')}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Revenue Ranking */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><DollarSign size={16} className="text-emerald-500" /> Ranking por Faturamento</h3>
                            <div className="space-y-3">
                                {rankings.byRevenue.length === 0 && <p className={`text-xs ${textSub}`}>Nenhuma unidade ativa</p>}
                                {rankings.byRevenue.map((u, i) => {
                                    const maxRev = rankings.byRevenue[0]?.revenue || 1;
                                    const pct = (u.revenue / maxRev) * 100;
                                    return (
                                        <div key={u.id} className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-500/10 text-amber-500' : i === 1 ? 'bg-slate-300/20 text-slate-400' : i === 2 ? 'bg-orange-500/10 text-orange-600' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className={`text-xs font-medium ${textMain}`}>{u.tradeName || u.name}</span>
                                                    <span className="text-xs font-bold text-emerald-500">{formatCurrency(u.revenue)}</span>
                                                </div>
                                                {renderRankBar(pct, 'bg-emerald-500')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Ticket Ranking */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><TrendingUp size={16} className="text-violet-500" /> Ranking por Ticket Médio</h3>
                            <div className="space-y-3">
                                {rankings.byTicket.length === 0 && <p className={`text-xs ${textSub}`}>Nenhuma unidade ativa</p>}
                                {rankings.byTicket.map((u, i) => {
                                    const maxTicket = rankings.byTicket[0]?.ticket || 1;
                                    const pct = maxTicket > 0 ? (u.ticket / maxTicket) * 100 : 0;
                                    return (
                                        <div key={u.id} className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-violet-500/10 text-violet-500' : i === 1 ? 'bg-slate-300/20 text-slate-400' : i === 2 ? 'bg-orange-500/10 text-orange-600' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className={`text-xs font-medium ${textMain}`}>{u.tradeName || u.name}</span>
                                                    <span className="text-xs font-bold text-violet-500">{formatCurrency(u.ticket)}</span>
                                                </div>
                                                {renderRankBar(pct, 'bg-violet-500')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Margin Ranking */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Target size={16} className="text-primary" /> Ranking por Margem</h3>
                            <div className="space-y-3">
                                {rankings.byMargin.length === 0 && <p className={`text-xs ${textSub}`}>Nenhuma unidade ativa</p>}
                                {rankings.byMargin.map((u, i) => (
                                    <div key={u.id} className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary/10 text-primary' : i === 1 ? 'bg-slate-300/20 text-slate-400' : i === 2 ? 'bg-orange-500/10 text-orange-600' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className={`text-xs font-medium ${textMain}`}>{u.tradeName || u.name}</span>
                                                <span className={`text-xs font-bold ${u.margin >= 30 ? 'text-emerald-500' : u.margin >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{u.margin.toFixed(1)}%</span>
                                            </div>
                                            {renderRankBar(u.margin, u.margin >= 30 ? 'bg-emerald-500' : u.margin >= 15 ? 'bg-amber-500' : 'bg-red-500')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Customers Ranking */}
                        <div className={`${bgCard} border ${borderCol} rounded-xl p-5 ${shadowClass}`}>
                            <h3 className={`text-sm font-bold ${textMain} mb-4 flex items-center gap-2`}><Users size={16} className="text-amber-500" /> Ranking por Clientes</h3>
                            <div className="space-y-3">
                                {rankings.byCustomers.length === 0 && <p className={`text-xs ${textSub}`}>Nenhuma unidade ativa</p>}
                                {rankings.byCustomers.map((u, i) => {
                                    const maxC = rankings.byCustomers[0]?.customers || 1;
                                    const pct = (u.customers / maxC) * 100;
                                    return (
                                        <div key={u.id} className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-500/10 text-amber-500' : i === 1 ? 'bg-slate-300/20 text-slate-400' : i === 2 ? 'bg-orange-500/10 text-orange-600' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className={`text-xs font-medium ${textMain}`}>{u.tradeName || u.name}</span>
                                                    <span className="text-xs font-bold text-amber-500">{u.customers} clientes</span>
                                                </div>
                                                {renderRankBar(pct, 'bg-amber-500')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ DETAILS TABLE ═══ */}
            {subTab === 'details' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl ${shadowClass} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className={`text-[11px] ${textSub} uppercase ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                                <th className="text-left py-3 px-5">Unidade</th>
                                <th className="text-left py-3 px-3">Endereço</th>
                                <th className="text-center py-3 px-3">Status</th>
                                <th className="text-center py-3 px-3">Gerente</th>
                                <th className="text-center py-3 px-3">Profissionais</th>
                                <th className="text-center py-3 px-3">Clientes</th>
                                <th className="text-center py-3 px-3">Atendimentos</th>
                                <th className="text-right py-3 px-3">Faturamento</th>
                                <th className="text-right py-3 px-3">Lucro</th>
                                <th className="text-right py-3 px-5">Margem</th>
                            </tr></thead>
                            <tbody>
                                {units.map((u) => {
                                    const kpi = unitKpis.find(k => k.unitId === u.id) || { revenue: 0, atendimentos: 0, customers: 0, professionals: 0, expenses: 0 };
                                    const profit = kpi.revenue - kpi.expenses;
                                    const margin = kpi.revenue > 0 ? (profit / kpi.revenue) * 100 : 0;
                                    const sc = STATUS_CONFIG[u.status];
                                    return (
                                        <tr key={u.id} className={`border-t ${borderCol} ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className={`py-3 px-5 font-medium ${textMain}`}>
                                                <div className="flex items-center gap-2">
                                                    <Building2 size={14} className="text-primary" />
                                                    <span className="text-xs font-bold">{u.tradeName || u.name}</span>
                                                </div>
                                            </td>
                                            <td className={`py-3 px-3 text-xs ${textSub}`}>
                                                {u.address}, {u.city}/{u.state}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                            </td>
                                            <td className={`py-3 px-3 text-center text-xs ${textMain}`}>{u.managerName || '-'}</td>
                                            <td className={`py-3 px-3 text-center text-xs font-bold ${textMain}`}>{kpi.professionals}</td>
                                            <td className={`py-3 px-3 text-center text-xs ${textMain}`}>{kpi.customers}</td>
                                            <td className={`py-3 px-3 text-center text-xs ${textMain}`}>{kpi.atendimentos}</td>
                                            <td className="py-3 px-3 text-right text-xs font-bold text-emerald-500">{kpi.revenue > 0 ? formatCurrency(kpi.revenue) : '-'}</td>
                                            <td className={`py-3 px-3 text-right text-xs font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{kpi.revenue > 0 ? formatCurrency(profit) : '-'}</td>
                                            <td className={`py-3 px-5 text-right text-xs font-bold ${margin >= 30 ? 'text-emerald-500' : margin >= 15 ? 'text-amber-500' : kpi.revenue > 0 ? 'text-red-500' : textSub}`}>
                                                {kpi.revenue > 0 ? `${margin.toFixed(1)}%` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Totals row */}
                                <tr className={`border-t-2 ${borderCol} ${isDarkMode ? 'bg-slate-900/70' : 'bg-slate-50'}`}>
                                    <td className={`py-3 px-5 text-xs font-bold ${textMain}`} colSpan={4}>TOTAL DA REDE</td>
                                    <td className={`py-3 px-3 text-center text-xs font-bold ${textMain}`}>{globalKpis.totalProfessionals}</td>
                                    <td className={`py-3 px-3 text-center text-xs font-bold ${textMain}`}>{globalKpis.totalCustomers}</td>
                                    <td className={`py-3 px-3 text-center text-xs font-bold ${textMain}`}>{globalKpis.totalAtendimentos}</td>
                                    <td className="py-3 px-3 text-right text-xs font-bold text-emerald-500">{formatCurrency(globalKpis.totalRevenue)}</td>
                                    <td className="py-3 px-3 text-right text-xs font-bold text-emerald-500">{formatCurrency(globalKpis.totalRevenue - globalKpis.totalExpenses)}</td>
                                    <td className={`py-3 px-5 text-right text-xs font-bold ${globalKpis.profitMargin >= 30 ? 'text-emerald-500' : 'text-amber-500'}`}>{globalKpis.profitMargin.toFixed(1)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ MODAL ═══ */}
            {renderModal()}

            {/* ═══ DELETE PASSWORD MODAL ═══ */}
            {showDeleteModal && (() => {
                const targetUnit = units.find(u => u.id === showDeleteModal);
                const targetName = targetUnit?.tradeName || targetUnit?.name || 'Unidade';
                return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className={`w-full max-w-md ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl`}>
                        <div className={`p-6 border-b ${isDarkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
                            <h3 className={`text-lg font-bold ${textMain}`}>Excluir "{targetName}"</h3>

                            {/* Mode selector */}
                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteMode('deactivate')}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${deleteMode === 'deactivate'
                                        ? 'border-amber-500 ' + (isDarkMode ? 'bg-amber-500/5' : 'bg-amber-50')
                                        : (isDarkMode ? 'border-zinc-700 hover:border-zinc-600' : 'border-slate-200 hover:border-slate-300')}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deleteMode === 'deactivate' ? 'border-amber-500' : isDarkMode ? 'border-zinc-600' : 'border-slate-300'}`}>
                                            {deleteMode === 'deactivate' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                        </div>
                                        <span className={`text-sm font-bold ${textMain}`}>Desativar</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>Recomendado</span>
                                    </div>
                                    <p className={`text-xs ${textSub} mt-1 ml-6`}>A unidade será desativada e ficará oculta, mas os dados serão preservados.</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setDeleteMode('permanent')}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${deleteMode === 'permanent'
                                        ? 'border-red-500 ' + (isDarkMode ? 'bg-red-500/5' : 'bg-red-50')
                                        : (isDarkMode ? 'border-zinc-700 hover:border-zinc-600' : 'border-slate-200 hover:border-slate-300')}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deleteMode === 'permanent' ? 'border-red-500' : isDarkMode ? 'border-zinc-600' : 'border-slate-300'}`}>
                                            {deleteMode === 'permanent' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                                        </div>
                                        <span className={`text-sm font-bold ${textMain}`}>Excluir permanentemente</span>
                                    </div>
                                    <p className={`text-xs ${textSub} mt-1 ml-6`}>A unidade e todos os vínculos serão <span className="font-bold text-red-500">removidos para sempre</span>. Esta ação não pode ser desfeita.</p>
                                </button>
                            </div>

                            <p className={`mt-4 text-xs font-medium ${textSub}`}>Digite sua senha para confirmar:</p>
                            <div className="relative mt-2">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    <Lock size={14} className={isDarkMode ? 'text-zinc-500' : 'text-slate-400'} />
                                </div>
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={e => setDeletePassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmDelete()}
                                    placeholder="Sua senha"
                                    autoFocus
                                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-white' : 'border-slate-300 bg-white'} text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none`}
                                />
                            </div>
                        </div>
                        <div className="p-4 flex gap-3">
                            <button onClick={() => setShowDeleteModal(null)}
                                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm border ${isDarkMode ? 'border-zinc-700 text-slate-300 hover:bg-zinc-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                Cancelar
                            </button>
                            <button onClick={confirmDelete} disabled={!deletePassword || deleteLoading}
                                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${deleteMode === 'permanent' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                {deleteLoading ? 'Verificando...' : deleteMode === 'permanent' ? 'Excluir Permanentemente' : 'Desativar Unidade'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};
