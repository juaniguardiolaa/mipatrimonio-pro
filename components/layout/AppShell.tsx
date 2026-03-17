'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bot, Building2, CircleDollarSign, Goal, Landmark, LayoutDashboard, LogOut, RefreshCcw, Settings, Wallet } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const sections = [
  { title: 'Core', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/accounts', label: 'Accounts', icon: Building2 },
    { href: '/investments', label: 'Investments', icon: Landmark },
    { href: '/income', label: 'Income', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: Wallet },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ]},
  { title: 'Intelligence', items: [
    { href: '/ai-analysis', label: 'AI Analysis', icon: Bot },
    { href: '/goals', label: 'Goals', icon: Goal },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

const authRoutes = new Set(['/login', '/signup']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (authRoutes.has(pathname)) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  const initials = 'MP';

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-card p-5 lg:block">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mi Patrimonio Pro</p>
        <h1 className="mb-8 text-xl font-bold text-primary">Fintech Suite</h1>
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition', active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                      <item.icon className="h-4 w-4" />{item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      <main className="lg:ml-72">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap gap-2">
            <Select><option>Portfolio Principal</option></Select>
            <Select><option>ARS</option><option>USD</option></Select>
            <Button variant="outline" size="icon"><RefreshCcw className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Avatar initials={initials} />
            <Button variant="outline" size="sm" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}><LogOut className="mr-1 h-4 w-4" />Salir</Button>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
