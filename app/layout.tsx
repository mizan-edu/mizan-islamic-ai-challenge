import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import '@fontsource/noto-naskh-arabic/latin-400.css';
import '@fontsource/noto-naskh-arabic/latin-700.css';
import './globals.css';
import JudgeFlag from '@/app/_components/JudgeFlag';
import { approvedText, loadUiStrings } from '@/app/_lib/content';

// Baloo Bhaijaan 2 (SIL OFL 1.1; public/fonts/BalooBhaijaan2-OFL.txt, LICENSES.md): headings, buttons
// and child lines. Files from @fontsource/baloo-bhaijaan-2, bundled by next/font and served from
// this app; child devices make no third-party font requests. Latin subset covers the digits.
const balooArabic = localFont({
  src: [
    { path: '../node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-700-normal.woff2', weight: '700' },
    { path: '../node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-800-normal.woff2', weight: '800' },
  ],
  variable: '--font-baloo-ar',
  display: 'swap',
  adjustFontFallback: false,
});
const balooLatin = localFont({
  src: [
    { path: '../node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-700-normal.woff2', weight: '700' },
    { path: '../node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-800-normal.woff2', weight: '800' },
  ],
  variable: '--font-baloo-latin',
  display: 'swap',
  adjustFontFallback: false,
});

export function generateMetadata(): Metadata {
  const title = approvedText(loadUiStrings().values(), 'UI.JOURNEY_TITLE') ?? 'MIZAN';
  return { title, applicationName: 'MIZAN' };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#CFEAF7',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${balooArabic.variable} ${balooLatin.variable}`}>
      <body className="min-h-dvh antialiased">{children}<JudgeFlag /></body>
    </html>
  );
}
