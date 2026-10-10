import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { ServiceWorker } from '@/components/staff/StaffShell';

export const metadata: Metadata = { title: 'Staff' };

export default function StaffLayout({ children }: LayoutProps<'/m'>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-ground">
      <ServiceWorker />
      <Suspense fallback={<div className="p-6 text-sm text-muted">กำลังโหลด…</div>}>
        <AuthGate next="/m">{children}</AuthGate>
      </Suspense>
    </div>
  );
}
