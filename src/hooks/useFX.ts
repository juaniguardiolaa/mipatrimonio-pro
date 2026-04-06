import { useEffect, useRef, useState } from 'react';
 
type FXState = {
  ccl: number | null;
  loading: boolean;
  error: string | null;
};
 
// Module-level cache so all hook instances share one in-memory value
// per browser session (avoids N simultaneous fetches on first render).
let fxCache: { value: number | null; ts: number } | null = null;
const FX_TTL_MS = 60_000; // 1 minute — matches server-side DB cache TTL
 
export function useFX(): FXState {
  const [state, setState] = useState<FXState>({
    ccl: fxCache?.value ?? null,
    loading: fxCache === null,
    error: null,
  });
  const mountedRef = useRef(true);
 
  useEffect(() => {
    mountedRef.current = true;
 
    const load = async () => {
      const now = Date.now();
 
      // Use in-memory cache if fresh enough
      if (fxCache && now - fxCache.ts < FX_TTL_MS) {
        if (mountedRef.current) {
          setState({ ccl: fxCache.value, loading: false, error: null });
        }
        return;
      }
 
      // All external FX requests go through our own backend route
      // to avoid CORS issues with dolarapi.com / bluelytics.com.ar
      try {
        const response = await fetch('/api/fx/ccl', {
          cache: 'no-store',
          credentials: 'include',
        });
 
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { message?: string };
          const msg = body?.message ?? `HTTP ${response.status}`;
          console.warn('[useFX] api_error', { status: response.status, msg });
 
          fxCache = { value: null, ts: now };
          if (mountedRef.current) setState({ ccl: null, loading: false, error: msg });
          return;
        }
 
        const data = await response.json() as { ok: boolean; ccl: number | null };
        const ccl = typeof data.ccl === 'number' && data.ccl > 0 ? data.ccl : null;
 
        if (!ccl) {
          console.warn('[useFX] ccl_unavailable', { data });
        }
 
        fxCache = { value: ccl, ts: now };
        if (mountedRef.current) setState({ ccl, loading: false, error: null });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'fetch_failed';
        console.error('[useFX] fetch_error', { message: msg });
        fxCache = { value: null, ts: now };
        if (mountedRef.current) setState({ ccl: null, loading: false, error: msg });
      }
    };
 
    load().catch(() => undefined);
 
    return () => {
      mountedRef.current = false;
    };
  }, []);
 
  return state;
}
 
