'use client';

import { buildLoadPlan, CARTON_STATUS, GROUP_COLORS, type Carton } from '@wms/shared';
import { ScanLine } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ContainerCard } from '@/components/ContainerCards';
import { TruckFill } from '@/components/TruckFill';
import { AiChip, Button, Card, ErrorBox, Loading, PageHeader, Pill, Progress, cx } from '@/components/ui';
import { useLive, useWms } from '@/lib/api/provider';
import { deviceId, newTxnId } from '@/lib/device';

const Container3D = dynamic(() => import('@/components/three/Container3D').then((m) => m.Container3D), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center text-sm text-muted">กำลังเตรียม 3D…</div>,
});

type View = 'side' | '3d';

export default function LoadingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useWms();
  const detail = useLive((a) => a.getContainer(id), [id], id);
  const all = useLive((a) => a.overview(), [], null);
  const [view, setView] = useState<View>('side');
  const [code, setCode] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [seal, setSeal] = useState('');

  const c = detail.data?.container;
  const cartons = useMemo(() => detail.data?.cartons ?? [], [detail.data]);
  const plan = useMemo(() => (c ? buildLoadPlan(cartons, c.type) : null), [cartons, c]);
  const loaded = useMemo(() => new Set(cartons.filter((x) => x.status === 'LOADED' || x.status === 'SHIPPED').map((x) => x.serial)), [cartons]);
  const next = useMemo(() => cartons.filter((x) => !loaded.has(x.serial) && x.status !== 'HOLD').sort((a, b) => (a.loadSeq ?? 1e9) - (b.loadSeq ?? 1e9))[0], [cartons, loaded]);

  if (detail.error) return <ErrorBox message={detail.error} />;
  if (detail.data === undefined) return <Loading />;
  if (!detail.data || !c) return <ErrorBox message="ไม่พบตู้นี้" />;

  const pct = c.plannedCartons ? (c.loadedCartons / c.plannedCartons) * 100 : 0;
  const pos = [...new Set(cartons.map((x) => x.poNo))];
  const poColor = (po: string) => GROUP_COLORS[pos.indexOf(po) % GROUP_COLORS.length];
  const byPo = pos.map((po) => {
    const mine = cartons.filter((x) => x.poNo === po);
    return { po, total: mine.length, loaded: mine.filter((x) => loaded.has(x.serial)).length, rows: mine.sort((a, b) => (a.loadSeq ?? 1e9) - (b.loadSeq ?? 1e9)) };
  });
  const maxKg = { '20GP': 28200, '40GP': 26700, '40HC': 26500, '45HC': 27600 }[c.type];

  async function scan(serial: string) {
    if (!serial.trim() || !c) return;
    try {
      const r = await api.scan({ clientTxnId: newTxnId(), action: 'LOAD', serial: serial.trim(), containerId: c.id, deviceId: deviceId(), scannedAt: new Date().toISOString() });
      setFlash({ ok: r.ok, text: r.ok ? `${serial} · ${r.message}` : r.message });
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    }
    setCode('');
  }

  async function close() {
    if (!c) return;
    const r = await api.closeContainer(c.id, seal.trim());
    setFlash({ ok: r.ok, text: r.message });
  }

  return (
    <>
      <PageHeader title={`โหลดตู้ ${c.code}`} crumbs={`ตู้ & โหลด › ${detail.data.shipment ? `Shipment ${detail.data.shipment.shipmentDate} · ${detail.data.shipment.destination}` : ''}`} />
      <div className="flex flex-wrap gap-4 px-7 pt-[18px] pb-7">
        <aside className="hidden w-[270px] shrink-0 flex-col gap-2.5 self-start xl:flex">
          <h2 className="m-0 text-[15px] font-semibold">ตู้อื่น</h2>
          {all.data?.containers
            .filter((x) => x.status !== 'CLOSED')
            .map((x) => <ContainerCard key={x.id} c={x} shipment={all.data?.shipments.find((s) => s.id === x.shipmentId)} active={x.id === c.id} />)}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card className="flex flex-col gap-2 px-[18px] pt-3.5 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <b className="text-base font-semibold">
                {c.code} · {c.type}
                {c.dock ? ` · ${c.dock}` : ''}
              </b>
              <span className="text-xs text-muted">
                {[c.truckPlate, c.driverName, c.containerNo].filter(Boolean).join(' · ')}
              </span>
              <div role="tablist" aria-label="มุมมอง" className="ml-auto flex rounded-[10px] bg-neutral-soft p-[3px]">
                {(['side', '3d'] as View[]).map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('rounded-lg px-3 py-1.5 text-[13px]', view === v ? 'bg-card text-ink shadow-sm' : 'text-muted')}>
                    {v === 'side' ? 'ด้านข้าง' : '3D แผนการจัด'}
                  </button>
                ))}
              </div>
            </div>
            {view === 'side' ? (
              <TruckFill pct={pct}>
                <div className="flex items-baseline gap-2">
                  <b className="text-[clamp(28px,4vw,46px)] leading-none font-semibold">{Math.round(pct)}%</b>
                  <span className="text-sm">โหลดแล้ว</span>
                </div>
                <span className="text-sm">
                  {c.loadedCartons} / {c.plannedCartons} กล่อง · {(c.loadedKg / 1000).toFixed(1)} t
                </span>
              </TruckFill>
            ) : (
              <div className="h-[420px] overflow-hidden rounded-xl border border-divider">
                {plan && <Container3D steps={plan.steps} loadedSerials={loaded} nextSerial={next?.serial} type={c.type} />}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {byPo.map((p) => (
                <div key={p.po} className="flex min-w-[150px] flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-sm" style={{ background: poColor(p.po) }} />
                    <span className="text-secondary">PO {p.po}</span>
                    <span className="ml-auto text-muted">
                      {p.loaded}/{p.total}
                    </span>
                  </div>
                  <Progress value={(p.loaded / p.total) * 100} color={p.loaded === p.total ? 'bg-success-data' : 'bg-data'} />
                </div>
              ))}
            </div>
            {plan && (
              <span className="text-xs text-muted">
                แผนการจัด: ใช้ปริมาตร {plan.fit.volumeUsedPct}% · {plan.unplaced.length ? `ไม่พอดีตู้ ${plan.unplaced.length} กล่อง` : 'ลงตู้ได้ครบ'}
              </span>
            )}
          </Card>

          <div className="flex flex-wrap gap-4">
            <Card className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 border-2 border-data px-[18px] py-4">
              <span className="text-xs text-link">กล่องถัดไป {next?.loadSeq ? `#${next.loadSeq}` : ''}</span>
              {next ? (
                <>
                  <b className="text-2xl font-semibold">{next.serial}</b>
                  <span className="text-sm text-secondary">
                    {next.style} · {next.size} · Pack {next.cartonCode}
                  </span>
                  <span className="text-sm font-semibold">วาง: {next.loadLabel ?? '-'}</span>
                </>
              ) : (
                <b className="text-lg">โหลดครบแล้ว</b>
              )}
            </Card>
            <Card className="flex min-w-0 flex-[2_1_420px] flex-col gap-2.5 px-[18px] py-4">
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-[15px] font-semibold">สแกนขึ้นตู้ (จากโต๊ะ / เครื่องสแกน USB)</h2>
                <span className="ml-auto">
                  <AiChip>ตรวจผิดตู้อัตโนมัติ</AiChip>
                </span>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void scan(code);
                }}
              >
                <label className="flex flex-1 items-center gap-2 rounded-[10px] border border-line px-3">
                  <ScanLine size={18} className="text-muted" aria-hidden />
                  <span className="sr-only">Serial กล่อง</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="สแกนหรือพิมพ์ serial แล้วกด Enter" className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none" />
                </label>
                <Button type="submit" variant="primary">
                  โหลด
                </Button>
                {next && (
                  <Button onClick={() => scan(next.serial)} title="จำลองการสแกนกล่องถัดไป">
                    สแกนกล่องถัดไป
                  </Button>
                )}
              </form>
              {flash && (
                <div className={cx('animate-flash rounded-[10px] px-3 py-2 text-sm font-semibold', flash.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')} role="status">
                  {flash.text}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3.5">
              <h2 className="m-0 text-base font-semibold">รายการกล่อง</h2>
              <AiChip>เรียงตามลำดับโหลด</AiChip>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="sticky top-0">
                  <tr>
                    {['ลำดับ', 'Serial', 'Style · Size', 'Pack', 'กก.', 'ตำแหน่งในตู้', 'สถานะ'].map((x) => (
                      <th key={x} className="bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byPo.map((g) => (
                    <PoRows key={g.po} po={g.po} total={g.total} loadedN={g.loaded} rows={g.rows} next={next?.serial} color={poColor(g.po)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-6 border-t border-line bg-[#fbfcfd] px-[18px] py-3.5">
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-muted">กล่อง</span>
                <b className="text-[15px] font-semibold">
                  {c.loadedCartons} / {c.plannedCartons}
                </b>
                <Progress value={pct} />
              </div>
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-muted">น้ำหนัก</span>
                <b className="text-[15px] font-semibold">
                  {(c.loadedKg / 1000).toFixed(1)} / {(maxKg / 1000).toFixed(1)} t
                </b>
                <Progress value={(c.loadedKg / maxKg) * 100} />
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-[10px] border border-line px-3">
                  <span className="sr-only">เลข Seal</span>
                  <input value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="เลข Seal" className="w-36 border-0 py-2.5 text-sm outline-none" />
                </label>
                <Button variant="primary" disabled={!seal.trim() || c.status === 'CLOSED'} onClick={close}>
                  {c.status === 'CLOSED' ? `ปิดแล้ว · ${c.sealNo ?? ''}` : 'ปิดตู้ + Seal'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function PoRows({ po, total, loadedN, rows, next, color }: { po: string; total: number; loadedN: number; rows: Carton[]; next?: string; color: string }) {
  const [open, setOpen] = useState(loadedN < total);
  return (
    <>
      <tr>
        <td colSpan={7} className="border-t border-divider bg-[#fbfcfd] px-4 py-2">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 text-[13px] font-semibold text-secondary">
            <span aria-hidden>{open ? '⌄' : '›'}</span>
            <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
            PO {po} · {total} กล่อง · โหลดแล้ว {loadedN}
          </button>
        </td>
      </tr>
      {open &&
        rows.map((r) => {
          const isNext = r.serial === next;
          const st = isNext ? { tone: 'info' as const, label: 'ถัดไป' } : CARTON_STATUS[r.status];
          return (
            <tr key={r.serial} className={isNext ? 'bg-[#f5faff]' : undefined}>
              <td className="border-t border-divider px-4 py-2.5 text-sm text-muted">{r.loadSeq ? `#${r.loadSeq}` : '-'}</td>
              <td className="border-t border-divider px-4 py-2.5 text-sm font-semibold">{r.serial}</td>
              <td className="border-t border-divider px-4 py-2.5 text-sm">
                {r.style} · {r.size}
              </td>
              <td className="border-t border-divider px-4 py-2.5 text-sm">{r.cartonCode}</td>
              <td className="border-t border-divider px-4 py-2.5 text-sm">{r.grossKg}</td>
              <td className="border-t border-divider px-4 py-2.5 text-sm">{r.loadLabel ?? '-'}</td>
              <td className="border-t border-divider px-4 py-2.5 text-sm">
                <Pill tone={st.tone}>{st.label}</Pill>
              </td>
            </tr>
          );
        })}
    </>
  );
}
