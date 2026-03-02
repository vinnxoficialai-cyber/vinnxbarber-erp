import React, { useState } from 'react';
import { X, Building2, Save, Shield, Globe, Hash, FileText } from 'lucide-react';
import { InvoiceEmitter } from '../../types';

interface EmitterEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    emitter: InvoiceEmitter;
    onSave: (emitter: InvoiceEmitter) => void;
    isDarkMode: boolean;
}

export const EmitterEditModal: React.FC<EmitterEditModalProps> = ({
    isOpen, onClose, emitter, onSave, isDarkMode
}) => {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const [form, setForm] = useState({ ...emitter });

    const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSave = () => {
        onSave(form);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}>
                        <Building2 size={20} className="text-primary" /> Editar Emitente
                    </h3>
                    <button onClick={onClose} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Basic Info */}
                    <div className="space-y-3">
                        <h4 className={`text-sm font-semibold text-primary flex items-center gap-2`}><FileText size={14} /> Dados Básicos</h4>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>Razão Social *</label>
                            <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                        </div>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>Nome Fantasia</label>
                            <input type="text" value={form.tradeName || ''} onChange={e => update('tradeName', e.target.value)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                        </div>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>CNPJ *</label>
                            <input type="text" value={form.cnpj} onChange={e => update('cnpj', e.target.value)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                        </div>
                    </div>

                    {/* Fiscal */}
                    <div className="space-y-3">
                        <h4 className={`text-sm font-semibold text-primary flex items-center gap-2`}><Globe size={14} /> Dados Fiscais</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Regime Tributário</label>
                                <select value={form.taxRegime} onChange={e => update('taxRegime', e.target.value)}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} outline-none`}>
                                    <option value="mei">MEI</option>
                                    <option value="simples">Simples Nacional</option>
                                    <option value="presumido">Lucro Presumido</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Inscrição Municipal</label>
                                <input type="text" value={form.municipalRegistration || ''} onChange={e => update('municipalRegistration', e.target.value)}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Série</label>
                                <input type="text" value={form.series || ''} onChange={e => update('series', e.target.value)}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                            <div>
                                <label className={`text-xs font-medium ${textSub} mb-1 block`}>Próximo Número</label>
                                <input type="number" value={form.nextNumber || ''} onChange={e => update('nextNumber', Number(e.target.value))}
                                    className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                            </div>
                        </div>
                    </div>

                    {/* Certificate */}
                    <div className="space-y-3">
                        <h4 className={`text-sm font-semibold text-primary flex items-center gap-2`}><Shield size={14} /> Certificado Digital</h4>
                        <div>
                            <label className={`text-xs font-medium ${textSub} mb-1 block`}>Validade do Certificado A1</label>
                            <input type="date" value={form.certificateExpiry || ''} onChange={e => update('certificateExpiry', e.target.value)}
                                className={`w-full p-2.5 rounded-lg ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                            <span className={`text-sm font-medium ${textMain}`}>Emitente ativo</span>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${borderCol} flex items-center gap-3 mt-auto shrink-0`}>
                    <button onClick={onClose} className={`px-4 py-2.5 rounded-xl border ${borderCol} text-sm font-medium ${textSub}`}>Cancelar</button>
                    <div className="flex-1" />
                    <button onClick={handleSave}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all">
                        <Save size={14} /> Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};
