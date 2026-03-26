'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PricingStatusIndicator } from '@/components/pricing/PricingStatusIndicator';

type PricingStatus = 'idle' | 'updating' | 'updated' | 'error';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const LOCAL_STORAGE_KEY = 'lastPricingUpdate';

export function AutoPricingUpdater({ onUpdated }: { onUpdated?: () => Promise<void> | void }) {
  const router = useRouter();
  const runningRef = useRef(false);
  const [status, setStatus] = useState<PricingStatus>('idle');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const executeUpdate = useCallback(async (force = false) => {
    if (runningRef.current) return;

    const lastRaw = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    const lastUpdate = lastRaw ? Number(lastRaw) : 0;
    const stale = Date.now() - lastUpdate > FIVE_MINUTES_MS;

    if (!force && !stale) {
      setStatus('updated');
      setLastUpdatedAt(lastUpdate ? new Date(lastUpdate) : null);
      return;
    }

    runningRef.current = true;
    setStatus('updating');

    try {
      const res = await fetch('/api/pricing/update', { method: 'GET', cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('pricing update failed');

      const now = Date.now();
      window.localStorage.setItem(LOCAL_STORAGE_KEY, String(now));
      setStatus('updated');
      setLastUpdatedAt(new Date(now));

      await onUpdated?.();
      router.refresh();
    } catch {
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [onUpdated, router]);

  useEffect(() => {
    executeUpdate().catch(() => undefined);
    const interval = window.setInterval(() => {
      executeUpdate(true).catch(() => undefined);
    }, FIVE_MINUTES_MS);

    return () => window.clearInterval(interval);
  }, [executeUpdate]);

  return <PricingStatusIndicator status={status} lastUpdatedAt={lastUpdatedAt} />;
}
