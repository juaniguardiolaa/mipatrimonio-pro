import { useEffect, useMemo, useRef } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useSimulation } from './useSimulation';
import { useAdvisorMemory } from './useAdvisorMemory';
 
export type ProactiveInsight = {
  message: string;
  severity: 'low' | 'medium' | 'high';
  type: 'risk' | 'opportunity' | 'warning';
  severityLevel: number;
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
type AlertsStore = Record<string, SmartAlert>;
 
// ── Storage helpers — safe, SSR-friendly ─────────────────────────────────────
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
 
function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be full or blocked (private mode) — non-fatal
    console.warn('[proactive] localStorage_write_failed', { key });
  }
}
 
function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return String(hash >>> 0);
}
 
const TRIGGER_KEY = 'advisor:v2:trigger-state';
const ALERTS_KEY = 'advisor:v2:alerts';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
 
export function useProactiveAdvisor() {
  const dashboard = useDashboard();
  const insights = useFinancialInsights();
  const simulation = useSimulation();
  const memory = useAdvisorMemory();
 
  // ── FIX: Read localStorage once on mount into refs.
  // Previously readJson and writeJson were called inside useMemo, which is
  // supposed to be a pure computation with no side-effects. This caused:
  //   1. Writes on every re-render in React Strict Mode (double invocation).
  //   2. Synchronous I/O blocking the render thread on every dependency change.
  //   3. Inability to unit-test the computation without mocking localStorage.
  //
  // New pattern:
  //   - triggerStateRef / alertsStoreRef hold the current in-memory state.
  //   - useMemo reads from refs (pure read, no I/O) and builds the result.
  //   - useEffect persists any mutations back to localStorage after render.
 
  const triggerStateRef = useRef<TriggerState>({});
  const alertsStoreRef = useRef<AlertsStore>({});
  const pendingWriteRef = useRef<{ triggers: TriggerState; alerts: AlertsStore } | null>(null);
  const initializedRef = useRef(false);
 
  // Load from localStorage exactly once after mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    triggerStateRef.current = readJson<TriggerState>(TRIGGER_KEY, {});
    alertsStoreRef.current = readJson<AlertsStore>(ALERTS_KEY, {});
  }, []);
 
  // Flush any pending writes produced by the last useMemo run
  useEffect(() => {
    if (!pendingWriteRef.current) return;
    writeJson(TRIGGER_KEY, pendingWriteRef.current.triggers);
    writeJson(ALERTS_KEY, pendingWriteRef.current.alerts);
    pendingWriteRef.current = null;
  });
 
  return useMemo(() => {
    const now = Date.now();
 
    // Work on copies so we can detect mutations without mutating the refs yet
    const triggerState: TriggerState = { ...triggerStateRef.current };
    const alertsStore: AlertsStore = { ...alertsStoreRef.current };
 
    const snapshotHash = hashString(JSON.stringify({
      savingsRate: dashboard.cashflow.savingsRate,
      expenses: dashboard.cashflow.totalExpenses,
      income: dashboard.cashflow.totalIncome,
      topAllocation: dashboard.allocation.byType[0]?.percentage ?? 0,
      yearsToGoal: simulation.yearsToGoal,
      fx: dashboard.fx,
      pending: memory.pendingRecommendations.length,
    }));
 
    // ── Build raw signals ─────────────────────────────────────────────────
    const raw: ProactiveInsight[] = [];
 
    if (dashboard.cashflow.savingsRate < 0.1) {
      raw.push({
        message: `Savings rate is ${(dashboard.cashflow.savingsRate * 100).toFixed(1)}%, below target.`,
        severity: 'high',
        type: 'warning',
        severityLevel: 0.95,
      });
    }
 
    const monthly = dashboard.cashflow.monthly;
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    if (last && prev && last.expenses > prev.expenses * 1.15) {
      const delta = ((last.expenses - prev.expenses) / Math.max(prev.expenses, 1)) * 100;
      raw.push({
        message: `Expenses spiked ${delta.toFixed(1)}% vs last month.`,
        severity: 'high',
        type: 'risk',
        severityLevel: 0.9,
      });
    }
 
    const topAllocation = dashboard.allocation.byType[0];
    if (topAllocation && topAllocation.percentage > 50) {
      const level = topAllocation.percentage > 70 ? 0.88 : 0.68;
      raw.push({
        message: `Allocation risk: ${topAllocation.assetType} is ${topAllocation.percentage.toFixed(1)}% of portfolio.`,
        severity: topAllocation.percentage > 70 ? 'high' : 'medium',
        type: 'risk',
        severityLevel: level,
      });
    }
 
    if (
      simulation.yearsToGoal !== null &&
      simulation.conservativeYearsToGoal !== null &&
      simulation.conservativeYearsToGoal - simulation.yearsToGoal >= 2
    ) {
      raw.push({
        message: 'Goal timeline worsens materially under conservative assumptions.',
        severity: 'medium',
        type: 'warning',
        severityLevel: 0.66,
      });
    }
 
    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      raw.push({
        message: 'FX data missing can distort portfolio analysis.',
        severity: 'medium',
        type: 'warning',
        severityLevel: 0.62,
      });
    }
 
    // ── Apply cooldown filter ─────────────────────────────────────────────
    const filteredByCooldown = raw
      .filter((item) => {
        const state = triggerState[item.type];
        if (!state) return true;
        const withinCooldown = now - state.lastTriggeredAt < COOLDOWN_MS;
        const worsened = item.severityLevel > state.severityLevel;
        return !withinCooldown || worsened;
      })
      .slice(0, 5);
 
    // Update trigger state (in-memory copy)
    filteredByCooldown.forEach((item) => {
      triggerState[item.type] = { lastTriggeredAt: now, severityLevel: item.severityLevel };
    });
 
    // ── Build smart alerts ────────────────────────────────────────────────
    const smartAlerts: SmartAlert[] = [];
 
    filteredByCooldown.forEach((insight) => {
      const key = hashString(`${insight.type}:${insight.message}`);
      const level = insight.severity === 'high' ? 3 : insight.severity === 'medium' ? 2 : 1;
      const existing = alertsStore[key];
 
      if (!existing) {
        alertsStore[key] = {
          key,
          message: insight.message,
          severity: insight.severity,
          firstSeen: now,
          level,
        };
        smartAlerts.push(alertsStore[key]);
      } else if (level > existing.level) {
        existing.level = level;
        existing.severity = insight.severity;
        existing.message = insight.message;
        smartAlerts.push(existing);
      } else {
        smartAlerts.push(existing);
      }
    });
 
    // ── Schedule localStorage write (after render, not during) ───────────
    // We assign to pendingWriteRef here (inside useMemo) but the actual I/O
    // happens in the useEffect above, which runs after the render is committed.
    pendingWriteRef.current = { triggers: triggerState, alerts: alertsStore };
    // Also sync refs so next render reads updated values
    triggerStateRef.current = triggerState;
    alertsStoreRef.current = alertsStore;
 
    // ── Pending recommendations (stale > 3 days) ──────────────────────────
    const pendingRecommendations = memory.pendingRecommendations
      .filter((item) => now - item.createdAt > 3 * 24 * 60 * 60 * 1000)
      .slice(0, 3)
      .map((item) => ({ text: item.text, impact: item.impact }));
 
    // ── Priority pool ─────────────────────────────────────────────────────
    const hasIncome = dashboard.cashflow.totalIncome > 0;
    const hasExpenses = dashboard.cashflow.totalExpenses > 0;
    const hasAssets = dashboard.allocation.byType.length > 0;
    const hasFx = !dashboard.fx.requiresConversion || dashboard.fx.rateAvailable;
    const dataCompleteness = [hasIncome, hasExpenses, hasAssets, hasFx].filter(Boolean).length / 4;
 
    const priorityPool: PriorityItem[] = [
      ...smartAlerts.map((a) => ({
        message: a.message,
        type: 'alert' as const,
        severity: a.level / 3,
        reason: '',
        confidence: 0,
      })),
      ...pendingRecommendations.map((r) => ({
        message: r.text,
        type: 'recommendation' as const,
        severity: Math.min(1, r.impact),
        reason: '',
        confidence: 0,
      })),
      ...filteredByCooldown.map((i) => ({
        message: i.message,
        type: 'insight' as const,
        severity: i.severityLevel,
        reason: '',
        confidence: 0,
      })),
    ];
 
    const topPriority =
      [...priorityPool]
        .map((item) => {
          const isExpense = item.message.toLowerCase().includes('expense');
          const isSavings = item.message.toLowerCase().includes('saving');
          const isAllocation =
            item.message.toLowerCase().includes('allocation') ||
            item.message.toLowerCase().includes('portfolio');
 
          const consistency =
            (isExpense && dashboard.cashflow.savingsRate < 0.1) ||
            (isSavings && dashboard.cashflow.totalExpenses > dashboard.cashflow.totalIncome) ||
            (isAllocation && (dashboard.allocation.byType[0]?.percentage ?? 0) > 50)
              ? 0.9
              : 0.55;
 
          const confidence = Math.min(
            1,
            Math.max(0, 0.4 * dataCompleteness + 0.3 * item.severity + 0.3 * consistency),
          );
 
          let reason = 'Based on your current financial trends.';
          if (isExpense && last && prev) {
            const inc = ((last.expenses - prev.expenses) / Math.max(prev.expenses, 1)) * 100;
            reason = `Expenses increased ${inc.toFixed(1)}% this month, weakening your savings profile.`;
          } else if (isAllocation && dashboard.allocation.byType[0]) {
            const top = dashboard.allocation.byType[0];
            reason = `${top.percentage.toFixed(1)}% of your portfolio is in ${top.assetType}, raising concentration risk.`;
          } else if (
            item.message.toLowerCase().includes('goal') &&
            simulation.yearsToGoal !== null &&
            simulation.conservativeYearsToGoal !== null
          ) {
            const delta = simulation.conservativeYearsToGoal - simulation.yearsToGoal;
            reason = `Goal timeline worsened by ${delta.toFixed(1)} years under conservative assumptions.`;
          } else if (isSavings) {
            reason = `Savings rate is ${(dashboard.cashflow.savingsRate * 100).toFixed(1)}%, below a resilient target.`;
          }
 
          return { ...item, reason, confidence };
        })
        .sort((a, b) => b.severity - a.severity || b.confidence - a.confidence)[0] ?? null;
 
    console.log('[advisor:v2] priority_computed', { topPriority: topPriority?.type ?? null });
 
    const aiSummary =
      topPriority?.message ??
      insights.insights[0]?.description ??
      'Your financial profile is stable. Keep monitoring trends.';
 
    // ── Timeline events (deduplicated) ────────────────────────────────────
    const groupedEvents = new Map<
      string,
      { count: number; timestamp: number; message: string; type: AdvisorEvent['type'] }
    >();
 
    [
      ...filteredByCooldown.map((i) => ({
        type: 'insight' as const,
        message: i.message,
        timestamp: now,
      })),
      ...smartAlerts.map((a) => ({
        type: 'alert' as const,
        message: `${a.message} (first seen ${new Date(a.firstSeen).toLocaleDateString()})`,
        timestamp: a.firstSeen,
      })),
      ...pendingRecommendations.map((r) => ({
        type: 'recommendation' as const,
        message: `Pending: ${r.text}`,
        timestamp: now,
      })),
    ].forEach((event) => {
      const key = `${event.type}:${event.message}`;
      const current = groupedEvents.get(key);
      if (!current) {
        groupedEvents.set(key, {
          count: 1,
          timestamp: event.timestamp,
          message: event.message,
          type: event.type,
        });
      } else {
        current.count++;
        current.timestamp = Math.max(current.timestamp, event.timestamp);
      }
    });
 
    const events: AdvisorEvent[] = Array.from(groupedEvents.values())
      .map((item) => ({
        type: item.type,
        message:
          item.count > 1
            ? `${item.message} (${item.count} times this week)`
            : item.message,
        timestamp: item.timestamp,
      }))
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
}
 
