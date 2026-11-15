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
  const [visible, setVisible] = useState(false);

  if (!needsAttention && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand dark:border-slate-800 dark:text-slate-300"
      >
        <KeyIcon width={14} height={14} /> API key set · change
      </button>
    );
  }

  return (
    <Card className="mb-5">
      <label htmlFor="api-key" className="mb-1.5 flex items-center gap-2 text-base font-bold">
        <KeyIcon width={18} height={18} /> API key
      </label>
      <p className="mb-3 text-slate-600 dark:text-slate-300">Needed to talk to the API. Saved in this browser only.</p>
      <div className="flex gap-2">
        {/* Monospace + a larger size keeps the hidden dots readable; Urbanist's own bullets are tiny. */}
        <input
          id="api-key"
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your API key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-mono text-base tracking-wide dark:border-slate-700"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="shrink-0 rounded-xl border border-slate-300 px-4 font-semibold dark:border-slate-700"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
        {!needsAttention && (
          <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-xl bg-brand px-4 font-semibold text-white">
            Done
          </button>
        )}
      </div>
    </Card>
  );
}
