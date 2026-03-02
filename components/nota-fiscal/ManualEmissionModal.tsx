import React, { useState } from 'react';
import { X, Plus, Trash2, Building2, User, Hash, FileText, Save, Zap, AlertCircle } from 'lucide-react';
import { Invoice, InvoiceEmitter, InvoiceItem, InvoiceDocType } from '../../types';
import { createManualDraft, formatCurrency } from './helpers';

const DOC_TYPE_LABELS: Record<string, string> = { nfse: 'NFS-e', nfe: 'NF-e', nfce: 'NFC-e' };

interface ManualEmissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    emitters: InvoiceEmitter[];
    onSave: (invoice: Invoice) => void;
    isDarkMode: boolean;
}

export const ManualEmissionModal: React.FC<ManualEmissionModalProps> = ({
    isOpen, onClose, emitters, onSave, isDarkMode
}) => {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const [emitterId, setEmitterId] = useState(emitters[0]?.id || '');
    const [docType, setDocType] = useState<InvoiceDocType>('nfse');
    const [clientName, setClientName] = useState('');
    const [clientCpfCnpj, setClientCpfCnpj] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<{ description: string; type: 'service' | 'product'; quantity: number; unitPrice: number }[]>([
        { description: '', type: 'service', quantity: 1, unitPrice: 0 },
    ]);

    const addItem = () => setItems(prev => [...prev, { description: '', type: 'service', quantity: 1, unitPrice: 0 }]);
    const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));
    const updateItem = (index: number, field: string, value: any) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const totalServices = items.filter(i => i.type === 'service').reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const totalProducts = items.filter(i => i.type === 'product').reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const selectedEmitter = emitters.find(e => e.id === emitterId);
    const canSave = clientName.trim().length > 0 && items.some(i => i.description && i.unitPrice > 0);

    const handleSave = (emit: boolean) => {
        const invoiceItems: InvoiceItem[] = items
            .filter(i => i.description && i.unitPrice > 0)
            .map((i, idx) => ({
                id: `manual-item-${idx}`, type: i.type, sourceId: `manual-${idx}`,
                description: i.description, quantity: i.quantity,
                unitPrice: i.unitPrice, totalPrice: i.quantity * i.unitPrice,
            }));

        const draft = createManualDraft({
            emitterId, emitterName: selectedEmitter?.tradeName || selectedEmitter?.name || '',
            docType, clientName, clientCpfCnpj: clientCpfCnpj || undefined,
            clientEmail: clientEmail || undefined, items: invoiceItems,
            totalServices, totalProducts, totalAmount, notes: notes || undefined,
        });

        if (emit) {
            draft.status = 'queued';
            draft.events.push({ id: `ev-emit-${Date.now()}`, type: 'queued', description: 'Enviada para processamento (emissão manual)', timestamp: new Date().toISOString() });
        }
        onSave(draft);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`p-4 border-b ${borderCol} shrink-0 flex items-center justify-between ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <div>
                        <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}>
                            <FileText size={20} className="text-primary" /> Emissão Manual
                        </h3>
                        <p className={`text-xs ${textSub}`}>Crie uma nota fiscal sem vincular a uma comanda</p>
                    </div>
                    <button onClick={onClose} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Emitter + Doc Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Building2 size={12} /> Emitente *</label>
                            <select value={emitterId} onChange={e => setEmitterId(e.target.value)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none`}>
                                {emitters.filter(e => e.active).map(em => (
                                    <option key={em.id} value={em.id}>{em.tradeName || em.name} ({em.cnpj})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><FileText size={12} /> Tipo Documento *</label>
                            <select value={docType} onChange={e => setDocType(e.target.value as InvoiceDocType)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none`}>
                                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Client */}
                    <div className={`p-4 rounded-xl border ${borderCol}`}>
                        <h4 className={`text-sm font-semibold text-primary mb-3 flex items-center gap-2`}><User size={14} /> Tomador / Destinatário</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Nome *</label>
                                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                                    placeholder="Nome do cliente"
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>CPF / CNPJ</label>
                                <input type="text" value={clientCpfCnpj} onChange={e => setClientCpfCnpj(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>E-mail</label>
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                                    placeholder="email@exemplo.com"
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className={`p-4 rounded-xl border ${borderCol}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className={`text-sm font-semibold text-primary flex items-center gap-2`}><Hash size={14} /> Itens da Nota</h4>
                            <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all">
                                <Plus size={14} /> Adicionar Item
                            </button>
                        </div>
                        <div className="space-y-3">
                            {items.map((item, i) => (
                                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                                        <div className="md:col-span-4">
                                            <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                                                placeholder="Descrição"
                                                className={`w-full p-2 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none`} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <select value={item.type} onChange={e => updateItem(i, 'type', e.target.value)}
                                                className={`w-full p-2 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none`}>
                                                <option value="service">Serviço</option>
                                                <option value="product">Produto</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                                                className={`w-full p-2 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none text-center`} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <input type="number" min={0} step={0.01} value={item.unitPrice || ''} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))}
                                                placeholder="R$"
                                                className={`w-full p-2 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none text-right`} />
                                        </div>
                                        <div className="md:col-span-2 flex items-center justify-end gap-2">
                                            <span className={`text-sm font-semibold ${textMain}`}>{formatCurrency(item.quantity * item.unitPrice)}</span>
                                            {items.length > 1 && (
                                                <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Totals */}
                        <div className={`mt-3 pt-3 border-t ${borderCol} flex items-center justify-between`}>
                            <div className="flex items-center gap-4">
                                {totalServices > 0 && <span className={`text-xs ${textSub}`}>Serviços: <b className="text-primary">{formatCurrency(totalServices)}</b></span>}
                                {totalProducts > 0 && <span className={`text-xs ${textSub}`}>Produtos: <b className="text-emerald-500">{formatCurrency(totalProducts)}</b></span>}
                            </div>
                            <span className={`text-lg font-bold ${textMain}`}>Total: {formatCurrency(totalAmount)}</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={`text-xs font-medium ${textSub} mb-1 block`}>Observações</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                            placeholder="Observações adicionais..."
                            className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none resize-none`} />
                    </div>

                    {!canSave && clientName.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                            <p className="text-xs text-amber-500 font-semibold flex items-center gap-1"><AlertCircle size={12} /> Preencha ao menos um item com descrição e valor</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${borderCol} mt-auto shrink-0 flex items-center gap-3`}>
                    <button onClick={onClose} className={`px-4 py-2.5 rounded-xl border ${borderCol} text-sm font-medium ${textSub}`}>Cancelar</button>
                    <div className="flex-1" />
                    <button onClick={() => handleSave(false)} disabled={!canSave}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border ${borderCol} text-sm font-semibold transition-all ${canSave ? `${textMain} hover:shadow-md` : 'opacity-40 cursor-not-allowed'}`}>
                        <Save size={14} /> Salvar Rascunho
                    </button>
                    <button onClick={() => handleSave(true)} disabled={!canSave}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all ${canSave ? 'bg-primary text-white hover:shadow-md' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                        <Zap size={14} /> Salvar e Emitir
                    </button>
                </div>
            </div>
        </div>
    );
};
