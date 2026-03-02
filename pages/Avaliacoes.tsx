import React, { useState, useEffect, useMemo } from 'react';
import { Star, Plus, X, User, TrendingUp, Calendar, ChevronRight, BarChart3, Users, UserCheck, Target, Filter, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { TeamMember, PerformanceReview, PerformanceCriterion } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useAppData } from '../hooks/useAppData'; // MIGRATED
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { savePerformanceReview, deletePerformanceReview } from '../lib/dataService';

// Review types for 360 feedback
type ReviewDirection = 'self' | 'manager' | 'peer' | 'upward';

interface AvaliacoesProps {
    // members: TeamMember[]; // members now comes from useAppData, but we can keep prop if App passes it, or ignore it.
    // To minimize breaking changes in App.tsx, we can keep the prop interface but prefer useAppData inside.
    // However, clean code suggests removing unused props. Let's see usage in App.tsx.
    // App.tsx passes: <Avaliacoes members={members} currentUser={currentUser} isDarkMode={isDarkMode} />
    // So we can accept them, but members in useAppData is the source of truth.
    members: TeamMember[];
    currentUser: TeamMember;
    isDarkMode: boolean;
}

// EnhancedReview not needed if PerformanceReview has direction. 
// Types.ts was updated to have direction.
// So we can use PerformanceReview directly.

const CRITERIA_BY_ROLE: Record<string, { id: string; name: string; weight: number }[]> = {
    default: [
        { id: '1', name: 'Qualidade do trabalho', weight: 1.2 },
        { id: '2', name: 'Pontualidade', weight: 1.0 },
        { id: '3', name: 'Comunicação', weight: 1.0 },
        { id: '4', name: 'Trabalho em equipe', weight: 1.1 },
        { id: '5', name: 'Proatividade', weight: 1.0 },
    ],
    'Sales Executive': [
        { id: '1', name: 'Cumprimento de metas', weight: 1.5 },
        { id: '2', name: 'Relacionamento com cliente', weight: 1.3 },
        { id: '3', name: 'Negociação', weight: 1.2 },
        { id: '4', name: 'Prospecção', weight: 1.0 },
        { id: '5', name: 'Conhecimento do produto', weight: 1.0 },
    ],
    Manager: [
        { id: '1', name: 'Liderança', weight: 1.5 },
        { id: '2', name: 'Tomada de decisão', weight: 1.3 },
        { id: '3', name: 'Desenvolvimento de equipe', weight: 1.2 },
        { id: '4', name: 'Gestão de conflitos', weight: 1.1 },
        { id: '5', name: 'Planejamento estratégico', weight: 1.0 },
    ],
};

const DIRECTION_CONFIG: Record<ReviewDirection, { label: string; icon: React.ElementType; color: string }> = {
    self: { label: 'Autoavaliação', icon: UserCheck, color: 'text-purple-500' },
    manager: { label: 'Avaliação do Gestor', icon: TrendingUp, color: 'text-blue-500' },
    peer: { label: 'Avaliação por Pares', icon: Users, color: 'text-green-500' },
    upward: { label: 'Avaliação Ascendente', icon: ArrowUpRight, color: 'text-orange-500' },
};

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'Precisa melhorar', color: 'bg-red-500' },
    2: { label: 'Abaixo do esperado', color: 'bg-orange-500' },
    3: { label: 'Atende expectativas', color: 'bg-yellow-500' },
    4: { label: 'Acima do esperado', color: 'bg-lime-500' },
    5: { label: 'Excepcional', color: 'bg-green-500' },
};

export const Avaliacoes: React.FC<AvaliacoesProps> = ({ currentUser, isDarkMode }) => {
    // Use useAppData for state management
    const { reviews, members, setReviews, refresh, loading } = useAppData();

    // Guard: prevent crash if currentUser is not loaded yet or data is loading
    if (!currentUser || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Local UI state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [reviewDirection, setReviewDirection] = useState<ReviewDirection>('manager');
    const [reviewType, setReviewType] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
    const [period, setPeriod] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
    const [criteria, setCriteria] = useState<(PerformanceCriterion & { weight: number })[]>([]);
    const [positives, setPositives] = useState('');
    const [improvements, setImprovements] = useState('');
    const [goals, setGoals] = useState('');
    const [filterDirection, setFilterDirection] = useState<ReviewDirection | 'all'>('all');
    const [selectedMemberView, setSelectedMemberView] = useState<string | null>(null);

    const confirm = useConfirm();
    const toast = useToast();

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

    // Access Control
    const { permissions: contextPermissions } = useAppData();
    const { canCreate, canDelete, isAdminOrManager } = usePermissions(currentUser, contextPermissions);
    const canCreateReview = canCreate('/avaliacoes');
    const canDeleteReview = canDelete('/avaliacoes');
    // Non-admin/manager can only see their own reviews
    const viewAllData = isAdminOrManager;

    // REMOVED: useEffect for safeStorage saving

    // Initialize criteria based on member role
    useEffect(() => {
        if (selectedMemberId) {
            const member = members.find(m => m.id === selectedMemberId);
            const roleCriteria = CRITERIA_BY_ROLE[member?.role || ''] || CRITERIA_BY_ROLE.default;
            setCriteria(roleCriteria.map(c => ({ ...c, score: 3 as const })));
        }
    }, [selectedMemberId, members]);

    const calculateWeightedScore = (c: (PerformanceCriterion & { weight: number })[]) => {
        const totalWeight = c.reduce((acc, curr) => acc + curr.weight, 0);
        const weightedSum = c.reduce((acc, curr) => acc + (curr.score * curr.weight), 0);
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    };

    const getMemberReviews = (memberId: string) => reviews.filter(r => r.employeeId === memberId);

    const get360Summary = (memberId: string) => {
        const memberReviews = getMemberReviews(memberId);
        const directions: ReviewDirection[] = ['self', 'manager', 'peer', 'upward'];
        return directions.map(dir => {
            const dirReviews = memberReviews.filter(r => r.direction === dir);
            if (dirReviews.length === 0) return { direction: dir, average: null, count: 0 };
            const avg = dirReviews.reduce((acc, r) => acc + r.overallScore, 0) / dirReviews.length;
            return { direction: dir, average: avg, count: dirReviews.length };
        });
    };

    const getOverall360Score = (memberId: string) => {
        const summary = get360Summary(memberId);
        const validScores = summary.filter(s => s.average !== null);
        if (validScores.length === 0) return null;
        return validScores.reduce((acc, s) => acc + (s.average || 0), 0) / validScores.length;
    };

    const getScoreBadge = (score: number) => {
        const rounded = Math.round(score);
        const info = SCORE_LABELS[rounded] || SCORE_LABELS[3];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white ${info.color}`}>
                <Star size={12} /> {score.toFixed(1)}
            </span>
        );
    };

    const handleScoreChange = (criterionId: string, score: 1 | 2 | 3 | 4 | 5) => {
        setCriteria(prev => prev.map(c => c.id === criterionId ? { ...c, score } : c));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMemberId) return;

        // Lookup teamMemberId for FK
        const selectedMember = members.find(m => m.id === selectedMemberId);

        // Use PerformanceReview type directly
        const newReview: PerformanceReview & { teamMemberId?: string } = {
            id: crypto.randomUUID(),
            employeeId: selectedMemberId,
            teamMemberId: selectedMember?.teamMemberId, // FK to team_members table
            reviewerId: currentUser.id,
            direction: reviewDirection,
            type: reviewType,
            period,
            criteria: criteria.map(c => ({ id: c.id, name: c.name, score: c.score })),
            overallScore: calculateWeightedScore(criteria),
            positives,
            improvements,
            goals,
            createdAt: new Date().toISOString(),
        };

        // Save to Supabase
        const result = await savePerformanceReview(newReview);
        if (!result.success) {
            toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
            return;
        }

        // Optimistic update + Refresh
        // setReviews(prev => [newReview, ...prev]); // Optional: optimistic
        await refresh(); // Sync with DB

        setIsModalOpen(false);
        resetForm();
        toast.success('Avaliação registrada');
    };

    const handleDelete = async (reviewId: string) => {
        const ok = await confirm({
            title: 'Excluir Avaliação',
            message: 'Tem certeza que deseja excluir esta avaliação?',
            variant: 'danger',
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (ok) {
            const result = await deletePerformanceReview(reviewId);
            if (!result.success) {
                toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
                return;
            }
            // setReviews(prev => prev.filter(r => r.id !== reviewId)); // Optional: optimistic
            await refresh();
            toast.success('Avaliação excluída');
        }
    };

    const resetForm = () => {
        setSelectedMemberId('');
        // Initialize criteria empty until member selected
        setCriteria([]);
        setPositives('');
        setImprovements('');
        setGoals('');
    };

    const filteredReviews = useMemo(() => {
        let filtered = reviews;

        // Data Scoping
        if (!viewAllData) {
            filtered = filtered.filter(r => r.employeeId === currentUser.id);
        }

        if (filterDirection !== 'all') {
            filtered = filtered.filter(r => r.direction === filterDirection);
        }
        if (selectedMemberView) {
            filtered = filtered.filter(r => r.employeeId === selectedMemberView);
        }
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [reviews, filterDirection, selectedMemberView, viewAllData, currentUser.id]);

    const visibleMembers = useMemo(() => {
        if (viewAllData) return members;
        return members.filter(m => m.id === currentUser.id);
    }, [members, viewAllData, currentUser.id]);

    // Stats based on visible reviews
    const stats = useMemo(() => {
        // Use filteredReviews source (but without UI filters like direction/memberView, just scoping)
        // actually easier to re-filter from raw reviews for stats to check consistency?
        // Let's use the scoped reviews base.
        let base = reviews;
        if (!viewAllData) {
            base = base.filter(r => r.employeeId === currentUser.id);
        }

        const total = base.length;
        const byDirection = {
            self: base.filter(r => r.direction === 'self').length,
            manager: base.filter(r => r.direction === 'manager').length,
            peer: base.filter(r => r.direction === 'peer').length,
            upward: base.filter(r => r.direction === 'upward').length,
        };
        const avgScore = total > 0 ? base.reduce((acc, r) => acc + r.overallScore, 0) / total : 0;
        return { total, byDirection, avgScore };
    }, [reviews, viewAllData, currentUser.id]);

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Star className="text-primary" /> Avaliação 360°
                    </h1>
                    <p className={`${textSub} text-sm`}>Avaliação completa com feedback de múltiplas perspectivas.</p>
                </div>

                {canCreateReview && (
                    <button onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
                        <Plus size={16} /> Nova Avaliação
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={16} className="text-primary" />
                        <span className={`text-xs ${textSub}`}>Total</span>
                    </div>
                    <p className={`text-2xl font-bold ${textMain}`}>{stats.total}</p>
                </div>
                {Object.entries(DIRECTION_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                        <div key={key} className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon size={16} className={config.color} />
                                <span className={`text-xs ${textSub}`}>{config.label.split(' ')[0]}</span>
                            </div>
                            <p className={`text-2xl font-bold ${textMain}`}>{stats.byDirection[key as ReviewDirection]}</p>
                        </div>
                    );
                })}
            </div>

            {/* Members 360 Overview */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden mb-6`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} flex justify-between items-center`}>
                    <h3 className={`font-semibold ${textMain}`}>Visão 360° por Funcionário</h3>
                </div>
                <div className="overflow-x-auto">
                    <div className="relative">
                        {/* Fade effect for horizontal scroll */}
                        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-dark-surface to-transparent z-10" />
                        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-dark-surface to-transparent z-10" />

                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className={`text-xs font-bold uppercase ${textSub}`}>
                                    <th className="text-left p-4">Funcionário</th>
                                    {Object.entries(DIRECTION_CONFIG).map(([key, config]) => (
                                        <th key={key} className="text-center p-4">
                                            <span className={`flex items-center justify-center gap-1 ${config.color}`}>
                                                {React.createElement(config.icon, { size: 14 })}
                                                {config.label.split(' ')[0]}
                                            </span>
                                        </th>
                                    ))}
                                    <th className="text-center p-4">Média 360°</th>
                                    <th className="text-center p-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleMembers.map(member => {
                                    const summary = get360Summary(member.id);
                                    const overall = getOverall360Score(member.id);
                                    return (
                                        <tr key={member.id} className={`border-t ${borderCol} hover:${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'} transition-colors`}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                                        <User size={16} className={textSub} />
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold text-sm ${textMain}`}>{member.name}</p>
                                                        <p className={`text-xs ${textSub}`}>{member.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {summary.map(s => (
                                                <td key={s.direction} className="p-4 text-center">
                                                    {s.average !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            {getScoreBadge(s.average)}
                                                            <span className={`text-xs ${textSub} mt-1`}>({s.count})</span>
                                                        </div>
                                                    ) : (
                                                        <span className={`text-xs ${textSub}`}>-</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="p-4 text-center">
                                                {overall !== null ? getScoreBadge(overall) : <span className={textSub}>-</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                {canCreateReview && (
                                                    <button onClick={() => { setSelectedMemberId(member.id); setIsModalOpen(true); }}
                                                        className="text-primary hover:text-primary-600 text-sm font-medium flex items-center gap-1 mx-auto">
                                                        Avaliar <ChevronRight size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Reviews with Filter */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
                    <h3 className={`font-semibold ${textMain}`}>Histórico de Avaliações</h3>
                    <div className="flex items-center gap-2">
                        <Filter size={14} className={textSub} />
                        <CustomDropdown
                            value={filterDirection}
                            onChange={v => setFilterDirection(v as ReviewDirection | 'all')}
                            options={[
                                { value: 'all', label: 'Todas' },
                                ...Object.entries(DIRECTION_CONFIG).map(([key, config]) => ({ value: key, label: config.label }))
                            ]}
                            isDarkMode={isDarkMode}
                            placeholder="Todas"
                        />
                    </div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-dark-border">
                    {filteredReviews.slice(0, 10).map(review => {
                        const member = members.find(m => m.id === review.employeeId);
                        const reviewer = members.find(m => m.id === review.reviewerId);
                        const dirConfig = DIRECTION_CONFIG[review.direction || 'manager']; // Fallback
                        const DirIcon = dirConfig.icon;
                        return (
                            <div key={review.id} className="p-4 flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                    <DirIcon size={18} className={dirConfig.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`font-semibold text-sm ${textMain}`}>{member?.name || 'Desconhecido'}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} ${dirConfig.color}`}>
                                            {dirConfig.label}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${textSub}`}>
                                        Por {reviewer?.name || 'Sistema'} • {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {getScoreBadge(review.overallScore)}
                                    {canDeleteReview && (
                                        <button onClick={() => handleDelete(review.id)} className="text-red-500 hover:text-red-600 p-1">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredReviews.length === 0 && (
                        <div className={`text-center py-12 ${textSub}`}>
                            <Star size={48} className="mx-auto mb-4 opacity-30" />
                            <p>Nenhuma avaliação encontrada.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>Nova Avaliação 360°</h3>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className={textSub}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Funcionário</label>
                                    <CustomDropdown
                                        value={selectedMemberId}
                                        onChange={v => setSelectedMemberId(v)}
                                        options={[
                                            { value: '', label: 'Selecione...' },
                                            ...(isAdminOrManager ? members : members.filter(m => m.id === currentUser.id)).map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
                                        ]}
                                        isDarkMode={isDarkMode}
                                        placeholder="Selecione..."
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Tipo de Avaliação</label>
                                    <CustomDropdown
                                        value={reviewDirection}
                                        onChange={v => setReviewDirection(v as ReviewDirection)}
                                        options={Object.entries(DIRECTION_CONFIG)
                                            .filter(([key]) => isAdminOrManager || key === 'self')
                                            .map(([key, config]) => ({ value: key, label: config.label }))}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Período</label>
                                    <CustomDropdown
                                        value={reviewType}
                                        onChange={v => setReviewType(v as 'monthly' | 'quarterly' | 'annual')}
                                        options={[
                                            { value: 'monthly', label: 'Mensal' },
                                            { value: 'quarterly', label: 'Trimestral' },
                                            { value: 'annual', label: 'Anual' },
                                        ]}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Mês/Ano</label>
                                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain}`} />
                                </div>
                            </div>

                            {/* Criteria */}
                            {criteria.length > 0 && (
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-3`}>Critérios de Avaliação</label>
                                    <div className="space-y-3">
                                        {criteria.map(c => (
                                            <div key={c.id} className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className={`text-sm font-medium ${textMain}`}>{c.name}</span>
                                                    <span className={`text-xs ${textSub}`}>Peso: {c.weight}x</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {([1, 2, 3, 4, 5] as const).map(score => (
                                                        <button key={score} type="button" onClick={() => handleScoreChange(c.id, score)}
                                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${c.score === score
                                                                ? `${SCORE_LABELS[score].color} text-white`
                                                                : `${isDarkMode ? 'bg-dark-surface' : 'bg-white'} border ${borderCol} ${textSub} hover:border-primary`
                                                                }`}>
                                                            {score}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Pontos Positivos</label>
                                    <textarea value={positives} onChange={e => setPositives(e.target.value)} rows={2}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} resize-none`}
                                        placeholder="O que o funcionário faz bem..." />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Pontos de Melhoria</label>
                                    <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} resize-none`}
                                        placeholder="O que pode ser melhorado..." />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Metas para Próximo Período</label>
                                    <textarea value={goals} onChange={e => setGoals(e.target.value)} rows={2}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} resize-none`}
                                        placeholder="Objetivos a atingir..." />
                                </div>
                            </div>

                            {/* Score Preview */}
                            {criteria.length > 0 && (
                                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} flex items-center justify-between`}>
                                    <span className={`font-semibold ${textMain}`}>Nota Final (Ponderada)</span>
                                    {getScoreBadge(calculateWeightedScore(criteria))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain}`}>
                                    Cancelar
                                </button>
                                <button type="submit" disabled={!selectedMemberId || criteria.length === 0}
                                    className={`flex-1 py-3 font-bold rounded-lg transition-colors ${selectedMemberId && criteria.length > 0 ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}>
                                    Salvar Avaliação
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
