import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanAction } from '@wms/shared';
import type { BannerState } from '../components/ScanBanner';
import { scanFeedback } from '../lib/feedback';
import type { SubmitOutcome } from '../lib/scanQueue';
import { useAuthed } from '../lib/session';

/** Submit a scan through the offline queue and translate the outcome into banner + haptics. */
export function useScan() {
  const { queue } = useAuthed();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((b: BannerState, ttlMs = 6000) => {
    setBanner(b);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(null), ttlMs);
    scanFeedback(b.kind === 'success' ? 'success' : b.kind === 'danger' ? 'error' : 'warn');
  }, []);

  const submit = useCallback(
    async (action: ScanAction, serial: string, opts: { containerId?: string | null; locationCode?: string | null } = {}): Promise<SubmitOutcome> => {
      setBusy(true);
      try {
        const out = await queue.submit({ action, serial, ...opts });
        if (out.status === 'queued') {
          show({ kind: 'warn', title: `บันทึกแล้ว · รอส่ง`, detail: `${serial} — ไม่มีสัญญาณ จะส่งอัตโนมัติเมื่อออนไลน์` });
        } else if (out.result.ok) {
          const c = out.result.carton;
          show({
            kind: 'success',
            title: `✓ ${out.result.message}`,
            detail: c ? `${c.serial} · ${c.style} · ${c.size} · ${c.cartonCode}` : serial,
          });
        } else {
          show({ kind: 'danger', title: `✕ ${out.result.message}`, detail: serial }, 9000);
        }
        return out;
      } finally {
        setBusy(false);
      }
    },
    [queue, show],
  );

  return { banner, show, submit, busy };
}
