import React, { useState, useEffect, useRef } from 'react';
import {
    Settings, Building2, FileText, Zap, Shield,
    CreditCard, MapPin, Mail, Phone, Award,
    Server, Key, ToggleLeft, ToggleRight,
    Save, Globe, Hash, Percent, Lock, Upload,
    CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { InvoiceEmitter, FiscalSettings } from '../../types';
import { saveEmitter, saveFiscalSettings } from '../../lib/dataService';
import { uploadCertificate } from '../../lib/fiscalService';

interface Props {
    emitters: InvoiceEmitter[];
    settings: FiscalSettings | null;
    isDarkMode: boolean;
    onRefresh: () => void;
    toast: any;
}

export default function TabConfiguracoes({ emitters, settings, isDarkMode, onRefresh, toast }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    // Section state
    const [section, setSection] = useState<'emitter' | 'nfse_nfce' | 'rules' | 'api'>('emitter');

    // Emitter form
    const mainEmitter = emitters.find(e => e.type === 'company') || null;
    const [emitterForm, setEmitterForm] = useState<Partial<InvoiceEmitter>>({});

    useEffect(() => {
        if (mainEmitter) setEmitterForm(mainEmitter);
        else setEmitterForm({ type: 'company', active: true, cnpj: '', name: '', address: '', city: '', state: '', email: '' });
    }, [emitters]);

    // Settings form
    const [settingsForm, setSettingsForm] = useState<Partial<FiscalSettings>>({});
    useEffect(() => {
        setSettingsForm(settings || {
            autoEmitOnClose: false, autoSendEmail: false,
            defaultDocType: 'nfse', splitMixedComanda: false,
            apiProvider: 'none', apiEnvironment: 'sandbox',
            cancellationWindowHours: 24,
        });
    }, [settings]);

    const handleSaveEmitter = async () => {
        if (!emitterForm.cnpj || !emitterForm.name) {
            toast.error('Campos obrigatórios', 'CNPJ e Razão Social são obrigatórios.');
            return;
        }
        const data = {
            ...emitterForm,
            id: mainEmitter?.id || crypto.randomUUID(),
            type: 'company' as const,
            active: true,
        } as InvoiceEmitter;
        const result = await saveEmitter(data);
        if (result.success) {
            toast.success('Emitente salvo', 'Dados do emitente atualizados.');
            onRefresh();
        } else toast.error('Erro', result.error);
    };

    const handleSaveSettings = async () => {
        const result = await saveFiscalSettings(settingsForm as FiscalSettings);
        if (result.success) {
            toast.success('Configurações salvas');
            onRefresh();
        } else toast.error('Erro', result.error);
    };

    const handleCertUpload = async (file: File) => {
        if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
            toast.error('Formato inválido', 'Selecione um arquivo .pfx ou .p12');
            return;
        }
        const emitterId = mainEmitter?.id || 'new';
        const result = await uploadCertificate(file, emitterId);
        if (result.success) {
            setEmitterForm({
                ...emitterForm,
                certificateFile: result.path,
                certificateName: file.name,
                certificateStatus: 'valid',
            });
            toast.success('Certificado enviado', `${file.name} carregado com sucesso.`);
        } else {
            toast.error('Erro no upload', result.error || 'Não foi possível enviar o certificado.');
        }
    };

    const SECTIONS = [
        { id: 'emitter', label: 'Dados do Emitente', icon: Building2 },
        { id: 'nfse_nfce', label: 'NFS-e / NFC-e', icon: FileText },
        { id: 'rules', label: 'Regras de Emissão', icon: Zap },
        { id: 'api', label: 'Integração API', icon: Server },
    ] as const;

    const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div className="flex items-center justify-between">
            <span className={`text-sm ${textMain}`}>{label}</span>
            <button onClick={() => onChange(!value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 ${value ? 'left-5.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all`} />
            </button>
        </div>
    );

    const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = 'text' }: any) => (
        <div>
            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                {Icon && <Icon size={12} />} {label}
            </label>
            <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Section Tabs */}
            <div className={`${bgCard} border ${borderCol} rounded-xl p-1 shadow-sm flex gap-1`}>
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setSection(s.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium flex-1 justify-center transition-all ${section === s.id ? 'bg-primary text-white shadow-sm' : `${textSub}`
                            }`}>
                        <s.icon size={14} />
                        <span className="hidden sm:inline">{s.label}</span>
                    </button>
                ))}
            </div>

            {/* EMITTER DATA */}
            {section === 'emitter' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                    <div className={`p-4 border-b ${borderCol}`}>
                        <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                            <Building2 size={18} className="text-primary" /> Dados do Emitente Principal
                        </h3>
                        <p className={`text-xs ${textSub} mt-1`}>Informações fiscais da empresa para emissão de NF</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InputField label="CNPJ *" icon={CreditCard} value={emitterForm.cnpj}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, cnpj: v })} placeholder="00.000.000/0001-00" />
                            <InputField label="Razão Social *" icon={Building2} value={emitterForm.name}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, name: v })} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InputField label="Nome Fantasia" icon={Award} value={emitterForm.tradeName}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, tradeName: v })} />
                            <InputField label="CNAE" icon={Hash} value={emitterForm.cnae}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, cnae: v })} placeholder="9602-5/01" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InputField label="Inscrição Municipal" icon={FileText} value={emitterForm.municipalRegistration}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, municipalRegistration: v })} />
                            <InputField label="Inscrição Estadual" icon={FileText} value={emitterForm.stateRegistration}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, stateRegistration: v })} />
                        </div>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                <Shield size={12} /> Regime Tributário
                            </label>
                            <select value={emitterForm.taxRegime || 'simples'}
                                onChange={e => setEmitterForm({ ...emitterForm, taxRegime: e.target.value })}
                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                <option value="mei">MEI</option>
                                <option value="simples">Simples Nacional</option>
                                <option value="presumido">Lucro Presumido</option>
                            </select>
                        </div>

                        {/* Address */}
                        <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                            <p className={`text-sm font-bold text-primary flex items-center gap-1`}>
                                <MapPin size={14} /> Endereço
                            </p>
                            <InputField label="Logradouro" value={emitterForm.address}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, address: v })} />
                            <div className="grid grid-cols-3 gap-3">
                                <InputField label="Cidade" value={emitterForm.city}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, city: v })} />
                                <InputField label="UF" value={emitterForm.state}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, state: v })} placeholder="SP" />
                                <InputField label="CEP" value={emitterForm.zip}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, zip: v })} placeholder="00000-000" />
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InputField label="Email" icon={Mail} value={emitterForm.email}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, email: v })} type="email" />
                            <InputField label="Telefone" icon={Phone} value={emitterForm.phone}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, phone: v })} />
                        </div>

                        {/* Certificate Upload */}
                        <div className={`p-4 rounded-xl border ${borderCol} space-y-3`}>
                            <p className={`text-sm font-bold text-primary flex items-center gap-1`}>
                                <Lock size={14} /> Certificado Digital (A1)
                            </p>
                            <p className={`text-xs ${textSub}`}>
                                Arquivo .pfx ou .p12 — necessário para emissão de NF-e/NFS-e/NFC-e
                            </p>

                            {/* Upload Area */}
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${emitterForm.certificateStatus === 'valid'
                                    ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
                                    : `${borderCol} hover:border-primary/50 hover:bg-primary/5`
                                    }`}
                                onClick={() => {
                                    const input = document.getElementById('cert-upload') as HTMLInputElement;
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
                                <input
                                    id="cert-upload"
                                    type="file"
                                    accept=".pfx,.p12"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) await handleCertUpload(file);
                                    }}
                                />
                                {emitterForm.certificateName ? (
                                    <div className="flex flex-col items-center gap-2">
                                        {emitterForm.certificateStatus === 'valid' ? (
                                            <CheckCircle2 size={28} className="text-emerald-500" />
                                        ) : emitterForm.certificateStatus === 'expiring' ? (
                                            <AlertTriangle size={28} className="text-amber-500" />
                                        ) : emitterForm.certificateStatus === 'expired' ? (
                                            <XCircle size={28} className="text-red-500" />
                                        ) : (
                                            <Upload size={28} className={textSub} />
                                        )}
                                        <p className={`text-sm font-semibold ${textMain}`}>
                                            {emitterForm.certificateName}
                                        </p>
                                        <p className={`text-xs ${emitterForm.certificateStatus === 'valid' ? 'text-emerald-500' :
                                            emitterForm.certificateStatus === 'expiring' ? 'text-amber-500' :
                                                emitterForm.certificateStatus === 'expired' ? 'text-red-500' : textSub
                                            }`}>
                                            {emitterForm.certificateStatus === 'valid' ? '✓ Certificado válido' :
                                                emitterForm.certificateStatus === 'expiring' ? '⚠ Certificado expirando' :
                                                    emitterForm.certificateStatus === 'expired' ? '✕ Certificado expirado' :
                                                        'Status desconhecido'}
                                            {emitterForm.certificateExpiry && ` — Validade: ${new Date(emitterForm.certificateExpiry).toLocaleDateString('pt-BR')}`}
                                        </p>
                                        <p className={`text-[10px] ${textSub}`}>Clique para substituir</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload size={28} className={`${textSub} opacity-50`} />
                                        <p className={`text-sm font-medium ${textMain}`}>Arraste o certificado .pfx aqui</p>
                                        <p className={`text-xs ${textSub}`}>ou clique para selecionar o arquivo</p>
                                    </div>
                                )}
                            </div>

                            {/* Password */}
                            <InputField label="Senha do Certificado" icon={Key} type="password"
                                value={emitterForm.certificatePassword}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, certificatePassword: v })}
                                placeholder="Senha do arquivo .pfx" />

                            {/* Expiry */}
                            <InputField label="Data de Validade" type="date"
                                value={emitterForm.certificateExpiry?.split('T')[0]}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, certificateExpiry: v })} />
                        </div>
                    </div>
                    <div className={`p-5 border-t ${borderCol}`}>
                        <button onClick={handleSaveEmitter}
                            className="w-full py-3 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            <Save size={16} /> Salvar Emitente
                        </button>
                    </div>
                </div>
            )}

            {/* NFS-e / NFC-e CONFIG */}
            {section === 'nfse_nfce' && (
                <div className="space-y-4">
                    {/* NFS-e */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                        <div className={`p-4 border-b ${borderCol}`}>
                            <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                                <FileText size={18} className="text-blue-500" /> Configuração NFS-e (Serviços)
                            </h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                        <Globe size={12} /> Ambiente
                                    </label>
                                    <select value={emitterForm.nfseEnvironment || 'homologacao'}
                                        onChange={e => setEmitterForm({ ...emitterForm, nfseEnvironment: e.target.value as any })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                        <option value="homologacao">Homologação (Testes)</option>
                                        <option value="producao">Produção</option>
                                    </select>
                                </div>
                                <InputField label="Série" icon={Hash} value={emitterForm.nfseSeries}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfseSeries: v })} placeholder="1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Próximo Número" icon={Hash} value={emitterForm.nfseNextNumber}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfseNextNumber: Number(v) })} type="number" />
                                <InputField label="Alíquota ISS (%)" icon={Percent} value={emitterForm.nfseIssRate}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfseIssRate: Number(v) })} type="number" />
                            </div>
                            <InputField label="Código de Serviço Municipal" value={emitterForm.defaultServiceCode}
                                onChange={(v: string) => setEmitterForm({ ...emitterForm, defaultServiceCode: v })} placeholder="14.01" />
                        </div>
                    </div>

                    {/* NFC-e */}
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                        <div className={`p-4 border-b ${borderCol}`}>
                            <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                                <FileText size={18} className="text-emerald-500" /> Configuração NFC-e (Produtos)
                            </h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                        <Globe size={12} /> Ambiente
                                    </label>
                                    <select value={emitterForm.nfceEnvironment || 'homologacao'}
                                        onChange={e => setEmitterForm({ ...emitterForm, nfceEnvironment: e.target.value as any })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                        <option value="homologacao">Homologação (Testes)</option>
                                        <option value="producao">Produção</option>
                                    </select>
                                </div>
                                <InputField label="Série" icon={Hash} value={emitterForm.nfceSeries}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfceSeries: v })} placeholder="1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="CSC (Código de Segurança)" icon={Key} value={emitterForm.nfceCsc}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfceCsc: v })} />
                                <InputField label="Token ID" icon={Key} value={emitterForm.nfceTokenId}
                                    onChange={(v: string) => setEmitterForm({ ...emitterForm, nfceTokenId: v })} />
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSaveEmitter}
                        className="w-full py-3 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                        <Save size={16} /> Salvar Configurações de Emissão
                    </button>
                </div>
            )}

            {/* EMISSION RULES */}
            {section === 'rules' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                    <div className={`p-4 border-b ${borderCol}`}>
                        <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                            <Zap size={18} className="text-amber-500" /> Regras de Emissão Automática
                        </h3>
                        <p className={`text-xs ${textSub} mt-1`}>Configure quando e como as notas são emitidas automaticamente</p>
                    </div>
                    <div className="p-5 space-y-5">
                        <Toggle label="Emitir NF automaticamente ao concluir atendimento"
                            value={settingsForm.autoEmitOnClose ?? false}
                            onChange={v => setSettingsForm({ ...settingsForm, autoEmitOnClose: v })} />
                        <Toggle label="Enviar NF por email ao cliente automaticamente"
                            value={settingsForm.autoSendEmail ?? false}
                            onChange={v => setSettingsForm({ ...settingsForm, autoSendEmail: v })} />
                        <Toggle label="Separar comanda mista (serviços + produtos = 2 notas)"
                            value={settingsForm.splitMixedComanda ?? false}
                            onChange={v => setSettingsForm({ ...settingsForm, splitMixedComanda: v })} />

                        <div className={`border-t ${borderCol} pt-4`}>
                            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                <FileText size={12} /> Tipo de emissão padrão
                            </label>
                            <select value={settingsForm.defaultDocType || 'nfse'}
                                onChange={e => setSettingsForm({ ...settingsForm, defaultDocType: e.target.value as any })}
                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                <option value="nfse">NFS-e (Serviços)</option>
                                <option value="nfce">NFC-e (Produtos)</option>
                            </select>
                        </div>

                        <InputField label="Prazo para cancelamento (horas)" type="number"
                            value={settingsForm.cancellationWindowHours}
                            onChange={(v: string) => setSettingsForm({ ...settingsForm, cancellationWindowHours: Number(v) })} />

                        {/* Subscription Rules */}
                        <div className={`border-t ${borderCol} pt-4 space-y-5`}>
                            <p className={`text-sm font-bold text-primary flex items-center gap-1`}>
                                <CreditCard size={14} /> Assinaturas
                            </p>
                            <Toggle label="Emitir NF automaticamente ao receber pagamento de assinatura"
                                value={settingsForm.autoEmitOnSubscription ?? false}
                                onChange={v => setSettingsForm({ ...settingsForm, autoEmitOnSubscription: v })} />
                            <Toggle label="Incluir detalhes do plano na descrição da NF"
                                value={settingsForm.includePlanDetails ?? true}
                                onChange={v => setSettingsForm({ ...settingsForm, includePlanDetails: v })} />
                        </div>

                        {/* Tax Rates */}
                        <div className={`border-t ${borderCol} pt-4 space-y-3`}>
                            <p className={`text-sm font-bold text-primary flex items-center gap-1`}>
                                <Percent size={14} /> Alíquotas para Indicadores
                            </p>
                            <p className={`text-xs ${textSub}`}>Usadas para calcular tributos no dashboard de indicadores fiscais</p>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Alíquota PIS (%)" icon={Percent} type="number"
                                    value={settingsForm.pisRate}
                                    onChange={(v: string) => setSettingsForm({ ...settingsForm, pisRate: Number(v) })}
                                    placeholder="0.65" />
                                <InputField label="Alíquota COFINS (%)" icon={Percent} type="number"
                                    value={settingsForm.cofinsRate}
                                    onChange={(v: string) => setSettingsForm({ ...settingsForm, cofinsRate: Number(v) })}
                                    placeholder="3.00" />
                            </div>
                        </div>
                    </div>
                    <div className={`p-5 border-t ${borderCol}`}>
                        <button onClick={handleSaveSettings}
                            className="w-full py-3 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            <Save size={16} /> Salvar Regras
                        </button>
                    </div>
                </div>
            )}

            {/* API INTEGRATION */}
            {section === 'api' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                    <div className={`p-4 border-b ${borderCol}`}>
                        <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                            <Server size={18} className="text-purple-500" /> Integração com Provedor Fiscal
                        </h3>
                        <p className={`text-xs ${textSub} mt-1`}>Configure a conexão com o provedor de emissão de NF</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                <Server size={12} /> Provedor
                            </label>
                            <select value={settingsForm.apiProvider || 'none'}
                                onChange={e => setSettingsForm({ ...settingsForm, apiProvider: e.target.value as any })}
                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                <option value="none">Nenhum (Manual)</option>
                                <option value="focus_nfe">Focus NFe</option>
                                <option value="nfe_io">NFE.io</option>
                                <option value="plugnotas">PlugNotas</option>
                            </select>
                        </div>

                        {settingsForm.apiProvider && settingsForm.apiProvider !== 'none' && (
                            <>
                                <InputField label="Chave de API" icon={Key}
                                    value={settingsForm.apiKey}
                                    onChange={(v: string) => setSettingsForm({ ...settingsForm, apiKey: v })}
                                    placeholder="Sua chave de API" />
                                <div>
                                    <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                                        <Globe size={12} /> Ambiente da API
                                    </label>
                                    <select value={settingsForm.apiEnvironment || 'sandbox'}
                                        onChange={e => setSettingsForm({ ...settingsForm, apiEnvironment: e.target.value as any })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} outline-none`}>
                                        <option value="sandbox">Sandbox (Testes)</option>
                                        <option value="production">Produção</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                    <div className={`p-5 border-t ${borderCol}`}>
                        <button onClick={handleSaveSettings}
                            className="w-full py-3 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            <Save size={16} /> Salvar Integração
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
