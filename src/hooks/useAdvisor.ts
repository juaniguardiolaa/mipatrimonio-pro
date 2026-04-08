import { useCallback, useMemo, useRef, useState } from 'react';
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
    lastRecommendations: Array<{ text: string; impact: number; status: 'pending' | 'completed' | 'ignored' }>;
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
const MAX_PAYLOAD_BYTES = 8_192;

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
      memory: {
        lastQuestions: advisorMemory.memory.lastQuestions.map((item) => item.text),
        lastRecommendations: advisorMemory.memory.lastRecommendations.map((item) => ({
          text: item.text,
          impact: item.impact,
          status: item.status,
        })).slice(0, 5),
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

    const payload: {
      userQuestion: string;
      financialSummary: CompactContext['financialSummary'];
      memory: CompactContext['memory'];
    } = {
      userQuestion: normalized,
      ...context,
    };

    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    if (payloadSize > MAX_PAYLOAD_BYTES) {
      console.warn('[advisor] payload_too_large', { payloadSize, limit: MAX_PAYLOAD_BYTES });
      payload.financialSummary.alerts = payload.financialSummary.alerts.slice(0, 2);
      payload.financialSummary.recommendations = payload.financialSummary.recommendations.slice(0, 2);
      payload.memory.lastQuestions = payload.memory.lastQuestions.slice(0, 3);
      payload.memory.lastRecommendations = payload.memory.lastRecommendations.slice(0, 3);

      const retrySize = new Blob([JSON.stringify(payload)]).size;
      if (retrySize > MAX_PAYLOAD_BYTES) {
        throw new Error('advisor_payload_too_large');
      }
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
      advisorMemory.pushQuestion(normalized);
      advisorMemory.mergeRecommendations(data.actions, context.financialSummary.snapshotHash);
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
  }, [advisorMemory, context]);

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
    memory: advisorMemory.memory,
    pendingRecommendations: advisorMemory.pendingRecommendations,
    setRecommendationStatus: (text: string, status: 'pending' | 'completed' | 'ignored') => {
      if (status !== 'completed') {
        advisorMemory.setRecommendationStatus(text, status);
        return;
      }

      const last = dashboard.cashflow.monthly[dashboard.cashflow.monthly.length - 1];
      const prev = dashboard.cashflow.monthly[dashboard.cashflow.monthly.length - 2];
      const loweredText = text.toLowerCase();

      let improved = true;
      if (loweredText.includes('expense') || loweredText.includes('spend')) {
        improved = Boolean(last && prev && last.expenses <= prev.expenses);
      } else if (loweredText.includes('saving')) {
        improved = dashboard.cashflow.savingsRate >= 0.1;
      }

      if (improved) {
        advisorMemory.setRecommendationStatus(text, 'completed');
      } else {
        console.warn('[advisor:v2] false_completion_detected', { text });
        advisorMemory.setRecommendationStatus(text, 'pending');
      }
    },
  };
}
