import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Play, Square, Plus, X, Calendar, User, TrendingUp, TrendingDown, Timer } from 'lucide-react';
import { TeamMember, TimeEntry, HRSettings } from '../types';
import { useAppData } from '../hooks/useAppData'; // MIGRATED
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../components/Toast';
import { CustomDropdown } from '../components/CustomDropdown';
import { saveTimeEntry } from '../lib/dataService';

interface BancoHorasProps {
    members: TeamMember[];
    currentUser: TeamMember;
    isDarkMode: boolean;
}

const DEFAULT_HR_SETTINGS: HRSettings = {
    workdayHours: 8,
    weeklyHours: 44,
    lunchBreakMinutes: 60,
    timeBank: {
        enabled: true,
        maxAccumulatedHours: 40,
        compensationPeriod: 'semester',
        toleranceMinutes: 10,
        overtimeAction: 'compensate',
    },
    vacation: {
        monthlyAccrual: 2.5,
        maxDays: 30,
        minAdvanceRequestDays: 30,
        allowSplit: true,
        maxSplitParts: 3,
        allowSellDays: true,
        maxSellDays: 10,
    },
    holidays: [],
    positions: [],
    departments: [],
};

export const BancoHoras: React.FC<BancoHorasProps> = ({ members, currentUser, isDarkMode }) => {
    // Use useAppData
    const { timeEntries: entries, settings, permissions: contextPermissions, refresh, loading } = useAppData();
    const { canCreate } = usePermissions(currentUser, contextPermissions);
    const canCreateEntry = canCreate('/banco-horas');

    // Guard: prevent crash if currentUser is not loaded yet or data is loading
    if (!currentUser || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const userId = currentUser.id;

    // Derive hrSettings from settings (settings contains hr settings)
    const hrSettings = settings?.hr || DEFAULT_HR_SETTINGS;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualClockIn, setManualClockIn] = useState('09:00');
    const [manualClockOut, setManualClockOut] = useState('18:00');
    const [manualNotes, setManualNotes] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(userId);

    // Constants derived from settings (with complete fallbacks)
    const WORKDAY_MINUTES = (hrSettings?.workdayHours || 8) * 60;
    const TOLERANCE_MINUTES = hrSettings?.timeBank?.toleranceMinutes || 10;

    // Theme helpers
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-200';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const toast = useToast();

    // Form validation for manual entry
    const isFormValid = useMemo(() => {
        return manualDate !== '' && manualClockIn !== '' && manualClockOut !== '';
    }, [manualDate, manualClockIn, manualClockOut]);

    // REMOVED: useEffect for safeStorage

    useEffect(() => {
        // Check for active entry (has clockIn but no clockOut)
        const today = new Date().toISOString().split('T')[0];
        const active = entries.find(e => e.employeeId === userId && e.date === today && e.clockIn && !e.clockOut);
        setActiveEntry(active || null);
    }, [entries, userId]);

    const formatMinutesToHours = (minutes: number) => {
        const sign = minutes < 0 ? '-' : '+';
        const abs = Math.abs(minutes);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${sign}${h}h ${m.toString().padStart(2, '0')}m`;
    };

    const getTimeMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const calculateDayBalance = (totalMinutes: number) => {
        const diff = totalMinutes - WORKDAY_MINUTES;
        // Apply tolerance
        if (Math.abs(diff) <= TOLERANCE_MINUTES) return 0;
        return diff;
    };

    const calculateBalance = (employeeId: string) => {
        const employeeEntries = entries.filter(e => e.employeeId === employeeId && e.totalMinutes);
        return employeeEntries.reduce((sum, e) => sum + calculateDayBalance(e.totalMinutes || 0), 0);
    };

    const getMonthlyHours = (employeeId: string) => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return entries
            .filter(e => e.employeeId === employeeId && e.date.startsWith(currentMonth) && e.totalMinutes)
            .reduce((sum, e) => sum + (e.totalMinutes || 0), 0);
    };

    const handleClockIn = async () => {
        const now = new Date();
        const newEntry: TimeEntry & { teamMemberId?: string } = {
            id: crypto.randomUUID(),
            employeeId: userId,
            teamMemberId: currentUser.teamMemberId, // FK to team_members table
            date: now.toISOString().split('T')[0],
            clockIn: now.toTimeString().slice(0, 5),
            type: 'regular',
            createdAt: now.toISOString(),
        };

        // Persistir no Supabase
        const result = await saveTimeEntry(newEntry);
        if (!result.success) {
            toast.error('Erro ao registrar entrada', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();
        toast.success('Ponto registrado');
    };

    const handleClockOut = async () => {
        if (!activeEntry) return;
        const now = new Date();
        const clockOut = now.toTimeString().slice(0, 5);
        const totalMinutes = getTimeMinutes(clockOut) - getTimeMinutes(activeEntry.clockIn!);

        const updatedEntry: TimeEntry = {
            ...activeEntry,
            clockOut,
            totalMinutes,
            updatedAt: new Date().toISOString() // Ensure update timestamp
        };

        // Persistir no Supabase
        const result = await saveTimeEntry(updatedEntry);
        if (!result.success) {
            toast.error('Erro ao registrar saída', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();
        toast.success('Saída registrada');
    };

    const handleManualEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const totalMinutes = getTimeMinutes(manualClockOut) - getTimeMinutes(manualClockIn);

        const selectedMember = members.find(m => m.id === selectedEmployeeId);
        const newEntry: TimeEntry & { teamMemberId?: string } = {
            id: crypto.randomUUID(),
            employeeId: selectedEmployeeId,
            teamMemberId: selectedMember?.teamMemberId, // FK to team_members table
            date: manualDate,
            clockIn: manualClockIn,
            clockOut: manualClockOut,
            totalMinutes,
            type: 'regular',
            notes: manualNotes,
            createdAt: new Date().toISOString(),
        };

        // Persistir no Supabase
        const result = await saveTimeEntry(newEntry);
        if (!result.success) {
            toast.error('Erro ao salvar registro', result.error || 'Erro desconhecido');
            return;
        }

        await refresh();

        setIsModalOpen(false);
        setManualNotes('');
        toast.success('Registro adicionado');
    };

    const balance = calculateBalance(userId);
    const monthlyHours = getMonthlyHours(userId);

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
                        <Clock className="text-primary" /> Banco de Horas
                    </h1>
                    <p className={`${textSub} text-sm`}>Controle de ponto e horas trabalhadas.</p>
                </div>

                {canCreateEntry && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
                    >
                        <Plus size={16} /> Entrada Manual
                    </button>
                )}
            </div>

            {/* Clock In/Out Card */}
            <div className={`${bgCard} border ${borderCol} rounded-xl p-6 mb-6`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <p className={`${textSub} text-sm mb-1`}>Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <p className={`text-4xl font-bold ${textMain}`}>
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {activeEntry && (
                            <p className={`text-sm ${textSub} mt-2`}>
                                Entrada às {activeEntry.clockIn}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-4">
                        {!activeEntry ? (
                            <button
                                onClick={handleClockIn}
                                className="px-8 py-4 bg-primary hover:bg-primary-600 text-white font-bold rounded-xl flex items-center gap-3 transition-all shadow-lg shadow-primary/30 hover:scale-105"
                            >
                                <Play size={24} fill="currentColor" /> Registrar Entrada
                            </button>
                        ) : (
                            <button
                                onClick={handleClockOut}
                                className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center gap-3 transition-all shadow-lg shadow-red-500/30 hover:scale-105"
                            >
                                <Square size={24} fill="currentColor" /> Registrar Saída
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${balance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {balance >= 0 ? <TrendingUp size={20} className="text-green-500" /> : <TrendingDown size={20} className="text-red-500" />}
                        </div>
                        <span className={`text-sm ${textSub}`}>Saldo Atual</span>
                    </div>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatMinutesToHours(balance)}
                    </p>
                </div>

                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Timer size={20} className="text-primary" />
                        </div>
                        <span className={`text-sm ${textSub}`}>Horas no Mês</span>
                    </div>
                    <p className={`text-2xl font-bold ${textMain}`}>
                        {formatMinutesToHours(monthlyHours)}
                    </p>
                </div>

                <div className={`${bgCard} border ${borderCol} rounded-xl p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Calendar size={20} className="text-blue-500" />
                        </div>
                        <span className={`text-sm ${textSub}`}>Média Diária</span>
                    </div>
                    <p className={`text-2xl font-bold ${textMain}`}>
                        {entries.filter(e => e.employeeId === userId && e.totalMinutes).length > 0
                            ? formatMinutesToHours(Math.round(monthlyHours / Math.max(1, entries.filter(e => e.employeeId === userId && e.totalMinutes && e.date.startsWith(new Date().toISOString().slice(0, 7))).length)))
                            : '0h 0m'}
                    </p>
                </div>
            </div>

            {/* History Table */}
            <div className={`${bgCard} border ${borderCol} rounded-xl overflow-hidden`}>
                <div className={`p-4 border-b ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                    <h3 className={`font-semibold ${textMain}`}>Histórico de Registros</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={`border-b ${borderCol} text-xs font-bold uppercase ${textSub}`}>
                                <th className="text-left p-4">Data</th>
                                <th className="text-left p-4">Entrada</th>
                                <th className="text-left p-4">Saída</th>
                                <th className="text-left p-4">Total</th>
                                <th className="text-left p-4">Observações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries
                                .filter(e => e.employeeId === userId)
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .slice(0, 20)
                                .map(entry => (
                                    <tr key={entry.id} className={`border-b ${borderCol} last:border-b-0 hover:${isDarkMode ? 'bg-dark/50' : 'bg-slate-50'}`}>
                                        <td className={`p-4 ${textMain}`}>
                                            {new Date(entry.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                        </td>
                                        <td className={`p-4 ${textMain}`}>{entry.clockIn || '-'}</td>
                                        <td className={`p-4 ${textMain}`}>{entry.clockOut || <span className="text-yellow-500">Em andamento</span>}</td>
                                        <td className={`p-4 font-semibold ${textMain}`}>
                                            {entry.totalMinutes ? formatMinutesToHours(entry.totalMinutes) : '-'}
                                        </td>
                                        <td className={`p-4 ${textSub}`}>{entry.notes || '-'}</td>
                                    </tr>
                                ))}
                            {entries.filter(e => e.employeeId === userId).length === 0 && (
                                <tr>
                                    <td colSpan={5} className={`p-8 text-center ${textSub}`}>
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <h3 className={`font-semibold text-lg ${textMain}`}>Entrada Manual</h3>
                            <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain}`}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleManualEntry} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Funcionário</label>
                                <CustomDropdown
                                    value={selectedEmployeeId}
                                    onChange={v => setSelectedEmployeeId(v)}
                                    options={members.map(m => ({ value: m.id, label: m.name }))}
                                    isDarkMode={isDarkMode}
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Data</label>
                                <input
                                    type="date"
                                    value={manualDate}
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Entrada</label>
                                    <input
                                        type="time"
                                        value={manualClockIn}
                                        onChange={(e) => setManualClockIn(e.target.value)}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Saída</label>
                                    <input
                                        type="time"
                                        value={manualClockOut}
                                        onChange={(e) => setManualClockOut(e.target.value)}
                                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-1`}>Observações</label>
                                <textarea
                                    value={manualNotes}
                                    onChange={(e) => setManualNotes(e.target.value)}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    rows={2}
                                    placeholder="Motivo do ajuste..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className={`flex-1 py-3 font-bold rounded-lg border ${borderCol} ${textMain} hover:bg-opacity-10 transition-colors`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isFormValid}
                                    className={`flex-1 py-3 font-bold rounded-lg transition-colors ${isFormValid ? 'bg-primary hover:bg-primary-600 text-white' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
