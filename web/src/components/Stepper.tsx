import { CheckIcon } from './icons';

const STEPS = ['Choose a time', 'Your details', 'Confirmed'];

/** `current` is 1-based: 1 = choosing, 2 = filling details, 3 = booked. */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm font-semibold" aria-label="Progress">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current || current === 3;
        const active = step === current && current !== 3;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={[
                'grid size-7 shrink-0 place-items-center rounded-full text-xs',
                done ? 'bg-brand text-white' : active ? 'border-2 border-brand text-brand' : 'border-2 border-slate-300 text-slate-400 dark:border-slate-700',
              ].join(' ')}
            >
              {done ? <CheckIcon width={14} height={14} strokeWidth={3} /> : step}
            </span>
            <span className={`hidden sm:inline ${active || done ? '' : 'text-slate-400'}`}>{label}</span>
            {step < STEPS.length && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
          </li>
        );
      })}
    </ol>
  );
}
