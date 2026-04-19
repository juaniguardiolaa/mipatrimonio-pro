'use client';

import { createContext, ReactNode, useContext } from 'react';
import { useDashboard } from '@/src/hooks/useDashboard';

type DashboardContextValue = ReturnType<typeof useDashboard>;

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const dashboard = useDashboard();
  return <DashboardContext.Provider value={dashboard}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardContext must be used within DashboardProvider');
  return ctx;
}
