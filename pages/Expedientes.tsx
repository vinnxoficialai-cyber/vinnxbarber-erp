import React, { useState, useMemo, useEffect } from 'react';
import {
    Clock, Calendar, UserCog, Copy, X, Sun, Moon, Coffee,
    Check, AlertCircle, Users, Pencil, Save, RotateCcw
} from 'lucide-react';
import { WorkSchedule, TeamMember } from '../types';
import { useToast } from '../components/Toast';
import { getWorkSchedules, saveWorkSchedule, saveWorkSchedulesBulk } from '../lib/dataService';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';

interface ExpedientesProps {
    isDarkMode: boolean;
    currentUser: TeamMember;
}

const DAYS = [
    { key: 1, label: 'Seg', full: 'Segunda' },
    { key: 2, label: 'Ter', full: 'Terça' },
    { key: 3, label: 'Qua', full: 'Quarta' },
    { key: 4, label: 'Qui', full: 'Quinta' },
    { key: 5, label: 'Sex', full: 'Sexta' },
    { key: 6, label: 'Sáb', full: 'Sábado' },
    { key: 0, label: 'Dom', full: 'Domingo' },
];

const TEMPLATES = [
    { name: 'Integral', icon: Sun, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    { name: 'Meio Período', icon: Moon, startTime: '09:00', endTime: '13:00', breakStart: '', breakEnd: '' },
    { name: 'Noturno', icon: Moon, startTime: '14:00', endTime: '22:00', breakStart: '18:00', breakEnd: '19:00' },
];

export const Expedientes: React.FC<ExpedientesProps> = ({ isDarkMode, currentUser }) => {
    const { permissions: contextPermissions, members } = useAppData();
    const { canCreate } = usePermissions(currentUser, contextPermissions);
    const toast = useToast();

    // Theme tokens
    const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
    const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
    const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
    const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
    const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
    const shadowClass = isDarkMode ? '' : 'shadow-sm';

    // State
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editModal, setEditModal] = useState<{ memberId: string; dayOfWeek: number } | null>(null);
    const [editForm, setEditForm] = useState({ startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', isOff: false });

    // Barbers only
    const barbers = useMemo(() => members.filter(m => m.status === 'Active' && (m.role === 'Barber' || m.role === 'Admin' || m.role === 'Manager')), [members]);

    // Load data
    useEffect(() => {
        (async () => {
            setLoading(true);
            const data = await getWorkSchedules();
            setSchedules(data);
            setLoading(false);
        })();
    }, []);

    // Get schedule for member + day
    const getSchedule = (memberId: string, dayOfWeek: number) => {
        return schedules.find(s => s.memberId === memberId && s.dayOfWeek === dayOfWeek);
    };

    // Open edit modal
    const openEdit = (memberId: string, dayOfWeek: number) => {
        const existing = getSchedule(memberId, dayOfWeek);
        if (existing) {
            setEditForm({
                startTime: existing.startTime || '09:00',
                endTime: existing.endTime || '18:00',
                breakStart: existing.breakStart || '',
                breakEnd: existing.breakEnd || '',
                isOff: existing.isOff,
            });
        } else {
            setEditForm({ startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', isOff: false });
        }
        setEditModal({ memberId, dayOfWeek });
    };

    // Save single schedule
    const handleSave = async () => {
        if (!editModal) return;
        const existing = getSchedule(editModal.memberId, editModal.dayOfWeek);
        const schedule: WorkSchedule = {
            id: existing?.id || crypto.randomUUID(),
            memberId: editModal.memberId,
            dayOfWeek: editModal.dayOfWeek,
            startTime: editForm.isOff ? undefined : editForm.startTime,
            endTime: editForm.isOff ? undefined : editForm.endTime,
            breakStart: editForm.isOff ? undefined : editForm.breakStart || undefined,
            breakEnd: editForm.isOff ? undefined : editForm.breakEnd || undefined,
            isOff: editForm.isOff,
        };
        const result = await saveWorkSchedule(schedule);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        const updated = await getWorkSchedules();
        setSchedules(updated);
        toast.success('Horário salvo');
        setEditModal(null);
    };

    // Apply template to an entire row (all days for one member)
    const applyTemplate = async (memberId: string, template: typeof TEMPLATES[0]) => {
        const weekSchedules: WorkSchedule[] = DAYS.map(day => {
            const existing = getSchedule(memberId, day.key);
            const isSunday = day.key === 0;
            return {
                id: existing?.id || crypto.randomUUID(),
                memberId,
                dayOfWeek: day.key,
                startTime: isSunday ? undefined : template.startTime,
                endTime: isSunday ? undefined : template.endTime,
                breakStart: isSunday ? undefined : template.breakStart || undefined,
                breakEnd: isSunday ? undefined : template.breakEnd || undefined,
                isOff: isSunday,
                templateName: template.name,
            };
        });
        const result = await saveWorkSchedulesBulk(weekSchedules);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        const updated = await getWorkSchedules();
        setSchedules(updated);
        toast.success(`Modelo "${template.name}" aplicado`);
    };

    // Copy schedule from one member to another
    const copySchedule = async (fromId: string, toId: string) => {
        const source = schedules.filter(s => s.memberId === fromId);
        if (source.length === 0) { toast.error('Sem horários', 'O barbeiro selecionado não tem horários definidos.'); return; }
        const copies: WorkSchedule[] = source.map(s => {
            const existing = getSchedule(toId, s.dayOfWeek);
            return { ...s, id: existing?.id || crypto.randomUUID(), memberId: toId };
        });
        const result = await saveWorkSchedulesBulk(copies);
        if (!result.success) { toast.error('Erro', result.error || ''); return; }
        const updated = await getWorkSchedules();
        setSchedules(updated);
        toast.success('Horários copiados');
    };

    // KPIs
    const kpis = useMemo(() => {
        const barbersWithSchedule = new Set(schedules.map(s => s.memberId)).size;
        const totalSlots = schedules.filter(s => !s.isOff).length;
        const offSlots = schedules.filter(s => s.isOff).length;
        return { barbersWithSchedule, totalSlots, offSlots };
    }, [schedules]);

    const editMember = editModal ? barbers.find(b => b.id === editModal.memberId) : null;
    const editDay = editModal ? DAYS.find(d => d.key === editModal.dayOfWeek) : null;

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 relative pb-16 md:pb-0">

            {/* ===== EDIT MODAL ===== */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
                        <div className={`p-4 border-b ${borderCol} flex justify-between items-center ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
                            <div>
                                <h3 className={`font-semibold text-lg ${textMain}`}>Editar Turno</h3>
                                <p className={`text-xs ${textSub}`}>{editMember?.name} — {editDay?.full}</p>
                            </div>
                            <button onClick={() => setEditModal(null)} className={`${textSub} hover:${textMain}`}><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Quick templates */}
                            <div>
                                <label className={`block text-xs font-medium ${textSub} mb-2`}>Modelo Rápido</label>
                                <div className="flex gap-2">
                                    {TEMPLATES.map(t => (
                                        <button key={t.name} type="button"
                                            onClick={() => setEditForm({ startTime: t.startTime, endTime: t.endTime, breakStart: t.breakStart, breakEnd: t.breakEnd, isOff: false })}
                                            className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${isDarkMode ? 'border-dark-border text-slate-300 hover:border-primary hover:text-primary' : 'border-slate-300 text-slate-600 hover:border-primary hover:text-primary'}`}>
                                            <t.icon size={14} className="mx-auto mb-1" />
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="isOff" checked={editForm.isOff} onChange={e => setEditForm(p => ({ ...p, isOff: e.target.checked }))}
                                    className="accent-red-500 w-4 h-4" />
                                <label htmlFor="isOff" className={`text-sm font-medium ${editForm.isOff ? 'text-red-500' : textMain}`}>Folga / Dia Off</label>
                            </div>

                            {!editForm.isOff && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Clock size={12} /> Entrada</label>
                                            <input type="time" value={editForm.startTime} onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Clock size={12} /> Saída</label>
                                            <input type="time" value={editForm.endTime} onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Coffee size={12} /> Início Intervalo</label>
                                            <input type="time" value={editForm.breakStart} onChange={e => setEditForm(p => ({ ...p, breakStart: e.target.value }))}
                                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}><Coffee size={12} /> Fim Intervalo</label>
                                            <input type="time" value={editForm.breakEnd} onChange={e => setEditForm(p => ({ ...p, breakEnd: e.target.value }))}
                                                className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <button onClick={handleSave}
                                className="w-full py-3 font-bold rounded-lg bg-primary hover:bg-primary-600 text-white transition-colors shadow-lg shadow-primary/20">
                                <Save size={16} className="inline mr-2" />Salvar Turno
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== HEADER ===== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={`text-2xl font-bold ${textMain}`}>Expedientes</h1>
                    <p className={`${textSub} text-sm`}>Grade semanal de horários dos profissionais.</p>
                </div>
            </div>

            {/* ===== KPIs ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Com Escala', value: kpis.barbersWithSchedule.toString(), icon: Users, color: 'text-primary', bg: isDarkMode ? 'bg-primary/10' : 'bg-primary/5' },
                    { label: 'Turnos Ativos', value: kpis.totalSlots.toString(), icon: Clock, color: 'text-emerald-500', bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50' },
                    { label: 'Folgas', value: kpis.offSlots.toString(), icon: Sun, color: 'text-amber-500', bg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50' },
                ].map((kpi, i) => (
                    <div key={i} className={`${bgCard} border ${borderCol} rounded-xl p-4 ${shadowClass} flex items-center gap-3`}>
                        <div className={`p-2 rounded-lg ${kpi.bg}`}>
                            <kpi.icon size={20} className={kpi.color} />
                        </div>
                        <div>
                            <p className={`text-xs ${textSub}`}>{kpi.label}</p>
                            <p className={`text-lg font-bold ${textMain}`}>{kpi.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== SCHEDULE GRID ===== */}
            <div className={`${bgCard} border ${borderCol} ${shadowClass} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className={`${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} uppercase font-medium`}>
                            <tr>
                                <th className="px-4 py-3 sticky left-0 z-10 bg-inherit min-w-[180px]">Profissional</th>
                                {DAYS.map(day => (
                                    <th key={day.key} className="px-2 py-3 text-center min-w-[100px]">{day.label}</th>
                                ))}
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                            {barbers.length === 0 ? (
                                <tr><td colSpan={DAYS.length + 2} className={`px-6 py-12 text-center ${textSub}`}>
                                    <UserCog size={32} className="mx-auto mb-2 opacity-30" />Nenhum profissional ativo encontrado.
                                </td></tr>
                            ) : barbers.map(barber => (
                                <tr key={barber.id} className={`${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                                    <td className={`px-4 py-3 sticky left-0 z-10 ${isDarkMode ? 'bg-dark-surface' : 'bg-white'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary'}`}>
                                                {barber.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`font-medium text-sm ${textMain}`}>{barber.name.split(' ')[0]}</p>
                                                <p className={`text-[10px] ${textSub}`}>{barber.role === 'Barber' ? 'Barbeiro' : barber.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {DAYS.map(day => {
                                        const sched = getSchedule(barber.id, day.key);
                                        return (
                                            <td key={day.key} className="px-1 py-2 text-center">
                                                <button onClick={() => openEdit(barber.id, day.key)}
                                                    className={`w-full py-2 px-1 rounded-lg text-[11px] transition-all border ${sched
                                                        ? sched.isOff
                                                            ? `${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`
                                                            : `${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`
                                                        : `${isDarkMode ? 'border-dark-border text-slate-600 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-400'} border-dashed`
                                                        }`}>
                                                    {sched ? (
                                                        sched.isOff ? (
                                                            <span className="font-medium">Folga</span>
                                                        ) : (
                                                            <div>
                                                                <div className="font-semibold">{sched.startTime}</div>
                                                                <div className="opacity-70">{sched.endTime}</div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </button>
                                            </td>
                                        );
                                    })}
                                    <td className="px-2 py-2 text-center">
                                        <div className="flex flex-col gap-1">
                                            {TEMPLATES.slice(0, 2).map(t => (
                                                <button key={t.name} onClick={() => applyTemplate(barber.id, t)}
                                                    title={`Aplicar modelo ${t.name}`}
                                                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${isDarkMode ? 'border-dark-border text-slate-400 hover:border-primary hover:text-primary' : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary'}`}>
                                                    <t.icon size={10} className="inline mr-0.5" />{t.name.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className={`flex flex-wrap gap-4 mt-4 text-xs ${textSub}`}>
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${isDarkMode ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`} />
                    Turno definido
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${isDarkMode ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`} />
                    Folga
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded border border-dashed ${isDarkMode ? 'border-slate-600' : 'border-slate-300'}`} />
                    Não definido
                </div>
            </div>
        </div>
    );
};
