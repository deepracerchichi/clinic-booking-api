import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { formatDay, formatRange } from '../lib/format';
import type { Booking, Slot } from '../types';
import { Card } from './Card';
import { CheckIcon } from './icons';

interface Props {
  apiKey: string;
  booking: Booking;
  slot?: Slot;
  onChange: (booking: Booking) => void;
  onBookAnother: () => void;
}

export function Confirmation({ apiKey, booking, slot, onChange, onBookAnother }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const confirmed = booking.status === 'confirmed';

  async function cancel() {
    setCancelling(true);
    setError('');
    try {
      onChange(await api.cancelBooking(apiKey.trim(), booking.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  }

  const rows: Array<[string, string]> = [
    ['Provider', slot?.provider ?? '—'],
    ['When', slot ? `${formatDay(slot.start)}, ${formatRange(slot)}` : booking.slot_id],
    ['Name', booking.name],
    ['Email', booking.email],
    ['Booking ID', booking.id],
  ];

  return (
    <Card>
      <p className="mb-4 hidden text-center text-lg font-extrabold print:block">Clinic Booking · Appointment receipt</p>
      <div className="mb-4 flex flex-col items-center text-center">
        <span
          className={`mb-3 grid size-14 place-items-center rounded-full text-white ${confirmed ? 'bg-brand' : 'bg-slate-400'}`}
        >
          <CheckIcon width={28} height={28} strokeWidth={3} />
        </span>
        <h2 className="text-xl font-bold">{confirmed ? 'Booking confirmed' : 'Booking cancelled'}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {confirmed ? 'Keep your booking ID in case you need to cancel.' : 'The time is free for someone else now.'}
        </p>
      </div>

      <dl className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
            <dd className="break-all text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-slate-300 py-2.5 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Print receipt
        </button>
        {confirmed && (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="rounded-xl border border-slate-300 py-2.5 font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {cancelling ? 'Cancelling…' : 'Cancel this booking'}
          </button>
        )}
        <button type="button" onClick={onBookAnother} className="rounded-xl bg-brand py-2.5 font-bold text-white hover:bg-brand-dark">
          Book another appointment
        </button>
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-red-600 print:hidden dark:text-red-400">{error}</p>
    </Card>
  );
}
