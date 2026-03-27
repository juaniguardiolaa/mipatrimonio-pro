import { useCallback, useMemo, useRef, useState } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useSimulation } from './useSimulation';

type AdvisorResponse = {
  answer: string;
  actions: string[];
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
};

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
  }
  return String(hash >>> 0);
}

const compactMessage = (value: string, max = 100) => (value.length <= max ? value : `${value.slice(0, max)}...`);

export function useAdvisor() {
  const dashboard = useDashboard();
  const insights = useFinancialInsights();
  const simulation = useSimulation();

  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<AdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, AdvisorResponse>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<AdvisorResponse>>>(new Map());
  const debounceRef = useRef<number | null>(null);

  const context = useMemo<CompactContext>(() => {
    const allocations = [...dashboard.allocation.byType]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
      .map((row) => ({ assetType: row.assetType, percentage: row.percentage }));

    const alerts = [...insights.alerts]
      .slice(0, 3)
      .map((alert) => ({ severity: alert.severity, message: compactMessage(alert.message) }));

    const recommendations = [...insights.recommendations]
      .slice(0, 3)
      .map((recommendation) => ({ action: compactMessage(recommendation.action, 120) }));

    const fingerprint = {
      netWorthUsd: dashboard.netWorth.usd,
      savingsRate: dashboard.cashflow.savingsRate,
      allocations,
      alerts,
      recommendations,
      yearsToGoal: simulation.yearsToGoal,
      expectedReturn: simulation.expectedReturn,
    };

    const snapshotHash = hashString(JSON.stringify(fingerprint));

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
        snapshotHash,
      },
    };
  }, [
    dashboard.allocation.byType,
    dashboard.cashflow.savingsRate,
    dashboard.netWorth.usd,
    insights.alerts,
    insights.recommendations,
    simulation.expectedReturn,
    simulation.yearsToGoal,
  ]);

  const ask = useCallback(async (question: string) => {
    const normalized = question.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) throw new Error('Question is required');

    const cacheKey = `${normalized}::${context.financialSummary.snapshotHash}`;

    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)!;
      setLastResponse(cached);
      return cached;
    }

    const inFlight = inFlightRef.current.get(cacheKey);
    if (inFlight) return inFlight;

    const payload = {
      userQuestion: normalized,
      ...context,
    };

    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    if (payloadSize > 2048) {
      throw new Error('advisor_payload_too_large');
    }

    const promise = (async () => {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`advisor_request_failed_${response.status}`);

      const data = await response.json() as AdvisorResponse;
      cacheRef.current.set(cacheKey, data);
      setLastResponse(data);
      return data;
    })()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'advisor_error');
        throw err;
      })
      .finally(() => {
        inFlightRef.current.delete(cacheKey);
        setLoading(false);
      });

    inFlightRef.current.set(cacheKey, promise);
    return promise;
  }, [context]);

  const askDebounced = useCallback((question: string, delayMs = 300) => new Promise<AdvisorResponse>((resolve, reject) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      ask(question).then(resolve).catch(reject);
    }, delayMs);
  }), [ask]);

  return {
    ask,
    askDebounced,
    loading,
    error,
    lastResponse,
  };
}
