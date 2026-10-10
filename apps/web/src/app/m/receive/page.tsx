'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Scanner, feedback } from '@/components/staff/Scanner';
import { Flash, StaffHeader } from '@/components/staff/StaffShell';
import { cx } from '@/components/ui';
import { useWms } from '@/lib/api/provider';
import { deviceId, newTxnId } from '@/lib/device';
import { useScanQueue } from '@/lib/scanQueue';

/** Location labels look like C-A04-2, STG-A, DOCK-1, A-R01 — everything else is treated as a carton serial. */
const isLocation = (code: string) => /^[A-Z]{1,5}-[A-Z0-9-]+$/i.test(code.trim()) && !/^\d+$/.test(code.trim());

export default function ReceivePage() {
  return (
    <Suspense fallback={<StaffHeader title="รับเข้า / วางของ" back="/m" />}>
      <Receive />
    </Suspense>
  );
}

function Receive() {
  const mode = useSearchParams().get('mode') === 'PUTAWAY' ? 'PUTAWAY' : 'RECEIVE';
  const { api } = useWms();
  const { pending, submit } = useScanQueue(api);
  const [location, setLocation] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; queued?: boolean } | null>(null);
  const [count, setCount] = useState(0);

  async function onScan(code: string) {
    if (isLocation(code)) {
      setLocation(code.toUpperCase());
      feedback(true);
      setMsg({ ok: true, text: `ตำแหน่ง ${code.toUpperCase()} — สแกนกล่องต่อได้เลย` });
      return;
    }
    if (mode === 'PUTAWAY' && !location) {
      feedback(false);
      setMsg({ ok: false, text: 'สแกนป้ายตำแหน่งก่อน' });
      return;
    }
    const out = await submit({ clientTxnId: newTxnId(), action: mode, serial: code, locationCode: location, deviceId: deviceId(), scannedAt: new Date().toISOString() });
    const ok = out.queued || out.result.ok;
    feedback(ok);
    if (ok) setCount((n) => n + 1);
    setMsg(out.queued ? { ok: true, queued: true, text: `${code} · บันทึกไว้ในเครื่อง` } : { ok: out.result.ok, text: out.result.ok ? `${code} · ${out.result.message}` : out.result.message });
  }

  return (
    <>
      <StaffHeader title={mode === 'PUTAWAY' ? 'วางของ' : 'รับเข้า'} sub={mode === 'PUTAWAY' ? 'สแกนตำแหน่ง แล้วสแกนกล่อง' : 'สแกนกล่องที่มาถึง (ตำแหน่งไม่บังคับ)'} back="/m" pending={pending} />
      <main className="flex flex-col gap-3.5 p-4">
        <div className={cx('flex flex-col gap-1 rounded-2xl border bg-card p-4', location ? 'border-2 border-data' : 'border-line')}>
          <span className="text-sm text-muted">ตำแหน่งปัจจุบัน</span>
          <b className={cx('text-[40px] leading-none font-bold tracking-tight', location ? 'text-link' : 'text-[#a3acb8]')}>{location ?? 'ยังไม่เลือก'}</b>
          <span className="text-[13px] text-muted">สแกนป้ายตำแหน่งใหม่เมื่อเปลี่ยนช่อง · ทำไปแล้ว {count} กล่อง</span>
        </div>
        <Flash msg={msg} />
        <Scanner onScan={onScan} placeholder="สแกน serial หรือป้ายตำแหน่ง" />
      </main>
    </>
  );
}
