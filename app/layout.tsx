import type { Metadata, Viewport } from 'next';
import '../src/styles.css';
import '../src/redesign.css';

export const metadata: Metadata = {
  title: 'Gym Hawk',
  description: 'Your personal training space.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Gym Hawk', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  other: { 'gym-hawk-shell': '1' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f5f3', viewportFit: 'cover' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
