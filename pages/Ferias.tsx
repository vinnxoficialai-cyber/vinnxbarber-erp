import React, { useState } from 'react'; // removed useEffect
import { Sun, Plus, X, Calendar, User, Check, XCircle, Clock, Briefcase } from 'lucide-react';
import { TeamMember, VacationPeriod } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { useAppData } from '../hooks/useAppData'; // MIGRATED
import { usePermissions } from '../hooks/usePermissions';
import { validators } from '../utils';
import { useToast } from '../components/Toast';
import { saveVacation } from '../lib/dataService';

interface FeriasProps {
    members: TeamMember[];
    currentUser: TeamMember;
    isDarkMode: boolean;
}

const STATUS_CONFIG: Record<VacationPeriod['status'], { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendente', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    approved: { label: 'Aprovado', color: 'text-green-500', bg: 'bg-green-500/10' },
    rejected: { label: 'Rejeitado', color: 'text-red-500', bg: 'bg-red-500/10' },
    in_progress: { label: 'Em andamento', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    completed: { label: 'Concluído', color: 'text-slate-500', bg: 'bg-slate-500/10' },
};

export const Ferias: React.FC<FeriasProps> = ({ members, currentUser, isDarkMode }) => {
    // Use useAppData
    const { vacations, permissions: contextPermissions, refresh } = useAppData();
    const { canCreate, getActionLevel, isAdmin } = usePermissions(currentUser, contextPermissions);

    // Permissions
    const canCreateVacation = canCreate('/ferias');
    const actionLevel = getActionLevel('/ferias');
    const isManagerial = actionLevel === 'full';
    const viewAllData = isManagerial; // Simple mapping for now

    // Guard: prevent crash if currentUser is not loaded yet
    const userId = currentUser?.id || '';
    const userRole = currentUser?.role || '';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [vacationType, setVacationType] = useState<'vacation' | 'pecuniary'>('vacation');
    const [notes, setNotes] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const toast = useToast();

    // REMOVED: useEffect for safeStorage

    const calculateVacationBalance = (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return { entitled: 0, used: 0, balance: 0 };

        const joinDate = new Date(member.joinDate);
        const now = new Date();
        const monthsWorked = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

        // 30 days per year = 2.5 days per month
        const entitled = Math.min(30, Math.floor(monthsWorked * 2.5));

        const used = vacations
            .filter(v => v.employeeId === memberId && (v.status === 'approved' || v.status === 'completed' || v.status === 'in_progress'))
            .reduce((sum, v) => sum + calculateDaysBetween(v.startDate, v.endDate), 0);

        return { entitled, used, balance: entitled - used };
    };

    // Filtered Data
    const visibleMembers = React.useMemo(() => {
        if (viewAllData) return members;
        return members.filter(m => m.id === currentUser.id);
    }, [members, viewAllData, currentUser.id]);

    const visibleVacations = React.useMemo(() => {
        if (viewAllData) return vacations;
        return vacations.filter(v => v.employeeId === currentUser.id);
    }, [vacations, viewAllData, currentUser.id]);

    const calculateDaysBetween = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };

    const handleScheduleVacation = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validações
        const dateError = validators.dateRange(startDate, endDate);
        if (dateError) {
            setFormError(dateError);
            return;
        }

        const futureDateError = validators.futureDate(startDate, 'Data de início');
        if (futureDateError) {
            setFormError(futureDateError);
            return;
        }

        if (!selectedEmployeeId) {
            setFormError('Selecione um funcionário');
            return;
        }

        const selectedMember = members.find(m => m.id === selectedEmployeeId);
        if (!selectedMember?.teamMemberId) {
            toast.error('Erro', 'Este funcionário não possui registro de equipe válido. Verifique o cadastro.');
            return;
        }
        const newVacation: VacationPeriod & { teamMemberId?: string } = {
            id: crypto.randomUUID(),
            employeeId: selectedEmployeeId,
            teamMemberId: selectedMember.teamMemberId, // FK to team_members table — validated above
            startDate,
            endDate,
            type: vacationType,
            status: 'pending',
            notes,
            createdAt: new Date().toISOString(),
        };

        // Persistir no Supabase
        const result = await saveVacation(newVacation);
        if (!result.success) {
            toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();

        setIsModalOpen(false);
        resetForm();
        setFormError(null);
        toast.success('Férias solicitadas');
    };

    const handleApproveVacation = async (vacationId: string) => {
        const vacation = vacations.find(v => v.id === vacationId);
        if (!vacation) return;

        const updatedVacation = {
            ...vacation,
            status: 'approved' as const,
            approvedBy: userId,
            approvedAt: new Date().toISOString()
        };

        // Persistir no Supabase
        await saveVacation(updatedVacation);

        await refresh();
        toast.success('Férias aprovadas');
    };

    const handleRejectVacation = async (vacationId: string) => {
        const vacation = vacations.find(v => v.id === vacationId);
        if (!vacation) return;

        const updatedVacation = { ...vacation, status: 'rejected' as const };

        // Persistir no Supabase
        await saveVacation(updatedVacation);

        await refresh();
        toast.info('Férias rejeitadas');
    };

    const resetForm = () => {
        setSelectedEmployeeId('');
        setStartDate('');
        setEndDate('');
        setNotes('');
    };



    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Sun className="text-primary" /> Gestão de Férias
                    </h1>
                    <p className={`${textSub} text-sm`}>Controle de férias e ausências da equipe.</p>
                </div>

                {canCreateVacation && (
                    <button
                        onClick={() => {
                            setIsModalOpen(true);
                            if (!viewAllData) setSelectedEmployeeId(currentUser.id);
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={16} /> Agendar Férias
                    </button>
                )}
            </div>

            {/* Members with Balance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {visibleMembers.map(member => {
                    const balance = calculateVacationBalance(member.id);
                    return (
                        <div key={member.id} className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                    <User size={18} className={textSub} />
                                </div>
                                <div>
                                    <p className={`font-semibold ${textMain}`}>{member.name}</p>
                                    <p className={`text-xs ${textSub}`}>{member.role}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-lg font-bold text-primary`}>{balance.entitled}</p>
                                    <p className={`text-xs ${textSub}`}>Direito</p>
                                </div>
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-lg font-bold text-orange-500`}>{balance.used}</p>
                                    <p className={`text-xs ${textSub}`}>Usados</p>
                                </div>
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                                    <p className={`text-lg font-bold ${balance.balance > 0 ? 'text-green-500' : 'text-red-500'}`}>{balance.balance}</p>
                                    <p className={`text-xs ${textSub}`}>Saldo</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Admin: Pending Requests Section */}
            {isManagerial && (() => {
                const pendingVacations = vacations.filter(v => v.status === 'pending');
                if (pendingVacations.length === 0) return null;
                return (
                    <div className={`${bgCard} border-2 border-yellow-500/30 rounded-xl overflow-hidden mb-6`}>
                        <div className={`p-4 border-b border-yellow-500/20 ${isDarkMode ? 'bg-yellow-500/5' : 'bg-yellow-50'} flex items-center justify-between`}>
                            <h3 className={`font-semibold ${textMain} flex items-center gap-2`}>
                                <Clock size={18} className="text-yellow-500" />
                                Solicitações Pendentes
                            </h3>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500">
                                {pendingVacations.length} pendente{pendingVacations.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-dark-border">
                            {pendingVacations.map(vacation => {
                                const member = members.find(m => m.id === vacation.employeeId);
                                const days = calculateDaysBetween(vacation.startDate, vacation.endDate);
                                return (
                                    <div key={vacation.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:${isDarkMode ? 'bg-dark/50' : 'bg-yellow-50/50'} transition-colors`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center`}>
                                                <User size={16} className="text-yellow-500" />
                                            </div>
                                            <div>
                                                <p className={`font-semibold ${textMain}`}>{member?.name || 'Funcionário'}</p>
                                                <div className={`flex items-center gap-2 text-sm ${textSub}`}>
                                                    <Calendar size={12} />
                                                    {new Date(vacation.startDate).toLocaleDateString('pt-BR')} - {new Date(vacation.endDate).toLocaleDateString('pt-BR')}
                                                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-500">{days} dias</span>
                                                </div>
                                                {vacation.notes && <p className={`text-xs ${textSub} mt-1`}>📝 {vacation.notes}</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleApproveVacation(vacation.id)} className="px-4 py-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors text-sm font-medium flex items-center gap-1">
                                                <Check size={14} /> Aprovar
                                            </button>
                                            <button onClick={() => handleRejectVacation(vacation.id)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium flex items-center gap-1">
                                                <XCircle size={14} /> Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Vacation Requests */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <h3 className={`font-semibold ${textMain}`}>Solicitações de Férias</h3>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-dark-border">
                    {visibleVacations.map(vacation => {
                        const member = members.find(m => m.id === vacation.employeeId);
                        const days = calculateDaysBetween(vacation.startDate, vacation.endDate);
                        const config = STATUS_CONFIG[vacation.status];

                        return (
                            <div key={vacation.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'} transition-colors`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-dark' : 'bg-slate-100'} flex items-center justify-center`}>
                                        <User size={16} className={textSub} />
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${textMain}`}>{member?.name || 'Funcionário'}</p>
                                        <div className={`flex items-center gap-2 text-sm ${textSub}`}>
                                            <Calendar size={12} />
                                            {new Date(vacation.startDate).toLocaleDateString('pt-BR')} - {new Date(vacation.endDate).toLocaleDateString('pt-BR')}
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${config.bg} ${config.color}`}>
                                                {days} dias
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                                        {config.label}
                                    </span>

                                    {vacation.status === 'pending' && isManagerial && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveVacation(vacation.id)}
                                                className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                                                title="Aprovar"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleRejectVacation(vacation.id)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                                title="Rejeitar"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {vacations.length === 0 && (
                        <div className={`p-8 text-center ${textSub}`}>
                            <Calendar size={48} className="mx-auto mb-4 opacity-30" />
                            <p>Nenhuma solicitação de férias.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>Agendar Férias</h3>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className={`${textSub} hover:${textMain}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleScheduleVacation} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                                    {formError}
                                </div>
                            )}
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Funcionário</label>
                                <CustomDropdown
                                    value={selectedEmployeeId}
                                    onChange={v => setSelectedEmployeeId(v)}
                                    options={[
                                        { value: '', label: 'Selecione...' },
                                        ...members.map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
                                    ]}
                                    isDarkMode={isDarkMode}
                                    placeholder="Selecione..."
                                    disabled={!viewAllData}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Data Início</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Data Fim</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Tipo</label>
                                <CustomDropdown
                                    value={vacationType}
                                    onChange={v => setVacationType(v as any)}
                                    options={[
                                        { value: 'vacation', label: 'Férias' },
                                        { value: 'pecuniary', label: 'Abono Pecuniário' },
                                    ]}
                                    isDarkMode={isDarkMode}
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    rows={2}
                                />
                            </div>

                            {selectedEmployeeId && startDate && endDate && (
                                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-dark' : 'bg-slate-50'} flex items-center justify-between`}>
                                    <span className={textSub}>Total de dias:</span>
                                    <span className={`font-bold ${textMain}`}>{calculateDaysBetween(startDate, endDate)} dias</span>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain} hover:bg-opacity-10 transition-colors`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 font-bold rounded-lg bg-primary hover:bg-primary-600 text-white transition-colors"
                                >
                                    Solicitar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
