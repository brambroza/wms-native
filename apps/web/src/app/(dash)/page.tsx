'use client';

import { CONTAINER_STATUS, PLAN_STATUS, type Container } from '@wms/shared';
import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TruckFill } from '@/components/TruckFill';
import { AiChip, Button, ButtonLink, Card, CardHeader, ErrorBox, Kpi, Loading, Pill, Progress } from '@/components/ui';
import { useLive, useWms } from '@/lib/api/provider';

/** loose mixed cartons: ~75% is a good load with the v1 wall packer (see packages/shared/src/containerFit.ts) */
const FILL_TARGET = 72;

const pct = (c: Container) => (c.plannedCartons ? (c.loadedCartons / c.plannedCartons) * 100 : 0);

export default function DashboardPage() {
  const { api } = useWms();
  const { data, error } = useLive((a) => a.overview(), [], null);
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const loading = data.containers.filter((c) => c.status === 'LOADING').sort((a, b) => pct(b) - pct(a));
  const hero = loading[0];
  const heroShipment = hero && data.shipments.find((s) => s.id === hero.shipmentId);
  const plans = data.plans;
  const funnel = [
    { k: 'แผนเข้า', v: plans.length },
    { k: 'ตรวจผ่าน', v: plans.filter((p) => p.status !== 'DRAFT').length },
    { k: 'จัดตู้', v: plans.filter((p) => ['APPROVED', 'SUBMITTED', 'RELEASED', 'LOADING', 'CLOSED'].includes(p.status)).length },
    { k: 'กำลังโหลด', v: plans.filter((p) => ['LOADING', 'CLOSED'].includes(p.status)).length },
    { k: 'ปิดแล้ว', v: plans.filter((p) => p.status === 'CLOSED').length },
  ];
  const fillAvg = data.containers.length ? data.containers.reduce((s, c) => s + c.fillVolumePct, 0) / data.containers.length : 0;
  const atRisk = data.plans.filter((p) => p.issue).length;

  return (
    <div className="flex flex-col gap-4 px-7 pt-5 pb-9">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <h1 className="m-0 text-xl font-semibold">ภาพรวมวันนี้</h1>
          <span className="text-[13px] text-muted">WH กลาง · อัปเดตเรียลไทม์</span>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/stock" aria-label="ค้นหาสต็อก" className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-card">
            <Search size={18} aria-hidden />
          </Link>
          <button type="button" aria-label="แจ้งเตือน" className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-card">
            <Bell size={18} aria-hidden />
            {data.decisions.length > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger-data" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Kpi label="ตู้ที่ยังไม่ปิด" value={`${data.containers.filter((c) => c.status !== 'CLOSED').length} ตู้`} sub={`กำลังโหลด ${loading.length}`} delta={`${data.shipments.length} shipment`} tone="info" />
        <Kpi label="เต็มตู้เฉลี่ย (ปริมาตร)" value={`${fillAvg.toFixed(1)}%`} sub={`เป้าหมาย ≥ ${FILL_TARGET}%`} delta={fillAvg >= FILL_TARGET ? 'ถึงเป้า' : 'ต่ำกว่าเป้า'} tone={fillAvg >= FILL_TARGET ? 'success' : 'warn'} />
        <Kpi label="กล่องในคลังกลาง" value={data.cartonsInCentral.toLocaleString()} sub={`จองให้ตู้ ${data.reservedInCentral.toLocaleString()}`} delta={`${Math.round((data.reservedInCentral / Math.max(1, data.cartonsInCentral)) * 100)}% จองแล้ว`} tone="info" />
        <Kpi label="เรื่องที่รอตัดสินใจ" value={`${data.decisions.length} เรื่อง`} sub={atRisk ? `แผนมีปัญหา ${atRisk}` : 'ไม่มีแผนมีปัญหา'} delta={data.decisions.length ? 'ดูด้านล่าง' : 'เรียบร้อย'} tone={data.decisions.length ? 'warn' : 'success'} />
      </div>

      <div className="flex flex-wrap gap-3.5">
        <Card className="min-w-0 flex-[3_1_560px] px-[18px] pt-4 pb-3">
          {hero ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="m-0 text-base font-semibold">กำลังโหลด · {hero.dock ?? '-'}</h2>
                <Pill tone="warn">
                  {hero.code} · {hero.type}
                </Pill>
                <Link href={`/loading/${hero.id}`} className="ml-auto text-[13px] text-link no-underline">
                  เปิดหน้าโหลด →
                </Link>
              </div>
              <div className="relative">
                <TruckFill pct={pct(hero)} />
                <div className="pointer-events-none absolute top-[22%] left-[37%] flex flex-col gap-0.5 text-white">
                  <div className="flex items-baseline gap-2">
                    <b className="text-[clamp(28px,4vw,46px)] leading-none font-semibold">{Math.round(pct(hero))}%</b>
                    <span className="text-sm">โหลดแล้ว</span>
                  </div>
                  <span className="text-sm">
                    {hero.loadedCartons} / {hero.plannedCartons} กล่อง · {(hero.loadedKg / 1000).toFixed(1)} t
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1 text-[13px] text-muted">
                <span>
                  คาดเสร็จ <b className="text-ink">{hero.etaDone ?? '-'}</b>
                </span>
                <span>
                  ทะเบียน <b className="text-ink">{hero.truckPlate ?? '-'}</b>
                </span>
                {heroShipment && (
                  <span>
                    Shipment <b className="text-ink">{heroShipment.shipmentDate} · {heroShipment.destination}</b>
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">ยังไม่มีตู้ที่กำลังโหลด</p>
          )}
        </Card>

        <Card className="flex min-w-0 flex-[2_1_360px] flex-col gap-3 px-[18px] py-4">
          <h2 className="m-0 text-base font-semibold">เส้นทางงาน (Packing Plan)</h2>
          <div className="h-px bg-divider" />
          <div className="grid flex-1 grid-cols-5">
            {funnel.map((f, i) => {
              const h = Math.max(8, (f.v / Math.max(1, funnel[0].v)) * 140);
              return (
                <div key={f.k} className={`flex min-h-[220px] flex-col gap-1 px-1.5 ${i ? 'border-l border-divider' : ''}`}>
                  <span className="text-xs text-muted">{f.k}</span>
                  <b className="text-xl font-semibold">{f.v}</b>
                  <div className="mt-auto rounded-lg" style={{ height: h, background: ['#4da3f0', '#73b7f3', '#93c8f6', '#b4d9f8', '#d2e8fb'][i] }} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-3.5">
        <Card className="min-w-0 flex-[3_1_560px] overflow-hidden">
          <CardHeader title="ตู้ทั้งหมด" right={<span className="text-[13px] text-muted">{data.containers.length} ตู้</span>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  {['ตู้', 'Shipment', 'ประเภท', 'ความคืบหน้า', 'สถานะ'].map((h) => (
                    <th key={h} className="bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.containers.map((c) => {
                  const s = data.shipments.find((x) => x.id === c.shipmentId);
                  const st = CONTAINER_STATUS[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-ground">
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <Link href={`/loading/${c.id}`} className="font-semibold text-link no-underline">
                          {c.code}
                        </Link>
                      </td>
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        {s?.shipmentDate} · {s?.destination}
                      </td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{c.type}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Progress value={pct(c)} className="w-28 shrink-0" color={c.status === 'CLOSED' ? 'bg-success-data' : 'bg-data'} />
                          <span className="w-16 text-xs text-muted">
                            {c.loadedCartons}/{c.plannedCartons}
                          </span>
                        </div>
                      </td>
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex min-w-0 flex-[2_1_380px] flex-col gap-3 px-[18px] py-4">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-base font-semibold">ต้องการการตัดสินใจ</h2>
            <span className="ml-auto">
              <AiChip>AI · {data.decisions.length} เรื่อง</AiChip>
            </span>
          </div>
          {data.decisions.length === 0 && <p className="m-0 text-sm text-muted">ไม่มีเรื่องค้าง</p>}
          {data.decisions.map((d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
              <b className="text-sm font-semibold">{d.title}</b>
              <span className="text-[13px] leading-relaxed text-secondary">
                <span className="font-semibold text-ai">AI แนะนำ ({Math.round(d.confidence * 100)}%):</span> {d.recommendation}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="px-3.5 py-2 text-[13px]"
                  disabled={busy === d.id}
                  onClick={async () => {
                    setBusy(d.id);
                    await api.resolveDecision(d.id, `${d.primaryAction} — ${d.title}`);
                    setBusy(null);
                  }}
                >
                  {d.primaryAction}
                </Button>
                <ButtonLink href="/plans" className="px-3.5 py-2 text-[13px]">
                  ดูรายละเอียด
                </ButtonLink>
              </div>
            </div>
          ))}
          <div className="mt-1 flex flex-col gap-2 border-t border-divider pt-3">
            <span className="text-xs text-muted">Autopilot ล่าสุด</span>
            {data.actions.slice(0, 5).map((a) => (
              <div key={a.id} className="flex gap-2 text-[13px]">
                <span className="w-16 shrink-0 font-semibold text-ai">{a.agent}</span>
                <span className="text-secondary">{a.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="แผนล่าสุด" right={<Link href="/plans" className="text-[13px] text-link no-underline">ดูทั้งหมด →</Link>} />
        <div className="flex flex-wrap gap-2 px-[18px] pb-4">
          {data.plans.slice(0, 8).map((p) => (
            <Link key={p.id} href={`/plans/${p.id}`} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[13px] text-ink no-underline hover:bg-ground">
              <b className="font-semibold">{p.planRef}</b>
              <Pill tone={p.issue ? 'danger' : PLAN_STATUS[p.status].tone}>{p.issue ?? PLAN_STATUS[p.status].label}</Pill>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
