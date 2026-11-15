import { useMemo, useState } from 'react';
import { formatDayMonth, formatTime, formatWeekday, groupByDay } from '../lib/format';
import type { Slot } from '../types';
import { Card } from './Card';

interface Props {
  loading: boolean;
  hasKey: boolean;
  error?: string;
  slots: Slot[];
  selectedId?: string;
  onSelect: (slot: Slot) => void;
}

const chip = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
    active
      ? 'border-brand bg-brand text-white'
      : 'border-slate-200 hover:border-brand dark:border-slate-700 dark:hover:border-brand'
  }`;

export function SlotPicker({ loading, hasKey, error, slots, selectedId, onSelect }: Props) {
  const [provider, setProvider] = useState('all');
  const [dayChoice, setDayChoice] = useState('');

  const providers = useMemo(() => [...new Set(slots.map((s) => s.provider))].sort(), [slots]);
  const activeProvider = providers.includes(provider) ? provider : 'all';
  const filtered = useMemo(
    () => (activeProvider === 'all' ? slots : slots.filter((s) => s.provider === activeProvider)),
    [slots, activeProvider],
  );
  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const activeDay = days.find((d) => d.key === dayChoice) ?? days[0];

  const message = !hasKey
    ? 'Enter your API key to load available times.'
    : error
      ? error
      : loading && slots.length === 0
        ? 'Loading available times…'
        : slots.length === 0
          ? 'No upcoming slots right now.'
          : '';

  return (
    <Card title="Select a date & time">
      {message ? (
        <p role="status" className={error && hasKey ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}>
          {message}
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by provider">
            <button type="button" aria-pressed={activeProvider === 'all'} onClick={() => setProvider('all')} className={chip(activeProvider === 'all')}>
              All providers
            </button>
            {providers.map((p) => (
              <button key={p} type="button" aria-pressed={activeProvider === p} onClick={() => setProvider(p)} className={chip(activeProvider === p)}>
                {p}
              </button>
            ))}
          </div>

          <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Choose a day">
            {days.map((day) => {
              const open = day.slots.filter((s) => s.available).length;
              const active = day.key === activeDay?.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDayChoice(day.key)}
                  className={`flex w-20 shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 transition ${
                    active ? 'border-brand bg-brand text-white' : 'border-slate-200 hover:border-brand dark:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-medium opacity-80">{formatWeekday(day.first)}</span>
                  <span className="text-base font-bold">{formatDayMonth(day.first)}</span>
                  <span className={`text-xs ${active ? 'opacity-90' : 'text-slate-600 dark:text-slate-300'}`}>{open} open</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {activeDay?.slots.map((slot) => {
              const selected = slot.id === selectedId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!slot.available}
                  aria-pressed={selected}
                  onClick={() => onSelect(slot)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-left transition',
                    selected
                      ? 'border-brand bg-brand-50 ring-2 ring-brand dark:bg-brand/15'
                      : 'border-slate-200 hover:border-brand dark:border-slate-700',
                    slot.available ? '' : 'cursor-not-allowed bg-slate-50 opacity-50 dark:bg-slate-800/50',
                  ].join(' ')}
                >
                  <span className={`block font-bold ${slot.available ? '' : 'line-through'}`}>{formatTime(slot.start)}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">
                    {slot.available ? slot.provider : 'Booked'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
