// ── Agenda Shared Helpers & Constants ───────────────────────────
// Extracted from Agenda.tsx for modular reuse across sub-components

export const SLOT_INTERVAL = 30; // minutes per slot (enterprise: 30min for barbershop)

export const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500' },
  { value: 'arrived', label: 'Chegou', color: 'bg-amber-500' },
  { value: 'in_service', label: 'Em Atendimento', color: 'bg-blue-500' },
  { value: 'completed', label: 'Concluído', color: 'bg-slate-400' },
  { value: 'no_show', label: 'Não Compareceu', color: 'bg-red-500' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-slate-300' },
];

// Build time options for selects (parametrized by start/end hours)
export const buildTimeOptions = (startHour: number, endHour: number): string[] => {
  const opts: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
};

// Build hour labels (parametrized by start/end hours)
export const buildHourLabels = (startHour: number, endHour: number): string[] => {
  const labels: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
  return labels;
};

export const getMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const addMinutes = (time: string, mins: number): string => {
  const total = getMinutes(time) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatNavDate = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');

export const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
