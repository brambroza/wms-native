'use client';

import { CONTAINER_STATUS } from '@wms/shared';
import { PackageCheck, PackageOpen, Truck, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { StaffHeader } from '@/components/staff/StaffShell';
import { Pill, Progress } from '@/components/ui';
import { useLive } from '@/lib/api/provider';

export default function StaffHome() {
  const { data } = useLive((a) => a.overview(), [], null);
  const open = (data?.containers ?? []).filter((c) => c.status !== 'CLOSED');
  const loading = open.find((c) => c.status === 'LOADING');
  const picking = open.find((c) => c.status === 'PICKING' || c.status === 'PLANNED');

  const tiles = [
    { href: picking ? `/m/pick/${picking.id}` : '/m', label: 'หยิบ', sub: picking ? `ตู้ ${picking.code}` : 'ไม่มีงาน', icon: PackageOpen },
    { href: loading ? `/m/load/${loading.id}` : '/m', label: 'โหลดตู้', sub: loading ? `ตู้ ${loading.code}` : 'ไม่มีงาน', icon: Truck },
    { href: '/m/receive?mode=RECEIVE', label: 'รับเข้า', sub: 'จากคลังสาขา', icon: PackageCheck },
    { href: '/m/receive?mode=PUTAWAY', label: 'วางของ', sub: 'สแกนกล่อง → ตำแหน่ง', icon: Warehouse },
  ];

  return (
    <>
      <StaffHeader title="งานของฉัน" sub="FG Dock · Staff" />
      <main className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ href, label, sub, icon: Icon }) => (
            <Link key={label} href={href} className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-line bg-card p-4 text-ink no-underline active:bg-primary-soft">
              <Icon size={28} className="text-link" aria-hidden />
              <div className="flex flex-col">
                <b className="text-lg font-semibold">{label}</b>
                <span className="text-[13px] text-muted">{sub}</span>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="m-0 mt-2 text-[15px] font-semibold text-secondary">ตู้ที่ยังไม่ปิด</h2>
        {!data && <p className="text-sm text-muted">กำลังโหลด…</p>}
        {open.map((c) => {
          const pct = c.plannedCartons ? (c.loadedCartons / c.plannedCartons) * 100 : 0;
          const st = CONTAINER_STATUS[c.status];
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2">
                <b className="text-base font-semibold">{c.code}</b>
                <span className="text-[13px] text-muted">
                  {c.type}
                  {c.dock ? ` · ${c.dock}` : ''}
                </span>
                <span className="ml-auto">
                  <Pill tone={st.tone}>{st.label}</Pill>
                </span>
              </div>
              <Progress value={pct} />
              <div className="flex gap-2">
                <Link href={`/m/pick/${c.id}`} className="flex-1 rounded-xl border border-line py-3 text-center text-[15px] text-ink no-underline">
                  หยิบ
                </Link>
                <Link href={`/m/load/${c.id}`} className="flex-1 rounded-xl bg-primary py-3 text-center text-[15px] font-semibold text-white no-underline">
                  โหลด {c.loadedCartons}/{c.plannedCartons}
                </Link>
              </div>
            </div>
          );
        })}
        <Link href="/" className="pt-2 text-center text-[13px] text-link no-underline">
          ไปหน้าผู้จัดการ (เว็บ)
        </Link>
      </main>
    </>
  );
}
