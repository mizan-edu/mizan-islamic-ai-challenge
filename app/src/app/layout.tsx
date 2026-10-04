import type { Metadata, Viewport } from 'next';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import '@fontsource/noto-naskh-arabic/latin-400.css';
import '@fontsource/noto-naskh-arabic/latin-700.css';
import './globals.css';
import { approvedText, loadUiStrings } from '@/lib/content';

export function generateMetadata(): Metadata {
  const title = approvedText(loadUiStrings().values(), 'UI.JOURNEY_TITLE') ?? 'MIZAN';
  return { title, applicationName: 'MIZAN' };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f4ec',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
