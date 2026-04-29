import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Lock, User, Plus, CheckCircle2, Crown, Clock
} from 'lucide-react';
import { CalendarEvent } from '../../types';
import { getMinutes, STATUS_OPTIONS } from './agendaHelpers';

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
const STATUS_STYLES: Record<string, { border: string; text: string }> = {
  confirmed:  { border: 'border-emerald-500/50', text: 'text-emerald-400' },
  arrived:    { border: 'border-amber-500/50',   text: 'text-amber-400' },
  in_service: { border: 'border-blue-500/50',    text: 'text-blue-400' },
  completed:  { border: 'border-slate-500/50',   text: 'text-slate-400' },
  no_show:    { border: 'border-red-500/50',     text: 'text-red-400' },
  cancelled:  { border: 'border-slate-600/50',   text: 'text-slate-500 line-through' },
};

const DEFAULT_STATUS = { border: 'border-emerald-500/50', text: 'text-emerald-400' };

// ── Draggable Card ─────────────────────────────────────────────
export const DraggableCard: React.FC<{
  event: CalendarEvent;
  isDarkMode: boolean;
  slotStartMin: number;
  onClick: () => void;
  onStatusChange?: (eventId: string, newStatus: string) => void;
  slotHeight: number;
  hourHeight: number;
  isSubscriber?: boolean;
  planName?: string;
}> = ({ event, isDarkMode, slotStartMin, onClick, onStatusChange, slotHeight, hourHeight, isSubscriber, planName }) => {
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

  const statusStyle = isBlocked
    ? { border: 'border-border border-dashed', text: 'text-muted-foreground' }
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isBlocked ? {} : listeners)}
      {...(isBlocked ? {} : attributes)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onContextMenu={(e) => {
        if (!isBlocked && onStatusChange) {
          e.preventDefault();
          e.stopPropagation();
          setShowStatusMenu(prev => !prev);
        }
      }}
      className={`rounded-md border px-3 py-2 bg-card ${statusStyle.border} ${statusStyle.text} text-xs font-semibold overflow-hidden select-none hover:z-20 transition-all`}
    >
      {/* Line 1: Grip + Service/Title */}
      <div className="flex items-center gap-1.5">
        {isBlocked ? <Lock size={12} /> : <GripVertical size={12} />}
        <span className="truncate flex-1">
          {event.client
            ? (event.serviceName || event.title?.replace(`${event.client} - `, '').replace(` - ${event.client}`, '') || event.title)
            : event.title}
        </span>
        {event.source && event.source !== 'manual' && (
          <span className="px-1 py-px rounded text-[9px] font-bold uppercase opacity-60 shrink-0">
            {event.source === 'app' ? 'APP' : 'Web'}
          </span>
        )}
        {isSubscriber && <Crown size={11} className="text-amber-400 shrink-0" />}
      </div>

      {/* Line 2: Time */}
      <div className="text-[11px] opacity-60 mt-0.5 flex items-center gap-1">
        <Clock size={10} />
        {event.startTime} - {event.endTime}
      </div>

      {/* Line 3: Client */}
      {!isBlocked && event.client && (
        <div className="text-[11px] opacity-50 flex items-center gap-1 mt-0.5">
          <User size={10} />{event.client}
        </div>
      )}

      {/* Line 4: Observation (long slots) */}
      {duration >= 60 && event.observation && (
        <div className="text-[9px] italic opacity-30 truncate mt-0.5">
          {event.observation}
        </div>
      )}

      {/* Status context menu (right-click) */}
      {showStatusMenu && onStatusChange && (
        <div
          className="absolute top-full left-0 mt-1 z-[60] w-36 rounded-lg border shadow-md py-1 bg-card border-border"
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
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-muted ${event.status === opt.value ? 'font-bold' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full ${opt.color}`} />
              <span className="text-foreground">{opt.label}</span>
              {event.status === opt.value && <CheckCircle2 size={10} className="ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
