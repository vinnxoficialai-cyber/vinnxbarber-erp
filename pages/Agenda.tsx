import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, X, Lock,
  User, Trash2, History, Scissors, GripVertical, AlertCircle,
  ChevronDown, Users, Settings2, Loader2, CheckCircle2, DollarSign, TrendingUp,
  Repeat, Mail, Phone, Gift, UserPlus, Search, Filter, PanelLeftClose, PanelLeft,
  Bell, Palette, Eye, MessageCircle, Zap, Globe, Shield, LayoutGrid, Timer
} from 'lucide-react';
import { CalendarEvent, EventType, TeamMember, Service, WorkSchedule, AgendaSettings, Client } from '../types';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { saveCalendarEvent, deleteCalendarEvent, getWorkSchedules, saveAppSettings, saveClient, createComandaFromAppointment, saveComanda } from '../lib/dataService';
import { useAppData } from '../context/AppDataContext';
import { useFilteredData } from '../hooks/useFilteredData';
import { useSelectedUnit } from '../context/UnitContext';
import { usePermissions } from '../hooks/usePermissions';
import { HistoryModal, eventToHistoryItem } from '../components/HistoryModal';
import { CustomDropdown, CustomDropdown as AgendaDropdown } from '../components/CustomDropdown';
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// ── Types ──────────────────────────────────────────────────────
type ViewMode = 'day' | 'week' | 'month';

interface AgendaProps {
  isDarkMode: boolean;
  currentUser: TeamMember | null;
}

// ── Constants ──────────────────────────────────────────────────
const SLOT_INTERVAL = 30; // minutes per slot (enterprise: 30min for barbershop)

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

// Build time options for selects (parametrized by start/end hours)
const buildTimeOptions = (startHour: number, endHour: number): string[] => {
  const opts: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
};

// Build hour labels (parametrized by start/end hours)
const buildHourLabels = (startHour: number, endHour: number): string[] => {
  const labels: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
  return labels;
};

// ── Helpers ────────────────────────────────────────────────────
const getMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

const addMinutes = (time: string, mins: number): string => {
  const total = getMinutes(time) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatNavDate = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');

const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

// ── Droppable Slot ─────────────────────────────────────────────
const DroppableSlot: React.FC<{
  id: string;
  time: string;
  isDarkMode: boolean;
  onClick: () => void;
  startHour: number;
  slotHeight: number;
  hourHeight: number;
}> = ({ id, time, isDarkMode, onClick, startHour, slotHeight, hourHeight }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const dayStartMin = startHour * 60;
  const topPx = ((getMinutes(time) - dayStartMin) / 60) * hourHeight;

  return (
    <div
      ref={setNodeRef}
      className="absolute left-0 right-0 group/slot cursor-pointer"
      style={{ top: `${topPx}px`, height: `${slotHeight}px`, zIndex: 1 }}
      onClick={onClick}
    >
      <div className={`absolute inset-0 flex items-center justify-center transition-colors rounded-sm
        ${isOver
          ? (isDarkMode ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-primary/10 ring-1 ring-primary/30')
          : 'opacity-0 group-hover/slot:opacity-100 bg-primary/5'
        }`}
      >
        {isOver ? (
          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{time}</span>
        ) : (
          <Plus size={10} className="text-primary opacity-60" />
        )}
      </div>
    </div>
  );
};

// AgendaDropdown is now imported from '../components/CustomDropdown'

// ── Draggable Card ─────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'arrived', label: 'Chegou', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
  { value: 'in_service', label: 'Em Atendimento', color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
  { value: 'completed', label: 'Concluido', color: 'bg-slate-400', textColor: 'text-slate-600 dark:text-slate-400' },
  { value: 'no_show', label: 'Nao Compareceu', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-slate-300', textColor: 'text-slate-500 dark:text-slate-500' },
] as const;

const DraggableCard: React.FC<{
  event: CalendarEvent;
  isDarkMode: boolean;
  slotStartMin: number;
  onClick: () => void;
  onStatusChange?: (eventId: string, newStatus: string) => void;
  slotHeight: number;
  hourHeight: number;
}> = ({ event, isDarkMode, slotStartMin, onClick, onStatusChange, slotHeight, hourHeight }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const isBlocked = event.type === 'blocked';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: isBlocked,
  });

  const startMin = getMinutes(event.startTime);
  const endMin = getMinutes(event.endTime);
  const duration = endMin - startMin;
  const dayStartMin = slotStartMin;
  const topPx = ((startMin - dayStartMin) / 60) * hourHeight;
  const heightPx = Math.max((duration / 60) * hourHeight, slotHeight);

  const isAppointment = event.type === 'appointment';

  // Status indicator colors
  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-500',
    arrived: 'bg-amber-500',
    in_service: 'bg-blue-500',
    completed: 'bg-slate-400',
    no_show: 'bg-red-500',
    cancelled: 'bg-slate-300',
  };
  const statusDot = statusColors[event.status || 'confirmed'] || 'bg-emerald-500';
  const currentStatusLabel = STATUS_OPTIONS.find(s => s.value === (event.status || 'confirmed'))?.label || 'Confirmado';

  // Accent border color (enterprise left-border style)
  const accentBorder = isBlocked
    ? 'border-l-slate-500'
    : isAppointment
      ? 'border-l-primary'
      : 'border-l-blue-500';

  const bgClass = isBlocked
    ? (isDarkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-100 border-slate-200')
    : isAppointment
      ? (isDarkMode ? 'bg-primary/10 border-primary/20' : 'bg-primary/5 border-primary/15')
      : (isDarkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-500/5 border-blue-500/15');

  const textClass = isBlocked
    ? (isDarkMode ? 'text-slate-500' : 'text-slate-400')
    : isAppointment
      ? 'text-primary'
      : 'text-blue-600 dark:text-blue-400';

  // Enterprise card border color
  const cardBorder = isBlocked
    ? (isDarkMode ? 'border-slate-600/50' : 'border-slate-300')
    : isAppointment
      ? (isDarkMode ? 'border-primary/50' : 'border-primary/40')
      : (isDarkMode ? 'border-blue-500/50' : 'border-blue-500/40');

  const cardBg = isBlocked
    ? (isDarkMode ? 'bg-dark-surface' : 'bg-slate-50')
    : (isDarkMode ? 'bg-dark-surface' : 'bg-white');

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: '4px',
    right: '4px',
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.25 : 1,
    cursor: isBlocked ? 'default' : 'grab',
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'box-shadow 0.15s ease, border-color 0.15s ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isBlocked ? {} : listeners)}
      {...(isBlocked ? {} : attributes)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`
        rounded-xl border ${cardBorder} ${cardBg} px-3 py-2 overflow-hidden select-none
        hover:shadow-xl hover:z-20 transition-all
        ${isBlocked ? 'border-dashed' : ''}
      `}
    >
      {/* Top row: Grip + Title + Status badge */}
      <div className="flex items-center gap-2 leading-tight">
        {!isBlocked && (
          <GripVertical size={12} className={isDarkMode ? 'text-slate-600 shrink-0' : 'text-slate-300 shrink-0'} />
        )}
        {isBlocked && <Lock size={12} className={`shrink-0 ${textClass}`} />}
        <span className={`text-[12px] font-bold truncate flex-1 ${textClass}`}>{event.title}</span>

        {/* Status badge (clickable) */}
        {!isBlocked && (
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(prev => !prev); }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border
                ${isDarkMode ? 'border-dark-border bg-black/25 hover:border-primary/40' : 'border-slate-200 bg-slate-50 hover:border-primary/30'}`}
              title={currentStatusLabel}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{currentStatusLabel}</span>
            </button>
            {showStatusMenu && onStatusChange && (
              <div
                className={`absolute top-6 right-0 z-[60] w-40 rounded-xl border shadow-2xl py-1 ${isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-slate-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(event.id, opt.value);
                      setShowStatusMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${isDarkMode ? 'hover:bg-dark' : 'hover:bg-slate-50'} ${event.status === opt.value ? 'font-bold' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{opt.label}</span>
                    {event.status === opt.value && <CheckCircle2 size={10} className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Time + Service row */}
      <div className={`flex items-center gap-2 mt-1 text-[11px] font-semibold ${textClass} ${isDarkMode ? 'opacity-60' : 'opacity-55'}`}>
        <span>{event.startTime} - {event.endTime}</span>
        {event.serviceName && event.serviceName !== event.title && (
          <>
            <span className="opacity-40">•</span>
            <span className="truncate flex items-center gap-1"><Scissors size={9} />{event.serviceName}</span>
          </>
        )}
        {event.source && event.source !== 'manual' && (
          <span className={`ml-auto px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
            {event.source === 'app' ? 'App' : 'Web'}
          </span>
        )}
      </div>

      {/* Client row */}
      {!isBlocked && event.client && (
        <div className={`text-[11px] flex items-center gap-1.5 mt-1 font-medium ${textClass} ${isDarkMode ? 'opacity-55' : 'opacity-50'}`}>
          <User size={10} className="shrink-0" /> <span className="truncate">{event.client}</span>
        </div>
      )}

      {/* Observation (only for >=60min slots) */}
      {duration >= 60 && event.observation && (
        <div className={`text-[10px] italic mt-1 truncate ${textClass} ${isDarkMode ? 'opacity-35' : 'opacity-30'}`}>
          {event.observation}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ██  AGENDA COMPONENT  ██
// ══════════════════════════════════════════════════════════════
export const Agenda: React.FC<AgendaProps> = ({ isDarkMode, currentUser }) => {
  const {
    setCalendarEvents, refresh,
    permissions: contextPermissions, setComandas
  } = useAppData();
  const {
    filteredCalendarEvents: events, filteredClients: contextClients,
    filteredMembers: members, filteredServices: services,
    filteredComandas: comandas, selectedUnitId
  } = useFilteredData();
  const [inlineClients, setInlineClients] = useState<Client[]>([]);
  const clients = useMemo(() => [...contextClients, ...inlineClients], [contextClients, inlineClients]);
  const { isAdminOrManager } = usePermissions(currentUser, contextPermissions);
  const isAdmin = isAdminOrManager;

  // ── State ──────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [barberFilter, setBarberFilter] = useState<string>('all');
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarCalDate, setSidebarCalDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Agenda Settings (from appSettings or defaults) ────────
  const { settings: systemSettings } = useAppData();
  const defaultAgendaSettings: AgendaSettings = {
    startHour: 7, endHour: 21, slotInterval: 30, bufferMinutes: 0,
    allowOverbooking: false, autoAssignBarber: false,
    requireService: true, requireClient: false,
    showBreakTime: true, showOffDays: true, weekStartsOnMonday: false,
    defaultDuration: 30, reminderMinutes: 0, autoConfirmOnline: false,
    colorByStatus: false, compactView: false, whatsappReminder: false,
    onlineBooking: { enabled: false, leadTimeMinutes: 60, maxAdvanceDays: 30, cancellationMinutes: 120, requireDeposit: false },
  };
  const [agendaSettings, setAgendaSettings] = useState<AgendaSettings>(() => ({
    ...defaultAgendaSettings,
    ...((systemSettings as any)?.agenda || {}),
  }));

  // ── Dynamic Grid Constants (react to agendaSettings) ────────
  const START_HOUR = agendaSettings.startHour;
  const END_HOUR = agendaSettings.endHour;
  const SLOT_HEIGHT = agendaSettings.compactView ? 40 : 56;
  const HOUR_HEIGHT = SLOT_HEIGHT * (60 / SLOT_INTERVAL);
  const TIME_OPTIONS = useMemo(() => buildTimeOptions(START_HOUR, END_HOUR), [START_HOUR, END_HOUR]);
  const HOUR_LABELS = useMemo(() => buildHourLabels(START_HOUR, END_HOUR), [START_HOUR, END_HOUR]);

  // Fetch work schedules on mount
  useEffect(() => {
    getWorkSchedules().then(setWorkSchedules).catch(() => { });
  }, []);

  const confirm = useConfirm();
  const toast = useToast();

  // Current time for live indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to 8am on mount (offset preserves 07:00 label fully visible)
  useEffect(() => {
    if (scrollRef.current && view !== 'month') {
      const scrollToMin = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 16);
      scrollRef.current.scrollTop = scrollToMin;
    }
  }, [view]);

  // ── Theme Tokens ───────────────────────────────────────────
  const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
  const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
  const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';

  // ── Active barbers (role = Barber, status = Active) ────────
  const activeBarbers = useMemo(() =>
    members.filter(m => m.status === 'Active' && m.role === 'Barber'),
    [members]);

  const displayedBarbers = useMemo(() => {
    if (barberFilter === 'all') return activeBarbers;
    return activeBarbers.filter(b => b.id === barberFilter);
  }, [activeBarbers, barberFilter]);

  // ── Form State ─────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: '',
    type: 'appointment' as EventType,
    date: '',
    startTime: '09:00',
    endTime: '09:30',
    client: '',
    observation: '',
    barberId: '',
    serviceId: '',       // backward compat — primary service
    selectedServices: [] as string[],  // multi-service IDs
    status: 'confirmed' as string,
  });

  // Inline new-client (only for Novo Agendamento)
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '', email: '', phone: '', birthday: '', gender: '' as string,
  });

  // Repeat booking (only for Novo Agendamento)
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatConfig, setRepeatConfig] = useState({
    frequency: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
    count: 4,
  });

  // Computed: total duration and price from selected services
  const selectedServiceDetails = useMemo(() => {
    const svcs = formData.selectedServices.map(id => services.find(s => s.id === id)).filter(Boolean) as typeof services;
    const totalDuration = svcs.reduce((sum, s) => sum + (s.duration || 30), 0) + (agendaSettings.bufferMinutes || 0);
    const totalPrice = svcs.reduce((sum, s) => sum + (s.price || 0), 0);
    return { svcs, totalDuration, totalPrice };
  }, [formData.selectedServices, services, agendaSettings.bufferMinutes]);

  const isFormValid = useMemo(() => {
    if (!formData.date || !formData.startTime || !formData.endTime) return false;
    if (formData.type === 'blocked') return true;
    if (agendaSettings.requireService && formData.selectedServices.length === 0) return false;
    if (agendaSettings.requireClient && !formData.client.trim()) return false;
    return formData.title.trim() !== '' || formData.selectedServices.length > 0;
  }, [formData, agendaSettings.requireService, agendaSettings.requireClient]);

  // Auto-fill endTime when services change
  useEffect(() => {
    if (formData.selectedServices.length > 0) {
      const totalDur = selectedServiceDetails.totalDuration;
      const firstSvc = services.find(s => s.id === formData.selectedServices[0]);
      setFormData(prev => ({
        ...prev,
        title: prev.title || firstSvc?.name || '',
        endTime: addMinutes(prev.startTime, totalDur),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.selectedServices.length, services]);

  // ── Validation: form end > start ───────────────────────────
  const isTimeValid = getMinutes(formData.endTime) > getMinutes(formData.startTime);

  // ── Conflict Detection ─────────────────────────────────────
  const conflictingEvents = useMemo(() => {
    if (!formData.barberId || !formData.date || !formData.startTime || !formData.endTime) return [];
    const [y, m, d] = formData.date.split('-').map(Number);
    const formStart = getMinutes(formData.startTime);
    const formEnd = getMinutes(formData.endTime);
    return events.filter(ev => {
      if (editingEventId && ev.id === editingEventId) return false;
      if (ev.barberId !== formData.barberId) return false;
      if (ev.year !== y || ev.month !== m - 1 || ev.date !== d) return false;
      const evStart = getMinutes(ev.startTime);
      const evEnd = getMinutes(ev.endTime);
      return formStart < evEnd && formEnd > evStart;
    });
  }, [formData.barberId, formData.date, formData.startTime, formData.endTime, events, editingEventId]);

  // ── Navigation ─────────────────────────────────────────────
  const handlePrev = () => {
    const nd = new Date(currentDate);
    if (view === 'month') nd.setMonth(nd.getMonth() - 1);
    else if (view === 'week') nd.setDate(nd.getDate() - 7);
    else nd.setDate(nd.getDate() - 1);
    setCurrentDate(nd);
  };
  const handleNext = () => {
    const nd = new Date(currentDate);
    if (view === 'month') nd.setMonth(nd.getMonth() + 1);
    else if (view === 'week') nd.setDate(nd.getDate() + 7);
    else nd.setDate(nd.getDate() + 1);
    setCurrentDate(nd);
  };
  const handleReset = () => setCurrentDate(new Date());

  // ── Modal Open ─────────────────────────────────────────────
  const handleOpenModal = useCallback((event?: CalendarEvent, slotDate?: Date, slotTime?: string, barberId?: string) => {
    setShowNewClient(false);
    setRepeatEnabled(false);
    setRepeatConfig({ frequency: 'weekly', count: 4 });
    setNewClientData({ name: '', email: '', phone: '', birthday: '', gender: '' });

    if (event) {
      setEditingEventId(event.id);
      const year = event.year || new Date().getFullYear();
      const dateStr = new Date(year, event.month, event.date).toISOString().split('T')[0];
      setFormData({
        title: event.title,
        type: event.type,
        date: dateStr,
        startTime: event.startTime,
        endTime: event.endTime,
        client: event.client || '',
        observation: event.observation || '',
        barberId: event.barberId || '',
        serviceId: event.serviceId || '',
        selectedServices: event.serviceIds && event.serviceIds.length > 0 ? event.serviceIds : (event.serviceId ? [event.serviceId] : []),
        status: event.status || 'confirmed',
      });
    } else {
      setEditingEventId(null);
      let dateStr = new Date().toISOString().split('T')[0];
      if (slotDate) {
        const y = slotDate.getFullYear();
        const m = String(slotDate.getMonth() + 1).padStart(2, '0');
        const d = String(slotDate.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      }
      const start = slotTime || '09:00';
      setFormData({
        title: '',
        type: 'appointment',
        date: dateStr,
        startTime: start,
        endTime: addMinutes(start, agendaSettings.defaultDuration || 30),
        client: '',
        observation: '',
        barberId: barberId || '',
        serviceId: '',
        selectedServices: [],
        status: 'confirmed',
      });
    }
    setIsModalOpen(true);
  }, [agendaSettings.defaultDuration]);

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Agendamento',
      message: 'Tem certeza que deseja excluir este agendamento?',
      variant: 'danger',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (ok) {
      const result = await deleteCalendarEvent(id);
      if (!result.success) {
        toast.error('Erro ao excluir', result.error || 'Erro desconhecido');
        return;
      }
      // Optimistic local update — no refresh/reload
      setCalendarEvents(prev => prev.filter(ev => ev.id !== id));
      toast.success('Agendamento excluido');
      setIsModalOpen(false);
    }
  };

  // ── Save (supports multi-service + repeat) ─────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const [y, m, d] = formData.date.split('-').map(Number);

    if (formData.type === 'blocked' && !isAdmin) {
      toast.error('Sem permissao', 'Apenas administradores podem bloquear horarios.');
      return;
    }

    // If creating a new client inline
    if (showNewClient && newClientData.name.trim() && !editingEventId) {
      const newClient: Client = {
        id: crypto.randomUUID(),
        name: newClientData.name.trim(),
        email: newClientData.email.trim(),
        phone: newClientData.phone.trim(),
        birthday: newClientData.birthday || undefined,
        gender: (newClientData.gender || undefined) as any,
        company: '',
        status: 'Active',
        revenue: 0,
        monthlyValue: 0,
        setupValue: 0,
        totalValue: 0,
        monthsActive: 0,
      };
      const clientResult = await saveClient(newClient);
      if (!clientResult.success) {
        toast.error('Erro ao criar cliente', clientResult.error || '');
        return;
      }
      // Update form client with new name
      formData.client = newClient.name;
      // Add to local inline state
      setInlineClients(prev => [...prev, newClient]);
    }

    const barber = members.find(mb => mb.id === formData.barberId);
    const primarySvc = formData.selectedServices.length > 0
      ? services.find(s => s.id === formData.selectedServices[0])
      : services.find(s => s.id === formData.serviceId);

    const buildEvent = (dateObj: Date, id?: string): CalendarEvent => ({
      id: id || 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: formData.title || primarySvc?.name || (formData.type === 'blocked' ? 'Bloqueado' : 'Agendamento'),
      type: formData.type,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: dateObj.getDate(),
      month: dateObj.getMonth(),
      year: dateObj.getFullYear(),
      color: '',
      client: formData.client,
      observation: formData.observation,
      barberId: formData.barberId || undefined,
      barberName: barber?.name || undefined,
      serviceId: formData.selectedServices[0] || formData.serviceId || undefined,
      serviceName: primarySvc?.name || undefined,
      serviceIds: formData.selectedServices.length > 0 ? formData.selectedServices : undefined,
      duration: getMinutes(formData.endTime) - getMinutes(formData.startTime),
      unitId: selectedUnitId !== 'all' ? selectedUnitId : undefined,
      source: editingEventId ? (events.find(ev => ev.id === editingEventId)?.source || 'manual') : 'manual',
      status: formData.status as any,
      comandaId: editingEventId ? (events.find(ev => ev.id === editingEventId)?.comandaId || undefined) : undefined,
    });


    const baseDate = new Date(y, m - 1, d);

    if (editingEventId) {
      // Update existing
      const originalEvent = events.find(ev => ev.id === editingEventId);
      const updated = buildEvent(baseDate, editingEventId);
      const result = await saveCalendarEvent(updated);
      if (!result.success) {
        toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
        return;
      }
      setCalendarEvents(prev => prev.map(ev => ev.id === editingEventId ? updated : ev));
      toast.success('Agendamento atualizado');

      // ── AUTO-COMANDA: if status changed to in_service, create comanda ──
      if (formData.status === 'in_service' && originalEvent?.status !== 'in_service') {
        const existingComanda = comandas.find(c => c.appointmentId === editingEventId && c.status !== 'cancelled');
        if (!existingComanda) {
          const userId = currentUser?.id || '';
          const createResult = await createComandaFromAppointment(updated, services, clients, userId);
          if (createResult.success && createResult.comanda) {
            setComandas(prev => [createResult.comanda!, ...prev]);
            setCalendarEvents(prev => prev.map(ev =>
              ev.id === editingEventId ? { ...ev, comandaId: createResult.comanda!.id } : ev
            ));
            toast.success('Comanda criada', `Comanda gerada automaticamente do agendamento`);
          } else {
            console.warn('Failed to create comanda from modal:', createResult.error);
            toast.error('Erro ao criar comanda', createResult.error || '');
          }
        } else {
          toast.success('Comanda já existe', `Comanda #${existingComanda.id.slice(0, 6)} já vinculada`);
        }
      }

      // ── CANCEL PROPAGATION ──
      if (formData.status === 'cancelled' && originalEvent?.comandaId) {
        const linkedComanda = comandas.find(c => c.id === originalEvent.comandaId && c.status !== 'closed');
        if (linkedComanda) {
          const cancelledComanda = { ...linkedComanda, status: 'cancelled' as const };
          await saveComanda(cancelledComanda);
          setComandas(prev => prev.map(c => c.id === linkedComanda.id ? cancelledComanda : c));
        }
      }
    } else {
      // Create new (possibly repeated)
      const dates: Date[] = [baseDate];
      if (repeatEnabled && repeatConfig.count > 1) {
        for (let i = 1; i < repeatConfig.count; i++) {
          const nextDate = new Date(baseDate);
          if (repeatConfig.frequency === 'weekly') nextDate.setDate(baseDate.getDate() + 7 * i);
          else if (repeatConfig.frequency === 'biweekly') nextDate.setDate(baseDate.getDate() + 14 * i);
          else nextDate.setMonth(baseDate.getMonth() + i);
          dates.push(nextDate);
        }
      }

      const newEvents: CalendarEvent[] = [];
      for (const dt of dates) {
        const ev = buildEvent(dt);
        const result = await saveCalendarEvent(ev);
        if (!result.success) {
          toast.error('Erro ao salvar', result.error || 'Erro desconhecido');
          break;
        }
        newEvents.push(ev);
      }
      setCalendarEvents(prev => [...prev, ...newEvents]);
      toast.success(newEvents.length > 1 ? `${newEvents.length} agendamentos criados` : 'Agendamento criado');
    }
    setIsModalOpen(false);
  };

  // ── Quick Status Change (from card dropdown) ──────────────
  const handleStatusChange = async (eventId: string, newStatus: string) => {
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    const updated = { ...event, status: newStatus as any };
    // Optimistic local update
    setCalendarEvents(prev => prev.map(ev => ev.id === eventId ? updated : ev));
    // Persist to DB
    const result = await saveCalendarEvent(updated);
    if (!result.success) {
      // Revert on error
      setCalendarEvents(prev => prev.map(ev => ev.id === eventId ? event : ev));
      toast.error('Erro ao atualizar status', result.error || '');
      return;
    }

    // Push notification is handled by DB trigger (trg_push_on_calendar_event)

    // ── AUTO-COMANDA: create comanda when entering "in_service" ──
    if (newStatus === 'in_service') {
      // Check if comanda already exists for this appointment
      const existingComanda = comandas.find(c => c.appointmentId === eventId && c.status !== 'cancelled');
      if (existingComanda) {
        toast.success('Comanda já existe', `Comanda #${existingComanda.id.slice(0, 6)} já vinculada`);
      } else {
        const userId = currentUser?.id || '';
        const createResult = await createComandaFromAppointment(event, services, clients, userId);
        if (createResult.success && createResult.comanda) {
          // Update local state with new comanda
          setComandas(prev => [createResult.comanda!, ...prev]);
          // Update event with comandaId
          setCalendarEvents(prev => prev.map(ev =>
            ev.id === eventId ? { ...ev, comandaId: createResult.comanda!.id, status: newStatus as any } : ev
          ));
          toast.success('Comanda criada', `Comanda #${createResult.comanda.id.slice(0, 6)} gerada automaticamente`);
        } else {
          console.warn('Failed to create comanda:', createResult.error);
          toast.error('Erro ao criar comanda', createResult.error || '');
        }
      }
    }

    // ── CANCEL PROPAGATION: cancel linked comanda when cancelling appointment ──
    if (newStatus === 'cancelled' && event.comandaId) {
      const linkedComanda = comandas.find(c => c.id === event.comandaId && c.status !== 'closed');
      if (linkedComanda) {
        const cancelledComanda = { ...linkedComanda, status: 'cancelled' as const };
        await saveComanda(cancelledComanda);
        setComandas(prev => prev.map(c => c.id === linkedComanda.id ? cancelledComanda : c));
      }
    }
  };

  // ── Drag & Drop (Day view only) ────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;

    const eventId = String(active.id);
    const event = events.find(ev => ev.id === eventId);
    if (!event || event.type === 'blocked') return;

    // over.id format: "slot_{barberId}_{HH:MM}"
    const overId = String(over.id);
    if (!overId.startsWith('slot_')) return;

    const parts = overId.split('_');
    const newBarberId = parts[1];
    const newStartTime = parts.slice(2).join(':'); // Handle HH:MM
    const duration = getMinutes(event.endTime) - getMinutes(event.startTime);
    const newEndTime = addMinutes(newStartTime, duration);

    // Only update if something changed
    if (event.barberId === newBarberId && event.startTime === newStartTime) return;

    // Check for conflicts at destination
    const conflictsAtDest = dayEvents.filter(ev => {
      if (ev.id === eventId) return false;
      if (ev.barberId !== newBarberId) return false;
      if (ev.type === 'blocked') return false;
      const evStart = getMinutes(ev.startTime);
      const evEnd = getMinutes(ev.endTime);
      const nStart = getMinutes(newStartTime);
      const nEnd = getMinutes(newEndTime);
      return nStart < evEnd && nEnd > evStart;
    });

    const barber = members.find(mb => mb.id === newBarberId);
    const updated: CalendarEvent = {
      ...event,
      barberId: newBarberId,
      barberName: barber?.name || event.barberName,
      startTime: newStartTime,
      endTime: newEndTime,
    };

    const result = await saveCalendarEvent(updated);
    if (!result.success) {
      toast.error('Erro ao mover', result.error || 'Erro desconhecido');
      return;
    }
    // Optimistic local update — no refresh/reload
    setCalendarEvents(prev => prev.map(ev => ev.id === event.id ? updated : ev));
    if (conflictsAtDest.length > 0) {
      toast.warning(
        `Movido para ${barber?.name || 'profissional'} as ${newStartTime}`,
        `Conflito com: ${conflictsAtDest.map(c => c.title).join(', ')}`
      );
    } else {
      toast.success(`Movido para ${barber?.name || 'profissional'} as ${newStartTime}`);
    }
  };

  const draggedEvent = activeDragId ? events.find(ev => ev.id === activeDragId) : null;

  // ── Today Events for Day View ──────────────────────────────
  const dayEvents = useMemo(() =>
    events.filter(ev =>
      ev.date === currentDate.getDate() &&
      ev.month === currentDate.getMonth() &&
      ev.year === currentDate.getFullYear()
    ), [events, currentDate]);

  // ── Mini Calendar Builder ──────────────────────────────────
  const buildMiniCalendar = useMemo(() => {
    const year = sidebarCalDate.getFullYear();
    const month = sidebarCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const cells: { day: number; inMonth: boolean; date: Date }[] = [];
    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    // Fill remaining (up to 42 cells for 6 rows)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
    }
    return cells;
  }, [sidebarCalDate]);

  // Events count per day (for mini calendar dots)
  const eventCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(ev => {
      const key = `${ev.year}-${ev.month}-${ev.date}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [events]);

  // ── Sidebar Filtered Events ──────────────────────────────
  const filteredDayEvents = useMemo(() => {
    let filtered = dayEvents;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ev => ev.status === statusFilter);
    }
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(ev => ev.serviceId === serviceFilter || ev.serviceIds?.includes(serviceFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ev =>
        (ev.title || '').toLowerCase().includes(q) ||
        (ev.client || '').toLowerCase().includes(q) ||
        (ev.observation || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [dayEvents, statusFilter, serviceFilter, searchQuery]);

  // ══════════════════════════════════════════════════════════
  // ██  DAY VIEW — Columns per Professional  ██
  // ══════════════════════════════════════════════════════════
  const renderDayView = () => {
    const isToday = isSameDay(currentDate, now);
    const currentTotalMin = now.getHours() * 60 + now.getMinutes();
    const dayStartMin = START_HOUR * 60;
    const timeIndicatorTop = ((currentTotalMin - dayStartMin) / 60) * HOUR_HEIGHT;
    const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    return (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Column Headers */}
          <div className={`flex border-b ${borderCol} shrink-0`}>
            <div className={`w-14 shrink-0 border-r ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`} />
            {displayedBarbers.length > 0 ? displayedBarbers.map(barber => {
              const barberDayEvents = dayEvents.filter(ev => ev.barberId === barber.id && ev.type !== 'blocked');
              const totalSlots = (END_HOUR - START_HOUR) * (60 / SLOT_INTERVAL);
              const usedSlots = barberDayEvents.reduce((sum, ev) => sum + Math.ceil((getMinutes(ev.endTime) - getMinutes(ev.startTime)) / SLOT_INTERVAL), 0);
              const occupancy = Math.round((usedSlots / totalSlots) * 100);
              const occColor = occupancy > 80 ? 'bg-red-500' : occupancy > 50 ? 'bg-amber-500' : 'bg-emerald-500';
              const occTextColor = occupancy > 80 ? 'text-red-500' : occupancy > 50 ? 'text-amber-500' : 'text-emerald-500';

              return (
                <div
                  key={barber.id}
                  className={`flex-1 min-w-[140px] p-3 border-r last:border-r-0 ${borderCol}`}
                >
                  <div className="flex items-center gap-2.5">
                    {barber.image ? (
                      <img src={barber.image} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-primary/20" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-dark text-slate-400 border border-dark-border' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {barber.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${textMain} leading-tight truncate`}>{barber.name.split(' ')[0]}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {barber.station && (
                          <span className={`text-[10px] ${textSub}`}>Cadeira {barber.station}</span>
                        )}
                        <span className={`text-[10px] font-semibold ${occTextColor}`}>{barberDayEvents.length} atend.</span>
                      </div>
                      {/* Occupation bar */}
                      <div className={`mt-1 h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-dark-border' : 'bg-slate-200'}`}>
                        <div className={`h-full rounded-full transition-all duration-500 ${occColor}`} style={{ width: `${Math.min(occupancy, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className={`flex-1 p-3 text-center ${textSub} text-sm`}>
                Nenhum profissional ativo
              </div>
            )}
            {/* Scrollbar spacer — compensate for grid scrollbar width */}
            <div className="w-[8px] shrink-0" />
          </div>

          {/* Unassigned Events Banner */}
          {(() => {
            const unassigned = dayEvents.filter(ev => !ev.barberId && ev.type !== 'blocked');
            if (unassigned.length === 0) return null;
            return (
              <div className={`flex items-center gap-2 px-4 py-2 border-b ${borderCol} shrink-0 ${isDarkMode ? 'bg-amber-900/10' : 'bg-amber-50'}`}>
                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                <span className={`text-xs font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                  {unassigned.length} sem profissional:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {unassigned.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => handleOpenModal(ev)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold shrink-0 transition-colors border
                        ${isDarkMode ? 'bg-dark-surface border-dark-border text-slate-300 hover:border-primary hover:text-primary' : 'bg-white border-slate-200 text-slate-700 hover:border-primary hover:text-primary'}`}
                    >
                      <Scissors size={10} />
                      {ev.title} <span className="opacity-50">{ev.startTime}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Time Grid */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar relative pt-2">
            <div className="flex" style={{ minHeight: `${totalHeight}px` }}>
              {/* Time Labels Column */}
              <div className={`w-14 shrink-0 border-r ${borderCol} relative`}>
                {HOUR_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={`absolute right-2 text-[11px] font-semibold ${textSub}`}
                    style={{ top: `${i * HOUR_HEIGHT - 7}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Professional Columns */}
              {displayedBarbers.map(barber => {
                const barberEvents = dayEvents.filter(ev => ev.barberId === barber.id);

                // Work schedule for this barber on this day of week
                const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
                const schedule = workSchedules.find(ws => ws.memberId === barber.id && ws.dayOfWeek === dayOfWeek);
                const isOff = schedule?.isOff || false;

                // Build off-hours blocks: before startTime, after endTime, and break
                const offBlocks: { startMin: number; endMin: number }[] = [];
                if (schedule && !isOff && schedule.startTime && schedule.endTime) {
                  const schedStart = getMinutes(schedule.startTime);
                  const schedEnd = getMinutes(schedule.endTime);
                  const gridStart = START_HOUR * 60;
                  const gridEnd = END_HOUR * 60;
                  if (schedStart > gridStart) offBlocks.push({ startMin: gridStart, endMin: schedStart });
                  if (schedEnd < gridEnd) offBlocks.push({ startMin: schedEnd, endMin: gridEnd });
                  if (schedule.breakStart && schedule.breakEnd) {
                    offBlocks.push({ startMin: getMinutes(schedule.breakStart), endMin: getMinutes(schedule.breakEnd) });
                  }
                }

                return (
                  <div
                    key={barber.id}
                    className={`flex-1 min-w-[140px] border-r last:border-r-0 ${borderCol} relative`}
                  >
                    {/* Hour grid lines */}
                    {HOUR_LABELS.map((_, i) => (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 border-t ${isDarkMode ? 'border-dark-border/40' : 'border-slate-200/80'}`}
                        style={{ top: `${i * HOUR_HEIGHT}px` }}
                      />
                    ))}
                    {/* Half-hour lines (subtle) */}
                    {HOUR_LABELS.map((_, i) => (
                      <div
                        key={`half-${i}`}
                        className={`absolute left-0 right-0 border-t ${isDarkMode ? 'border-dark-border/20' : 'border-slate-100'}`}
                        style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                      />
                    ))}

                    {/* Off-hours overlay */}
                    {isOff ? (
                      <div
                        className={`absolute inset-0 flex items-center justify-center z-5 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-100/60'}`}
                        style={{
                          backgroundImage: isDarkMode
                            ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(100,116,139,0.08) 8px, rgba(100,116,139,0.08) 9px)'
                            : 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148,163,184,0.12) 8px, rgba(148,163,184,0.12) 9px)',
                        }}
                      >
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'bg-dark-surface/80 text-slate-500 border border-dark-border' : 'bg-white/80 text-slate-400 border border-slate-200'}`}>
                          Folga
                        </div>
                      </div>
                    ) : offBlocks.map((block, idx) => {
                      const dayStartMin = START_HOUR * 60;
                      const topPx = ((block.startMin - dayStartMin) / 60) * HOUR_HEIGHT;
                      const heightPx = ((block.endMin - block.startMin) / 60) * HOUR_HEIGHT;
                      return (
                        <div
                          key={`off-${idx}`}
                          className="absolute left-0 right-0 pointer-events-none z-5"
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            backgroundImage: isDarkMode
                              ? 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(100,116,139,0.06) 6px, rgba(100,116,139,0.06) 7px)'
                              : 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(148,163,184,0.1) 6px, rgba(148,163,184,0.1) 7px)',
                            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(241,245,249,0.5)',
                          }}
                        />
                      );
                    })}

                    {/* Droppable + Clickable slots (15-min) */}
                    {TIME_OPTIONS.filter((_, idx) => idx < TIME_OPTIONS.length - 1).map(time => (
                      <DroppableSlot
                        key={`slot_${barber.id}_${time}`}
                        id={`slot_${barber.id}_${time}`}
                        time={time}
                        isDarkMode={isDarkMode}
                        onClick={() => handleOpenModal(undefined, currentDate, time, barber.id)}
                        startHour={START_HOUR}
                        slotHeight={SLOT_HEIGHT}
                        hourHeight={HOUR_HEIGHT}
                      />
                    ))}

                    {/* Appointment Cards */}
                    {barberEvents.map(ev => (
                      <DraggableCard
                        key={ev.id}
                        event={ev}
                        isDarkMode={isDarkMode}
                        slotStartMin={dayStartMin}
                        onClick={() => handleOpenModal(ev)}
                        onStatusChange={handleStatusChange}
                        slotHeight={SLOT_HEIGHT}
                        hourHeight={HOUR_HEIGHT}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Current time indicator */}
              {isToday && currentTotalMin >= dayStartMin && currentTotalMin <= END_HOUR * 60 && (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  style={{ top: `${timeIndicatorTop}px` }}
                >
                  <div className="w-14 text-right pr-1">
                    <span className="text-[9px] font-bold text-red-500 bg-white dark:bg-dark-surface px-1 rounded">
                      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex-1 h-[2px] bg-red-500 relative">
                    <div className="absolute -top-[3px] -left-[1px] w-2 h-2 rounded-full bg-red-500" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedEvent && (
            <div className={`rounded-md border px-3 py-2 shadow-2xl ${isDarkMode ? 'bg-dark-surface border-primary/50' : 'bg-white border-primary/50'} text-primary text-[11px] font-semibold min-w-[120px]`}>
              <div className="flex items-center gap-1.5">
                <GripVertical size={10} />
                <span className="truncate">{draggedEvent.title}</span>
              </div>
              <div className="text-[10px] opacity-60 mt-0.5">{draggedEvent.startTime} - {draggedEvent.endTime}</div>
              {draggedEvent.client && (
                <div className="text-[10px] opacity-50 flex items-center gap-1 mt-0.5">
                  <User size={8} />{draggedEvent.client}
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    );
  };

  // ══════════════════════════════════════════════════════════
  // ██  WEEK VIEW  ██
  // ══════════════════════════════════════════════════════════
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDates.push(d);
    }

    const timeSlots = HOUR_LABELS;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className={`grid grid-cols-8 border-b ${borderCol} shrink-0`}>
          <div className={`p-2 border-r ${borderCol} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`} />
          {weekDates.map((date, i) => {
            const isToday = isSameDay(date, now);
            return (
              <div key={i} className={`p-2 text-center border-r ${borderCol} last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                <div className={`text-[10px] font-bold uppercase ${textSub}`}>{weekDays[i]}</div>
                <div
                  className={`text-lg font-bold cursor-pointer transition-colors ${isToday ? 'text-primary' : textMain} hover:text-primary`}
                  onClick={() => { setCurrentDate(date); setView('day'); }}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
          {timeSlots.map(time => {
            const slotStart = getMinutes(time);
            const slotEnd = slotStart + 60;

            return (
              <div key={time} className={`grid grid-cols-8 border-b ${borderCol}`} style={{ height: `${HOUR_HEIGHT}px` }}>
                <div className={`p-2 text-[10px] ${textSub} border-r ${borderCol} text-right pt-1 font-medium`}>
                  {time}
                </div>
                {weekDates.map((date, dayIndex) => {
                  const slotEvents = events.filter(ev =>
                    ev.date === date.getDate() &&
                    ev.month === date.getMonth() &&
                    ev.year === date.getFullYear() &&
                    getMinutes(ev.startTime) >= slotStart &&
                    getMinutes(ev.startTime) < slotEnd
                  );

                  return (
                    <div
                      key={dayIndex}
                      className={`border-r ${borderCol} last:border-r-0 relative cursor-pointer group transition-colors ${isDarkMode ? 'hover:bg-dark-border/20' : 'hover:bg-slate-50'}`}
                      onClick={() => handleOpenModal(undefined, date, time)}
                    >
                      <div className="hidden group-hover:flex absolute inset-0 items-center justify-center pointer-events-none z-0">
                        <Plus size={12} className="text-primary opacity-40" />
                      </div>
                      {slotEvents.map(ev => {
                        const startM = getMinutes(ev.startTime);
                        const dur = getMinutes(ev.endTime) - startM;
                        const offset = startM - slotStart;
                        const isBlocked = ev.type === 'blocked';

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(ev); }}
                            style={{
                              position: 'absolute',
                              top: `${(offset / 60) * 100}%`,
                              height: `${(dur / 60) * 100}%`,
                              left: '1px', right: '1px',
                              zIndex: 10,
                            }}
                            className={`
                              rounded px-1.5 py-0.5 text-[10px] border truncate cursor-pointer shadow-sm transition-all
                              ${isBlocked
                                ? 'bg-transparent border-dashed border-slate-400/50 text-slate-400 dark:text-slate-500 dark:border-slate-600'
                                : ev.type === 'appointment'
                                  ? 'bg-primary/10 text-primary border-primary/30'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              }
                              hover:shadow-lg hover:z-50
                            `}
                          >
                            <div className="font-bold flex items-center gap-0.5 leading-tight">
                              {isBlocked && <Lock size={8} />}
                              {ev.title}
                            </div>
                            {dur >= 45 && !isBlocked && (
                              <div className="opacity-60">{ev.startTime} - {ev.endTime}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // ██  MONTH VIEW  ██
  // ══════════════════════════════════════════════════════════
  const renderMonthView = () => {
    const totalDays = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const weeks = Math.ceil((totalDays + startDay) / 7);
    const cells = [];

    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`e-${i}`} className={`border ${borderCol} ${isDarkMode ? 'bg-dark/30' : 'bg-slate-50/50'}`} />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayEvs = events.filter(e => e.date === d && e.month === currentDate.getMonth() && e.year === currentDate.getFullYear());
      const isToday = d === now.getDate() && currentDate.getMonth() === now.getMonth() && currentDate.getFullYear() === now.getFullYear();
      const appointmentCount = dayEvs.filter(e => e.type === 'appointment').length;

      cells.push(
        <div
          key={d}
          onClick={() => {
            const clickDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            if (dayEvs.length === 0) {
              // Empty day — open modal directly for faster scheduling
              handleOpenModal(undefined, clickDate, '09:00');
            } else {
              setCurrentDate(clickDate);
              setView('day');
            }
          }}
          className={`border ${borderCol} p-1.5 relative group cursor-pointer transition-colors flex flex-col ${isDarkMode ? 'hover:bg-dark-border/30' : 'hover:bg-slate-50'} ${isToday ? (isDarkMode ? 'bg-dark-border/30' : 'bg-primary/5') : ''}`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-xs font-semibold ${isToday ? 'bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]' : textSub}`}>
              {d}
            </span>
            {appointmentCount > 0 && (
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                {appointmentCount}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-0.5 overflow-hidden">
            {dayEvs.slice(0, 3).map(ev => (
              <div
                key={ev.id}
                onClick={(e) => { e.stopPropagation(); handleOpenModal(ev); }}
                className={`text-[9px] px-1 py-0.5 rounded truncate leading-tight hover:ring-1 hover:ring-primary/30 transition-all
                  ${ev.type === 'blocked'
                    ? 'bg-transparent border border-dashed border-slate-300 dark:border-slate-600 text-slate-400'
                    : ev.type === 'appointment'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}
              >
                <span className="font-bold">{ev.startTime}</span> {ev.title}
              </div>
            ))}
            {dayEvs.length > 3 && (
              <div className={`text-[9px] text-center ${textSub}`}>+ {dayEvs.length - 3}</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className={`grid grid-cols-7 border-b ${borderCol} shrink-0`}>
          {weekDays.map(day => (
            <div key={day} className={`py-2 text-center text-[10px] font-bold uppercase ${textSub} ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: `repeat(${weeks}, 1fr)`,
          height: '100%',
        }}>
          {cells}
        </div>
      </div>
    );
  };

  // ── Day view stats ─────────────────────────────────────────
  const todayStats = useMemo(() => {
    const appointments = dayEvents.filter(e => e.type === 'appointment');
    const blocked = dayEvents.filter(e => e.type === 'blocked');
    const unassigned = dayEvents.filter(e => !e.barberId && e.type !== 'blocked');
    // Estimated revenue: sum service prices for appointments that have a serviceId
    const revenue = appointments.reduce((sum, ev) => {
      if (ev.serviceId) {
        const svc = services.find(s => s.id === ev.serviceId);
        return sum + (svc?.price || 0);
      }
      return sum;
    }, 0);
    return {
      total: appointments.length,
      blocked: blocked.length,
      unassigned: unassigned.length,
      barbers: displayedBarbers.length,
      revenue,
    };
  }, [dayEvents, displayedBarbers, services]);

  // ══════════════════════════════════════════════════════════
  // ██  RENDER  ██
  // ══════════════════════════════════════════════════════════
  return (
    <div className={`h-[calc(100vh-8rem)] grid gap-3 animate-in fade-in duration-300 ${sidebarCollapsed ? 'grid-cols-[1fr]' : 'grid-cols-[320px_1fr]'}`} style={{ gridTemplateRows: 'auto auto 1fr' }}>

      {/* ── Appointment Modal (Enterprise 2-Column) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]`}>
            {/* Header */}
            <div className={`p-4 border-b ${borderCol} flex justify-between items-center shrink-0 ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
              <h3 className={`font-semibold text-lg ${textMain} flex items-center gap-2`}>
                {formData.type === 'blocked' ? <Lock size={18} /> : <CalendarIcon size={18} className="text-primary" />}
                {editingEventId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`${textSub} hover:${textMain} transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-border`}>
                <X size={20} />
              </button>
            </div>

            {/* Form Body — 2 Columns */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex flex-1 overflow-hidden">

                {/* LEFT COLUMN — Primary Form (60%) */}
                <div className={`w-[60%] p-5 space-y-4 overflow-y-auto custom-scrollbar border-r ${borderCol}`}>

                  {/* Type Switcher */}
                  {isAdmin && (
                    <div className={`flex rounded-lg border p-1 gap-1 ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: 'appointment' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5
                          ${formData.type === 'appointment' ? 'bg-primary text-white shadow-sm' : `${textSub} hover:${textMain}`}`}
                      >
                        <Scissors size={13} /> Agendamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: 'blocked' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5
                          ${formData.type === 'blocked' ? 'bg-slate-600 text-white shadow-sm' : `${textSub} hover:${textMain}`}`}
                      >
                        <Lock size={13} /> Bloquear Horario
                      </button>
                    </div>
                  )}

                  {/* Multi-Service Selection */}
                  {formData.type !== 'blocked' && (
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <Scissors size={12} /> Servicos
                      </label>
                      <CustomDropdown
                        value=""
                        onChange={(v) => {
                          if (v && !formData.selectedServices.includes(v)) {
                            const svc = services.find(s => s.id === v);
                            setFormData(prev => ({
                              ...prev,
                              selectedServices: [...prev.selectedServices, v],
                              serviceId: prev.selectedServices.length === 0 ? v : prev.serviceId,
                              title: prev.title || svc?.name || '',
                            }));
                          }
                        }}
                        options={[
                          { value: '', label: 'Adicionar servico...' },
                          ...services.filter(s => s.active && !formData.selectedServices.includes(s.id)).map(s => ({
                            value: s.id,
                            label: `${s.name} ${s.duration ? `(${s.duration}min)` : ''} - R$ ${s.price.toFixed(2)}`,
                            icon: <Scissors size={12} />
                          }))
                        ]}
                        isDarkMode={isDarkMode}
                      />

                      {/* Service Chips */}
                      {formData.selectedServices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {formData.selectedServices.map(svcId => {
                            const svc = services.find(s => s.id === svcId);
                            if (!svc) return null;
                            return (
                              <div
                                key={svcId}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${isDarkMode ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-primary/5 border-primary/15 text-primary'}`}
                              >
                                <Scissors size={10} />
                                <span>{svc.name}</span>
                                <span className={`${textSub} text-[10px]`}>{svc.duration || 30}min</span>
                                <span className={`${textSub} text-[10px]`}>R${svc.price.toFixed(0)}</span>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    selectedServices: prev.selectedServices.filter(id => id !== svcId),
                                    serviceId: prev.selectedServices.filter(id => id !== svcId)[0] || '',
                                  }))}
                                  className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          })}
                          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold ${isDarkMode ? 'bg-dark-border text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            <Clock size={10} /> {selectedServiceDetails.totalDuration}min
                            <DollarSign size={10} /> R$ {selectedServiceDetails.totalPrice.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                      <CalendarIcon size={12} /> {formData.type === 'blocked' ? 'Motivo do bloqueio' : 'Titulo'}
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                      placeholder={formData.type === 'blocked' ? 'Ex: Almoco, Reuniao...' : 'Preenchido automaticamente pelo servico'}
                    />
                  </div>

                  {/* Professional */}
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                      <User size={12} /> Profissional
                    </label>
                    <CustomDropdown
                      value={formData.barberId}
                      onChange={v => setFormData(prev => ({ ...prev, barberId: v }))}
                      options={[
                        { value: '', label: 'Selecione um profissional...' },
                        ...activeBarbers.map(b => ({ value: b.id, label: `${b.name}${b.station ? ` (Cadeira ${b.station})` : ''}`, icon: <User size={12} /> }))
                      ]}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Client */}
                  {formData.type !== 'blocked' && (
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <Users size={12} /> Cliente
                      </label>
                      <CustomDropdown
                        value={formData.client}
                        onChange={v => {
                          setFormData(prev => ({ ...prev, client: v }));
                          if (v) setShowNewClient(false);
                        }}
                        options={[
                          { value: '', label: 'Nenhum / Walk-in' },
                          ...clients.map(c => ({ value: c.name, label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}`, icon: <Users size={12} /> }))
                        ]}
                        isDarkMode={isDarkMode}
                      />

                      {/* Inline New Client (only in New mode) */}
                      {!editingEventId && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowNewClient(prev => !prev)}
                            className={`mt-2 text-xs font-medium flex items-center gap-1 transition-colors ${showNewClient ? 'text-primary' : `${textSub} hover:text-primary`}`}
                          >
                            <UserPlus size={12} /> {showNewClient ? 'Cancelar cadastro' : 'Cadastrar novo cliente'}
                          </button>

                          {showNewClient && (
                            <div className={`mt-2 p-3 rounded-lg border space-y-2.5 ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                              <div>
                                <label className={`block text-[10px] font-medium ${textSub} mb-0.5 flex items-center gap-1`}>
                                  <User size={10} /> Nome *
                                </label>
                                <input
                                  type="text"
                                  value={newClientData.name}
                                  onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                                  className={`w-full ${bgInput} border ${borderCol} rounded-md p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                  placeholder="Nome completo"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={`block text-[10px] font-medium ${textSub} mb-0.5 flex items-center gap-1`}>
                                    <Mail size={10} /> E-mail
                                  </label>
                                  <input
                                    type="email"
                                    value={newClientData.email}
                                    onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-md p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="email@exemplo.com"
                                  />
                                </div>
                                <div>
                                  <label className={`block text-[10px] font-medium ${textSub} mb-0.5 flex items-center gap-1`}>
                                    <Phone size={10} /> Contato
                                  </label>
                                  <input
                                    type="tel"
                                    value={newClientData.phone}
                                    onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-md p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none`}
                                    placeholder="(11) 99999-9999"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={`block text-[10px] font-medium ${textSub} mb-0.5 flex items-center gap-1`}>
                                    <Gift size={10} /> Aniversario
                                  </label>
                                  <input
                                    type="date"
                                    value={newClientData.birthday}
                                    onChange={(e) => setNewClientData(prev => ({ ...prev, birthday: e.target.value }))}
                                    className={`w-full ${bgInput} border ${borderCol} rounded-md p-2 text-xs ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                                  />
                                </div>
                                <div>
                                  <label className={`block text-[10px] font-medium ${textSub} mb-0.5 flex items-center gap-1`}>
                                    <User size={10} /> Genero
                                  </label>
                                  <CustomDropdown
                                    value={newClientData.gender}
                                    onChange={v => setNewClientData(prev => ({ ...prev, gender: v }))}
                                    options={[
                                      { value: '', label: 'Selecionar...' },
                                      { value: 'M', label: 'Masculino' },
                                      { value: 'F', label: 'Feminino' },
                                      { value: 'O', label: 'Outro' }
                                    ]}
                                    isDarkMode={isDarkMode}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Date + Time */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <CalendarIcon size={12} /> Data
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none [color-scheme:${isDarkMode ? 'dark' : 'light'}]`}
                        required
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <Clock size={12} /> Inicio
                      </label>
                      <CustomDropdown
                        value={formData.startTime}
                        onChange={v => {
                          const totalDur = selectedServiceDetails.totalDuration || 30;
                          setFormData(prev => ({
                            ...prev,
                            startTime: v,
                            endTime: formData.selectedServices.length > 0 ? addMinutes(v, totalDur) : prev.endTime,
                          }));
                        }}
                        options={TIME_OPTIONS.map(t => ({ value: t, label: t }))}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <Clock size={12} /> Fim
                      </label>
                      <CustomDropdown
                        value={formData.endTime}
                        onChange={v => setFormData(prev => ({ ...prev, endTime: v }))}
                        options={TIME_OPTIONS.map(t => ({ value: t, label: t }))}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  </div>

                  {/* Warnings */}
                  {!isTimeValid && formData.startTime && formData.endTime && (
                    <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle size={14} />
                      O horario de termino deve ser posterior ao de inicio.
                    </div>
                  )}
                  {conflictingEvents.length > 0 && (
                    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 border ${isDarkMode ? 'bg-amber-900/15 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Conflito de horario detectado</div>
                        <div className="mt-0.5 opacity-80">
                          {conflictingEvents.map(ev => (
                            <span key={ev.id} className="block">{ev.title} ({ev.startTime}-{ev.endTime})</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN — Summary + Extras (40%) */}
                <div className="w-[40%] p-5 space-y-4 overflow-y-auto custom-scrollbar">

                  {/* Live Summary Card */}
                  <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-dark border-dark-border' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className={`text-xs font-bold ${textMain} uppercase tracking-wider mb-3 flex items-center gap-1.5`}>
                      <CalendarIcon size={12} className="text-primary" /> Resumo
                    </h4>
                    <div className="space-y-2">
                      {formData.date && (
                        <div className="flex items-center justify-between text-xs">
                          <span className={textSub}>Data</span>
                          <span className={`font-medium ${textMain}`}>
                            {new Date(formData.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className={textSub}>Horario</span>
                        <span className={`font-medium ${textMain}`}>{formData.startTime} - {formData.endTime}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={textSub}>Duracao</span>
                        <span className={`font-medium ${textMain}`}>{getMinutes(formData.endTime) - getMinutes(formData.startTime)}min</span>
                      </div>
                      {formData.selectedServices.length > 0 && (
                        <>
                          <div className={`border-t ${borderCol} my-1`} />
                          {selectedServiceDetails.svcs.map(svc => (
                            <div key={svc.id} className="flex items-center justify-between text-xs">
                              <span className={textSub}>{svc.name}</span>
                              <span className={`font-medium ${textMain}`}>R$ {svc.price.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className={`border-t ${borderCol} my-1`} />
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-bold ${textMain}`}>Total</span>
                            <span className="font-bold text-primary">R$ {selectedServiceDetails.totalPrice.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {formData.barberId && (
                        <div className="flex items-center justify-between text-xs">
                          <span className={textSub}>Profissional</span>
                          <span className={`font-medium ${textMain}`}>
                            {activeBarbers.find(b => b.id === formData.barberId)?.name || '-'}
                          </span>
                        </div>
                      )}
                      {formData.client && (
                        <div className="flex items-center justify-between text-xs">
                          <span className={textSub}>Cliente</span>
                          <span className={`font-medium ${textMain}`}>{formData.client}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Observations */}
                  <div>
                    <label className={`block text-xs font-medium ${textSub} mb-1`}>Observacoes</label>
                    <textarea
                      value={formData.observation}
                      onChange={(e) => setFormData(prev => ({ ...prev, observation: e.target.value }))}
                      className={`w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none resize-none`}
                      rows={3}
                      placeholder="Anotacoes internas..."
                    />
                  </div>

                  {/* Status (edit only) */}
                  {editingEventId && formData.type !== 'blocked' && (
                    <div>
                      <label className={`block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`}>
                        <CheckCircle2 size={12} /> Status
                      </label>
                      <CustomDropdown
                        value={formData.status}
                        onChange={v => setFormData(prev => ({ ...prev, status: v }))}
                        options={STATUS_OPTIONS.map(opt => ({ value: opt.value, label: opt.label, dot: opt.color }))}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  )}

                  {/* Repeat Booking (new only) */}
                  {!editingEventId && formData.type !== 'blocked' && (
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className={`text-xs font-medium ${textMain} flex items-center gap-1.5`}>
                          <Repeat size={12} className="text-primary" /> Repetir agendamento
                        </label>
                        <button
                          type="button"
                          onClick={() => setRepeatEnabled(prev => !prev)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${repeatEnabled ? 'bg-primary' : isDarkMode ? 'bg-dark-border' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${repeatEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {repeatEnabled && (
                        <div className="mt-3 space-y-2">
                          <div>
                            <label className={`block text-[10px] font-medium ${textSub} mb-0.5`}>Frequencia</label>
                            <CustomDropdown
                              value={repeatConfig.frequency}
                              onChange={v => setRepeatConfig(prev => ({ ...prev, frequency: v as any }))}
                              options={[
                                { value: 'weekly', label: 'Semanal' },
                                { value: 'biweekly', label: 'Quinzenal' },
                                { value: 'monthly', label: 'Mensal' }
                              ]}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                          <div>
                            <label className={`block text-[10px] font-medium ${textSub} mb-0.5`}>Quantidade</label>
                            <CustomDropdown
                              value={String(repeatConfig.count)}
                              onChange={v => setRepeatConfig(prev => ({ ...prev, count: Number(v) }))}
                              options={[2, 4, 8, 12].map(n => ({ value: String(n), label: `${n} vezes` }))}
                              isDarkMode={isDarkMode}
                            />
                          </div>
                          <p className={`text-[10px] ${textSub}`}>
                            Serao criados {repeatConfig.count} agendamentos no total
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* Footer — pinned */}
              <div className={`p-4 border-t ${borderCol} shrink-0 flex gap-3`}>
                {editingEventId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEventId)}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-lg transition-colors border border-red-500/30"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-5 py-2.5 font-medium rounded-lg transition-colors border ${isDarkMode ? 'border-dark-border text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || !isTimeValid}
                  className={`flex-1 py-2.5 font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2
                    ${(!isFormValid || !isTimeValid)
                      ? 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none'
                      : formData.type === 'blocked'
                        ? 'bg-slate-600 hover:bg-slate-500 text-white shadow-slate-900/20'
                        : 'bg-primary hover:bg-primary-600 text-white shadow-primary/20'
                    }`}
                >
                  {editingEventId ? 'Salvar Alteracoes' : (formData.type === 'blocked' ? 'Bloquear Horario' :
                    repeatEnabled ? `Criar ${repeatConfig.count} Agendamentos` : 'Criar Agendamento')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Page Title (outside toolbar, like other pages) ── */}
      <div className="col-span-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className={`text-2xl font-bold ${textMain} flex items-center gap-2`}>
            <CalendarIcon className="text-primary" size={24} /> Agenda
          </h1>
          <p className={`${textSub} text-sm hidden md:block`}>
            {view === 'day'
              ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : view === 'month'
                ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                : (() => {
                  const startOfWeek = new Date(currentDate);
                  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                  const endOfWeek = new Date(startOfWeek);
                  endOfWeek.setDate(startOfWeek.getDate() + 6);
                  return `${formatNavDate(startOfWeek)} - ${formatNavDate(endOfWeek)}, ${endOfWeek.getFullYear()}`;
                })()
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* New Appointment */}
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus size={14} /> Novo
          </button>
          {/* Config */}
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border ${isDarkMode ? 'bg-dark-surface border-dark-border text-slate-400 hover:text-primary' : 'bg-white border-slate-300 text-slate-600 hover:text-primary'}`}
          >
            <Settings2 size={14} />
          </button>
          {/* History */}
          <button
            onClick={() => setShowHistory(true)}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border ${isDarkMode ? 'bg-dark-surface border-dark-border text-slate-400 hover:text-primary' : 'bg-white border-slate-300 text-slate-600 hover:text-primary'}`}
          >
            <History size={14} />
          </button>
        </div>
      </div>

      {/* ── Toolbar (Enterprise bar — spans full width) ── */}
      <header className={`col-span-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl border ${borderCol} ${isDarkMode ? 'bg-gradient-to-b from-white/[0.03] to-white/[0.015]' : 'bg-gradient-to-b from-white to-slate-50/80'} shadow-lg ${isDarkMode ? 'shadow-black/30' : 'shadow-slate-200/60'}`}>
        {/* Left: Toggle + Stats */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className={`p-2 rounded-xl border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400 hover:text-primary' : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-primary'}`}
            title={sidebarCollapsed ? 'Mostrar sidebar' : 'Ocultar sidebar'}
          >
            {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {/* Stats Chips */}
          {view === 'day' && (
            <div className="hidden lg:flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${isDarkMode ? 'border-dark-border bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <strong className={textMain}>{todayStats.total}</strong>
                <span className={textSub}>agendamento{todayStats.total !== 1 ? 's' : ''}</span>
              </div>
              {todayStats.revenue > 0 && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${isDarkMode ? 'border-dark-border bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                  <span className="text-emerald-400 font-semibold">R$</span>
                  <strong className={textMain}>{todayStats.revenue.toFixed(0)}</strong>
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${isDarkMode ? 'border-dark-border bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <strong className={textMain}>{todayStats.barbers}</strong>
                <span className={textSub}>profissiona{todayStats.barbers !== 1 ? 'is' : 'l'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Search + View + Filter */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Search */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border min-w-[220px] ${isDarkMode ? 'border-dark-border bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <Search size={14} className={textSub} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, servico..."
              className={`flex-1 bg-transparent outline-none text-xs font-semibold ${textMain} placeholder:${textSub}`}
            />
          </div>

          {/* View Switcher */}
          <div className={`flex items-center rounded-xl border overflow-hidden ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-white'}`}>
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-xs font-bold transition-colors
                  ${view === v
                    ? (isDarkMode ? 'bg-primary/12 text-white' : 'bg-primary text-white')
                    : `${textSub} hover:${textMain}`
                  }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Barber Filter */}
          {view === 'day' && activeBarbers.length > 1 && (
            <AgendaDropdown
              value={barberFilter}
              onChange={setBarberFilter}
              options={[
                { value: 'all', label: 'Todos', icon: <Users size={13} /> },
                ...activeBarbers.map(b => ({ value: b.id, label: b.name.split(' ')[0], icon: <User size={13} /> }))
              ]}
              icon={<User size={14} />}
              isDarkMode={isDarkMode}
              className="min-w-[140px]"
            />
          )}
        </div>
      </header>

      {/* ── Sidebar (Aside) ── */}
      {!sidebarCollapsed && (
        <aside style={{ gridRow: '3', gridColumn: '1' }} className={`rounded-2xl border ${borderCol} overflow-hidden flex flex-col min-h-0 ${isDarkMode ? 'bg-gradient-to-b from-white/[0.02] to-white/[0.01]' : 'bg-white'} shadow-lg ${isDarkMode ? 'shadow-black/30' : 'shadow-slate-200/60'}`}>
          {/* Aside Header */}
          <div className={`px-4 py-3 border-b ${borderCol} flex items-center justify-between`}>
            <h2 className={`text-sm font-bold ${textSub} tracking-wide`}>Operacao</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${isDarkMode ? 'border-dark-border bg-black/25 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              Hoje
            </span>
          </div>

          {/* Mini Calendar */}
          <div className={`px-4 py-3 border-b ${borderCol}`}>
            <div className="flex items-center justify-between mb-2.5">
              <span className={`font-bold text-sm ${textMain}`}>
                {monthNames[sidebarCalDate.getMonth()]} {sidebarCalDate.getFullYear()}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSidebarCalDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; })}
                  className={`p-1.5 rounded-lg border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setSidebarCalDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; })}
                  className={`p-1.5 rounded-lg border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(d => (
                <div key={d} className={`text-center text-[11px] font-semibold py-1 ${textSub}`}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {buildMiniCalendar.map((cell, i) => {
                const isSelected = isSameDay(cell.date, currentDate);
                const isToday = isSameDay(cell.date, new Date());
                const eventKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                const hasEvents = (eventCountByDay[eventKey] || 0) > 0;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentDate(cell.date);
                      if (view !== 'day') setView('day');
                    }}
                    className={`relative py-1.5 rounded-lg text-xs font-bold transition-all text-center
                      ${!cell.inMonth ? 'opacity-30' : ''}
                      ${isSelected
                        ? 'bg-primary text-white shadow-md shadow-primary/30 scale-105'
                        : isToday
                          ? `ring-1 ${isDarkMode ? 'ring-primary/50 text-primary bg-primary/10' : 'ring-primary/40 text-primary bg-primary/5'}`
                          : `${isDarkMode ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-700 hover:bg-slate-100'}`
                      }
                    `}
                  >
                    {cell.day}
                    {/* Event dot */}
                    {hasEvents && !isSelected && (
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                    {/* Today indicator — always visible even when another day is selected */}
                    {isToday && !isSelected && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-0.5 rounded-full bg-primary/60" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className={`px-4 py-3 space-y-2.5`}>
            <div>
              <div className={`text-[11px] font-semibold ${textSub} mb-1.5`}>Status</div>
              <AgendaDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label, dot: s.color }))
                ]}
                isDarkMode={isDarkMode}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className={`text-[11px] font-semibold ${textSub} mb-1.5`}>Servico</div>
                <AgendaDropdown
                  value={serviceFilter}
                  onChange={setServiceFilter}
                  options={[
                    { value: 'all', label: 'Todos' },
                    ...services.filter(s => s.active).map(s => ({ value: s.id, label: s.name, icon: <Scissors size={12} /> }))
                  ]}
                  isDarkMode={isDarkMode}
                />
              </div>
              <div>
                <div className={`text-[11px] font-semibold ${textSub} mb-1.5`}>Profissional</div>
                <AgendaDropdown
                  value={barberFilter}
                  onChange={setBarberFilter}
                  options={[
                    { value: 'all', label: 'Todos', icon: <Users size={12} /> },
                    ...activeBarbers.map(b => ({ value: b.id, label: b.name.split(' ')[0], icon: <User size={12} /> }))
                  ]}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          </div>

        </aside>
      )}

      {/* ── Main Content (Calendar Grid) ── */}
      <div style={{ gridRow: '3', gridColumn: sidebarCollapsed ? '1' : '2' }} className={`rounded-2xl border ${borderCol} overflow-hidden flex flex-col min-h-0 ${isDarkMode ? 'bg-gradient-to-b from-white/[0.02] to-white/[0.01]' : 'bg-white'} shadow-lg ${isDarkMode ? 'shadow-black/30' : 'shadow-slate-200/60'}`}>
        {/* Main Top Bar (Day nav + controls) */}
        <div className={`px-3 py-2.5 border-b ${borderCol} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2">
            {/* Date Nav */}
            <div className="flex items-center gap-1.5">
              <button onClick={handlePrev} className={`p-2 rounded-xl border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`}>
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleReset}
                className={`px-3.5 py-2 rounded-xl border font-extrabold text-xs min-w-[110px] text-center transition-colors ${isDarkMode ? 'border-dark-border bg-white/[0.02] text-white' : 'border-slate-200 bg-white text-slate-800'}`}
              >
                {view === 'day' ? formatNavDate(currentDate) :
                  view === 'month' ? monthNames[currentDate.getMonth()] : 'Semana'}
              </button>
              <button onClick={handleNext} className={`p-2 rounded-xl border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Day Stats Chip */}
            {view === 'day' && todayStats.total > 0 && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${isDarkMode ? 'border-dark-border bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <strong className={textMain}>{todayStats.total}</strong>
                <span className={textSub}>•</span>
                <span className="text-emerald-400 font-semibold">R$</span>
                <strong className={textMain}>{todayStats.revenue.toFixed(0)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'month' ? renderMonthView() : view === 'week' ? renderWeekView() : renderDayView()}
        </div>
      </div>

      {/* ── History Modal ── */}
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Historico de Agendamentos"
        items={events.map(eventToHistoryItem)}
        members={members}
        isDarkMode={isDarkMode}
        itemType="event"
      />

      {/* ── Settings Modal (Floating) ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${bgCard} border ${borderCol} rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]`}>
            {/* Header */}
            <div className={`px-5 py-4 border-b ${borderCol} flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-primary/10' : 'bg-primary/5'}`}>
                  <Settings2 size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${textMain}`}>Configuracoes</h3>
                  <p className={`text-[11px] ${textSub}`}>Personalize sua agenda</p>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className={`p-2 rounded-xl border transition-colors ${isDarkMode ? 'border-dark-border hover:bg-dark text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">

              {/* ══ Section: Horario ══ */}
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-primary" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textSub}`}>Horario de Funcionamento</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Inicio</label>
                    <CustomDropdown value={String(agendaSettings.startHour)} onChange={v => setAgendaSettings(prev => ({ ...prev, startHour: Number(v) }))} options={Array.from({ length: 12 }, (_, i) => i + 5).map(h => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))} isDarkMode={isDarkMode} />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Termino</label>
                    <CustomDropdown value={String(agendaSettings.endHour)} onChange={v => setAgendaSettings(prev => ({ ...prev, endHour: Number(v) }))} options={Array.from({ length: 12 }, (_, i) => i + 12).map(h => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))} isDarkMode={isDarkMode} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Intervalo</label>
                    <CustomDropdown value={String(agendaSettings.slotInterval)} onChange={v => setAgendaSettings(prev => ({ ...prev, slotInterval: Number(v) as 15 | 30 | 60 }))} options={[{ value: '15', label: '15 min' }, { value: '30', label: '30 min' }, { value: '60', label: '60 min' }]} isDarkMode={isDarkMode} />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Buffer</label>
                    <CustomDropdown value={String(agendaSettings.bufferMinutes)} onChange={v => setAgendaSettings(prev => ({ ...prev, bufferMinutes: Number(v) }))} options={[{ value: '0', label: 'Sem' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }]} isDarkMode={isDarkMode} />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Duracao padrao</label>
                    <CustomDropdown value={String(agendaSettings.defaultDuration)} onChange={v => setAgendaSettings(prev => ({ ...prev, defaultDuration: Number(v) }))} options={[{ value: '30', label: '30 min' }, { value: '45', label: '45 min' }, { value: '60', label: '60 min' }, { value: '90', label: '90 min' }]} isDarkMode={isDarkMode} />
                  </div>
                </div>
              </div>

              {/* ══ Section: Regras ══ */}
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} className="text-primary" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textSub}`}>Regras de Agendamento</h4>
                </div>
                <div className="space-y-1.5">
                  {[
                    { key: 'requireService' as const, label: 'Exigir servico', desc: 'Obrigar escolha de servico', icon: <Scissors size={13} /> },
                    { key: 'requireClient' as const, label: 'Exigir cliente', desc: 'Obrigar nome do cliente', icon: <User size={13} /> },
                    { key: 'allowOverbooking' as const, label: 'Permitir overbooking', desc: 'Dois agendamentos no mesmo horario', icon: <AlertCircle size={13} /> },
                    { key: 'autoAssignBarber' as const, label: 'Auto-atribuir profissional', desc: 'Selecionar profissional automaticamente', icon: <Zap size={13} /> },
                  ].map(item => (
                    <label key={item.key} className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isDarkMode ? 'border-dark-border/60 hover:border-primary/30 hover:bg-primary/5' : 'border-slate-200 hover:border-primary/20 hover:bg-primary/5'}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={textSub}>{item.icon}</span>
                        <div>
                          <div className={`text-sm font-semibold ${textMain}`}>{item.label}</div>
                          <div className={`text-[10px] ${textSub}`}>{item.desc}</div>
                        </div>
                      </div>
                      <div className="relative shrink-0 ml-3">
                        <input type="checkbox" className="sr-only peer" checked={agendaSettings[item.key]} onChange={e => setAgendaSettings(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                        <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-slate-300 dark:bg-dark-border" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ══ Section: Visual & Inteligencia ══ */}
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid size={14} className="text-primary" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textSub}`}>Visual & Comportamento</h4>
                </div>
                <div className="space-y-1.5">
                  {[
                    { key: 'showBreakTime' as const, label: 'Mostrar intervalos', desc: 'Exibir horario de pausa no grid', icon: <Clock size={13} /> },
                    { key: 'showOffDays' as const, label: 'Mostrar folgas', desc: 'Overlay de dia de folga', icon: <Eye size={13} /> },
                    { key: 'compactView' as const, label: 'Visualizacao compacta', desc: 'Slots menores para ver mais horarios', icon: <LayoutGrid size={13} /> },
                    { key: 'colorByStatus' as const, label: 'Cor por status', desc: 'Colorir cards pelo status do atendimento', icon: <Palette size={13} /> },
                    { key: 'weekStartsOnMonday' as const, label: 'Semana na segunda', desc: 'Segunda-feira como primeiro dia', icon: <CalendarIcon size={13} /> },
                  ].map(item => (
                    <label key={item.key} className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isDarkMode ? 'border-dark-border/60 hover:border-primary/30 hover:bg-primary/5' : 'border-slate-200 hover:border-primary/20 hover:bg-primary/5'}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={textSub}>{item.icon}</span>
                        <div>
                          <div className={`text-sm font-semibold ${textMain}`}>{item.label}</div>
                          <div className={`text-[10px] ${textSub}`}>{item.desc}</div>
                        </div>
                      </div>
                      <div className="relative shrink-0 ml-3">
                        <input type="checkbox" className="sr-only peer" checked={agendaSettings[item.key]} onChange={e => setAgendaSettings(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                        <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-slate-300 dark:bg-dark-border" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ══ Section: Notificacoes ══ */}
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={14} className="text-primary" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textSub}`}>Notificacoes & Lembretes</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-[11px] font-medium ${textSub} mb-1 flex items-center gap-1`}>
                      <Timer size={11} /> Lembrete automatico
                    </label>
                    <CustomDropdown value={String(agendaSettings.reminderMinutes)} onChange={v => setAgendaSettings(prev => ({ ...prev, reminderMinutes: Number(v) }))} options={[{ value: '0', label: 'Desabilitado' }, { value: '15', label: '15 min antes' }, { value: '30', label: '30 min antes' }, { value: '60', label: '1 hora antes' }, { value: '120', label: '2 horas antes' }]} isDarkMode={isDarkMode} />
                  </div>
                  <label className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isDarkMode ? 'border-dark-border/60 hover:border-primary/30 hover:bg-primary/5' : 'border-slate-200 hover:border-primary/20 hover:bg-primary/5'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={textSub}><MessageCircle size={13} /></span>
                      <div>
                        <div className={`text-sm font-semibold ${textMain}`}>Lembrete via WhatsApp</div>
                        <div className={`text-[10px] ${textSub}`}>Enviar lembrete automatico ao cliente</div>
                      </div>
                    </div>
                    <div className="relative shrink-0 ml-3">
                      <input type="checkbox" className="sr-only peer" checked={agendaSettings.whatsappReminder} onChange={e => setAgendaSettings(prev => ({ ...prev, whatsappReminder: e.target.checked }))} />
                      <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-slate-300 dark:bg-dark-border" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
                    </div>
                  </label>
                </div>
              </div>

              {/* ══ Section: Agendamento Online ══ */}
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-dark-border bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={14} className="text-primary" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textSub}`}>Agendamento Online</h4>
                </div>
                <div className="space-y-2.5">
                  <label className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isDarkMode ? 'border-dark-border/60 hover:border-primary/30 hover:bg-primary/5' : 'border-slate-200 hover:border-primary/20 hover:bg-primary/5'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={textSub}><Globe size={13} /></span>
                      <div>
                        <div className={`text-sm font-semibold ${textMain}`}>Habilitar agendamento online</div>
                        <div className={`text-[10px] ${textSub}`}>Clientes agendam pelo app/site</div>
                      </div>
                    </div>
                    <div className="relative shrink-0 ml-3">
                      <input type="checkbox" className="sr-only peer" checked={agendaSettings.onlineBooking.enabled} onChange={e => setAgendaSettings(prev => ({ ...prev, onlineBooking: { ...prev.onlineBooking, enabled: e.target.checked } }))} />
                      <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-slate-300 dark:bg-dark-border" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
                    </div>
                  </label>

                  {agendaSettings.onlineBooking.enabled && (
                    <>
                      <label className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isDarkMode ? 'border-dark-border/60 hover:border-primary/30 hover:bg-primary/5' : 'border-slate-200 hover:border-primary/20 hover:bg-primary/5'}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={textSub}><CheckCircle2 size={13} /></span>
                          <div>
                            <div className={`text-sm font-semibold ${textMain}`}>Confirmacao automatica</div>
                            <div className={`text-[10px] ${textSub}`}>Confirmar agendamentos online automaticamente</div>
                          </div>
                        </div>
                        <div className="relative shrink-0 ml-3">
                          <input type="checkbox" className="sr-only peer" checked={agendaSettings.autoConfirmOnline} onChange={e => setAgendaSettings(prev => ({ ...prev, autoConfirmOnline: e.target.checked }))} />
                          <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-slate-300 dark:bg-dark-border" />
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
                        </div>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Antecedencia</label>
                          <CustomDropdown value={String(agendaSettings.onlineBooking.leadTimeMinutes)} onChange={v => setAgendaSettings(prev => ({ ...prev, onlineBooking: { ...prev.onlineBooking, leadTimeMinutes: Number(v) } }))} options={[{ value: '30', label: '30 min' }, { value: '60', label: '1 hora' }, { value: '120', label: '2 horas' }, { value: '240', label: '4 horas' }]} isDarkMode={isDarkMode} />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Agendar ate</label>
                          <CustomDropdown value={String(agendaSettings.onlineBooking.maxAdvanceDays)} onChange={v => setAgendaSettings(prev => ({ ...prev, onlineBooking: { ...prev.onlineBooking, maxAdvanceDays: Number(v) } }))} options={[{ value: '7', label: '7 dias' }, { value: '14', label: '14 dias' }, { value: '30', label: '30 dias' }, { value: '60', label: '60 dias' }]} isDarkMode={isDarkMode} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] font-medium ${textSub} mb-1`}>Cancelamento</label>
                          <CustomDropdown value={String(agendaSettings.onlineBooking.cancellationMinutes)} onChange={v => setAgendaSettings(prev => ({ ...prev, onlineBooking: { ...prev.onlineBooking, cancellationMinutes: Number(v) } }))} options={[{ value: '60', label: '1h antes' }, { value: '120', label: '2h antes' }, { value: '240', label: '4h antes' }, { value: '1440', label: '24h antes' }]} isDarkMode={isDarkMode} />
                        </div>
                        <div className="flex items-end pb-0.5">
                          <label className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer w-full ${isDarkMode ? 'border-dark-border' : 'border-slate-200'}`}>
                            <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" checked={agendaSettings.onlineBooking.requireDeposit} onChange={e => setAgendaSettings(prev => ({ ...prev, onlineBooking: { ...prev.onlineBooking, requireDeposit: e.target.checked } }))} />
                            <span className={`text-xs font-medium ${textMain}`}>Exigir sinal</span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — pinned */}
            <div className={`px-5 py-4 border-t ${borderCol} shrink-0 flex gap-3`}>
              <button
                onClick={() => setShowSettings(false)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm border transition-colors ${isDarkMode ? 'border-dark-border text-slate-400 hover:bg-dark' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setSavingSettings(true);
                  const result = await saveAppSettings('agenda', agendaSettings);
                  setSavingSettings(false);
                  if (result.success) {
                    toast.success('Configuracoes salvas');
                    setShowSettings(false);
                  } else {
                    toast.error('Erro ao salvar', result.error || '');
                  }
                }}
                disabled={savingSettings}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingSettings && <Loader2 size={14} className="animate-spin" />}
                Salvar Configuracoes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};