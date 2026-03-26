import { useCallback, useMemo, useRef, useState } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useSimulation } from './useSimulation';

type AdvisorResponse = {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  suggestions?: string[];
};

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

  const context = useMemo(() => ({
    financialSummary: {
      netWorth: dashboard.netWorth,
      savingsRate: dashboard.cashflow.savingsRate,
      expenses: dashboard.cashflow.totalExpenses,
      income: dashboard.cashflow.totalIncome,
      allocation: dashboard.allocation.byType.map((row) => ({
        assetType: row.assetType,
        percentage: row.percentage,
      })),
      healthScore: insights.healthScore,
      goalProgress: simulation.goalProgress,
      simulation: {
        monthsToGoal: simulation.monthsToGoal,
        yearsToGoal: simulation.yearsToGoal,
        optimisticYearsToGoal: simulation.optimisticYearsToGoal,
        conservativeYearsToGoal: simulation.conservativeYearsToGoal,
      },
    },
    alerts: insights.alerts,
    recommendations: insights.recommendations,
    insights: insights.insights,
  }), [
    dashboard.allocation.byType,
    dashboard.cashflow.savingsRate,
    dashboard.cashflow.totalExpenses,
    dashboard.cashflow.totalIncome,
    dashboard.netWorth,
    insights.alerts,
    insights.healthScore,
    insights.insights,
    insights.recommendations,
    simulation.conservativeYearsToGoal,
    simulation.goalProgress,
    simulation.monthsToGoal,
    simulation.optimisticYearsToGoal,
    simulation.yearsToGoal,
  ]);

  const ask = useCallback(async (question: string) => {
    const normalized = question.trim();
    if (!normalized) throw new Error('Question is required');

    if (cacheRef.current.has(normalized)) {
      const cached = cacheRef.current.get(normalized)!;
      setLastResponse(cached);
      return cached;
    }

    const inFlight = inFlightRef.current.get(normalized);
    if (inFlight) return inFlight;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userQuestion: normalized,
          ...context,
        }),
      });

      if (!response.ok) {
        throw new Error(`advisor_request_failed_${response.status}`);
      }

      const data = await response.json() as AdvisorResponse;
      cacheRef.current.set(normalized, data);
      setLastResponse(data);
      return data;
    })()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'advisor_error');
        throw err;
      })
      .finally(() => {
        inFlightRef.current.delete(normalized);
        setLoading(false);
      });

    inFlightRef.current.set(normalized, promise);
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
