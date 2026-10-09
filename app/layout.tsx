import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';

export const metadata: Metadata = {
  title: 'Ñam Ñam',
  description: 'Seguimiento personal de nutrición, recetas, historial y supermercado.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b0d12',
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="es">
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
