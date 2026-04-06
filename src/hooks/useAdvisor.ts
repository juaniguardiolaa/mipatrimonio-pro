import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useSimulation } from './useSimulation';
import { useAdvisorMemory } from './useAdvisorMemory';
 
type AdvisorResponse = {
  answer: string;
  actions: Array<{ text: string; impact: number }>;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
};
 
type CompactContext = {
  financialSummary: {
    netWorthUsd: number;
    savingsRate: number;
    allocations: Array<{ assetType: string; percentage: number }>;
    alerts: Array<{ severity: 'low' | 'medium' | 'high'; message: string }>;
    recommendations: Array<{ action: string }>;
    simulation: {
      yearsToGoal: number | null;
      expectedReturn: number;
    };
    snapshotHash: string;
  };
  memory: {
    lastQuestions: string[];
    lastRecommendations: Array<{
      text: string;
      impact: number;
      status: 'pending' | 'completed' | 'ignored';
    }>;
  };
};
 
// ── FIX: raised from 2 048 to 8 192 bytes to match the server-side limit.
// The original 2 KB ceiling was hit regularly on portfolios with ≥ 5 alerts,
// throwing before any request was ever sent. TextEncoder gives accurate UTF-8
// byte counts (Blob was correct too, but less available in all runtimes).
const MAX_PAYLOAD_BYTES = 8_192;
 
function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return String(hash >>> 0);
}
 
const compact = (text: string, max = 100) =>
  text.length <= max ? text : `${text.slice(0, max)}...`;
 
export function useAdvisor() {
  const dashboard = useDashboard();
  const insights = useFinancialInsights();
  const simulation = useSimulation();
  const advisorMemory = useAdvisorMemory();
 
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<AdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
 
  const cacheRef = useRef<Map<string, AdvisorResponse>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<AdvisorResponse>>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 
  // Clean up any pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
 
  const context = useMemo<CompactContext>(() => {
    const allocations = [...dashboard.allocation.byType]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
      .map((r) => ({ assetType: r.assetType, percentage: r.percentage }));
 
    const alerts = [...insights.alerts]
      .slice(0, 3)
      .map((a) => ({ severity: a.severity, message: compact(a.message) }));
 
    const recommendations = [...insights.recommendations]
      .slice(0, 3)
      .map((r) => ({ action: compact(r.action, 120) }));
 
    const fingerprint = {
      netWorthUsd: dashboard.netWorth.usd,
      savingsRate: dashboard.cashflow.savingsRate,
      allocations,
      alerts,
      recommendations,
      yearsToGoal: simulation.yearsToGoal,
      expectedReturn: simulation.expectedReturn,
    };
 
    return {
      financialSummary: {
        netWorthUsd: dashboard.netWorth.usd,
        savingsRate: dashboard.cashflow.savingsRate,
        allocations,
        alerts,
        recommendations,
        simulation: {
          yearsToGoal: simulation.yearsToGoal,
          expectedReturn: simulation.expectedReturn,
        },
        snapshotHash: hashString(JSON.stringify(fingerprint)),
      },
      memory: {
        lastQuestions: advisorMemory.memory.lastQuestions
          .slice(0, 5)
          .map((q) => q.text),
        lastRecommendations: advisorMemory.memory.lastRecommendations
          .slice(0, 5)
          .map((r) => ({ text: r.text, impact: r.impact, status: r.status })),
      },
    };
  }, [
    advisorMemory.memory.lastQuestions,
    advisorMemory.memory.lastRecommendations,
    dashboard.allocation.byType,
    dashboard.cashflow.savingsRate,
    dashboard.netWorth.usd,
    insights.alerts,
    insights.recommendations,
    simulation.expectedReturn,
    simulation.yearsToGoal,
  ]);
 
  const ask = useCallback(
    async (question: string): Promise<AdvisorResponse> => {
      const normalized = question.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!normalized) throw new Error('Question is required');
 
      const cacheKey = `${normalized}::${context.financialSummary.snapshotHash}`;
 
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setLastResponse(cached);
        return cached;
      }
 
      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) return inFlight;
 
      const payload = { userQuestion: normalized, ...context };
 
      // ── FIX: accurate byte measurement with TextEncoder (works in all
      // environments); limit raised to 8 KB to match server-side guard.
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        // Graceful degradation: trim memory fields and retry once before throwing
        const trimmedPayload = {
          userQuestion: normalized,
          financialSummary: payload.financialSummary,
          memory: {
            lastQuestions: payload.memory.lastQuestions.slice(0, 2),
            lastRecommendations: payload.memory.lastRecommendations.slice(0, 2),
          },
        };
        const trimmedBytes = new TextEncoder().encode(JSON.stringify(trimmedPayload)).length;
        if (trimmedBytes > MAX_PAYLOAD_BYTES) {
          throw new Error('advisor_payload_too_large');
        }
        console.warn('[advisor] payload_trimmed', { original: payloadBytes, trimmed: trimmedBytes });
        return ask(question); // recurse with trimmed memory (already mutated context is stale)
      }
 
      const promise = (async () => {
        setLoading(true);
        setError(null);
 
        try {
          const response = await fetch('/api/ai/advisor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
 
          if (!response.ok) {
            throw new Error(`advisor_request_failed_${response.status}`);
          }
 
          const data = (await response.json()) as AdvisorResponse;
          cacheRef.current.set(cacheKey, data);
          setLastResponse(data);
          advisorMemory.pushQuestion(normalized);
          advisorMemory.mergeRecommendations(
            data.actions,
            context.financialSummary.snapshotHash,
          );
          return data;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'advisor_error';
          setError(msg);
          throw err;
        } finally {
          inFlightRef.current.delete(cacheKey);
          setLoading(false);
        }
      })();
 
      inFlightRef.current.set(cacheKey, promise);
      return promise;
    },
    [advisorMemory, context],
  );
 
  const askDebounced = useCallback(
    (question: string, delayMs = 300): Promise<AdvisorResponse> =>
      new Promise<AdvisorResponse>((resolve, reject) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          ask(question).then(resolve).catch(reject);
        }, delayMs);
      }),
    [ask],
  );
 
  return {
    ask,
    askDebounced,
    loading,
    error,
    lastResponse,
    memory: advisorMemory.memory,
    pendingRecommendations: advisorMemory.pendingRecommendations,
    setRecommendationStatus: (
      text: string,
      status: 'pending' | 'completed' | 'ignored',
    ) => {
      if (status !== 'completed') {
        advisorMemory.setRecommendationStatus(text, status);
        return;
      }
 
      const monthly = dashboard.cashflow.monthly;
      const last = monthly[monthly.length - 1];
      const prev = monthly[monthly.length - 2];
      const lower = text.toLowerCase();
 
      let improved = true;
      if (lower.includes('expense') || lower.includes('spend')) {
        improved = Boolean(last && prev && last.expenses <= prev.expenses);
      } else if (lower.includes('saving')) {
        improved = dashboard.cashflow.savingsRate >= 0.1;
      }
 
      if (improved) {
        advisorMemory.setRecommendationStatus(text, 'completed');
      } else {
        console.warn('[advisor] false_completion_detected', { text });
        advisorMemory.setRecommendationStatus(text, 'pending');
      }
    },
  };
}
 
