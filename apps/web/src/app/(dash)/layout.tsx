import { Suspense } from 'react';
import { AuthGate, DemoBanner } from '@/components/AuthGate';
import { Sidebar } from '@/components/Sidebar';
import { Loading } from '@/components/ui';

// URL hooks (usePathname / useParams) are runtime data under cacheComponents, so the
// sidebar and the page each stream in behind their own Suspense boundary.
export default function DashLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Suspense fallback={<aside className="w-full border-b border-line bg-card lg:h-screen lg:w-[240px] lg:border-r lg:border-b-0" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <Suspense fallback={<Loading />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </div>
    </div>
  );
}
