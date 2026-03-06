import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi Patrimonio Pro',
  description: 'Net worth tracker profesional'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
