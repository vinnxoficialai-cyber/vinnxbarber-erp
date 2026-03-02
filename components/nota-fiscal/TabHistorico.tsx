import React, { useState, useMemo } from 'react';
import {
    Search, FileText, Download, Mail, XCircle,
    Eye, Filter, ChevronDown, Trash2, Calendar,
    User, CreditCard, Receipt, Landmark
} from 'lucide-react';
import { Invoice, InvoiceStatus, InvoiceDocType, TeamMember } from '../../types';
import { deleteInvoice, saveInvoice } from '../../lib/dataService';
import { cancelInvoice } from '../../lib/fiscalService';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';

interface Props {
    invoices: Invoice[];
    isDarkMode: boolean;
    members: TeamMember[];
    onRefresh: () => void;
    confirm: any;
    toast: any;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Rascunho', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    queued: { label: 'Na Fila', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    processing: { label: 'Processando', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    authorized: { label: 'Autorizada', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    rejected: { label: 'Rejeitada', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
    cancelled: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

const DOC_LABELS: Record<string, string> = { nfse: 'NFS-e', nfe: 'NF-e', nfce: 'NFC-e' };

// Dropdown options
const STATUS_OPTIONS: DropdownOption[] = [
    { value: 'all', label: 'Todos Status', dot: 'bg-slate-400' },
    { value: 'authorized', label: 'Autorizada', dot: 'bg-emerald-500' },
    { value: 'draft', label: 'Rascunho', dot: 'bg-slate-400' },
    { value: 'queued', label: 'Na Fila', dot: 'bg-blue-500' },
    { value: 'processing', label: 'Processando', dot: 'bg-amber-500' },
    { value: 'rejected', label: 'Rejeitada', dot: 'bg-red-500' },
    { value: 'cancelled', label: 'Cancelada', dot: 'bg-slate-300' },
];

const DOC_OPTIONS: DropdownOption[] = [
    { value: 'all', label: 'Todos Tipos' },
    { value: 'nfse', label: 'NFS-e (Serviços)' },
    { value: 'nfe', label: 'NF-e' },
    { value: 'nfce', label: 'NFC-e (Produtos)' },
];

const PERIOD_OPTIONS: DropdownOption[] = [
    { value: 'all', label: 'Todo Período' },
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '3m', label: 'Últimos 3 meses' },
    { value: '12m', label: 'Últimos 12 meses' },
];

const ORIGIN_OPTIONS: DropdownOption[] = [
    { value: 'all', label: 'Todas Origens' },
    { value: 'comanda', label: 'Comanda', dot: 'bg-amber-500' },
    { value: 'assinatura', label: 'Assinatura', dot: 'bg-violet-500' },
    { value: 'manual', label: 'Manual', dot: 'bg-slate-400' },
];

export default function TabHistorico({ invoices, isDarkMode, members, onRefresh, confirm, toast }: Props) {
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [docFilter, setDocFilter] = useState<string>('all');
    const [periodFilter, setPeriodFilter] = useState<string>('all');
    const [originFilter, setOriginFilter] = useState<string>('all');
    const [profFilter, setProfFilter] = useState<string>('all');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Build professional filter options
    const profOptions: DropdownOption[] = useMemo(() => {
        const opts: DropdownOption[] = [{ value: 'all', label: 'Todos Profissionais' }];
        members.forEach(m => opts.push({ value: m.id, label: m.name }));
        return opts;
    }, [members]);

    const filtered = useMemo(() => {
        const now = new Date();
        return invoices.filter(inv => {
            if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
            if (docFilter !== 'all' && inv.docType !== docFilter) return false;
            if (profFilter !== 'all' && inv.professionalId !== profFilter) return false;

            // Origin filter
            if (originFilter !== 'all') {
                const origin = inv.comandaId ? 'comanda' : inv.appointmentId ? 'assinatura' : 'manual';
                if (originFilter !== origin) return false;
            }

            // Period filter
            if (periodFilter !== 'all') {
                const d = new Date(inv.createdAt);
                switch (periodFilter) {
                    case 'today': {
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        if (d < today) return false; break;
                    }
                    case '7d': if (d < new Date(now.getTime() - 7 * 86400000)) return false; break;
                    case '30d': if (d < new Date(now.getTime() - 30 * 86400000)) return false; break;
                    case '3m': if (d < new Date(now.getFullYear(), now.getMonth() - 3, 1)) return false; break;
                    case '12m': if (d < new Date(now.getFullYear() - 1, now.getMonth(), 1)) return false; break;
                }
            }

            // Search
            if (search) {
                const q = search.toLowerCase();
                return inv.clientName?.toLowerCase().includes(q) ||
                    inv.number?.includes(q) ||
                    inv.emitterName?.toLowerCase().includes(q) ||
                    inv.professionalName?.toLowerCase().includes(q);
            }
            return true;
        });
    }, [invoices, search, statusFilter, docFilter, periodFilter, originFilter, profFilter]);

    const handleCancel = async (inv: Invoice) => {
        if (inv.status === 'authorized') {
            const ok = await confirm({
                title: 'Cancelar Nota Autorizada',
                message: `Cancelar nota ${inv.number || inv.id.slice(0, 8)}? Esta ação será enviada ao provedor fiscal.`,
                confirmLabel: 'Confirmar Cancelamento',
                variant: 'danger'
            });
            if (!ok) return;
            const result = await cancelInvoice(inv, 'Cancelamento solicitado pelo usuário');
            if (result.success) {
                toast.success('Nota cancelada');
            } else {
                toast.error('Erro', result.error || 'Não foi possível cancelar.');
            }
        } else {
            const ok = await confirm({
                title: 'Excluir Nota',
                message: `Excluir ${inv.number || inv.id.slice(0, 8)}?`,
                confirmLabel: 'Excluir',
                variant: 'danger'
            });
            if (!ok) return;
            await deleteInvoice(inv.id);
            toast.success('Nota excluída');
        }
        onRefresh();
    };

    const getOriginBadge = (inv: Invoice) => {
        if (inv.comandaId) return { label: 'Comanda', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' };
        if (inv.appointmentId) return { label: 'Assinatura', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' };
        return { label: 'Manual', color: textSub, bg: isDarkMode ? 'bg-dark' : 'bg-slate-50' };
    };

    return (
        <div className="space-y-4">
            {/* Filters — Row 1 */}
            <div className={`${bgCard} border ${borderCol} rounded-xl p-4 shadow-sm`}>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por cliente, número, profissional..."
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl ${bgInput} border ${borderCol} text-sm ${textMain} focus:ring-2 focus:ring-primary/30 outline-none`} />
                        </div>
                        <CustomDropdown value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS}
                            isDarkMode={isDarkMode} icon={<Filter size={13} />} className="min-w-[150px]" />
                        <CustomDropdown value={docFilter} onChange={setDocFilter} options={DOC_OPTIONS}
                            isDarkMode={isDarkMode} icon={<FileText size={13} />} className="min-w-[150px]" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <CustomDropdown value={periodFilter} onChange={setPeriodFilter} options={PERIOD_OPTIONS}
                            isDarkMode={isDarkMode} icon={<Calendar size={13} />} className="min-w-[160px]" />
                        <CustomDropdown value={originFilter} onChange={setOriginFilter} options={ORIGIN_OPTIONS}
                            isDarkMode={isDarkMode} icon={<Receipt size={13} />} className="min-w-[150px]" />
                        <CustomDropdown value={profFilter} onChange={setProfFilter} options={profOptions}
                            isDarkMode={isDarkMode} icon={<User size={13} />} className="min-w-[170px]" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className={`${bgCard} border ${borderCol} rounded-xl shadow-sm overflow-hidden`}>
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                        <FileText size={48} className={`${textSub} opacity-20 mb-3`} />
                        <p className={`text-sm ${textSub}`}>Nenhuma nota fiscal encontrada</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={`border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Número</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Tipo</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Origem</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Cliente</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Valor</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>ISS</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Status</th>
                                    <th className={`text-left text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Data</th>
                                    <th className={`text-right text-xs font-semibold ${textSub} uppercase px-4 py-3`}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(inv => {
                                    const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                                    const origin = getOriginBadge(inv);
                                    return (
                                        <tr key={inv.id} className={`border-b ${borderCol} last:border-b-0 hover:${isDarkMode ? 'bg-dark' : 'bg-slate-50'} transition-colors`}>
                                            <td className={`px-4 py-3 text-sm font-medium ${textMain}`}>
                                                {inv.number || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>
                                                    {DOC_LABELS[inv.docType] || inv.docType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${origin.bg} ${origin.color}`}>
                                                    {origin.label}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-sm ${textMain}`}>{inv.clientName}</td>
                                            <td className={`px-4 py-3 text-sm font-semibold ${textMain}`}>{fmt(inv.totalAmount)}</td>
                                            <td className="px-4 py-3">
                                                {inv.issTotal ? (
                                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50'} text-violet-500`}>
                                                        {fmt(inv.issTotal)}
                                                    </span>
                                                ) : (
                                                    <span className={`text-xs ${textSub}`}>-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${st.bg} ${st.color}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-sm ${textSub}`}>
                                                {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setSelectedInvoice(inv)}
                                                        className="text-primary hover:underline text-xs font-medium">Ver</button>
                                                    {inv.status === 'authorized' && (
                                                        <button className="text-primary hover:underline text-xs font-medium">PDF</button>
                                                    )}
                                                    {inv.status === 'authorized' && (
                                                        <button onClick={() => handleCancel(inv)}
                                                            className="text-amber-500 hover:underline text-xs font-medium">Cancelar</button>
                                                    )}
                                                    {['draft', 'rejected'].includes(inv.status) && (
                                                        <button onClick={() => handleCancel(inv)}
                                                            className="text-red-500 hover:underline text-xs font-medium">Excluir</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}>
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center`}>
                            <h3 className={`font-semibold ${textMain}`}>
                                Nota {selectedInvoice.number || selectedInvoice.id.slice(0, 8)}
                            </h3>
                            <button onClick={() => setSelectedInvoice(null)} className={textSub}>✕</button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Tipo', DOC_LABELS[selectedInvoice.docType]],
                                    ['Status', STATUS_CONFIG[selectedInvoice.status]?.label],
                                    ['Cliente', selectedInvoice.clientName],
                                    ['CPF/CNPJ', selectedInvoice.clientCpfCnpj || '-'],
                                    ['Emitente', selectedInvoice.emitterName],
                                    ['Valor', fmt(selectedInvoice.totalAmount)],
                                    ['ISS', selectedInvoice.issTotal ? fmt(selectedInvoice.issTotal) : '-'],
                                    ['Origem', selectedInvoice.comandaId ? 'Comanda' : selectedInvoice.appointmentId ? 'Assinatura' : 'Manual'],
                                ].map(([l, v], i) => (
                                    <div key={i} className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                        <p className={`text-xs ${textSub}`}>{l}</p>
                                        <p className={`text-sm font-medium ${textMain}`}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            {selectedInvoice.items.length > 0 && (
                                <div>
                                    <h4 className={`text-xs font-bold ${textSub} uppercase mb-2`}>Itens</h4>
                                    {selectedInvoice.items.map((item, i) => (
                                        <div key={i} className={`flex justify-between p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} mb-1`}>
                                            <span className={`text-sm ${textMain}`}>{item.description}</span>
                                            <span className={`text-sm font-semibold ${textMain}`}>{fmt(item.totalPrice)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
