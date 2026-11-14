import { FormEvent, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { formatDay, formatRange, initials, isValidEmail } from '../lib/format';
import type { Booking, Slot } from '../types';
import { Card } from './Card';
import { CalendarIcon, ClockIcon } from './icons';

interface Props {
  apiKey: string;
  slot: Slot;
  onBooked: (booking: Booking) => void;
  /** The slot was taken by someone else: the parent should refresh and clear the selection. */
  onSlotTaken: () => void;
}

const inputClass = 'w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700';
const labelClass = 'mb-1.5 block text-sm font-semibold';

export function BookingForm({ apiKey, slot, onBooked, onSlotTaken }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // One Idempotency-Key per logical request (same slot + same details). A double-click or a
  // retry after a network error reuses it, so the server can never create a second booking.
  const attempt = useRef<{ signature: string; key: string }>({ signature: '', key: '' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return setError('Please enter your name.');
    if (!isValidEmail(trimmedEmail)) return setError('Please enter a valid email address.');

    const signature = [slot.id, trimmedName, trimmedEmail.toLowerCase()].join('|');
    if (attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };

    setSubmitting(true);
    setError('');
    try {
      const booking = await api.createBooking(
        apiKey.trim(),
        { slot_id: slot.id, name: trimmedName, email: trimmedEmail },
        attempt.current.key,
      );
      onBooked(booking);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.status === 409) {
        setError('Sorry, that time was just taken. Please pick another.');
        onSlotTaken();
      } else if (e.status === 429) {
        setError(`Too many attempts. Try again in ${e.retryAfterSeconds ?? 'a few'} seconds.`);
      } else if (e.status === 0) {
        setError(`${e.message} Press confirm again; it will not double-book.`);
      } else {
        setError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Your appointment">
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-brand-50 p-3 dark:bg-brand/15">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand font-bold text-white">{initials(slot.provider)}</span>
        <div className="min-w-0 text-sm">
          <p className="font-bold">{slot.provider}</p>
          <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <CalendarIcon width={14} height={14} /> {formatDay(slot.start)}
          </p>
          <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <ClockIcon width={14} height={14} /> {formatRange(slot)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>Full name</label>
          <input id="name" autoComplete="name" placeholder="Ada Obi" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="ada@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand py-3 font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Booking…' : 'Confirm booking'}
        </button>
        <p role="status" className="min-h-5 text-sm text-red-600 dark:text-red-400">{error}</p>
      </form>
    </Card>
  );
}
