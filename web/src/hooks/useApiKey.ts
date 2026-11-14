import { useEffect, useState } from 'react';

const STORAGE_KEY = 'clinic-api-key';

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return ''; // storage can be blocked (private windows); the page still works without it
  }
}

/** The API key lives in this browser only; it is never part of the page's source. */
export function useApiKey() {
  const [apiKey, setApiKey] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, apiKey);
    } catch {
      /* ignore */
    }
  }, [apiKey]);

  return [apiKey, setApiKey] as const;
}
