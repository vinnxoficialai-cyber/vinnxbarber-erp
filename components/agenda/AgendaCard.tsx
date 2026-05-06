import React, { useState, useRef, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Lock, User, Plus, CheckCircle2, Crown, Clock, Scissors,
  UserCheck, Play, XCircle, UserX, Pencil, Trash2, Merge, Search
} from 'lucide-react';
import { CalendarEvent, Service } from '../../types';
import { getMinutes } from './agendaHelpers';

// ── Droppable Slot ─────────────────────────────────────────────
export const DroppableSlot: React.FC<{
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
          ? 'bg-primary/15'
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

// ── Status-driven border + text colors ─────────────────────────
const STATUS_STYLES: Record<string, { border: string; text: string; borderLight: string }> = {
  confirmed:  { border: 'border-emerald-500/50', text: 'text-emerald-400', borderLight: 'border-emerald-500/20' },
  arrived:    { border: 'border-amber-500/50',   text: 'text-amber-400',   borderLight: 'border-amber-500/20' },
  in_service: { border: 'border-blue-500/50',    text: 'text-blue-400',    borderLight: 'border-blue-500/20' },
  completed:  { border: 'border-slate-500/50',   text: 'text-slate-400',   borderLight: 'border-slate-500/20' },
  no_show:    { border: 'border-red-500/50',     text: 'text-red-400',     borderLight: 'border-red-500/20' },
  cancelled:  { border: 'border-slate-600/50',   text: 'text-slate-500 line-through', borderLight: 'border-slate-600/20' },
};

const DEFAULT_STATUS = { border: 'border-emerald-500/50', text: 'text-emerald-400', borderLight: 'border-emerald-500/20' };

// ── Context Menu Actions ───────────────────────────────────────
interface ContextAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  separator?: boolean;
}

const buildContextActions = (event: CalendarEvent, hasGroupId: boolean): ContextAction[] => {
  const actions: ContextAction[] = [];
  const status = event.status || 'confirmed';

  // Status progression actions (only show relevant ones)
  if (status !== 'arrived' && status !== 'in_service' && status !== 'completed' && status !== 'cancelled' && status !== 'no_show') {
    actions.push({ id: 'arrived', label: 'Chegou', icon: <UserCheck size={13} />, color: 'text-amber-400' });
  }
  if (status !== 'in_service' && status !== 'completed' && status !== 'cancelled' && status !== 'no_show') {
    actions.push({ id: 'in_service', label: 'Iniciar Atendimento', icon: <Play size={13} />, color: 'text-blue-400' });
  }
  if (status !== 'completed' && status !== 'cancelled' && status !== 'no_show') {
    actions.push({ id: 'completed', label: 'Concluir', icon: <CheckCircle2 size={13} />, color: 'text-emerald-400' });
  }

  // Separator
  if (actions.length > 0) {
    actions.push({ id: '_sep1', label: '', icon: null, color: '', separator: true });
  }

  // Negative actions
  if (status !== 'no_show' && status !== 'cancelled' && status !== 'completed') {
    actions.push({ id: 'no_show', label: 'Não Compareceu', icon: <UserX size={13} />, color: 'text-red-400' });
  }
  if (status !== 'cancelled') {
    actions.push({ id: 'cancelled', label: 'Cancelar', icon: <XCircle size={13} />, color: 'text-slate-400' });
  }

  // Separator
  actions.push({ id: '_sep2', label: '', icon: null, color: '', separator: true });

  // Merge option (only for grouped events)
  if (hasGroupId) {
    actions.push({ id: 'merge', label: 'Reagrupar Serviços', icon: <Merge size={13} />, color: 'text-primary' });
  }

  // Edit & Delete
  actions.push({ id: 'edit', label: 'Editar', icon: <Pencil size={13} />, color: 'text-foreground' });
  actions.push({ id: 'delete', label: 'Excluir', icon: <Trash2 size={13} />, color: 'text-red-400' });

  return actions;
};

// ── Draggable Service Slot (sub-card for individual service drag) ──
export const DraggableServiceSlot: React.FC<{
  eventId: string;
  slotIndex: number;
  serviceName: string;
  statusStyle: { border: string; text: string; borderLight: string };
  hasMultipleSlots: boolean;
}> = ({ eventId, slotIndex, serviceName, statusStyle, hasMultipleSlots }) => {
  const dragId = `service_${eventId}_${slotIndex}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    disabled: !hasMultipleSlots,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    cursor: hasMultipleSlots ? 'grab' : 'default',
    transition: isDragging ? 'none' : 'opacity 0.15s ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(hasMultipleSlots ? listeners : {})}
      {...(hasMultipleSlots ? attributes : {})}
      className={`flex-1 flex items-center gap-1.5 px-2 rounded border ${statusStyle.borderLight} bg-card/50 transition-colors hover:bg-muted/30 min-h-[24px]`}
      onClick={(e) => e.stopPropagation()}
    >
      {hasMultipleSlots && <GripVertical size={10} className="opacity-40 shrink-0" />}
      <Scissors size={9} className="opacity-40 shrink-0" />
      <span className="text-[10px] font-medium truncate">{serviceName}</span>
    </div>
  );
};

// ── Inline Add Service (transforms button into search + results) ──
const AddServiceInline: React.FC<{
  services: Service[];
  existingServiceIds: string[];
  borderStyle: string;
  onSelect: (serviceId: string) => void;
  onClose: () => void;
}> = ({ services, existingServiceIds, borderStyle, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay to prevent the click-to-open from immediately closing
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const filtered = services.filter(s =>
    s.active &&
    !existingServiceIds.includes(s.id) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Search input — replaces the "+ Adicionar" button */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-t border ${borderStyle} bg-muted/20`}>
        <Search size={10} className="text-primary shrink-0 opacity-70" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="flex-1 text-[10px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground font-medium"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
      {/* Results list — flows directly from the search bar */}
      <div className={`border border-t-0 ${borderStyle} rounded-b bg-card/95 max-h-[140px] overflow-y-auto custom-scrollbar`}>
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-[9px] text-muted-foreground text-center opacity-60">
            Nenhum serviço encontrado
          </div>
        ) : (
          filtered.map(svc => (
            <button
              key={svc.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(svc.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-left px-2 py-1.5 text-[10px] flex items-center gap-1.5 transition-colors hover:bg-primary/10 border-b border-border/30 last:border-b-0"
            >
              <Scissors size={9} className="text-primary shrink-0 opacity-60" />
              <span className="text-foreground font-medium truncate flex-1">{svc.name}</span>
              <span className="text-muted-foreground text-[8px] shrink-0 opacity-60">{svc.duration || 30}min</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ── Draggable Card (main appointment card) ─────────────────────
export const DraggableCard: React.FC<{
  event: CalendarEvent;
  isDarkMode: boolean;
  slotStartMin: number;
  onClick: () => void;
  onStatusChange?: (eventId: string, newStatus: string) => void;
  onEdit?: () => void;
  onDelete?: (eventId: string) => void;
  onMerge?: (groupId: string) => void;
  onAddService?: (eventId: string, serviceId: string) => void;
  services?: Service[];
  slotHeight: number;
  hourHeight: number;
  isSubscriber?: boolean;
  planName?: string;
}> = ({ event, isDarkMode, slotStartMin, onClick, onStatusChange, onEdit, onDelete, onMerge, onAddService, services = [], slotHeight, hourHeight, isSubscriber, planName }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isBlocked = event.type === 'blocked';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: isBlocked,
  });

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const startMin = getMinutes(event.startTime);
  const endMin = getMinutes(event.endTime);
  const duration = endMin - startMin;
  const dayStartMin = slotStartMin;
  const topPx = ((startMin - dayStartMin) / 60) * hourHeight;
  const heightPx = Math.max((duration / 60) * hourHeight, slotHeight);

  const statusStyle = isBlocked
    ? { border: 'border-border border-dashed', text: 'text-muted-foreground', borderLight: 'border-border' }
    : STATUS_STYLES[event.status || 'confirmed'] || DEFAULT_STATUS;

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: '3px',
    right: '3px',
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.25 : 1,
    cursor: isBlocked ? 'default' : 'grab',
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
  };

  // Parse service info
  const serviceSlots = event.serviceSlots && event.serviceSlots.length > 0 ? event.serviceSlots : null;
  const hasMultipleServices = serviceSlots ? serviceSlots.length > 1 : false;
  const serviceName = event.serviceName || event.title?.replace(`${event.client} - `, '').replace(` - ${event.client}`, '') || event.title;
  const hasGroupId = !!event.groupId;
  const existingServiceIds = event.serviceIds || (event.serviceId ? [event.serviceId] : []);

  // Can add service: not blocked, not cancelled/completed, not in_service
  const canAddService = !isBlocked && event.status !== 'cancelled' && event.status !== 'completed' && event.status !== 'in_service' && onAddService;

  // Any popover open?
  const hasPopover = !!(contextMenu || showAddService);

  // Context menu action handler
  const handleContextAction = (actionId: string) => {
    setContextMenu(null);
    switch (actionId) {
      case 'edit':
        onEdit?.();
        break;
      case 'delete':
        onDelete?.(event.id);
        break;
      case 'merge':
        if (hasGroupId) onMerge?.(event.groupId!);
        break;
      default:
        // Status changes
        onStatusChange?.(event.id, actionId);
        break;
    }
  };

  const contextActions = buildContextActions(event, hasGroupId);

  // Compact mode: minimal info for short slots
  const isCompact = heightPx < 56;
  const isVeryCompact = heightPx < 40;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isBlocked ? {} : listeners)}
      {...(isBlocked ? {} : attributes)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onContextMenu={(e) => {
        if (!isBlocked) {
          e.preventDefault();
          e.stopPropagation();
          setShowAddService(false);
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }}
      className={`rounded-md border px-2.5 py-1.5 bg-card flex flex-col ${statusStyle.border} ${statusStyle.text} text-xs font-semibold ${hasPopover ? 'overflow-visible z-[35]' : 'overflow-hidden hover:z-20'} select-none transition-all group/card`}
    >
      {/* === LAYOUT === */}

      {isBlocked ? (
        /* Blocked slot — keep simple */
        <>
          <div className="flex items-center gap-1.5">
            <Lock size={12} />
            <span className="truncate flex-1">{event.title}</span>
          </div>
          <div className="text-[11px] opacity-60 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {event.startTime} - {event.endTime}
          </div>
        </>
      ) : (
        <>
          {/* Line 1: Client Name (prominent) + Source badge */}
          <div className="flex items-center gap-1.5">
            <GripVertical size={12} className="opacity-40 shrink-0" />
            <span className="truncate flex-1 font-bold text-[12px]">
              {event.client || serviceName}
            </span>
            {event.source && event.source !== 'manual' && (
              <span className="px-1 py-px rounded text-[8px] font-bold uppercase opacity-50 shrink-0 bg-muted/30">
                {event.source === 'app' ? 'APP' : 'Web'}
              </span>
            )}
            {isSubscriber && <Crown size={11} className="text-amber-400 shrink-0" />}
          </div>

          {/* Line 2: Time + User icon */}
          {!isVeryCompact && (
            <div className="text-[10px] opacity-50 mt-0.5 flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1">
                <Clock size={9} />
                {event.startTime} - {event.endTime}
              </span>
              {event.client && <User size={9} className="opacity-60" />}
            </div>
          )}

          {/* Service sub-cards */}
          {!isCompact && serviceSlots && serviceSlots.length > 0 ? (
            <div className="mt-1 flex-1 flex flex-col gap-1 relative min-h-0">
              {serviceSlots.map((ss: any, idx: number) => (
                <DraggableServiceSlot
                  key={idx}
                  eventId={event.id}
                  slotIndex={idx}
                  serviceName={ss.serviceName}
                  statusStyle={statusStyle}
                  hasMultipleSlots={hasMultipleServices}
                />
              ))}
              {/* + Add service: button or inline search */}
              {canAddService && !showAddService && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddService(true); setContextMenu(null); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex-1 w-full flex items-center justify-center gap-1 rounded border border-dashed ${statusStyle.borderLight} text-[9px] opacity-40 hover:opacity-70 transition-opacity min-h-[20px]`}
                >
                  <Plus size={9} />
                  <span>Adicionar serviço</span>
                </button>
              )}
              {showAddService && (
                <AddServiceInline
                  services={services}
                  existingServiceIds={existingServiceIds}
                  borderStyle={statusStyle.borderLight}
                  onSelect={(svcId) => { setShowAddService(false); onAddService?.(event.id, svcId); }}
                  onClose={() => setShowAddService(false)}
                />
              )}
            </div>
          ) : !isCompact && serviceName ? (
            /* Single service — show as sub-card + add */
            <div className="mt-1 flex-1 flex flex-col gap-1 relative min-h-0">
              <div className={`flex-1 flex items-center gap-1.5 px-2 rounded border ${statusStyle.borderLight} bg-card/50 min-h-[24px]`}>
                <Scissors size={9} className="opacity-40 shrink-0" />
                <span className="text-[10px] font-medium truncate">{serviceName}</span>
              </div>
              {/* + Add service: button or inline search */}
              {canAddService && !showAddService && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddService(true); setContextMenu(null); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex-1 w-full flex items-center justify-center gap-1 rounded border border-dashed ${statusStyle.borderLight} text-[9px] opacity-40 hover:opacity-70 transition-opacity min-h-[20px]`}
                >
                  <Plus size={9} />
                  <span>Adicionar serviço</span>
                </button>
              )}
              {showAddService && (
                <AddServiceInline
                  services={services}
                  existingServiceIds={existingServiceIds}
                  borderStyle={statusStyle.borderLight}
                  onSelect={(svcId) => { setShowAddService(false); onAddService?.(event.id, svcId); }}
                  onClose={() => setShowAddService(false)}
                />
              )}
            </div>
          ) : null}

          {/* Observation (for tall slots only) */}
          {duration >= 90 && event.observation && (
            <div className="text-[9px] italic opacity-25 truncate mt-1">
              {event.observation}
            </div>
          )}
        </>
      )}

      {/* === CONTEXT MENU (right-click) === */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="absolute z-[60] w-44 rounded-xl border shadow-xl py-1.5 bg-card border-border backdrop-blur-sm"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            transform: 'translateY(-4px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextActions.map(action =>
            action.separator ? (
              <div key={action.id} className="h-px mx-2 my-1 bg-border" />
            ) : (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextAction(action.id);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2.5 transition-colors hover:bg-muted rounded-lg mx-0.5`}
                style={{ width: 'calc(100% - 4px)' }}
              >
                <span className={action.color}>{action.icon}</span>
                <span className="text-foreground font-medium">{action.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
