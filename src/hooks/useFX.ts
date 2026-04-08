import { useEffect, useRef, useState } from 'react';

type FXState = {
  ccl: number | null;
};

let fxCache: { value: number | null; ts: number } | null = null;
const FX_TTL = 60_000;

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchCclRate(): Promise<number | null> {
  const internal = await fetchJsonWithTimeout<{ ccl?: number }>('/api/fx/ccl');
  const rate = Number(internal?.ccl ?? null);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function useFX(): FXState {
  const [state, setState] = useState<FXState>({ ccl: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      const now = Date.now();
      if (fxCache && now - fxCache.ts < FX_TTL) {
        if (mountedRef.current) setState({ ccl: fxCache.value });
        return;
      }

      const ccl = await fetchCclRate();
      fxCache = { value: ccl, ts: Date.now() };
      if (mountedRef.current) setState({ ccl });
    };

    load().catch(() => undefined);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return state;
}
