/** Stable per-browser device id + idempotency keys for scans. */
export function deviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('fgdock.deviceId');
    if (!id) {
      id = `web-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem('fgdock.deviceId', id);
    }
    return id;
  } catch {
    return 'web-anon';
  }
}

export function newTxnId(): string {
  return crypto.randomUUID();
}
