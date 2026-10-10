'use client';

import { ContainerCard } from '@/components/ContainerCards';
import { ErrorBox, Loading, PageHeader } from '@/components/ui';
import { useLive } from '@/lib/api/provider';

export default function LoadingIndexPage() {
  const { data, error } = useLive((a) => a.overview(), [], null);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const order = { LOADING: 0, READY: 1, PICKING: 2, PLANNED: 3, CLOSED: 4 } as const;
  const list = [...data.containers].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <>
      <PageHeader title="ตู้ & โหลด" crumbs="เลือกตู้เพื่อดูการโหลดแบบเรียลไทม์" />
      <div className="grid grid-cols-1 gap-4 px-7 pt-[18px] pb-7 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <ContainerCard key={c.id} c={c} shipment={data.shipments.find((s) => s.id === c.shipmentId)} />
        ))}
      </div>
    </>
  );
}
