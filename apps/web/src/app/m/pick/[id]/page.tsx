'use client';

import type { Carton } from '@wms/shared';
import { Check } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Scanner, feedback } from '@/components/staff/Scanner';
import { Flash, StaffHeader } from '@/components/staff/StaffShell';
import { cx } from '@/components/ui';
import { useLive, useWms } from '@/lib/api/provider';
import { deviceId, newTxnId } from '@/lib/device';
import { useScanQueue } from '@/lib/scanQueue';

export default function StaffPickPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useWms();
  const { data, reload } = useLive((a) => Promise.all([a.getContainer(id), a.stock()]), [id], id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; queued?: boolean } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const { pending, submit } = useScanQueue(api, () => reload());

  const groups = useMemo(() => {
    if (!data?.[0]) return [];
    const [detail, stock] = data;
    const locCode = new Map(stock.locations.map((l) => [l.id, l.code]));
    const todo = detail!.cartons.filter((c) => ['AVAILABLE', 'RESERVED'].includes(c.status) || done.has(c.serial));
    const m = new Map<string, Carton[]>();
    todo.forEach((c) => {
      const code = (c.locationId && locCode.get(c.locationId)) || 'ไม่ทราบตำแหน่ง';
      m.set(code, [...(m.get(code) ?? []), c]);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, done]);

  if (data === undefined) return <StaffHeader title="หยิบ" back="/m" />;
  const detail = data[0];
  if (!detail) return <StaffHeader title="ไม่พบตู้" back="/m" />;
  const current = groups.find(([, cs]) => cs.some((c) => !done.has(c.serial)));
  const left = groups.reduce((s, [, cs]) => s + cs.filter((c) => !done.has(c.serial)).length, 0);

  async function onScan(code: string) {
    const out = await submit({ clientTxnId: newTxnId(), action: 'PICK', serial: code, containerId: id, deviceId: deviceId(), scannedAt: new Date().toISOString() });
    const ok = out.queued || out.result.ok;
    feedback(ok);
    if (ok) setDone((s) => new Set(s).add(code));
    setMsg(out.queued ? { ok: true, queued: true, text: `${code} · บันทึกไว้ในเครื่อง` } : { ok: out.result.ok, text: out.result.ok ? `${code} · ${out.result.message}` : out.result.message });
  }

  return (
    <>
      <StaffHeader title={`หยิบให้ตู้ ${detail.container.code}`} sub={`เหลือ ${left} กล่อง`} back="/m" pending={pending} />
      <main className="flex flex-col gap-3.5 p-4">
        {current ? (
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
            <span className="text-sm text-muted">ไปที่ตำแหน่ง</span>
            <b className="text-[44px] leading-none font-bold tracking-tight text-link">{current[0]}</b>
            <span className="text-[15px] text-secondary">หยิบ {current[1].filter((c) => !done.has(c.serial)).length} กล่อง แล้ววางที่ Staging ของตู้นี้</span>
          </div>
        ) : (
          <div className="rounded-2xl bg-success-soft p-4 text-lg font-semibold text-success">หยิบครบแล้ว</div>
        )}
        <Flash msg={msg} />
        <Scanner onScan={onScan} placeholder="สแกน serial กล่อง" />
        {groups.map(([loc, cs]) => (
          <div key={loc} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex bg-[#f6f8fa] px-4 py-2.5 text-[13px] text-muted">
              <span className="font-semibold text-secondary">{loc}</span>
              <span className="ml-auto">
                {cs.filter((c) => done.has(c.serial)).length}/{cs.length}
              </span>
            </div>
            {cs.map((c) => {
              const ok = done.has(c.serial);
              return (
                <div key={c.serial} className={cx('flex items-center gap-3 border-t border-divider px-4 py-3', ok && 'bg-success-soft/40')}>
                  <span className={cx('flex h-6 w-6 items-center justify-center rounded-md border-2', ok ? 'border-success-data bg-success-data text-white' : 'border-[#c5cdd6]')}>{ok && <Check size={14} aria-hidden />}</span>
                  <b className="text-[17px] font-semibold">{c.serial}</b>
                  <span className="ml-auto text-sm text-muted">
                    {c.size} · {c.cartonCode}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </main>
    </>
  );
}
