import type { Slot } from '../types';

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export const formatWeekday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
export const formatDayMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatRange = (slot: Pick<Slot, 'start' | 'end'>) => `${formatTime(slot.start)} – ${formatTime(slot.end)}`;

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export interface DayGroup {
  key: string; // local calendar date, e.g. 2026-12-10
  first: string; // an ISO time on that day, for formatting
  slots: Slot[];
}

/** Groups already-sorted slots by local calendar day, keeping order. */
export function groupByDay(slots: Slot[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const slot of slots) {
    const key = new Date(slot.start).toLocaleDateString('en-CA');
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.slots.push(slot);
    else groups.push({ key, first: slot.start, slots: [slot] });
  }
  return groups;
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
