import React, { useState, useEffect } from 'react';
import {
    Building2, CheckCircle2, AlertTriangle, XCircle,
    ChevronRight, Settings, ArrowLeft, Shield
} from 'lucide-react';
import { useSelectedUnit } from '../context/UnitContext';
import { useToast } from '../components/Toast';
import { InvoiceEmitter, FiscalSettings, Unit } from '../types';
import { getEmitters, getFiscalSettings } from '../lib/dataService';
import TabConfiguracoes from '../components/nota-fiscal/TabConfiguracoes';

interface Props {
    isDarkMode: boolean;
    currentUser: any;
}

type FiscalStatusLevel = 'configured' | 'partial' | 'pending';

function getUnitFiscalStatus(unit: Unit, emitters: InvoiceEmitter[], settings: FiscalSettings | null): FiscalStatusLevel {
    const emitter = emitters.find(e => e.type === 'company' && e.unitId === unit.id);
    const hasEmitter = !!emitter?.cnpj;
    const hasCert = !!emitter?.certificateFile;
    const hasSettings = !!settings?.apiProvider && settings.apiProvider !== 'none';
    if (hasEmitter && hasCert && hasSettings) return 'configured';
    if (hasEmitter || hasSettings) return 'partial';
    return 'pending';
}

const STATUS_CONFIG = {
    configured: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Configurado' },
    partial: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Parcial' },
    pending: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Pendente' },
};

export default function ConfiguracaoFiscal({ isDarkMode }: Props) {
    const { units } = useSelectedUnit();
    const toast = useToast();
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
    const [allEmitters, setAllEmitters] = useState<InvoiceEmitter[]>([]);
    const [allSettings, setAllSettings] = useState<Map<string, FiscalSettings | null>>(new Map());
    const [loading, setLoading] = useState(true);

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';

    const loadAll = async () => {
        setLoading(true);
        try {
            const emitters = await getEmitters();
            setAllEmitters(emitters);
            const settingsMap = new Map<string, FiscalSettings | null>();
            for (const unit of units) {
                const s = await getFiscalSettings(unit.id);
                settingsMap.set(unit.id, s);
            }
            setAllSettings(settingsMap);
        } catch (err) {
            console.error('Error loading fiscal config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, [units.length]);

    const activeUnit = units.find(u => u.id === selectedUnit);
    const unitEmitters = selectedUnit ? allEmitters.filter(e => e.unitId === selectedUnit || (!e.unitId && !allEmitters.some(x => x.unitId === selectedUnit && x.type === 'company'))) : [];
    const unitSettings = selectedUnit ? allSettings.get(selectedUnit) || null : null;

    if (selectedUnit && activeUnit) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedUnit(null)}
                        className={`p-2.5 rounded-xl border ${borderCol} ${textSub} hover:shadow-md transition-all`}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className={`text-2xl font-bold ${textMain}`}>Configuração Fiscal</h1>
                        <p className={`text-sm ${textSub} mt-0.5`}>
                            {activeUnit.tradeName || activeUnit.name} • {activeUnit.cnpj || 'CNPJ não cadastrado'}
                        </p>
                    </div>
                </div>
                <TabConfiguracoes
                    emitters={allEmitters}
                    settings={unitSettings}
                    isDarkMode={isDarkMode}
                    onRefresh={loadAll}
                    toast={toast}
                    selectedUnitId={selectedUnit}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Shield size={24} className="text-primary" /> Configuração Fiscal
                    </h1>
                    <p className={`text-sm ${textSub} mt-1`}>
                        Configure emitentes, certificados e integrações por unidade
                    </p>
                </div>
            </div>

            {/* Unit Grid */}
            {loading ? (
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-12 text-center`}>
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className={`text-sm ${textSub} mt-3`}>Carregando configurações...</p>
                </div>
            ) : units.length === 0 ? (
                <div className={`${bgCard} border ${borderCol} rounded-2xl p-12 text-center`}>
                    <Building2 size={48} className={`${textSub} mx-auto mb-3 opacity-30`} />
                    <p className={`text-sm font-medium ${textMain}`}>Nenhuma unidade cadastrada</p>
                    <p className={`text-xs ${textSub} mt-1`}>Cadastre unidades em Unidades para configurar</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {units.filter(u => u.status === 'active').map(unit => {
                        const status = getUnitFiscalStatus(unit, allEmitters, allSettings.get(unit.id) || null);
                        const cfg = STATUS_CONFIG[status];
                        const StatusIcon = cfg.icon;
                        const emitter = allEmitters.find(e => e.type === 'company' && e.unitId === unit.id);

                        return (
                            <button key={unit.id} onClick={() => setSelectedUnit(unit.id)}
                                className={`${bgCard} border ${borderCol} rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:border-primary/40 hover:scale-[1.01] group`}>
                                {/* Status badge */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.color} ${cfg.bg} ${cfg.border} border`}>
                                        <StatusIcon size={12} /> {cfg.label}
                                    </span>
                                    <ChevronRight size={16} className={`${textSub} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                </div>

                                {/* Unit info */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                                        <Building2 size={18} className="text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-bold ${textMain} truncate`}>
                                            {unit.tradeName || unit.name}
                                        </p>
                                        <p className={`text-[11px] ${textSub} truncate`}>
                                            {unit.cnpj || 'CNPJ não cadastrado'}
                                        </p>
                                        <p className={`text-[11px] ${textSub} truncate`}>
                                            {unit.city}/{unit.state}
                                        </p>
                                    </div>
                                </div>

                                {/* Config details */}
                                <div className={`mt-3 pt-3 border-t ${borderCol} space-y-1.5`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${emitter?.cnpj ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                        <span className={`text-[11px] ${textSub}`}>
                                            Emitente {emitter?.cnpj ? '✓' : 'pendente'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${emitter?.certificateFile ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                        <span className={`text-[11px] ${textSub}`}>
                                            Certificado {emitter?.certificateFile ? '✓' : 'pendente'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${allSettings.get(unit.id)?.apiProvider && allSettings.get(unit.id)?.apiProvider !== 'none' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                        <span className={`text-[11px] ${textSub}`}>
                                            API {allSettings.get(unit.id)?.apiProvider && allSettings.get(unit.id)?.apiProvider !== 'none' ? '✓' : 'pendente'}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
