'use client';

import type { ScanEvent, ScanResult } from '@wms/shared';
import { get, set } from 'idb-keyval';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WmsApi } from './api/types';

/**
 * Offline-first scan queue for the staff PWA.
 * Every scan is written to IndexedDB before it is sent; the server's scan_carton() is idempotent on
 * clientTxnId, so retrying after a dropped connection can never double-count a carton.
 */
const KEY = 'fgdock.scanQueue';

const isNetworkError = (e: unknown) => {
  const m = String((e as Error)?.message ?? e).toLowerCase();
  return (typeof navigator !== 'undefined' && !navigator.onLine) || m.includes('fetch') || m.includes('network') || m.includes('timeout');
};

async function readQueue(): Promise<ScanEvent[]> {
  return ((await get(KEY)) as ScanEvent[] | undefined) ?? [];
}

export type SubmitOutcome = { queued: true } | { queued: false; result: ScanResult };

export function useScanQueue(api: WmsApi, onLateResult?: (ev: ScanEvent, r: ScanResult) => void) {
  const [pending, setPending] = useState(0);
  const flushing = useRef(false);
  const lateRef = useRef(onLateResult);
  lateRef.current = onLateResult;

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let q = await readQueue();
      while (q.length) {
        const ev = q[0];
        try {
          const r = await api.scan(ev);
          lateRef.current?.(ev, r);
        } catch (e) {
          if (isNetworkError(e)) break; // still offline — try later
          lateRef.current?.(ev, { ok: false, duplicate: false, message: (e as Error).message });
        }
        q = (await readQueue()).filter((x) => x.clientTxnId !== ev.clientTxnId);
        await set(KEY, q);
        setPending(q.length);
      }
      setPending((await readQueue()).length);
    } finally {
      flushing.current = false;
    }
  }, [api]);

  useEffect(() => {
    void readQueue().then((q) => setPending(q.length));
    void flush();
    const on = () => void flush();
    window.addEventListener('online', on);
    const t = setInterval(on, 15000);
    return () => {
      window.removeEventListener('online', on);
      clearInterval(t);
    };
  }, [flush]);

  const submit = useCallback(
    async (ev: ScanEvent): Promise<SubmitOutcome> => {
      const q = await readQueue();
      await set(KEY, [...q, ev]);
      setPending(q.length + 1);
      if (q.length > 0 || !navigator.onLine) return { queued: true }; // keep order: older scans first
      try {
        const result = await api.scan(ev);
        const rest = (await readQueue()).filter((x) => x.clientTxnId !== ev.clientTxnId);
        await set(KEY, rest);
        setPending(rest.length);
        return { queued: false, result };
      } catch (e) {
        if (isNetworkError(e)) return { queued: true };
        const rest = (await readQueue()).filter((x) => x.clientTxnId !== ev.clientTxnId);
        await set(KEY, rest);
        setPending(rest.length);
        return { queued: false, result: { ok: false, duplicate: false, message: (e as Error).message } };
      }
    },
    [api],
  );

  return { pending, submit, flush };
}
