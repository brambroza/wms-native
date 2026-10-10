'use client';

import { CARTON_STATUS, type Carton, type Location } from '@wms/shared';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Card, ErrorBox, Kpi, Loading, PageHeader, Pill, cx } from '@/components/ui';
import { useLive } from '@/lib/api/provider';

const Warehouse3D = dynamic(() => import('@/components/three/Warehouse3D').then((m) => m.Warehouse3D), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">กำลังเตรียม 3D…</div>,
});

type View = '2d' | '3d';

function binColor(cs: Carton[]) {
  if (cs.some((c) => c.status === 'HOLD')) return '#e5675e';
  if (cs.some((c) => c.containerId)) return '#4da3f0';
  if (cs.some((c) => c.status === 'IN_TRANSIT')) return '#9b87e8';
  return '#3dbe7a';
}

export default function StockPage() {
  const { data, error } = useLive((a) => a.stock(), [], null);
  const [view, setView] = useState<View>('2d');
  const [wh, setWh] = useState('wh-c');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  const byLoc = useMemo(() => {
    const m = new Map<string, Carton[]>();
    data?.cartons.forEach((c) => c.locationId && m.set(c.locationId, [...(m.get(c.locationId) ?? []), c]));
    return m;
  }, [data]);

  const matchLocs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !data) return new Set<string>();
    return new Set(data.cartons.filter((c) => `${c.serial} ${c.poNo} ${c.style}`.toLowerCase().includes(s)).map((c) => c.locationId!));
  }, [q, data]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const locs = data.locations.filter((l) => l.warehouseId === wh);
  const racks = locs.filter((l) => l.kind === 'RACK');
  const inWh = data.cartons.filter((c) => c.warehouseId === wh);
  const capacity = racks.reduce((s, l) => s + l.capacityCartons, 0) || 1;
  const reserved = inWh.filter((c) => c.containerId).length;
  const hold = inWh.filter((c) => c.status === 'HOLD').length;
  const free = inWh.length - reserved - hold;
  const selLoc = locs.find((l) => l.id === sel) ?? null;
  const selCartons = sel ? byLoc.get(sel) ?? [] : [];

  // 2D grid: rows by y, bays by x (top view: level summed)
  const rows = [...new Set(racks.map((l) => l.y))].sort((a, b) => a - b);
  const bays = [...new Set(racks.map((l) => l.x))].sort((a, b) => a - b);

  return (
    <>
      <PageHeader
        title="สต็อก & คลัง"
        crumbs="คลัง › ภาพรวมรายกล่อง"
        actions={
          <>
            <label className="flex w-72 max-w-full items-center gap-2 rounded-[10px] border border-line bg-card px-3 py-2">
              <Search size={16} className="text-muted" aria-hidden />
              <span className="sr-only">ค้นหา</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="serial, PO, style…" className="min-w-0 flex-1 border-0 text-sm outline-none" />
            </label>
            <label className="sr-only" htmlFor="wh">
              คลัง
            </label>
            <select id="wh" value={wh} onChange={(e) => (setWh(e.target.value), setSel(null))} className="rounded-[10px] border border-line bg-card px-3 py-2 text-sm">
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </>
        }
      />
      <div className="flex flex-col gap-4 px-7 pt-[18px] pb-7">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <Kpi label="กล่องในคลังนี้" value={inWh.length.toLocaleString()} sub={`ความจุ ${capacity.toLocaleString()} กล่อง`} delta={`ใช้ ${Math.round((inWh.length / capacity) * 100)}%`} tone="info" />
          <Kpi label="จองให้ตู้แล้ว" value={reserved.toLocaleString()} sub="รอหยิบ / โหลด" delta={`${Math.round((reserved / Math.max(1, inWh.length)) * 100)}%`} tone="info" />
          <Kpi label="Hold / ปัญหา" value={hold} sub="ต้องตรวจ" delta={hold ? 'ตรวจด่วน' : 'ปกติ'} tone={hold ? 'danger' : 'success'} />
        </div>

        <div className="flex flex-wrap items-stretch gap-4">
          <Card className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 px-[18px] py-4 xl:max-w-[360px]">
            <h2 className="m-0 text-base font-semibold">การใช้พื้นที่</h2>
            {[
              { k: 'พร้อมใช้', n: free, c: '#3dbe7a', t: 'text-success' },
              { k: 'จองให้ตู้', n: reserved, c: '#4da3f0', t: 'text-link' },
              { k: 'Hold / ปัญหา', n: hold, c: '#e5675e', t: 'text-danger' },
            ].map((m) => {
              const ticks = 30;
              const on = Math.round((m.n / capacity) * ticks) || (m.n ? 1 : 0);
              return (
                <div key={m.k} className="flex flex-col gap-1.5">
                  <b className="text-sm font-semibold">{m.k}</b>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: ticks }, (_, i) => (
                      <span key={i} className="h-[18px] flex-1 rounded-[3px]" style={{ background: i < on ? m.c : '#e6eaf0' }} />
                    ))}
                  </div>
                  <b className={cx('text-[13px] font-semibold', m.t)}>{m.n.toLocaleString()}</b>
                </div>
              );
            })}
            {selLoc && (
              <div className="mt-2 flex flex-col gap-2 border-t border-divider pt-3">
                <span className="text-xs text-muted">ช่องที่เลือก</span>
                <b className="text-lg font-semibold">{selLoc.code}</b>
                <span className="text-[13px] text-secondary">
                  {selCartons.length} กล่อง · ใช้ไป {Math.round((selCartons.length / Math.max(1, selLoc.capacityCartons)) * 100)}%
                </span>
                <div className="flex max-h-56 flex-col gap-1 overflow-auto">
                  {selCartons.map((c) => (
                    <div key={c.serial} className="flex items-center gap-2 text-[13px]">
                      <span className="font-semibold">{c.serial}</span>
                      <span className="text-muted">
                        {c.size} · {c.cartonCode} · PO {c.poNo}
                      </span>
                      <span className="ml-auto">
                        <Pill tone={CARTON_STATUS[c.status].tone}>{CARTON_STATUS[c.status].label}</Pill>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="flex min-w-0 flex-[999_1_520px] flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-divider px-[18px] py-3">
              <div role="tablist" aria-label="มุมมอง" className="flex gap-4">
                {(['2d', '3d'] as View[]).map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('border-b-2 py-1.5 text-sm', view === v ? 'border-primary font-semibold text-link' : 'border-transparent text-muted')}>
                    {v === '2d' ? 'ผัง 2D' : '3D'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap gap-3 text-xs text-secondary">
                {[
                  ['พร้อมใช้', '#3dbe7a'],
                  ['จองให้ตู้', '#4da3f0'],
                  ['ระหว่างโอน', '#9b87e8'],
                  ['Hold', '#e5675e'],
                  ['ตรงกับค้นหา', '#e07a1f'],
                ].map(([t, c]) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {view === '2d' ? (
              <div className="overflow-x-auto p-[18px]">
                {racks.length === 0 && <p className="text-sm text-muted">คลังนี้ยังไม่มีผังตำแหน่ง</p>}
                <div className="flex min-w-max flex-col gap-2">
                  {rows.map((y) => (
                    <div key={y} className="flex items-center gap-1.5">
                      <span className="w-10 text-xs text-muted">{racks.find((l) => l.y === y)?.code.split('-')[1]?.[0] ?? ''}</span>
                      {bays.map((x) => {
                        const levels = racks.filter((l) => l.y === y && l.x === x).sort((a, b) => a.z - b.z);
                        if (!levels.length) return <span key={x} className="w-12" />;
                        return (
                          <div key={x} className="flex flex-col-reverse gap-0.5">
                            {levels.map((l) => (
                              <Bin2D key={l.id} l={l} cartons={byLoc.get(l.id) ?? []} selected={sel === l.id} match={matchLocs.has(l.id)} onClick={() => setSel(l.id)} />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {locs
                    .filter((l) => l.kind !== 'RACK')
                    .map((l) => (
                      <button key={l.id} type="button" onClick={() => setSel(l.id)} className={cx('min-w-[110px] rounded-lg px-3 py-2 text-left text-xs', l.kind === 'DOCK' ? 'bg-ink text-white' : 'border-2 border-dashed border-data text-link', sel === l.id && 'ring-2 ring-primary')}>
                        {l.code}
                        <br />
                        <b>{(byLoc.get(l.id) ?? []).length} กล่อง</b>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="h-[520px]">
                <Warehouse3D
                  bins={racks.map((l) => {
                    const cs = byLoc.get(l.id) ?? [];
                    return { id: l.id, code: l.code, x: l.x, y: l.y, z: l.z, fill: cs.length / Math.max(1, l.capacityCartons), color: matchLocs.has(l.id) ? '#e07a1f' : binColor(cs) };
                  })}
                  selectedId={sel}
                  onSelect={setSel}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Bin2D({ l, cartons, selected, match, onClick }: { l: Location; cartons: Carton[]; selected: boolean; match: boolean; onClick: () => void }) {
  const fill = cartons.length / Math.max(1, l.capacityCartons);
  const color = cartons.length ? binColor(cartons) : '#eef1f5';
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${l.code} · ${cartons.length} กล่อง`}
      aria-label={`${l.code} ${cartons.length} กล่อง`}
      className={cx('relative h-6 w-12 overflow-hidden rounded-[4px] bg-divider', selected && 'ring-2 ring-primary', match && 'outline-[3px] -outline-offset-[3px] outline-[#e07a1f] outline-solid')}
    >
      <span className="absolute inset-y-0 left-0" style={{ width: `${Math.max(fill * 100, cartons.length ? 12 : 0)}%`, background: color }} />
      <span className="relative text-[10px] font-semibold text-ink">{cartons.length || ''}</span>
    </button>
  );
}
