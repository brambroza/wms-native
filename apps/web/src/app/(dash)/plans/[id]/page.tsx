'use client';

import { CARTON_STATUS, PLAN_STATUS, type CartonStatus } from '@wms/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardHeader, ErrorBox, Loading, PageHeader, Pill } from '@/components/ui';
import { useLive } from '@/lib/api/provider';

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useLive((a) => a.getPlan(id), [id], null);
  if (error) return <ErrorBox message={error} />;
  if (data === undefined) return <Loading />;
  if (!data) return <ErrorBox message="ไม่พบแผนนี้" />;
  const { plan, ranges, cartons } = data;
  const st = PLAN_STATUS[plan.status];
  const byStatus = cartons.reduce<Record<string, number>>((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {});
  const containerIds = [...new Set(cartons.map((c) => c.containerId).filter(Boolean))] as string[];
  const missing = plan.totals.cartons - cartons.length;

  return (
    <>
      <PageHeader title={`${plan.planRef}${plan.version > 1 ? ` · v${plan.version}` : ''}`} crumbs={`Packing Plan › ${plan.description}`} actions={<Pill tone={plan.issue ? 'danger' : st.tone}>{plan.issue ?? st.label}</Pill>} />
      <div className="flex flex-col gap-4 px-7 pt-[18px] pb-7">
        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          {[
            ['กล่องตามแผน', plan.totals.cartons],
            ['ชิ้น', plan.totals.itemQty],
            ['Gross kg', plan.totals.grossKg],
            ['CBM', plan.totals.cbm],
          ].map(([k, v]) => (
            <Card key={k as string} className="flex flex-col gap-1 px-[18px] py-4">
              <span className="text-sm text-secondary">{k}</span>
              <b className="text-2xl font-semibold">{v}</b>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          <Card className="flex min-w-0 flex-[1_1_360px] flex-col gap-2 px-5 py-4">
            <h2 className="m-0 text-base font-semibold">ข้อมูลแผน</h2>
            {[
              ['PO / Line', `${plan.poNo} / ${plan.poLine}`],
              ['รหัสโรงงาน (vendor)', plan.vendorFactoryCode || '-'],
              ['คลังต้นทาง', plan.factoryWarehouseId ?? 'ยังไม่ map'],
              ['ที่มา', plan.source],
              ['ตู้', containerIds.length ? containerIds.join(', ') : 'ยังไม่จัดตู้'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-divider pb-2 text-sm">
                <span className="w-40 text-muted">{k}</span>
                <b className="font-semibold">{v}</b>
              </div>
            ))}
            {containerIds.map((cid) => (
              <Link key={cid} href={`/loading/${cid}`} className="text-sm text-link no-underline">
                เปิดหน้าโหลดตู้ {cid} →
              </Link>
            ))}
          </Card>
          <Card className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 px-5 py-4">
            <h2 className="m-0 text-base font-semibold">สถานะกล่อง</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byStatus).map(([s, n]) => (
                <Pill key={s} tone={CARTON_STATUS[s as CartonStatus].tone}>
                  {CARTON_STATUS[s as CartonStatus].label} {n}
                </Pill>
              ))}
              {missing > 0 && <Pill tone="danger">ยังไม่พบในคลัง {missing}</Pill>}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader title={`ช่วงกล่อง · ${ranges.length} ช่วง`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  {['Range', 'Serial', 'Size', 'กล่อง', 'Pack', 'ชิ้น/กล่อง', 'Gross kg', 'ขนาด (cm)'].map((x) => (
                    <th key={x} className="bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranges.map((r) => (
                  <tr key={r.rangeNo}>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">{r.rangeNo}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">
                      {r.serialFrom}
                      {r.serialTo !== r.serialFrom && `–${r.serialTo}`}
                    </td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm font-semibold">{r.size}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">{r.cartonCount}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">{r.cartonCode}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">{r.qtyPerCarton}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">{r.grossKg}</td>
                    <td className="border-t border-divider px-4 py-2.5 text-sm">
                      {r.lengthCm} × {r.widthCm} × {r.heightCm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
