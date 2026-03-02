import React, { useState, useMemo } from 'react'; // removed useEffect
import { Target, Plus, X, TrendingUp, Users, FileSignature, DollarSign } from 'lucide-react';
import { Goal, GoalType, TeamMember, Contract, Client } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useAppData } from '../hooks/useAppData'; // MIGRATED
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency } from '../utils';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveGoal, deleteGoal } from '../lib/dataService';

interface MetasProps {
    members: TeamMember[];
    contracts: Contract[];
    clients: Client[];
    currentUser: TeamMember;
    isDarkMode: boolean;
}

const GOAL_TYPES: { value: GoalType; label: string; color: string }[] = [
    { value: 'revenue', label: 'Receita', color: 'text-green-500' },
    { value: 'mrr', label: 'MRR', color: 'text-blue-500' },
    { value: 'contracts', label: 'Contratos', color: 'text-purple-500' },
    { value: 'clients', label: 'Clientes', color: 'text-orange-500' },
];

export const Metas: React.FC<MetasProps> = ({ contracts, clients, currentUser, isDarkMode }) => {
    // Use useAppData
    const { goals, permissions: contextPermissions, refresh, loading } = useAppData();
    const { canCreate, canDelete, isAdminOrManager } = usePermissions(currentUser, contextPermissions);

    // Permissions
    const canCreateGoal = canCreate('/metas');
    const canDeleteGoal = canDelete('/metas');
    // Note: canViewAllData returns true for 'read' level, but Sales with 'read'
    // should still only see their OWN goals, not all.
    const viewAll = isAdminOrManager;

    // Guard: prevent crash if data is still loading
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        type: 'revenue' as GoalType, title: '', targetValue: 0,
        period: 'monthly' as 'monthly' | 'quarterly' | 'annual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    });

    // Form validation - required fields
    const isFormValid = useMemo(() => {
        return formData.targetValue > 0;
    }, [formData.targetValue]);

    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    const confirm = useConfirm();
    const toast = useToast();

    // REMOVED: useEffect for safeStorage

    // Data Scoping: Sales sees only their own goals
    const scopedGoals = useMemo(() => {
        if (viewAll) return goals;
        return goals.filter(g => g.assignedTo.includes(currentUser.id));
    }, [goals, viewAll, currentUser.id]);

    const calculateCurrentValue = (goal: Goal): number => {
        const activeContracts = contracts.filter(c => c.status === 'Active');
        switch (goal.type) {
            case 'mrr': return activeContracts.reduce((sum, c) => sum + c.monthlyValue, 0);
            case 'contracts': return activeContracts.length;
            case 'clients': return clients.filter(c => c.status === 'Active').length;
            case 'revenue': return activeContracts.reduce((sum, c) => sum + (c.monthlyValue * c.contractDuration), 0);
            default: return 0;
        }
    };

    const currentMRR = contracts.filter(c => c.status === 'Active').reduce((s, c) => s + c.monthlyValue, 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validação
        if (formData.targetValue <= 0) {
            setFormError('O valor alvo deve ser maior que zero');
            return;
        }

        const newGoal: Goal = {
            id: crypto.randomUUID(), // UUID
            ...formData,
            title: formData.title || GOAL_TYPES.find(t => t.value === formData.type)?.label || 'Meta',
            currentValue: 0,
            assignedTo: [],
            createdAt: new Date().toISOString(),
        };

        // Persistir no Supabase
        const result = await saveGoal(newGoal);
        if (!result.success) {
            toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();

        setIsModalOpen(false);
        setFormError(null);
        toast.success('Meta criada');
    };

    const handleDelete = async (goal: Goal) => {
        const ok = await confirm({
            title: 'Excluir Meta',
            message: `Tem certeza que deseja excluir "${goal.title}"?`,
            variant: 'danger',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (ok) {
            // Persistir no Supabase
            const result = await deleteGoal(goal.id);
            if (!result.success) {
                toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
                return;
            }
            await refresh();
            toast.success('Meta excluída');
        }
    };

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Target className="text-primary" /> Metas & Comissões
                    </h1>
                    <p className={`${textSub} text-sm`}>Acompanhe suas metas.</p>
                </div>
                {canCreateGoal && (
                    <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2">
                        <Plus size={16} /> Nova Meta
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-500/10 rounded-lg"><TrendingUp size={20} className="text-blue-500" /></div><span className={`text-sm ${textSub}`}>MRR Atual</span></div>
                    <p className="text-2xl font-bold text-blue-500">{formatCurrency(currentMRR)}</p>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-purple-500/10 rounded-lg"><FileSignature size={20} className="text-purple-500" /></div><span className={`text-sm ${textSub}`}>Contratos</span></div>
                    <p className="text-2xl font-bold text-purple-500">{contracts.filter(c => c.status === 'Active').length}</p>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-orange-500/10 rounded-lg"><Users size={20} className="text-orange-500" /></div><span className={`text-sm ${textSub}`}>Clientes</span></div>
                    <p className="text-2xl font-bold text-orange-500">{clients.filter(c => c.status === 'Active').length}</p>
                </div>
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-green-500/10 rounded-lg"><DollarSign size={20} className="text-green-500" /></div><span className={`text-sm ${textSub}`}>Metas</span></div>
                    <p className="text-2xl font-bold text-green-500">{scopedGoals.length}</p>
                </div>
            </div>

            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}><h3 className={`font-semibold ${textMain}`}>Metas</h3></div>
                <div className="divide-y divide-slate-200 dark:divide-dark-border">
                    {scopedGoals.map(goal => {
                        const current = calculateCurrentValue(goal);
                        const pct = Math.min(100, (current / goal.targetValue) * 100);
                        const isMoney = goal.type === 'revenue' || goal.type === 'mrr';
                        return (
                            <div key={goal.id} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`font-semibold ${textMain}`}>{goal.title}</p>
                                    {canDeleteGoal && (
                                        <button onClick={() => handleDelete(goal)} className={`${textSub} hover:text-red-500`}><X size={16} /></button>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className={textMain}>{isMoney ? formatCurrency(current) : current} / {isMoney ? formatCurrency(goal.targetValue) : goal.targetValue}</span>
                                    <span className={`font-bold ${pct >= 100 ? 'text-green-500' : textMain}`}>{pct.toFixed(0)}%</span>
                                </div>
                                <div className={`h-2 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-200'}`}>
                                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary' : 'bg-yellow-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                    {scopedGoals.length === 0 && <div className={`p-8 text-center ${textSub}`}><Target size={48} className="mx-auto mb-4 opacity-30" /><p>Nenhuma meta.</p></div>}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center`}>
                            <h3 className={`font-semibold ${textMain}`}>Nova Meta</h3>
                            <button onClick={() => setIsModalOpen(false)} className={textSub}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                                    {formError}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={`block text-xs ${textSub} mb-1`}>Tipo</label>
                                    <CustomDropdown
                                        value={formData.type}
                                        onChange={v => setFormData({ ...formData, type: v as GoalType })}
                                        options={GOAL_TYPES.map(t => ({ value: t.value, label: t.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div><label className={`block text-xs ${textSub} mb-1`}>Valor Alvo</label>
                                    <input type="number" value={formData.targetValue} onChange={e => setFormData({ ...formData, targetValue: +e.target.value })} className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain}`} required min="1" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain}`}>Cancelar</button>
                                <button type="submit" disabled={!isFormValid} className={`flex-1 py-3 font-bold rounded-lg transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>Criar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
