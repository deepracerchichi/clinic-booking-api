// A cursor is just the last-seen booking `seq`, base64url-encoded so clients treat it as opaque.

export function encodeCursor(seq: number | string): string {
  return Buffer.from(String(seq)).toString('base64url');
}

/** Returns the seq, or null if the cursor is malformed. */
export function decodeCursor(cursor: string): number | null {
  const raw = Buffer.from(cursor, 'base64url').toString();
  return /^\d{1,15}$/.test(raw) ? Number(raw) : null;
}
