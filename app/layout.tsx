import './globals.css';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/layout/AppShell';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
