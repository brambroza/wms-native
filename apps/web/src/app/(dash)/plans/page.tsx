'use client';

import { PLAN_STATUS, type PackingPlan } from '@wms/shared';
import { Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ButtonLink, Card, ErrorBox, Loading, PageHeader, Pill, cx } from '@/components/ui';
import { useLive } from '@/lib/api/provider';

const TABS = [
  { k: 'all', label: 'ทั้งหมด', match: () => true },
  { k: 'review', label: 'รอตรวจ', match: (p: PackingPlan) => ['DRAFT', 'VALIDATED', 'PENDING_APPROVAL'].includes(p.status) },
  { k: 'planned', label: 'จัดตู้แล้ว', match: (p: PackingPlan) => ['APPROVED', 'SUBMITTED', 'RELEASED', 'LOADING'].includes(p.status) },
  { k: 'issue', label: 'มีปัญหา', match: (p: PackingPlan) => Boolean(p.issue) },
  { k: 'done', label: 'โหลดแล้ว', match: (p: PackingPlan) => p.status === 'CLOSED' },
] as const;

const SOURCE_TONE = { PDF: 'danger', EXCEL: 'success', CSV: 'success', MERCURY: 'info', MANUAL: 'neutral' } as const;

export default function PlansPage() {
  const { data, error } = useLive((a) => a.overview(), [], null);
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    const t = TABS.find((x) => x.k === tab)!;
    const s = q.trim().toLowerCase();
    return data.plans.filter((p) => t.match(p) && (!s || `${p.planRef} ${p.description} ${p.vendorFactoryCode}`.toLowerCase().includes(s)));
  }, [data, tab, q]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const total = data.plans.length || 1;
  const seg = [
    { label: 'โหลดแล้ว', n: data.plans.filter((p) => p.status === 'CLOSED').length, c: 'bg-success-data' },
    { label: 'จัดตู้แล้ว', n: data.plans.filter((p) => TABS[2].match(p)).length, c: 'bg-data' },
    { label: 'รอตรวจ', n: data.plans.filter((p) => TABS[1].match(p) && !p.issue).length, c: 'bg-warn-data' },
    { label: 'มีปัญหา', n: data.plans.filter((p) => p.issue).length, c: 'bg-danger-data' },
  ];
  const cartons = data.plans.reduce((s, p) => s + (p.totals.cartons ?? 0), 0);
  const cbm = data.plans.reduce((s, p) => s + (p.totals.cbm ?? 0), 0);
  const shipmentOf = (id: string | null) => data.shipments.find((s) => s.id === id);

  return (
    <>
      <PageHeader
        title="Packing Plans"
        crumbs="Packing Plan › รายการแผน"
        actions={
          <ButtonLink href="/plans/import" variant="primary">
            <Upload size={16} aria-hidden /> นำเข้าไฟล์
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-4 px-7 pt-[18px] pb-7">
        <Card className="flex flex-col gap-3 px-5 py-[18px]">
          <div className="flex flex-wrap items-baseline gap-3.5">
            <b className="text-base font-semibold">แผนทั้งหมด</b>
            <span className="text-sm text-secondary">
              รวม <b>{cartons.toLocaleString()} กล่อง</b> · {data.plans.length} แผน
            </span>
            <span className="ml-auto text-sm text-secondary">
              ปริมาตรรวม <b>{cbm.toFixed(1)} CBM</b>
            </span>
          </div>
          <div className="flex h-3 gap-1">
            {seg.filter((s) => s.n).map((s) => (
              <div key={s.label} className={cx('rounded-md', s.c)} style={{ flex: s.n / total }} title={`${s.label} ${s.n}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-5 text-[13px] text-secondary">
            {seg.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span className={cx('h-2.5 w-2.5 rounded-full', s.c)} />
                {s.label} {s.n} แผน
              </span>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-[18px] py-3.5">
            <div role="tablist" aria-label="กรองสถานะ" className="flex flex-wrap gap-5">
              {TABS.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.k}
                  onClick={() => setTab(t.k)}
                  className={cx('border-b-2 py-1.5 text-sm', tab === t.k ? 'border-primary font-semibold text-link' : 'border-transparent text-muted')}
                >
                  {t.label} ({data.plans.filter(t.match).length})
                </button>
              ))}
            </div>
            <label className="ml-auto flex w-60 items-center gap-2 rounded-[10px] border border-line px-3 py-2">
              <Search size={16} className="text-muted" aria-hidden />
              <span className="sr-only">ค้นหาแผน</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="PO, Plan Ref, โรงงาน…" className="min-w-0 flex-1 border-0 text-sm outline-none" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr>
                  {['Plan Ref', 'Description', 'โรงงาน', 'Shipment', 'กล่อง', 'Gross kg', 'CBM', 'ที่มา', 'สถานะ'].map((h) => (
                    <th key={h} className="bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const s = shipmentOf(p.shipmentId);
                  const st = PLAN_STATUS[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-ground">
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <Link href={`/plans/${p.id}`} className="font-semibold text-link no-underline">
                          {p.planRef}
                        </Link>
                        {p.version > 1 && <span className="ml-1.5 text-xs text-muted">v{p.version}</span>}
                      </td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{p.description}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{p.vendorFactoryCode || '-'}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{s ? `${s.shipmentDate} · ${s.shipMethod === 'SEA' ? 'ทางเรือ' : s.shipMethod}` : '-'}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{p.totals.cartons}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{p.totals.grossKg?.toLocaleString()}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">{p.totals.cbm?.toFixed(3)}</td>
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', { danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success', info: 'bg-primary-soft text-link', neutral: 'bg-neutral-soft text-secondary' }[SOURCE_TONE[p.source]])}>
                          {p.source}
                        </span>
                      </td>
                      <td className="border-t border-divider px-4 py-3 text-sm">
                        <Pill tone={p.issue ? 'danger' : st.tone}>{p.issue ?? st.label}</Pill>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="border-t border-divider px-4 py-10 text-center text-sm text-muted">
                      ไม่พบแผนที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
