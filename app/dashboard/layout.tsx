import { ReactNode } from 'react';
import { DashboardProvider } from '@/src/context/DashboardContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardProvider>{children}</DashboardProvider>;
}
