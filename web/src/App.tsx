import { useState } from 'react';
import { ApiKeyInput } from './components/ApiKeyInput';
import { BookingForm } from './components/BookingForm';
import { Card } from './components/Card';
import { Confirmation } from './components/Confirmation';
import { PlusIcon } from './components/icons';
import { SlotPicker } from './components/SlotPicker';
import { Stepper } from './components/Stepper';
import { useApiKey } from './hooks/useApiKey';
import { useSlots } from './hooks/useSlots';
import type { Booking, Slot } from './types';

export function App() {
  const [apiKey, setApiKey] = useApiKey();
  const { state, reload } = useSlots(apiKey);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const slots = 'slots' in state ? state.slots : [];
  const bookedSlot = booking ? slots.find((s) => s.id === booking.slot_id) : undefined;
  const step = booking ? 3 : selected ? 2 : 1;
  const needsKeyAttention = apiKey.trim() === '' || state.status === 'error';

  function handleBooked(created: Booking) {
    setBooking(created);
    setSelected(null);
    void reload();
  }

  function handleBookingChanged(updated: Booking) {
    setBooking(updated);
    void reload(); // a cancelled booking frees its slot
  }

  function handleSlotTaken() {
    setSelected(null);
    void reload();
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <PlusIcon strokeWidth={3} />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-tight">Clinic Booking</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Book your appointment in under a minute</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <Stepper current={step} />
        <ApiKeyInput value={apiKey} onChange={setApiKey} needsAttention={needsKeyAttention} />

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <SlotPicker
            hasKey={apiKey.trim() !== ''}
            loading={state.status === 'loading'}
            error={state.status === 'error' ? state.message : undefined}
            slots={slots}
            selectedId={selected?.id}
            onSelect={(slot) => {
              setBooking(null);
              setSelected(slot);
            }}
          />

          <div className="lg:sticky lg:top-6">
            {booking ? (
              <Confirmation
                apiKey={apiKey}
                booking={booking}
                slot={bookedSlot}
                onChange={handleBookingChanged}
                onBookAnother={() => setBooking(null)}
              />
            ) : selected ? (
              // key resets the form (and its idempotency key) whenever a different slot is chosen
              <BookingForm key={selected.id} apiKey={apiKey} slot={selected} onBooked={handleBooked} onSlotTaken={handleSlotTaken} />
            ) : (
              <Card title="Your appointment">
                <p className="text-slate-500 dark:text-slate-400">Pick a time on the left and your details will appear here.</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
