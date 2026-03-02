import React, { useState, useEffect, useMemo } from 'react';
import {
    FileSpreadsheet, Plus, X, Pencil, Trash2, Check, DollarSign,
    CalendarDays, AlertCircle, CheckCircle, Pause, Clock
} from 'lucide-react';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { CustomDropdown } from '../components/CustomDropdown';
import { supabase } from '../lib/supabase';

// ============================================================
// Types
// ============================================================
interface RecurringExpense {
    id: string;
    name: string;
    description?: string;
    amount: number;
    category: string;
    dueDay: number;
    recurrence: string;
    status: string;
    lastPaidAt?: string;
    lastPaidAmount?: number;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

const CATEGORIES = [
    { value: 'rent', label: 'Aluguel', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { value: 'utilities', label: 'Utilidades (Água/Energia)', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { value: 'subscriptions', label: 'Assinaturas/Serviços', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { value: 'taxes', label: 'Impostos', color: 'text-red-500', bg: 'bg-red-500/10' },
    { value: 'insurance', label: 'Seguros', color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { value: 'salaries', label: 'Salários', color: 'text-green-500', bg: 'bg-green-500/10' },
    { value: 'other', label: 'Outros', color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

interface ContasPagarProps {
    isDarkMode: boolean;
}

// ============================================================
// Component
// ============================================================
export const ContasPagar: React.FC<ContasPagarProps> = ({ isDarkMode }) => {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
    const confirm = useConfirm();
    const toast = useToast();

    // Theme
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        amount: 0,
        category: 'other',
        dueDay: 1,
        recurrence: 'monthly',
        notes: '',
    });

    const isFormValid = useMemo(() => formData.name.trim() !== '' && formData.amount > 0, [formData.name, formData.amount]);
    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // ============================================================
    // Data Loading
    // ============================================================
    const loadExpenses = async () => {
        try {
            const { data, error } = await supabase
                .from('recurring_expenses')
                .select('*')
                .order('dueDay', { ascending: true });
            if (error) throw error;
            setExpenses((data || []).map(e => ({
                id: e.id,
                name: e.name,
                description: e.description,
                amount: Number(e.amount),
                category: e.category,
                dueDay: e.dueDay,
                recurrence: e.recurrence,
                status: e.status,
                lastPaidAt: e.lastPaidAt,
                lastPaidAmount: e.lastPaidAmount ? Number(e.lastPaidAmount) : undefined,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            })));
        } catch (err: any) {
            console.error('Error loading expenses:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadExpenses(); }, []);

    // ============================================================
    // Handlers
    // ============================================================
    const handleOpenModal = (expense?: RecurringExpense) => {
        if (expense) {
            setEditingExpense(expense);
            setFormData({
                name: expense.name,
                description: expense.description || '',
                amount: expense.amount,
                category: expense.category,
                dueDay: expense.dueDay,
                recurrence: expense.recurrence,
                notes: expense.notes || '',
            });
        } else {
            setEditingExpense(null);
            setFormData({ name: '', description: '', amount: 0, category: 'other', dueDay: 1, recurrence: 'monthly', notes: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const now = new Date().toISOString();
        const dbData = {
            name: formData.name,
            description: formData.description || null,
            amount: formData.amount,
            category: formData.category,
            dueDay: formData.dueDay,
            recurrence: formData.recurrence,
            notes: formData.notes || null,
            updatedAt: now,
        };

        try {
            if (editingExpense) {
                const { error } = await supabase.from('recurring_expenses').update(dbData).eq('id', editingExpense.id);
                if (error) throw error;
                toast.success('Despesa atualizada');
            } else {
                const { error } = await supabase.from('recurring_expenses').insert({ ...dbData, createdAt: now });
                if (error) throw error;
                toast.success('Despesa criada');
            }
            setIsModalOpen(false);
            loadExpenses();
        } catch (err: any) {
            toast.error('Erro ao salvar', err.message);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Excluir Despesa',
            message: 'Tem certeza que deseja excluir esta despesa recorrente?',
            variant: 'danger',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (ok) {
            const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
            if (error) { toast.error('Erro ao excluir', error.message); return; }
            toast.success('Despesa excluída');
            loadExpenses();
        }
    };

    const handleMarkPaid = async (expense: RecurringExpense) => {
        const now = new Date().toISOString();
        const { error } = await supabase.from('recurring_expenses').update({
            lastPaidAt: now,
            lastPaidAmount: expense.amount,
            updatedAt: now,
        }).eq('id', expense.id);
        if (error) { toast.error('Erro', error.message); return; }
        toast.success(`"${expense.name}" marcada como paga`);
        loadExpenses();
    };

    const handleToggleStatus = async (expense: RecurringExpense) => {
        const newStatus = expense.status === 'active' ? 'paused' : 'active';
        const { error } = await supabase.from('recurring_expenses').update({
            status: newStatus,
            updatedAt: new Date().toISOString(),
        }).eq('id', expense.id);
        if (error) { toast.error('Erro', error.message); return; }
        toast.success(newStatus === 'paused' ? 'Despesa pausada' : 'Despesa reativada');
        loadExpenses();
    };

    // ============================================================
    // Computed
    // ============================================================
    const totalMonthly = expenses.filter(e => e.status === 'active' && e.recurrence === 'monthly').reduce((s, e) => s + e.amount, 0);
    const totalAnnual = expenses.filter(e => e.status === 'active').reduce((s, e) => {
        if (e.recurrence === 'monthly') return s + (e.amount * 12);
        if (e.recurrence === 'quarterly') return s + (e.amount * 4);
        return s + e.amount;
    }, 0);
    const today = new Date().getDate();
    const dueThisMonth = expenses.filter(e => e.status === 'active' && e.dueDay >= today && !isPaidThisMonth(e));

    function isPaidThisMonth(e: RecurringExpense) {
        if (!e.lastPaidAt) return false;
        const paid = new Date(e.lastPaidAt);
        const now = new Date();
        return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
    }

    const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="animate-in fade-in duration-300 pb-16 md:pb-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <FileSpreadsheet className="text-primary" /> Contas a Pagar
                    </h1>
                    <p className={`${textSub} text-sm`}>Gerencie despesas recorrentes da empresa.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                >
                    <Plus size={16} /> Nova Despesa
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 rounded-lg"><DollarSign size={20} className="text-red-500" /></div>
                        <span className={`text-sm ${textSub}`}>Total Mensal</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalMonthly)}</p>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg"><CalendarDays size={20} className="text-orange-500" /></div>
                        <span className={`text-sm ${textSub}`}>Projeção Anual</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalAnnual)}</p>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-500/10 rounded-lg"><AlertCircle size={20} className="text-yellow-500" /></div>
                        <span className={`text-sm ${textSub}`}>Pendentes este Mês</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-500">{dueThisMonth.length}</p>
                </div>
            </div>

            {/* Expenses List */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold ${textMain}`}>Despesas Recorrentes</h3>
                </div>

                {isLoading ? (
                    <div className={`p-8 text-center ${textSub}`}>Carregando...</div>
                ) : expenses.length === 0 ? (
                    <div className={`p-12 text-center ${textSub}`}>
                        <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-30" />
                        <p>Nenhuma despesa cadastrada.</p>
                        <p className="text-sm mt-1">Clique em "Nova Despesa" para começar.</p>
                    </div>
                ) : (
                    <div className={`divide-y ${isDarkMode ? 'divide-dark-border' : 'divide-slate-100'}`}>
                        {expenses.map(expense => {
                            const cat = getCategoryInfo(expense.category);
                            const paid = isPaidThisMonth(expense);
                            const isOverdue = !paid && expense.status === 'active' && expense.dueDay < today;
                            return (
                                <div key={expense.id} className={`px-4 py-3 flex items-center gap-4 ${isDarkMode ? 'hover:bg-dark-border/20' : 'hover:bg-slate-50'} transition-colors ${expense.status === 'paused' ? 'opacity-50' : ''}`}>
                                    {/* Category Icon */}
                                    <div className={`p-2.5 ${cat.bg} rounded-lg hidden sm:block`}>
                                        <DollarSign size={18} className={cat.color} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`font-semibold ${textMain} truncate`}>{expense.name}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${cat.bg} ${cat.color} font-medium`}>{cat.label}</span>
                                            {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">Vencida</span>}
                                            {paid && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium flex items-center gap-1"><CheckCircle size={10} /> Paga</span>}
                                            {expense.status === 'paused' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-medium flex items-center gap-1"><Pause size={10} /> Pausada</span>}
                                        </div>
                                        <div className={`text-xs ${textSub} flex items-center gap-2 mt-0.5`}>
                                            <span>Dia {expense.dueDay}</span>
                                            <span>•</span>
                                            <span>{expense.recurrence === 'monthly' ? 'Mensal' : expense.recurrence === 'quarterly' ? 'Trimestral' : 'Anual'}</span>
                                            {expense.description && <><span>•</span><span className="truncate">{expense.description}</span></>}
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right shrink-0">
                                        <p className={`font-bold ${textMain}`}>{formatCurrency(expense.amount)}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1 shrink-0">
                                        {!paid && expense.status === 'active' && (
                                            <button
                                                onClick={() => handleMarkPaid(expense)}
                                                title="Marcar como paga"
                                                className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-green-50'} text-green-500 transition-colors`}
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleToggleStatus(expense)}
                                            title={expense.status === 'active' ? 'Pausar' : 'Reativar'}
                                            className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} transition-colors`}
                                        >
                                            {expense.status === 'active' ? <Pause size={14} /> : <Clock size={14} />}
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(expense)}
                                            className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-primary transition-colors`}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className={`p-1.5 rounded ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-100'} ${textSub} hover:text-red-500 transition-colors`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>
                                {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${textSub}`}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Nome da Despesa *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="Ex: Aluguel do Escritório"
                                    required
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Descrição</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="Ex: Contrato 12 meses"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Valor (R$) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount || ''}
                                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Dia do Vencimento</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={formData.dueDay}
                                        onChange={e => setFormData({ ...formData, dueDay: parseInt(e.target.value) || 1 })}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Categoria</label>
                                    <CustomDropdown
                                        value={formData.category}
                                        onChange={v => setFormData({ ...formData, category: v })}
                                        options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Recorrência</label>
                                    <CustomDropdown
                                        value={formData.recurrence}
                                        onChange={v => setFormData({ ...formData, recurrence: v })}
                                        options={[
                                            { value: 'monthly', label: 'Mensal' },
                                            { value: 'quarterly', label: 'Trimestral' },
                                            { value: 'annual', label: 'Anual' }
                                        ]}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações</label>
                                <textarea
                                    rows={2}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`}
                                    placeholder="Anotações..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain} transition-colors`}>Cancelar</button>
                                <button type="submit" disabled={!isFormValid}
                                    className={`flex-1 py-3 font-bold rounded-lg transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
