import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, History, Calendar, User, CheckCircle, Circle, Clock, Search, Users } from 'lucide-react';
import { TeamMember, PersonalTask, CalendarEvent } from '../types';
import { CustomDropdown } from './CustomDropdown';

// Generic item type for the history modal
type HistoryItem = {
    id: string | number;
    text: string;
    completed?: boolean;
    date: string;
    startTime?: string;
    endTime?: string;
    assigneeId?: string;
    type?: string;
    scope?: string;
    status?: string;
    client?: string;
};

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: HistoryItem[];
    members: TeamMember[];
    isDarkMode: boolean;
    itemType: 'task' | 'event';
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    title,
    items,
    members,
    isDarkMode,
    itemType
}) => {
    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination — load 30 items at a time
    const PAGE_SIZE = 30;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (dateFrom && item.date < dateFrom) return false;
            if (dateTo && item.date > dateTo) return false;
            if (selectedMember !== 'all' && item.assigneeId !== selectedMember) return false;
            if (statusFilter === 'completed' && !item.completed) return false;
            if (statusFilter === 'pending' && item.completed) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchText = item.text.toLowerCase().includes(q);
                const matchClient = item.client?.toLowerCase().includes(q);
                const assignee = members.find(m => m.id === item.assigneeId);
                const matchAssignee = assignee?.name.toLowerCase().includes(q);
                if (!matchText && !matchClient && !matchAssignee) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [items, dateFrom, dateTo, selectedMember, statusFilter, searchQuery, members]);

    // Reset pagination when filters change
    React.useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [dateFrom, dateTo, selectedMember, statusFilter, searchQuery]);

    // Paginated slice
    const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
    const hasMore = visibleCount < filteredItems.length;

    // Stats
    const completedCount = filteredItems.filter(i => i.completed).length;
    const pendingCount = filteredItems.filter(i => !i.completed).length;

    // Group visible items by date (only paginated slice)
    const groupedItems = useMemo(() => {
        const groups: { date: string; label: string; items: typeof visibleItems }[] = [];
        const map = new Map<string, typeof visibleItems>();
        for (const item of visibleItems) {
            const key = item.date;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        for (const [date, dateItems] of map) {
            let label: string;
            if (date === today) label = 'Hoje';
            else if (date === yesterday) label = 'Ontem';
            else {
                const d = new Date(date + 'T12:00:00');
                label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
                label = label.charAt(0).toUpperCase() + label.slice(1);
            }
            groups.push({ date, label, items: dateItems });
        }
        return groups;
    }, [visibleItems]);

    // Status config
    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
        confirmed: { label: 'Confirmado', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        arrived: { label: 'Chegou', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        in_service: { label: 'Atendendo', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        completed: { label: 'Concluido', color: 'text-slate-400', bg: 'bg-slate-400/10' },
        no_show: { label: 'Faltou', color: 'text-red-500', bg: 'bg-red-500/10' },
        cancelled: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-400/10' },
        appointment: { label: 'Agendamento', color: 'text-primary', bg: 'bg-primary/10' },
        blocked: { label: 'Bloqueado', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    };

    const hasActiveFilters = dateFrom || dateTo || selectedMember !== 'all' || statusFilter !== 'all' || searchQuery;

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-background border border-border sm:rounded-lg shadow-lg w-full max-w-3xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-2 flex-shrink-0 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <History size={20} className="text-primary" />
                            {title}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {filteredItems.length} {itemType === 'task' ? 'tarefas' : 'registros'}
                        {hasActiveFilters && ' (filtrados)'}
                    </p>
                </div>

                {/* Filters — always visible, inline */}
                <div className="px-6 py-3 border-b border-border shrink-0">
                    {/* Search */}
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, cliente ou profissional..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    {/* Filter row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5 uppercase tracking-wider">De</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5 uppercase tracking-wider">Ate</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5 uppercase tracking-wider">Profissional</label>
                            <CustomDropdown
                                value={selectedMember}
                                onChange={setSelectedMember}
                                options={[
                                    { value: 'all', label: 'Todos', icon: <Users size={12} /> },
                                    ...members.map(m => ({ value: m.id, label: m.name, icon: <User size={12} /> }))
                                ]}
                                isDarkMode={isDarkMode}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5 uppercase tracking-wider">Status</label>
                            <CustomDropdown
                                value={statusFilter}
                                onChange={v => setStatusFilter(v as any)}
                                options={[
                                    { value: 'all', label: 'Todos' },
                                    { value: 'completed', label: 'Concluidos', dot: 'bg-emerald-500' },
                                    { value: 'pending', label: 'Pendentes', dot: 'bg-amber-500' }
                                ]}
                                isDarkMode={isDarkMode}
                            />
                        </div>
                    </div>
                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 mt-2.5">
                        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {completedCount} concluidos
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {pendingCount} pendentes
                        </span>
                        {hasActiveFilters && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); setSelectedMember('all'); setStatusFilter('all'); setSearchQuery(''); }}
                                className="text-[11px] font-medium text-primary hover:underline ml-auto"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Items List — grouped by date (timeline) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {visibleItems.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <History size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">Nenhum registro encontrado</p>
                            <p className="text-xs mt-1 opacity-60">Tente ajustar os filtros</p>
                        </div>
                    ) : (
                        <div className="px-5 py-3">
                            {groupedItems.map(group => (
                                <div key={group.date} className="mb-4 last:mb-0">
                                    {/* Date header */}
                                    <div className="flex items-center gap-2 mb-2 sticky top-0 z-10 py-1 bg-background">
                                        <Calendar size={12} className="text-primary" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-[10px] font-medium text-muted-foreground">{group.items.length}</span>
                                    </div>

                                    {/* Timeline items */}
                                    <div className="space-y-1.5">
                                        {group.items.map(item => {
                                            const assignee = members.find(m => m.id === item.assigneeId);
                                            const st = statusConfig[item.status || ''] || statusConfig[item.type || ''] || null;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl border transition-all border-border hover:border-primary/20 hover:bg-primary/5"
                                                >
                                                    {/* Status indicator */}
                                                    <div className="shrink-0">
                                                        {item.completed !== undefined ? (
                                                            item.completed
                                                                ? <CheckCircle size={16} className="text-emerald-500" />
                                                                : <Circle size={16} className="text-amber-500" />
                                                        ) : (
                                                            <div className={`w-4 h-4 rounded-full border-2 ${st ? st.color.replace('text-', 'border-') : 'border-slate-400'}`} />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-sm font-semibold truncate ${item.completed ? 'line-through opacity-50 text-muted-foreground' : 'text-foreground'}`}>
                                                                {item.text}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 mt-0.5">
                                                            {assignee && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                    <User size={9} />
                                                                    {assignee.name.split(' ')[0]}
                                                                </span>
                                                            )}
                                                            {item.client && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                    <User size={9} />
                                                                    {item.client}
                                                                </span>
                                                            )}
                                                            {item.startTime && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                    <Clock size={9} />
                                                                    {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Badges */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {st && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color} ${st.bg}`}>
                                                                {st.label}
                                                            </span>
                                                        )}
                                                        {item.scope && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.scope === 'day' ? 'text-primary bg-primary/10' : item.scope === 'week' ? 'text-blue-400 bg-blue-500/10' : 'text-violet-400 bg-violet-500/10'}`}>
                                                                {item.scope === 'day' ? 'Diaria' : item.scope === 'week' ? 'Semanal' : 'Mensal'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <div className="flex flex-col items-center gap-2 py-4">
                                    <p className="text-[11px] text-muted-foreground">
                                        Exibindo {visibleCount} de {filteredItems.length} registros
                                    </p>
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                                        className="px-5 py-2 text-xs font-semibold rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                    >
                                        Carregar mais {Math.min(PAGE_SIZE, filteredItems.length - visibleCount)} registros
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Helper function to convert PersonalTask to HistoryItem
export function taskToHistoryItem(task: PersonalTask): HistoryItem {
    return {
        id: task.id,
        text: task.text,
        completed: task.completed,
        date: task.createdAt.split('T')[0],
        assigneeId: task.assigneeId,
        scope: task.scope
    };
}

// Helper function to convert CalendarEvent to HistoryItem
export function eventToHistoryItem(event: CalendarEvent): HistoryItem {
    const dateStr = `${event.year}-${String(event.month + 1).padStart(2, '0')}-${String(event.date).padStart(2, '0')}`;
    return {
        id: event.id,
        text: event.title,
        completed: event.status === 'completed',
        date: dateStr,
        startTime: event.startTime,
        endTime: event.endTime,
        type: event.type,
        status: event.status || 'confirmed',
        assigneeId: event.barberId,
        client: event.client,
    };
}
