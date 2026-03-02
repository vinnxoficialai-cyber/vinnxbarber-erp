import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    Users, Shield, ShieldCheck, ShieldAlert, ShieldX,
    Edit2, Plus, FileText, Building2, CreditCard,
    Award, AlertCircle, ChevronDown, Upload, Lock,
    Key, CheckCircle2, Loader2, CheckCircle, X, Search
} from 'lucide-react';
import { TeamMember, ProfessionalFiscalData } from '../../types';
import { saveProfessionalFiscalData } from '../../lib/dataService';
import { uploadCertificate } from '../../lib/fiscalService';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';

interface Props {
    barbers: TeamMember[];
    fiscalData: ProfessionalFiscalData[];
    isDarkMode: boolean;
    onRefresh: () => void;
    confirm: any;
    toast: any;
}

const STATUS_FILTER_OPTIONS: DropdownOption[] = [
    { value: 'all', label: 'Todos', dot: 'bg-slate-400' },
    { value: 'active', label: 'Ativos', dot: 'bg-emerald-500' },
    { value: 'pending', label: 'Pendentes', dot: 'bg-amber-500' },
    { value: 'irregular', label: 'Irregulares', dot: 'bg-red-500' },
];

export default function TabEquipe({ barbers, fiscalData, isDarkMode, onRefresh, confirm, toast }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white';
    const inputClass = `w-full px-3 py-2 rounded-lg border ${borderCol} ${bgInput} text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors`;

    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    // CNPJ Lookup state
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const lastLookedUpCnpj = useRef<string>('');

    // Form + dirty tracking
    const defaultForm: Partial<ProfessionalFiscalData> = {
        cnpj: '', razaoSocial: '', nomeFantasia: '', taxRegime: 'mei',
        emissionVia: 'cnpj_proprio', municipalRegistration: '', stateRegistration: '',
        cnae: '', address: '', city: '', state: '', zip: '',
        certificateFile: null, certificatePassword: null, certificateName: null,
        certificateExpiry: null, certificateStatus: 'missing', fiscalStatus: 'pending',
        active: true,
    };
    const [formData, setFormData] = useState<Partial<ProfessionalFiscalData>>(defaultForm);
    const initialFormRef = useRef<string>('');

    const isDirty = useMemo(() => JSON.stringify(formData) !== initialFormRef.current, [formData]);

    // canSave: required fields = cnpj + razaoSocial + city + taxRegime
    const canSave = !!(formData.cnpj && formData.razaoSocial && formData.city && formData.taxRegime) && isDirty;

    // ===================== CNPJ LOGIC =====================
    const formatCnpjInput = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 14);
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    };

    const cleanCnpj = (cnpj: string) => cnpj.replace(/\D/g, '');

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
            setFormData(prev => ({
                ...prev,
                razaoSocial: data.company?.name || prev.razaoSocial,
                nomeFantasia: data.alias || data.company?.name || prev.nomeFantasia,
                address: fullAddress || prev.address,
                city: addr?.city || prev.city,
                state: addr?.state || prev.state,
                zip: addr?.zip ? addr.zip.replace(/(\d{5})(\d{3})/, '$1-$2') : prev.zip,
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
        setFormData(prev => ({ ...prev, cnpj: formatted }));
        setCnpjStatus('idle');
        const digits = cleanCnpj(formatted);
        if (digits.length === 14) {
            handleCnpjLookup(formatted);
        }
    };

    // ===================== MODAL OPEN / CLOSE =====================
    const handleOpenModal = (barber: TeamMember) => {
        lastLookedUpCnpj.current = '';
        setEditingMember(barber);
        const existing = fiscalData.find(f => f.memberId === barber.id);
        if (existing) {
            const fd = { ...existing };
            setFormData(fd);
            initialFormRef.current = JSON.stringify(fd);
        } else {
            const fd = { ...defaultForm, memberId: barber.id };
            setFormData(fd);
            initialFormRef.current = JSON.stringify(fd);
        }
        setCnpjStatus('idle');
        setShowModal(true);
    };

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

    // ===================== SAVE =====================
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.cnpj || !formData.razaoSocial || !formData.city || !formData.taxRegime) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }
        setSaving(true);
        try {
            const result = await saveProfessionalFiscalData(formData as ProfessionalFiscalData);
            if (result.success) {
                toast.success('Dados fiscais salvos!');
                onRefresh();
                setShowModal(false);
            } else {
                toast.error('Erro', result.error || 'Erro ao salvar dados fiscais.');
            }
        } catch (err: any) {
            toast.error('Erro', err.message || 'Erro ao salvar.');
        }
        setSaving(false);
    };

    // ===================== CERTIFICATE UPLOAD =====================
    const handleCertUpload = async (file: File) => {
        if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
            toast.error('Formato inválido', 'Selecione um arquivo .pfx ou .p12');
            return;
        }
        const memberId = editingMember?.id || 'new';
        const result = await uploadCertificate(file, memberId);
        if (result.success) {
            setFormData({
                ...formData,
                certificateFile: result.path,
                certificateName: file.name,
                certificateStatus: 'valid',
            });
            toast.success('Certificado enviado', `${file.name} carregado.`);
        } else {
            toast.error('Erro no upload', result.error || 'Não foi possível enviar.');
        }
    };

    // ===================== STATUS BADGES =====================
    const statusBadge = (status: string) => {
        const map: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
            active: { label: 'Ativo', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', Icon: ShieldCheck },
            irregular: { label: 'Irregular', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', Icon: ShieldAlert },
            pending: { label: 'Pendente', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', Icon: ShieldX },
            _default: { label: 'Sem dados', color: textSub, bg: isDarkMode ? 'bg-dark' : 'bg-slate-50', Icon: Shield },
        };
        const cfg = map[status] || map._default;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
                <cfg.Icon size={11} /> {cfg.label}
            </span>
        );
    };

    // ===================== FILTERED BARBERS =====================
    const filteredBarbers = useMemo(() => {
        return barbers.filter(b => {
            if (statusFilter !== 'all') {
                const fd = fiscalData.find(f => f.memberId === b.id);
                const st = fd?.fiscalStatus || 'pending';
                if (statusFilter !== st) return false;
            }
            if (search) {
                return b.name.toLowerCase().includes(search.toLowerCase());
            }
            return true;
        });
    }, [barbers, fiscalData, statusFilter, search]);

    // ===================== RENDER MODAL =====================
    function renderModal() {
        if (!showModal || !editingMember) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className={`w-full max-w-2xl ${isDarkMode ? 'bg-zinc-900' : 'bg-white'} rounded-2xl shadow-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}>
                    {/* Header */}
                    <div className={`p-5 border-b ${borderCol} flex items-center justify-between flex-shrink-0`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'} flex items-center justify-center`}>
                                {editingMember.avatar ? (
                                    <img src={editingMember.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                                ) : (
                                    <span className="text-sm font-bold text-primary">{editingMember.name.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h2 className={`text-sm font-bold ${textMain}`}>
                                    Dados Fiscais — {editingMember.name}
                                </h2>
                                <p className={`text-[10px] ${textSub}`}>Preencha os dados para emissão de NF</p>
                            </div>
                        </div>
                        <button type="button" onClick={handleCloseModal}
                            className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-slate-100'} transition-colors`}>
                            <X size={16} className={textSub} />
                        </button>
                    </div>

                    {/* Body */}
                    <form id="fiscal-form" onSubmit={handleSave} className="flex-1 overflow-y-auto pt-4 pb-4 custom-scrollbar">
                        <div className="px-5 space-y-5">

                            {/* ─── CNPJ Section ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>CNPJ *</label>
                                <div className="relative">
                                    <input type="text" value={formData.cnpj || ''} onChange={e => handleCnpjChange(e.target.value)}
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
                                        <input type="text" value={formData.razaoSocial || ''} onChange={e => setFormData({ ...formData, razaoSocial: e.target.value })}
                                            className={inputClass} placeholder="Nome empresarial" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Nome Fantasia</label>
                                        <input type="text" value={formData.nomeFantasia || ''} onChange={e => setFormData({ ...formData, nomeFantasia: e.target.value })}
                                            className={inputClass} placeholder="Nome fantasia" />
                                    </div>
                                </div>
                            </div>

                            {/* ─── Regime Tributário ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Tributação</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Regime Tributário *</label>
                                        <CustomDropdown
                                            value={formData.taxRegime || 'mei'}
                                            onChange={v => setFormData({ ...formData, taxRegime: v as any })}
                                            options={[
                                                { value: 'mei', label: 'MEI' },
                                                { value: 'simples', label: 'Simples Nacional' },
                                                { value: 'lucro_presumido', label: 'Lucro Presumido' },
                                                { value: 'lucro_real', label: 'Lucro Real' },
                                            ]}
                                            isDarkMode={isDarkMode}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Emissão via</label>
                                        <CustomDropdown
                                            value={formData.emissionVia || 'cnpj_proprio'}
                                            onChange={v => setFormData({ ...formData, emissionVia: v as any })}
                                            options={[
                                                { value: 'cnpj_proprio', label: 'CNPJ Próprio' },
                                                { value: 'empresa', label: 'Via Empresa (CNPJ Mãe)' },
                                            ]}
                                            isDarkMode={isDarkMode}
                                        />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Inscrição Municipal</label>
                                        <input type="text" value={formData.municipalRegistration || ''} onChange={e => setFormData({ ...formData, municipalRegistration: e.target.value })}
                                            className={inputClass} placeholder="Nº inscrição" />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>CNAE</label>
                                        <input type="text" value={formData.cnae || ''} onChange={e => setFormData({ ...formData, cnae: e.target.value })}
                                            className={inputClass} placeholder="9602-5/01" />
                                    </div>
                                </div>
                            </div>

                            {/* ─── Endereço ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Endereço</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Logradouro</label>
                                        <input type="text" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className={inputClass} placeholder="Rua, número — Bairro" />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Cidade *</label>
                                        <input type="text" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>UF</label>
                                            <input type="text" value={formData.state || ''} onChange={e => setFormData({ ...formData, state: e.target.value })}
                                                maxLength={2} className={`${inputClass} uppercase`} />
                                        </div>
                                        <div>
                                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>CEP</label>
                                            <input type="text" value={formData.zip || ''} onChange={e => setFormData({ ...formData, zip: e.target.value })}
                                                className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ─── Certificado Digital ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Certificado Digital (A1)</label>
                                <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${formData.certificateStatus === 'valid'
                                                ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
                                                : `${borderCol} hover:border-primary/50 hover:bg-primary/5`
                                            }`}
                                        onClick={() => {
                                            const input = document.getElementById('cert-upload-prof') as HTMLInputElement;
                                            if (input) input.click();
                                        }}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) await handleCertUpload(file);
                                        }}
                                    >
                                        <input id="cert-upload-prof" type="file" accept=".pfx,.p12" className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) await handleCertUpload(file);
                                            }} />
                                        {formData.certificateName ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <CheckCircle2 size={28} className="text-emerald-500" />
                                                <p className={`text-sm font-semibold ${textMain}`}>{formData.certificateName}</p>
                                                <p className="text-xs text-emerald-500">✓ Certificado carregado</p>
                                                <p className={`text-[10px] ${textSub}`}>Clique para substituir</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload size={28} className={`${textSub} opacity-40`} />
                                                <p className={`text-xs font-medium ${textSub}`}>Arraste seu arquivo .pfx / .p12 aqui</p>
                                                <p className={`text-[10px] ${textSub} opacity-60`}>ou clique para selecionar</p>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                            <Key size={12} /> Senha do Certificado
                                        </label>
                                        <input type="password" value={formData.certificatePassword || ''}
                                            onChange={e => setFormData({ ...formData, certificatePassword: e.target.value })}
                                            placeholder="Senha do .pfx"
                                            className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            {/* ─── Status Fiscal ─── */}
                            <div>
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSub} mb-2 block`}>Status</label>
                                <CustomDropdown
                                    value={formData.fiscalStatus || 'pending'}
                                    onChange={v => setFormData({ ...formData, fiscalStatus: v as any })}
                                    options={[
                                        { value: 'active', label: 'Ativo', dot: 'bg-emerald-500' },
                                        { value: 'pending', label: 'Pendente', dot: 'bg-amber-500' },
                                        { value: 'irregular', label: 'Irregular', dot: 'bg-red-500' },
                                    ]}
                                    isDarkMode={isDarkMode}
                                />
                            </div>
                        </div>
                    </form>

                    {/* ═══ Sticky Footer ═══ */}
                    <div className={`flex items-center justify-between p-4 border-t ${borderCol} flex-shrink-0`}>
                        {!canSave && (
                            <p className={`text-[10px] ${textSub}`}>Preencha CNPJ, Razão Social, Cidade e Regime</p>
                        )}
                        {canSave && <div />}
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handleCloseModal}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold ${isDarkMode ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                Cancelar
                            </button>
                            <button type="submit" form="fiscal-form" disabled={saving || !canSave}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? 'Salvando...' : 'Salvar Dados Fiscais'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ===================== MAIN RENDER =====================
    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className={`${bgCard} border ${borderCol} rounded-xl p-4 shadow-sm`}>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar profissional..."
                            className={`w-full pl-9 pr-4 py-2.5 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-white'} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                    </div>
                    <CustomDropdown
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={STATUS_FILTER_OPTIONS}
                        isDarkMode={isDarkMode}
                        icon={<Shield size={13} />}
                        className="min-w-[150px]"
                    />
                </div>
            </div>

            {/* Barber Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBarbers.map(barber => {
                    const fd = fiscalData.find(f => f.memberId === barber.id);
                    const status = fd?.fiscalStatus || 'pending';
                    return (
                        <div key={barber.id} className={`${bgCard} border ${borderCol} rounded-xl p-5 shadow-sm group hover:border-primary/30 transition-all`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'} flex items-center justify-center overflow-hidden`}>
                                        {barber.avatar ? (
                                            <img src={barber.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                                        ) : (
                                            <span className="text-sm font-bold text-primary">{barber.name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-bold ${textMain}`}>{barber.name}</h4>
                                        <p className={`text-[10px] ${textSub}`}>{barber.role}</p>
                                    </div>
                                </div>
                                {statusBadge(status)}
                            </div>

                            {fd ? (
                                <div className="space-y-1.5 mb-3">
                                    <div className="flex justify-between">
                                        <span className={`text-xs ${textSub}`}>CNPJ</span>
                                        <span className={`text-xs font-mono ${textMain}`}>{fd.cnpj}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={`text-xs ${textSub}`}>Regime</span>
                                        <span className={`text-xs font-medium ${textMain}`}>
                                            {fd.taxRegime === 'mei' ? 'MEI' : fd.taxRegime === 'simples' ? 'Simples' : fd.taxRegime}
                                        </span>
                                    </div>
                                    {fd.certificateName && (
                                        <div className="flex justify-between">
                                            <span className={`text-xs ${textSub}`}>Certificado</span>
                                            <span className="text-xs text-emerald-500 font-medium">✓ {fd.certificateName}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={`flex items-center gap-2 p-3 rounded-lg ${isDarkMode ? 'bg-amber-500/5' : 'bg-amber-50'} mb-3`}>
                                    <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                                    <p className={`text-[10px] ${textSub}`}>Dados fiscais não configurados</p>
                                </div>
                            )}

                            <button onClick={() => handleOpenModal(barber)}
                                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${fd
                                    ? `${isDarkMode ? 'bg-zinc-800 text-slate-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`
                                    : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                                    }`}>
                                {fd ? <><Edit2 size={12} /> Editar</> : <><Plus size={12} /> Configurar</>}
                            </button>
                        </div>
                    );
                })}
            </div>

            {filteredBarbers.length === 0 && (
                <div className={`${bgCard} border ${borderCol} rounded-xl p-12 text-center shadow-sm`}>
                    <Users size={48} className={`mx-auto mb-3 ${textSub} opacity-20`} />
                    <p className={`text-sm ${textSub}`}>Nenhum profissional encontrado</p>
                </div>
            )}

            {renderModal()}
        </div>
    );
}
