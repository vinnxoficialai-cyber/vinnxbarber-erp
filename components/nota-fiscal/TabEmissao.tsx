import React, { useState } from 'react';
import {
    Receipt, FileText, AlertCircle, ChevronRight,
    User, Zap, Clock, CreditCard, Users, Search
} from 'lucide-react';
import { Invoice, InvoiceEmitter, Comanda, TeamMember, Subscription, SubscriptionPlan } from '../../types';
import { saveInvoice } from '../../lib/dataService';
import { createInvoiceFromComanda, createInvoiceFromSubscription, emitInvoice } from '../../lib/fiscalService';

interface Props {
    invoices: Invoice[];
    emitters: InvoiceEmitter[];
    pendingComandas: Comanda[];
    members: TeamMember[];
    pendingSubscriptions: Subscription[];
    subscriptionPlans: SubscriptionPlan[];
    isDarkMode: boolean;
    onRefresh: () => void;
    confirm: any;
    toast: any;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type SourceTab = 'comandas' | 'assinaturas';

export default function TabEmissao({ invoices, emitters, pendingComandas, members, pendingSubscriptions, subscriptionPlans, isDarkMode, onRefresh, confirm, toast }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';

    const [sourceTab, setSourceTab] = useState<SourceTab>('comandas');
    const [emittingIds, setEmittingIds] = useState<Set<string>>(new Set());

    // ===================== COMANDA EMISSION =====================
    const handleEmitComanda = async (comanda: Comanda) => {
        if (emitters.length === 0) {
            toast.error('Sem emitente', 'Configure um emitente na aba Configurações antes de emitir.');
            return;
        }
        const ok = await confirm({
            title: 'Emitir Nota Fiscal',
            message: `Deseja gerar NF para a comanda de ${comanda.clientName || 'Cliente'}? Valor: ${fmt(comanda.finalAmount || comanda.totalAmount || 0)}`,
            confirmLabel: 'Emitir NF',
            variant: 'info'
        });
        if (!ok) return;

        setEmittingIds(prev => new Set(prev).add(comanda.id));
        try {
            const mainEmitter = emitters.find(e => e.type === 'company') || emitters[0];
            const invoice = await createInvoiceFromComanda(comanda, mainEmitter);
            await saveInvoice(invoice);
            const result = await emitInvoice(invoice);
            if (result.success) {
                toast.success('NF Emitida', `Nota autorizada — Protocolo: ${result.protocolNumber || 'N/A'}`);
            } else {
                toast.error('Erro na emissão', result.error || 'Erro desconhecido ao emitir NF.');
            }
        } catch (err: any) {
            toast.error('Erro', err.message || 'Erro ao processar nota fiscal.');
        }
        setEmittingIds(prev => { const n = new Set(prev); n.delete(comanda.id); return n; });
        onRefresh();
    };

    // ===================== SUBSCRIPTION EMISSION =====================
    const handleEmitSubscription = async (sub: Subscription) => {
        if (emitters.length === 0) {
            toast.error('Sem emitente', 'Configure um emitente na aba Configurações.');
            return;
        }
        const plan = subscriptionPlans.find(p => p.id === sub.planId);
        if (!plan) {
            toast.error('Plano não encontrado', 'O plano desta assinatura não foi localizado.');
            return;
        }
        const ok = await confirm({
            title: 'Emitir NF da Assinatura',
            message: `Gerar NFS-e para ${sub.clientName || 'Assinante'} — ${plan.name} (${fmt(plan.price)})`,
            confirmLabel: 'Emitir NF',
            variant: 'info'
        });
        if (!ok) return;

        setEmittingIds(prev => new Set(prev).add(sub.id));
        try {
            const mainEmitter = emitters.find(e => e.type === 'company') || emitters[0];
            const invoice = await createInvoiceFromSubscription(sub, plan, mainEmitter);
            await saveInvoice(invoice);
            const result = await emitInvoice(invoice);
            if (result.success) {
                toast.success('NF Emitida', `Assinatura ${plan.name} — Protocolo: ${result.protocolNumber || 'N/A'}`);
            } else {
                toast.error('Erro', result.error || 'Erro ao emitir NF.');
            }
        } catch (err: any) {
            toast.error('Erro', err.message || 'Erro ao processar NF de assinatura.');
        }
        setEmittingIds(prev => { const n = new Set(prev); n.delete(sub.id); return n; });
        onRefresh();
    };

    // ===================== BATCH EMISSION =====================
    const handleBatchEmitSubscriptions = async () => {
        if (pendingSubscriptions.length === 0) return;
        const ok = await confirm({
            title: 'Emissão em Lote',
            message: `Emitir NF para ${pendingSubscriptions.length} assinatura(s)?`,
            confirmLabel: 'Emitir Todas',
            variant: 'info'
        });
        if (!ok) return;

        let success = 0, fail = 0;
        for (const sub of pendingSubscriptions) {
            const plan = subscriptionPlans.find(p => p.id === sub.planId);
            if (!plan || emitters.length === 0) { fail++; continue; }
            try {
                const mainEmitter = emitters.find(e => e.type === 'company') || emitters[0];
                const invoice = await createInvoiceFromSubscription(sub, plan, mainEmitter);
                await saveInvoice(invoice);
                await emitInvoice(invoice);
                success++;
            } catch { fail++; }
        }
        toast.success('Lote concluído', `${success} emitida(s), ${fail} erro(s).`);
        onRefresh();
    };

    return (
        <div className="space-y-6">
            {/* Source Tab Toggle */}
            <div className={`${bgCard} border ${borderCol} rounded-xl p-1 shadow-sm flex gap-1`}>
                {([
                    { id: 'comandas' as const, label: 'Comandas', icon: Receipt, count: pendingComandas.length },
                    { id: 'assinaturas' as const, label: 'Assinaturas', icon: CreditCard, count: pendingSubscriptions.length },
                ]).map(t => (
                    <button key={t.id} onClick={() => setSourceTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${sourceTab === t.id
                            ? 'bg-primary text-white shadow-sm'
                            : textSub
                            }`}>
                        <t.icon size={16} />
                        {t.label}
                        {t.count > 0 && (
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceTab === t.id
                                ? 'bg-white/20 text-white'
                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* COMANDAS */}
            {sourceTab === 'comandas' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                    <div className="p-4 border-b border-inherit">
                        <div className="flex items-center justify-between">
                            <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                                <Clock size={18} className="text-amber-500" /> Comandas Fechadas sem NF
                            </h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${pendingComandas.length > 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'}`}>
                                {pendingComandas.length}
                            </span>
                        </div>
                    </div>
                    <div className="p-4">
                        {pendingComandas.length === 0 ? (
                            <div className="flex flex-col items-center py-8">
                                <Receipt size={48} className={`${textSub} opacity-20 mb-3`} />
                                <p className={`text-sm ${textSub}`}>Todas as comandas já possuem nota fiscal</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingComandas.slice(0, 20).map(cmd => {
                                    const barber = members.find(m => m.id === cmd.barberId);
                                    const isEmitting = emittingIds.has(cmd.id);
                                    return (
                                        <div key={cmd.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} hover:shadow-sm transition-all`}>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                                                    <Receipt size={14} className="text-amber-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-medium ${textMain} truncate`}>
                                                        {cmd.clientName || 'Cliente não identificado'}
                                                    </p>
                                                    <p className={`text-xs ${textSub}`}>
                                                        {barber?.name || 'Profissional'} • {new Date(cmd.closedAt || cmd.createdAt || '').toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-semibold ${textMain}`}>
                                                    {fmt(cmd.finalAmount || cmd.totalAmount || 0)}
                                                </span>
                                                <button onClick={() => handleEmitComanda(cmd)} disabled={isEmitting}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50">
                                                    <Zap size={12} /> {isEmitting ? '...' : 'Gerar NF'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ASSINATURAS */}
            {sourceTab === 'assinaturas' && (
                <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm`}>
                    <div className="p-4 border-b border-inherit">
                        <div className="flex items-center justify-between">
                            <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                                <CreditCard size={18} className="text-violet-500" /> Assinaturas Pagas sem NF
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${pendingSubscriptions.length > 0 ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'}`}>
                                    {pendingSubscriptions.length}
                                </span>
                                {pendingSubscriptions.length > 1 && (
                                    <button onClick={handleBatchEmitSubscriptions}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isDarkMode ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-primary/5 text-primary hover:bg-primary/10'}`}>
                                        <Zap size={12} /> Gerar em Lote ({pendingSubscriptions.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        {pendingSubscriptions.length === 0 ? (
                            <div className="flex flex-col items-center py-8">
                                <CreditCard size={48} className={`${textSub} opacity-20 mb-3`} />
                                <p className={`text-sm ${textSub}`}>Todas as assinaturas já possuem NF emitida</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingSubscriptions.map(sub => {
                                    const plan = subscriptionPlans.find(p => p.id === sub.planId);
                                    const isEmitting = emittingIds.has(sub.id);
                                    return (
                                        <div key={sub.id} className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} hover:shadow-sm transition-all`}>
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-bold text-primary">
                                                        {(sub.clientName || 'A').charAt(0)}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-medium ${textMain} truncate`}>{sub.clientName || 'Assinante'}</p>
                                                        {plan && (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary'}`}>
                                                                {plan.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-xs ${textSub}`}>
                                                        Pago em {sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toLocaleDateString('pt-BR') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm font-semibold ${textMain}`}>
                                                    {plan ? fmt(plan.price) : '-'}
                                                </span>
                                                <button onClick={() => handleEmitSubscription(sub)} disabled={isEmitting}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50">
                                                    <Zap size={12} /> {isEmitting ? '...' : 'Gerar NF'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Info */}
            {emitters.length === 0 && (
                <div className={`${bgCard} border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-center gap-3`}>
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                        <AlertCircle size={18} className="text-red-500" />
                    </div>
                    <div>
                        <p className={`text-sm font-semibold text-red-500`}>Nenhum emitente configurado</p>
                        <p className={`text-xs ${textSub}`}>Vá para Configurações → Dados do Emitente para cadastrar</p>
                    </div>
                </div>
            )}
        </div>
    );
}
