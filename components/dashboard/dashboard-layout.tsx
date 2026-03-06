import { SidebarNav } from '@/components/dashboard/sidebar-nav';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
