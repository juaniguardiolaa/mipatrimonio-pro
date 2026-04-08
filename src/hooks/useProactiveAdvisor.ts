import { useEffect, useMemo, useRef } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useSimulation } from './useSimulation';
import { useAdvisorMemory } from './useAdvisorMemory';

export type ProactiveInsight = {
  message: string;
  severity: 'low' | 'medium' | 'high';
  type: 'risk' | 'opportunity' | 'warning';
  lastTriggeredAt?: number;
  severityLevel?: number;
};

export type AdvisorEvent = {
  type: 'insight' | 'alert' | 'recommendation';
  message: string;
  timestamp: number;
};

export type PriorityItem = {
  message: string;
  type: 'alert' | 'recommendation' | 'insight';
  severity: number;
  reason: string;
  confidence: number;
};

type SmartAlert = {
  key: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  firstSeen: number;
  level: number;
};

type TriggerState = Record<string, { lastTriggeredAt: number; severityLevel: number }>;

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
  }
  return String(hash >>> 0);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function useProactiveAdvisor() {
  const dashboard = useDashboard();
  const insights = useFinancialInsights();
  const simulation = useSimulation();
  const memory = useAdvisorMemory();
  const triggerStateRef = useRef<TriggerState>({});
  const alertsStoreRef = useRef<Record<string, SmartAlert>>({});

  useEffect(() => {
    triggerStateRef.current = readJson<TriggerState>('advisor:v2:trigger-state', {});
    alertsStoreRef.current = readJson<Record<string, SmartAlert>>('advisor:v2:alerts', {});
  }, []);

  const proactiveResult = useMemo(() => {
    const snapshotHash = hashString(JSON.stringify({
      savingsRate: dashboard.cashflow.savingsRate,
      expenses: dashboard.cashflow.totalExpenses,
      income: dashboard.cashflow.totalIncome,
      topAllocation: dashboard.allocation.byType[0]?.percentage ?? 0,
      yearsToGoal: simulation.yearsToGoal,
      fx: dashboard.fx,
      pending: memory.pendingRecommendations.length,
    }));

    const now = Date.now();
    const cooldownMs = 24 * 60 * 60 * 1000;
    const triggerState: TriggerState = { ...triggerStateRef.current };

    const raw: Array<ProactiveInsight & { severityLevel: number }> = [];

    if (dashboard.cashflow.savingsRate < 0.1) {
      raw.push({ message: `Savings rate is ${(dashboard.cashflow.savingsRate * 100).toFixed(1)}%, below target.`, severity: 'high', type: 'warning', severityLevel: 0.95 });
    }

    const monthly = dashboard.cashflow.monthly;
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    if (last && prev && last.expenses > prev.expenses * 1.15) {
      raw.push({ message: `Expenses spiked ${(100 * ((last.expenses - prev.expenses) / Math.max(prev.expenses, 1))).toFixed(1)}% vs last month.`, severity: 'high', type: 'risk', severityLevel: 0.9 });
    }

    const topAllocation = dashboard.allocation.byType[0];
    if (topAllocation && topAllocation.percentage > 50) {
      const level = topAllocation.percentage > 70 ? 0.88 : 0.68;
      raw.push({ message: `Allocation risk: ${topAllocation.assetType} is ${topAllocation.percentage.toFixed(1)}% of portfolio.`, severity: topAllocation.percentage > 70 ? 'high' : 'medium', type: 'risk', severityLevel: level });
    }

    if (simulation.yearsToGoal !== null && simulation.conservativeYearsToGoal !== null && simulation.conservativeYearsToGoal - simulation.yearsToGoal >= 2) {
      raw.push({ message: 'Goal timeline worsens materially under conservative assumptions.', severity: 'medium', type: 'warning', severityLevel: 0.66 });
    }

    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      raw.push({ message: 'FX data missing can distort portfolio analysis.', severity: 'medium', type: 'warning', severityLevel: 0.62 });
    }

    const filteredByCooldown = raw.filter((item) => {
      const state = triggerState[item.type];
      if (!state) return true;
      const withinCooldown = now - state.lastTriggeredAt < cooldownMs;
      const worsened = item.severityLevel > state.severityLevel;
      return !withinCooldown || worsened;
    }).slice(0, 5);

    filteredByCooldown.forEach((item) => {
      triggerState[item.type] = { lastTriggeredAt: now, severityLevel: item.severityLevel };
    });

    console.log('[advisor:v2] noise_filtered', {
      before: raw.length,
      after: filteredByCooldown.length,
    });

    const alertsStore: Record<string, SmartAlert> = { ...alertsStoreRef.current };
    const smartAlerts: SmartAlert[] = [];

    filteredByCooldown.forEach((insight) => {
      const key = hashString(`${insight.type}:${insight.message}`);
      const level = insight.severity === 'high' ? 3 : insight.severity === 'medium' ? 2 : 1;
      const existing = alertsStore[key];

      if (!existing) {
        alertsStore[key] = { key, message: insight.message, severity: insight.severity, firstSeen: now, level };
        smartAlerts.push(alertsStore[key]);
      } else if (level > existing.level) {
        existing.level = level;
        existing.severity = insight.severity;
        existing.message = insight.message;
        smartAlerts.push(existing);
      } else if (level === existing.level) {
        smartAlerts.push(existing);
      }
    });

    const pendingRecommendations = memory.pendingRecommendations
      .filter((item) => now - item.createdAt > 3 * 24 * 60 * 60 * 1000)
      .slice(0, 3)
      .map((item) => ({ text: item.text, impact: item.impact }));

    const priorityPool: PriorityItem[] = [
      ...smartAlerts.map((item) => ({
        message: item.message,
        type: 'alert' as const,
        severity: item.level / 3,
        reason: '',
        confidence: 0,
      })),
      ...pendingRecommendations.map((item) => ({
        message: item.text,
        type: 'recommendation' as const,
        severity: Math.min(1, item.impact),
        reason: '',
        confidence: 0,
      })),
      ...filteredByCooldown.map((item) => ({
        message: item.message,
        type: 'insight' as const,
        severity: item.severityLevel,
        reason: '',
        confidence: 0,
      })),
    ];

    const hasIncome = dashboard.cashflow.totalIncome > 0;
    const hasExpenses = dashboard.cashflow.totalExpenses > 0;
    const hasAssets = dashboard.allocation.byType.length > 0;
    const hasFx = !dashboard.fx.requiresConversion || dashboard.fx.rateAvailable;
    const dataCompleteness = [hasIncome, hasExpenses, hasAssets, hasFx].filter(Boolean).length / 4;

    const topPriority = [...priorityPool]
      .map((item) => {
        const signalStrength = item.severity;
        const isExpense = item.message.toLowerCase().includes('expense');
        const isSavings = item.message.toLowerCase().includes('saving');
        const isAllocation = item.message.toLowerCase().includes('allocation') || item.message.toLowerCase().includes('portfolio');
        const consistency = (isExpense && dashboard.cashflow.savingsRate < 0.1) || (isSavings && dashboard.cashflow.totalExpenses > dashboard.cashflow.totalIncome) || (isAllocation && (dashboard.allocation.byType[0]?.percentage ?? 0) > 50)
          ? 0.9
          : 0.55;

        const confidence = Math.min(1, Math.max(0, (0.4 * dataCompleteness) + (0.3 * signalStrength) + (0.3 * consistency)));

        let reason = 'Based on your current financial trends.';
        if (isExpense && monthly.length >= 2) {
          const increase = ((last?.expenses ?? 0) - (prev?.expenses ?? 0)) / Math.max(prev?.expenses ?? 1, 1);
          reason = `Expenses increased ${(increase * 100).toFixed(1)}% this month, which weakens your savings profile.`;
        } else if (isAllocation && dashboard.allocation.byType[0]) {
          const top = dashboard.allocation.byType[0];
          reason = `${top.percentage.toFixed(1)}% of your portfolio is in ${top.assetType}, which raises concentration risk.`;
        } else if (item.message.toLowerCase().includes('goal') && simulation.yearsToGoal !== null && simulation.conservativeYearsToGoal !== null) {
          const delta = simulation.conservativeYearsToGoal - simulation.yearsToGoal;
          reason = `Your goal timeline worsened by ${delta.toFixed(1)} years under conservative assumptions.`;
        } else if (isSavings) {
          reason = `Savings rate is ${(dashboard.cashflow.savingsRate * 100).toFixed(1)}%, below a resilient target.`;
        }

        return { ...item, reason, confidence };
      })
      .sort((a, b) => (b.severity - a.severity) || (b.confidence - a.confidence))[0] ?? null;

    console.log('[advisor:v2] priority_computed', { topPriority });
    if (topPriority) {
      console.log('[advisor:v2] priority_explained', {
        type: topPriority.type,
        reason: topPriority.reason,
        confidence: topPriority.confidence,
      });
    }

    const aiSummary = topPriority?.message
      ?? insights.insights[0]?.description
      ?? 'Your financial profile is stable. Keep monitoring trends.';

    const groupedEvents = new Map<string, { count: number; timestamp: number; message: string; type: AdvisorEvent['type'] }>();

    [...filteredByCooldown.map((item) => ({ type: 'insight' as const, message: item.message, timestamp: now })),
      ...smartAlerts.map((item) => ({ type: 'alert' as const, message: `${item.message} (first seen ${new Date(item.firstSeen).toLocaleDateString()})`, timestamp: item.firstSeen })),
      ...pendingRecommendations.map((item) => ({ type: 'recommendation' as const, message: `Pending: ${item.text}`, timestamp: now }))]
      .forEach((event) => {
        const key = `${event.type}:${event.message}`;
        const current = groupedEvents.get(key);
        if (!current) {
          groupedEvents.set(key, { count: 1, timestamp: event.timestamp, message: event.message, type: event.type });
          return;
        }
        current.count += 1;
        current.timestamp = Math.max(current.timestamp, event.timestamp);
      });

    const events: AdvisorEvent[] = Array.from(groupedEvents.values())
      .map((item) => ({
        type: item.type,
        message: item.count > 1 ? `${item.message} (${item.count} times this week)` : item.message,
        timestamp: item.timestamp,
      }))
      .filter((item) => {
        if (item.type === 'insight') {
          const source = filteredByCooldown.find((entry) => item.message.startsWith(entry.message));
          return (source?.severityLevel ?? 0.5) >= 0.5;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    console.log('[advisor:v2] proactive_generated', {
      snapshotHash,
      proactive: filteredByCooldown.length,
      alerts: smartAlerts.length,
      pending: pendingRecommendations.length,
    });

    return {
      snapshotHash,
      proactive: filteredByCooldown,
      smartAlerts,
      pendingRecommendations,
      aiSummary,
      events,
      topPriority,
      _triggerState: triggerState,
      _alertsStore: alertsStore,
    };
  }, [
    dashboard.allocation.byType,
    dashboard.cashflow.monthly,
    dashboard.cashflow.savingsRate,
    dashboard.cashflow.totalExpenses,
    dashboard.cashflow.totalIncome,
    dashboard.fx,
    insights.insights,
    memory.pendingRecommendations,
    simulation.conservativeYearsToGoal,
    simulation.yearsToGoal,
  ]);

  useEffect(() => {
    triggerStateRef.current = proactiveResult._triggerState;
    alertsStoreRef.current = proactiveResult._alertsStore;
    writeJson('advisor:v2:trigger-state', proactiveResult._triggerState);
    writeJson('advisor:v2:alerts', proactiveResult._alertsStore);
  }, [proactiveResult._alertsStore, proactiveResult._triggerState]);

  const { _alertsStore, _triggerState, ...publicResult } = proactiveResult;
  return publicResult;
}
