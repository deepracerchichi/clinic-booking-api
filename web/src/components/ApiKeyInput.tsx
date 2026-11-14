import { useState } from 'react';
import { Card } from './Card';
import { KeyIcon } from './icons';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** True when there's no key yet or the API rejected it: show the full input instead of the compact bar. */
  needsAttention: boolean;
}

export function ApiKeyInput({ value, onChange, needsAttention }: Props) {
  const [open, setOpen] = useState(false);

  if (!needsAttention && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 hover:border-brand hover:text-brand dark:border-slate-800 dark:text-slate-400"
      >
        <KeyIcon width={14} height={14} /> API key set · change
      </button>
    );
  }

  return (
    <Card className="mb-5">
      <label htmlFor="api-key" className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <KeyIcon width={16} height={16} /> API key
      </label>
      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Needed to talk to the API. Saved in this browser only.</p>
      <div className="flex gap-2">
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          placeholder="X-API-Key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700"
        />
        {!needsAttention && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 font-semibold dark:border-slate-700">
            Done
          </button>
        )}
      </div>
    </Card>
  );
}
