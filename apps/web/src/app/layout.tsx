import type { Metadata, Viewport } from 'next';
import { ApiProvider } from '@/lib/api/provider';
// Kanit is self-hosted (Thai + Latin) so the staff PWA keeps its font offline
import '@fontsource/kanit/300.css';
import '@fontsource/kanit/400.css';
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FG Dock · WMS ส่งออก', template: '%s · FG Dock' },
  description: 'WMS งาน FG ส่งออก: Packing Plan, สต็อกรายกล่อง, คำนวณตู้ และโหลดตู้เรียลไทม์',
  applicationName: 'FG Dock',
  appleWebApp: { capable: true, title: 'FG Dock', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#1c74c4',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-ground text-ink antialiased">
        <ApiProvider>{children}</ApiProvider>
      </body>
    </html>
  );
}
