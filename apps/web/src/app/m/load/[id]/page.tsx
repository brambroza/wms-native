'use client';

import type { ScanEvent, ScanResult } from '@wms/shared';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { TruckFill } from '@/components/TruckFill';
import { Scanner, feedback } from '@/components/staff/Scanner';
import { Flash, StaffHeader } from '@/components/staff/StaffShell';
import { useLive, useWms } from '@/lib/api/provider';
import { deviceId, newTxnId } from '@/lib/device';
import { useScanQueue } from '@/lib/scanQueue';

type Msg = { ok: boolean; text: string; queued?: boolean } | null;

export default function StaffLoadPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useWms();
  const { data, reload } = useLive((a) => a.getContainer(id), [id], id);
  const [msg, setMsg] = useState<Msg>(null);
  const [seal, setSeal] = useState('');
  const { pending, submit } = useScanQueue(api, (_ev: ScanEvent, r: ScanResult) => {
    if (!r.ok) setMsg({ ok: false, text: `ส่งย้อนหลังไม่ผ่าน: ${r.message}` });
    reload();
  });

  const cartons = useMemo(() => data?.cartons ?? [], [data]);
  const next = useMemo(
    () => cartons.filter((c) => !['LOADED', 'SHIPPED', 'HOLD'].includes(c.status)).sort((a, b) => (a.loadSeq ?? 1e9) - (b.loadSeq ?? 1e9))[0],
    [cartons],
  );

  if (data === undefined) return <StaffHeader title="โหลดตู้" back="/m" />;
  if (!data) return <StaffHeader title="ไม่พบตู้" back="/m" />;
  const c = data.container;
  const pct = c.plannedCartons ? (c.loadedCartons / c.plannedCartons) * 100 : 0;

  async function onScan(code: string) {
    const out = await submit({ clientTxnId: newTxnId(), action: 'LOAD', serial: code, containerId: c.id, deviceId: deviceId(), scannedAt: new Date().toISOString() });
    if (out.queued) {
      feedback(true);
      setMsg({ ok: true, queued: true, text: `${code} · บันทึกไว้ในเครื่อง จะส่งเมื่อออนไลน์` });
    } else {
      feedback(out.result.ok);
      const skipped = out.result.ok && next && code !== next.serial ? ' (ไม่ตรงลำดับที่แนะนำ)' : '';
      setMsg({ ok: out.result.ok, text: out.result.ok ? `${code} · ${out.result.message}${skipped}` : out.result.message });
      reload();
    }
  }

  return (
    <>
      <StaffHeader title={`โหลดตู้ ${c.code} · ${c.dock ?? ''}`} sub={`${c.type} · ${c.truckPlate ?? ''}`} back="/m" pending={pending} />
      <main className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="rounded-2xl border border-line bg-card px-3 pt-3 pb-2">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[13px] text-muted">หัวรถ → ประตูตู้</span>
            <b className="text-xl font-semibold">
              {c.loadedCartons}
              <span className="text-sm text-muted">/{c.plannedCartons}</span>
            </b>
          </div>
          <TruckFill pct={pct} compact />
        </div>

        {next ? (
          <div className="flex flex-col gap-1 rounded-2xl border-2 border-data bg-card p-4">
            <span className="text-[13px] text-link">กล่องถัดไป {next.loadSeq ? `#${next.loadSeq}` : ''}</span>
            <b className="text-[34px] leading-tight font-bold tracking-tight">{next.serial}</b>
            <span className="text-[15px] text-secondary">
              {next.size} · Pack {next.cartonCode} · {next.grossKg} กก.
            </span>
            <span className="text-lg font-bold text-link">วาง: {next.loadLabel ?? '-'}</span>
          </div>
        ) : (
          <div className="rounded-2xl bg-success-soft p-4 text-lg font-semibold text-success">โหลดครบแล้ว — ถ่ายรูปและใส่เลข Seal</div>
        )}

        <Flash msg={msg} />
        <Scanner onScan={onScan} placeholder="สแกน serial กล่อง" />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="seal">
              เลข Seal
            </label>
            <input id="seal" value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="เลข Seal" className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-3 text-base" />
            <button
              type="button"
              disabled={!seal.trim() || pending > 0 || c.status === 'CLOSED'}
              onClick={async () => {
                const r = await api.closeContainer(c.id, seal.trim());
                feedback(r.ok);
                setMsg({ ok: r.ok, text: r.message });
                reload();
              }}
              className="rounded-xl bg-ink px-4 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              ปิดตู้
            </button>
          </div>
          {pending > 0 && <span className="text-xs text-warn">ปิดตู้ได้เมื่อส่งรายการที่ค้างครบ</span>}
        </div>
      </main>
    </>
  );
}
