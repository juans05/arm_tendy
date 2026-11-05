import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import RegistrarSW from '@/components/RegistrarSW';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });

export const metadata: Metadata = {
  title: 'ARM',
  description: 'Atiende y convierte a tus clientes de WhatsApp',
  appleWebApp: { capable: true, title: 'ARM', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#1d2645',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${bricolage.variable} ${figtree.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
