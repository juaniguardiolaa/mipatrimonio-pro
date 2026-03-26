import { useEffect, useRef, useState } from 'react';

type FXState = {
  ccl: number | null;
};

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
  const dolarApi = await fetchJsonWithTimeout<{ venta?: number }>('https://dolarapi.com/v1/dolares/contadoconliqui');
  const fromDolarApi = Number(dolarApi?.venta ?? null);
  if (Number.isFinite(fromDolarApi) && fromDolarApi > 0) return fromDolarApi;

  const bluelytics = await fetchJsonWithTimeout<{
    ccl?: { value_sell?: number };
  }>('https://api.bluelytics.com.ar/v2/latest');
  const fromBluelytics = Number(bluelytics?.ccl?.value_sell ?? null);
  if (Number.isFinite(fromBluelytics) && fromBluelytics > 0) return fromBluelytics;

  return null;
}

export function useFX(): FXState {
  const [state, setState] = useState<FXState>({ ccl: null });
  const cacheRef = useRef<{ ccl: number | null; ts: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.ts < 60_000) {
        if (mounted) setState({ ccl: cacheRef.current.ccl });
        return;
      }

      const ccl = await fetchCclRate();
      cacheRef.current = { ccl, ts: Date.now() };
      if (mounted) setState({ ccl });
    };

    load().catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
