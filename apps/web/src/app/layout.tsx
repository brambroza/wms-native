import type { Metadata, Viewport } from 'next';
import { ApiProvider } from '@/lib/api/provider';
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-ground text-ink antialiased">
        <ApiProvider>{children}</ApiProvider>
      </body>
    </html>
  );
}
