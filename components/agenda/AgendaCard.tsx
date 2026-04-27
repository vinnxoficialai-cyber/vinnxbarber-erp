import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Lock, User, Scissors, Plus, CheckCircle2, Crown
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

      {/* Client row + Subscriber badge */}
      {!isBlocked && event.client && (
        <div className={`text-[11px] flex items-center gap-1.5 mt-1 font-medium ${textClass} ${isDarkMode ? 'opacity-55' : 'opacity-50'}`}>
          <User size={10} className="shrink-0" /> <span className="truncate">{event.client}</span>
          {isSubscriber && (
            <span className={`ml-auto shrink-0 px-1.5 py-px rounded-full text-[9px] font-bold flex items-center gap-0.5 ${isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-500/10 text-amber-600'}`} title={planName || 'Assinante'}>
              <Crown size={8} /> Assinante
            </span>
          )}
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
