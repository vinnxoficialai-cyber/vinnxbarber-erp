import React, { useState, useMemo } from 'react';
import {
    X, ChevronLeft, ChevronRight, Building2, User, Check,
    AlertCircle, FileText, Shield, Hash, Receipt, Zap,
    CheckCircle2, XCircle, Info, Layers
} from 'lucide-react';
import { Invoice, InvoiceEmitter, InvoiceItem, InvoiceDocType, Comanda } from '../../types';
import { createDraftFromComanda, validateInvoice, calculateTaxes, suggestDocType, formatCurrency } from './helpers';

const DOC_TYPE_LABELS: Record<string, string> = { nfse: 'NFS-e', nfe: 'NF-e', nfce: 'NFC-e' };

interface EmissionWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    comanda: Comanda;
    emitters: InvoiceEmitter[];
    onEmit: (invoice: Invoice) => void;
    isDarkMode: boolean;
}

const STEPS = [
    { label: 'Emitente', icon: Building2 },
    { label: 'Tipo Doc', icon: FileText },
    { label: 'Tomador', icon: User },
    { label: 'Itens', icon: Layers },
    { label: 'Revisão', icon: CheckCircle2 },
];

export const EmissionWizardModal: React.FC<EmissionWizardModalProps> = ({
    isOpen, onClose, comanda, emitters, onEmit, isDarkMode
}) => {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const [step, setStep] = useState(0);
    const [selectedEmitterId, setSelectedEmitterId] = useState(emitters[0]?.id || '');
    const [docType, setDocType] = useState<InvoiceDocType>('nfse');
    const [clientName, setClientName] = useState(comanda.clientName || '');
    const [clientCpfCnpj, setClientCpfCnpj] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [notes, setNotes] = useState('');

    const selectedEmitter = emitters.find(e => e.id === selectedEmitterId);

    const draft = useMemo(() => {
        if (!selectedEmitter) return null;
        const inv = createDraftFromComanda(comanda, selectedEmitter);
        inv.docType = docType;
        inv.clientName = clientName;
        inv.clientCpfCnpj = clientCpfCnpj || undefined;
        inv.clientEmail = clientEmail || undefined;
        inv.notes = notes || undefined;
        return inv;
    }, [comanda, selectedEmitter, docType, clientName, clientCpfCnpj, clientEmail, notes]);

    const taxes = useMemo(() => {
        if (!draft) return null;
        return calculateTaxes(draft.items, docType);
    }, [draft, docType]);

    const validation = useMemo(() => {
        if (!draft) return { valid: false, errors: ['Rascunho não gerado'], warnings: [] };
        return validateInvoice(draft);
    }, [draft]);

    const suggestedType = useMemo(() => {
        const items: InvoiceItem[] = (comanda.items || []).map((item, i) => ({
            id: `itm-${i}`, type: item.type === 'product' ? 'product' as const : 'service' as const,
            sourceId: '', description: item.name || '', quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0, totalPrice: (item.quantity || 1) * (item.unitPrice || 0),
        }));
        return suggestDocType(items);
    }, [comanda]);

    const handleEmit = () => {
        if (draft && validation.valid) {
            const finalInvoice: Invoice = {
                ...draft,
                status: 'queued',
                events: [
                    ...draft.events,
                    { id: `ev-queue-${Date.now()}`, type: 'queued', description: 'Enviada para processamento via wizard', timestamp: new Date().toISOString() }
                ],
            };
            onEmit(finalInvoice);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`p-4 border-b ${borderCol} shrink-0 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}>
                            <Receipt size={20} className="text-primary" /> Emissão de Nota Fiscal
                        </h3>
                        <button onClick={onClose} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                    </div>
                    {/* Step indicator */}
                    <div className="flex items-center gap-1">
                        {STEPS.map((s, i) => (
                            <React.Fragment key={i}>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${i === step ? 'bg-primary text-white' :
                                    i < step ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                        `${isDarkMode ? 'bg-dark-surface' : 'bg-slate-100'} ${textSub}`
                                    }`}>
                                    {i < step ? <Check size={12} /> : <s.icon size={12} />}
                                    <span className="hidden sm:inline">{s.label}</span>
                                </div>
                                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : isDarkMode ? 'bg-dark-border' : 'bg-slate-200'}`} />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Step 0: Select Emitter */}
                    {step === 0 && (
                        <div className="space-y-3">
                            <p className={`text-sm ${textSub}`}>Selecione o emitente da nota fiscal:</p>
                            {emitters.filter(e => e.active).map(em => (
                                <button key={em.id} onClick={() => setSelectedEmitterId(em.id)}
                                    className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${selectedEmitterId === em.id ? 'border-primary bg-primary/5' : `border-slate-200 dark:border-dark-border hover:border-primary/30`
                                        }`}>
                                    <div className={`p-3 rounded-lg ${em.type === 'company' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'}`}>
                                        {em.type === 'company' ? <Building2 size={20} /> : <User size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-semibold ${textMain}`}>{em.tradeName || em.name}</p>
                                        <p className={`text-xs ${textSub}`}>{em.cnpj} • {em.taxRegime?.toUpperCase()}</p>
                                    </div>
                                    {selectedEmitterId === em.id && <CheckCircle2 size={20} className="text-primary" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 1: Doc Type */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-dark' : 'bg-emerald-50'} border ${isDarkMode ? 'border-emerald-800' : 'border-emerald-200'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap size={14} className="text-primary" />
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Sugestão Automática</span>
                                </div>
                                <p className={`text-sm ${textMain}`}>
                                    Com base nos itens da comanda, o tipo sugerido é <strong>{DOC_TYPE_LABELS[suggestedType]}</strong>
                                </p>
                            </div>
                            <p className={`text-sm ${textSub}`}>Selecione o tipo de documento fiscal:</p>
                            {(['nfse', 'nfe', 'nfce'] as InvoiceDocType[]).map(dt => (
                                <button key={dt} onClick={() => setDocType(dt)}
                                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${docType === dt ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-dark-border hover:border-primary/30'
                                        }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className={`font-semibold ${textMain}`}>{DOC_TYPE_LABELS[dt]}</p>
                                            <p className={`text-xs ${textSub} mt-1`}>
                                                {dt === 'nfse' ? 'Nota Fiscal de Serviço Eletrônica' :
                                                    dt === 'nfe' ? 'Nota Fiscal Eletrônica (B2B)' :
                                                        'Nota Fiscal de Consumidor Eletrônica'}
                                            </p>
                                        </div>
                                        {docType === dt && <CheckCircle2 size={20} className="text-primary" />}
                                        {dt === suggestedType && docType !== dt && <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Sugerido</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Client */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className={`text-sm ${textSub}`}>Confirme os dados do tomador/destinatário:</p>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><User size={12} /> Nome *</label>
                                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`} />
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Hash size={12} /> CPF / CNPJ</label>
                                <input type="text" value={clientCpfCnpj} onChange={e => setClientCpfCnpj(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`} />
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Info size={12} /> E-mail</label>
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                                    placeholder="email@exemplo.com"
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`} />
                                {!clientEmail && <p className={`text-xs ${textSub} mt-1`}>Sem email a nota não será enviada automaticamente</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Items Review */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <p className={`text-sm ${textSub}`}>Itens da nota fiscal:</p>
                            {(comanda.items || []).length > 0 ? (
                                <div>
                                    {(comanda.items || []).map((item, i) => (
                                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} mb-2`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.type === 'product'
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    }`}>{item.type === 'product' ? 'PRD' : 'SRV'}</span>
                                                <span className={`text-sm ${textMain}`}>{item.name || 'Item'}</span>
                                            </div>
                                            <span className={`font-semibold ${textMain}`}>{formatCurrency(item.unitPrice || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-sm ${textSub}`}>Nenhum item na comanda</p>
                            )}
                            <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-primary/30 bg-emerald-50 dark:bg-emerald-500/5`}>
                                <span className={`font-bold ${textMain}`}>Total da Nota</span>
                                <span className="text-xl font-bold text-primary">{formatCurrency(comanda.finalAmount || comanda.totalAmount || 0)}</span>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review & Confirm */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h4 className={`font-semibold ${textMain} mb-2`}>Resumo da Emissão</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub}`}>Emitente</p>
                                    <p className={`text-sm font-medium ${textMain}`}>{selectedEmitter?.tradeName || selectedEmitter?.name}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub}`}>Tipo</p>
                                    <p className={`text-sm font-medium ${textMain}`}>{DOC_TYPE_LABELS[docType]}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub}`}>Tomador</p>
                                    <p className={`text-sm font-medium ${textMain}`}>{clientName}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-xs ${textSub}`}>Valor Total</p>
                                    <p className="text-lg font-bold text-primary">{formatCurrency(comanda.finalAmount || comanda.totalAmount || 0)}</p>
                                </div>
                            </div>
                            {taxes && (
                                <div className={`p-4 rounded-xl border ${borderCol}`}>
                                    <h5 className={`text-xs font-bold ${textSub} uppercase mb-3`}>Estimativa Tributária</h5>
                                    <div className="space-y-2">
                                        {taxes.issTotal > 0 && <div className="flex justify-between"><span className={`text-sm ${textSub}`}>ISS (5%)</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(taxes.issTotal)}</span></div>}
                                        {(taxes.icmsTotal || 0) > 0 && <div className="flex justify-between"><span className={`text-sm ${textSub}`}>ICMS (18%)</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(taxes.icmsTotal || 0)}</span></div>}
                                        {(taxes.pisTotal || 0) > 0 && <div className="flex justify-between"><span className={`text-sm ${textSub}`}>PIS</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(taxes.pisTotal || 0)}</span></div>}
                                        {(taxes.cofinsTotal || 0) > 0 && <div className="flex justify-between"><span className={`text-sm ${textSub}`}>COFINS</span><span className={`text-sm font-medium ${textMain}`}>{formatCurrency(taxes.cofinsTotal || 0)}</span></div>}
                                        <div className={`border-t ${borderCol} pt-2 flex justify-between`}>
                                            <span className={`text-sm font-bold ${textMain}`}>Total Tributos</span>
                                            <span className="text-sm font-bold text-amber-500">{formatCurrency(taxes.totalTax)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {validation.errors.length > 0 && (
                                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                                    <p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1"><XCircle size={14} /> Erros que impedem a emissão:</p>
                                    {validation.errors.map((e, i) => <p key={i} className="text-sm text-red-600 dark:text-red-400">• {e}</p>)}
                                </div>
                            )}
                            {validation.warnings.length > 0 && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                    <p className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1"><AlertCircle size={14} /> Avisos:</p>
                                    {validation.warnings.map((w, i) => <p key={i} className="text-sm text-amber-600 dark:text-amber-400">• {w}</p>)}
                                </div>
                            )}
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Observações (opcional)</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none resize-none`} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${borderCol} mt-auto shrink-0 flex items-center gap-3`}>
                    {step > 0 && (
                        <button onClick={() => setStep(s => s - 1)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${borderCol} text-sm font-medium ${textSub} hover:shadow-md transition-all`}>
                            <ChevronLeft size={14} /> Voltar
                        </button>
                    )}
                    <div className="flex-1" />
                    {step < STEPS.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
                            Próximo <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button onClick={handleEmit} disabled={!validation.valid}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all ${validation.valid ? 'bg-primary text-white hover:shadow-md' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}>
                            <Zap size={14} /> Emitir Nota Fiscal
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
