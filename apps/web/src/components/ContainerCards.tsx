'use client';

import { CONTAINER_STATUS, type Container, type Shipment } from '@wms/shared';
import Link from 'next/link';
import { TruckFill } from './TruckFill';
import { Pill, cx } from './ui';

export function ContainerCard({ c, shipment, active }: { c: Container; shipment?: Shipment | null; active?: boolean }) {
  const pct = c.plannedCartons ? (c.loadedCartons / c.plannedCartons) * 100 : 0;
  const st = CONTAINER_STATUS[c.status];
  return (
    <Link
      href={`/loading/${c.id}`}
      aria-current={active ? 'page' : undefined}
      className={cx('flex flex-col gap-2 rounded-xl border p-3 text-ink no-underline', active ? 'border-2 border-data bg-[#f5faff]' : 'border-line bg-card hover:bg-ground')}
    >
      <div className="flex items-center gap-2">
        <b className="text-[15px] font-semibold">{c.code}</b>
        <span className="text-xs text-muted">
          {c.type}
          {c.dock ? ` · ${c.dock}` : ''}
        </span>
        <span className="ml-auto">
          <Pill tone={st.tone}>{st.label}</Pill>
        </span>
      </div>
      <TruckFill pct={pct} compact label={`${c.code} โหลดแล้ว ${Math.round(pct)}%`} />
      <div className="flex text-xs text-muted">
        <span>{shipment ? `${shipment.shipmentDate} · ${shipment.destination}` : ''}</span>
        <span className="ml-auto font-semibold text-ink">
          {c.loadedCartons}/{c.plannedCartons}
        </span>
      </div>
    </Link>
  );
}
