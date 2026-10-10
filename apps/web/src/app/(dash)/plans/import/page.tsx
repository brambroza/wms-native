'use client';

import { suggestContainerType, validatePlan, type ParsedPlan } from '@wms/shared';
import { CheckCircle2, FileUp, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, CardHeader, PageHeader, Pill, cx } from '@/components/ui';
import { useWms } from '@/lib/api/provider';
import type { ImportResult } from '@/lib/api/types';
import { parseImportFile, type FileParseResult } from '@/lib/importFile';

const LEVEL_PILL = { ok: { tone: 'success', label: 'ตรง' }, warn: { tone: 'warn', label: 'ยอมรับได้' }, error: { tone: 'danger', label: 'ไม่ตรง' } } as const;

export default function ImportPage() {
  const { api } = useWms();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<FileParseResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<(ImportResult & { planRef: string })[]>([]);
  const [drag, setDrag] = useState(false);

  async function onFile(f: File) {
    setFile(f);
    setErr(null);
    setParsed(null);
    setResults([]);
    try {
      const r = await parseImportFile(f);
      if (r.plans.length === 0) throw new Error('อ่านไฟล์ได้ แต่ไม่พบ Packing Plan ในรูปแบบที่รองรับ');
      setParsed(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function save() {
    if (!parsed) return;
    setSaving(true);
    setErr(null);
    try {
      const out: (ImportResult & { planRef: string })[] = [];
      for (const p of parsed.plans) {
        const v = validatePlan(p);
        const r = await api.importPlan(p, { source: parsed.source, shipMethod: v.shipMethod, totals: v.computed });
        out.push({ ...r, planRef: p.header.planRef });
      }
      setResults(out);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="นำเข้า Packing Plan" crumbs="Packing Plan › นำเข้า" />
      <div className="flex flex-col gap-4 px-7 pt-[18px] pb-7">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) void onFile(f);
          }}
          className={cx('flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 border-dashed bg-card px-6 py-10 text-center', drag ? 'border-primary bg-primary-soft' : 'border-line')}
        >
          <FileUp size={28} className="text-link" aria-hidden />
          <b className="text-base font-semibold">{file ? file.name : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'}</b>
          <span className="text-[13px] text-muted">PDF รายงาน Packing Plan จาก vendor · Excel (.xlsx) · CSV — ระบบอ่านและตรวจยอดให้ก่อนบันทึก</span>
          <input type="file" accept=".pdf,.xlsx,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>

        {err && <div className="rounded-[10px] bg-danger-soft p-4 text-sm text-danger">{err}</div>}

        {results.length > 0 && (
          <Card className="flex flex-col gap-2 px-5 py-4">
            <div className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 size={18} aria-hidden /> บันทึกแล้ว {results.length} แผน
            </div>
            {results.map((r) => (
              <div key={r.planId} className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/plans/${r.planId}`} className="font-semibold text-link no-underline">
                  {r.planRef} (v{r.version})
                </Link>
                <span>
                  พบกล่องในคลัง {r.matchedCartons}/{r.expectedCartons}
                </span>
                {r.missingCartons > 0 && <Pill tone="warn">ยังไม่พบ {r.missingCartons} กล่อง</Pill>}
                {!r.factoryWarehouseId && <Pill tone="danger">ต้อง map รหัสโรงงาน</Pill>}
              </div>
            ))}
          </Card>
        )}

        {parsed?.plans.map((p) => <PlanPreview key={p.header.planRef} plan={p} />)}

        {parsed && results.length === 0 && (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setParsed(null)}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : `บันทึก ${parsed.plans.length} แผน + จองกล่อง`}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function PlanPreview({ plan }: { plan: ParsedPlan }) {
  const v = validatePlan(plan);
  const h = plan.header;
  const fit = suggestContainerType(
    plan.ranges.map((r) => ({ key: r.cartonCode, group: r.poNo, lengthCm: r.lengthCm, widthCm: r.widthCm, heightCm: r.heightCm, grossKg: r.grossKg, count: r.cartonCount })),
  );
  const head: [string, string | null][] = [
    ['Plan Ref', h.planRef],
    ['PO / Line', `${h.poNo} / ${h.poLine}`],
    ['วันที่ Shipment', h.shipmentDate],
    ['รหัสโรงงาน (vendor)', h.vendorFactoryCode],
    ['Ship-to', h.shipToCode],
    ['ปลายทาง', h.destination],
    ['ขนส่ง', v.shipMethod === 'SEA' ? 'ทางเรือ' : v.shipMethod],
    ['Description', h.description],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <Card className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5 px-5 py-4">
          <h2 className="m-0 text-base font-semibold">หัวเอกสาร</h2>
          {head.map(([k, val]) => (
            <div key={k} className="flex gap-3 border-b border-divider pb-2 text-sm">
              <span className="w-40 text-muted">{k}</span>
              <b className="font-semibold">{val ?? '-'}</b>
            </div>
          ))}
        </Card>
        <Card className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-base font-semibold">ตรวจยอดควบคุม</h2>
            <span className="ml-auto">
              {v.level === 'error' ? (
                <Pill tone="danger">
                  <TriangleAlert size={12} className="mr-1" aria-hidden />
                  มีจุดไม่ตรง
                </Pill>
              ) : (
                <Pill tone="success">ผ่าน</Pill>
              )}
            </span>
          </div>
          <div className="grid grid-cols-[1.6fr_.8fr_.8fr_1fr] gap-2 text-xs text-muted">
            <span>รายการ</span>
            <span>เอกสาร</span>
            <span>คำนวณ</span>
            <span>ผล</span>
          </div>
          {v.checks.map((c) => (
            <div key={c.key} className="grid grid-cols-[1.6fr_.8fr_.8fr_1fr] items-center gap-2 text-sm">
              <span>{c.label}</span>
              <span>{c.document}</span>
              <span>{c.computed}</span>
              <span>
                <Pill tone={LEVEL_PILL[c.level].tone}>{c.note ?? LEVEL_PILL[c.level].label}</Pill>
              </span>
            </div>
          ))}
          <span className="text-xs text-muted">น้ำหนักในรายละเอียดเป็นแบบ {v.weightBasis === 'per_carton' ? 'ต่อกล่อง' : v.weightBasis === 'per_range' ? 'ต่อช่วง' : 'ไม่แน่ใจ'}</span>
        </Card>
        <Card className="flex min-w-0 flex-[1_1_280px] flex-col gap-2 border-2 border-data px-5 py-4">
          <h2 className="m-0 text-base font-semibold">ตู้ที่พอดี</h2>
          <b className="text-2xl font-semibold">{fit.containerType}</b>
          <span className="text-sm text-secondary">
            ใช้ปริมาตร {fit.volumeUsedPct}% · ยาว {(fit.lengthUsedCm / 100).toFixed(2)} ม.
          </span>
          <span className="text-[13px] text-muted">แผนนี้มี {v.computed.cartons} กล่อง ระบบจะรวมกับแผนอื่นใน shipment เดียวกันเพื่อให้เต็มตู้</span>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={`รายละเอียดกล่อง · ${plan.ranges.length} ช่วง · ${v.computed.cartons} กล่อง · ${v.computed.itemQty} ชิ้น`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                {['Range', 'กล่อง', 'Serial', 'Style · Color', 'Size', 'ชิ้น/กล่อง', 'Pack', 'Gross kg', 'L × W × H (cm)'].map((x) => (
                  <th key={x} className="bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.ranges.map((r) => (
                <tr key={r.rangeNo}>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">{r.rangeNo}</td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">{r.cartonFrom === r.cartonTo ? r.cartonFrom : `${r.cartonFrom}–${r.cartonTo}`}</td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">{r.serialFrom === r.serialTo ? r.serialFrom : `${r.serialFrom}–${r.serialTo}`}</td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">
                    {r.styleColor || r.style} · {r.color}
                  </td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm font-semibold">{r.size}</td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">{r.qtyPerCarton}</td>
                  <td className="border-t border-divider px-4 py-2.5 text-sm">{r.cartonCode}</td>
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
  );
}
