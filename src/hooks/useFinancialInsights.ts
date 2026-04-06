import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from './useDashboard';
import { useAdvisorMemory } from './useAdvisorMemory';
 
export type Insight = {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  category: 'cashflow' | 'investments' | 'risk' | 'general';
  title: string;
  description: string;
};
 
export type Alert = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
};
 
export type Recommendation = {
  id: string;
  action: string;
  reason: string;
};
 
type Snapshot = {
  date: string;
  netWorthUsd: number;
  netWorthArs: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
};
 
type ScoredInsight = Insight & { weight: number };
type PrioritizedRecommendation = Recommendation & { impact: number };
type SeverityWeight = Record<Alert['severity'], number>;
 
const SEVERITY_WEIGHT: SeverityWeight = { high: 3, medium: 2, low: 1 };
 
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
 
const safeDivide = (n: number, d: number) => {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return n / d;
};
 
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
 
const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};
 
function countIncreasingSteps(values: number[]) {
  if (values.length < 3) return 0;
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) count++;
  }
  return count;
}
 
function nowMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
 
// ── FIX: A month is considered "data-complete" only if it has meaningful
// income or expense activity. Months with both values at zero (no entries yet)
// are excluded from trend/consistency metrics to avoid false negatives.
function isDataCompleteMonth(row: Snapshot): boolean {
  return row.totalIncome > 0 || row.totalExpenses > 0;
}
 
export function useFinancialInsights() {
  const dashboard = useDashboard();
  const advisorMemory = useAdvisorMemory();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
 
  // ── FIX: Snapshot sync guard ───────────────────────────────────────────
  // Previously the useEffect fired on every re-render triggered by price
  // updates (every 30 s), causing repeated GET+POST /api/snapshots calls.
  // We now track the last synced month and skip if it hasn't changed.
  const lastSyncedMonthRef = useRef<string | null>(null);
 
  useEffect(() => {
    if (dashboard.loading) return;
 
    // Only re-sync when the calendar month changes, not on every price tick.
    const currentMonth = nowMonthKey();
    if (lastSyncedMonthRef.current === currentMonth) return;
 
 
    let mounted = true;
 
    const syncSnapshots = async () => {
      // Mark immediately to avoid re-entrant calls during the async fetch
      lastSyncedMonthRef.current = currentMonth;
      const res = await fetch('/api/snapshots', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      const existing: Snapshot[] = Array.isArray((data as any).snapshots)
        ? (data as any).snapshots
        : [];
 
      const month = nowMonthKey();
      const hasCurrent = existing.some((row) => row.date === month);
 
      if (!hasCurrent) {
        const payload: Snapshot = {
          date: month,
          netWorthUsd: dashboard.netWorth.usd,
          netWorthArs: dashboard.netWorth.ars,
          totalIncome: dashboard.cashflow.totalIncome,
          totalExpenses: dashboard.cashflow.totalExpenses,
          savingsRate: dashboard.cashflow.savingsRate,
        };
 
        const createRes = await fetch('/api/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
 
        if (createRes.ok) {
          const created = ((await createRes.json().catch(() => ({}))) as any)
            .snapshot as Snapshot | undefined;
          const next = created ? [...existing, created] : [...existing, payload];
          if (mounted) setSnapshots(next.sort((a, b) => a.date.localeCompare(b.date)));
          return;
        }
      }
 
      if (mounted) setSnapshots(existing.sort((a, b) => a.date.localeCompare(b.date)));
    };
 
    syncSnapshots().catch((err) => {
      // Reset so the next render can retry
      lastSyncedMonthRef.current = null;
      console.warn('[snapshots:sync:error]', {
        message: err instanceof Error ? err.message : 'unknown',
      });
    });
 
    return () => {
      mounted = false;
    };
  }, [
    dashboard.loading,
    dashboard.netWorth.usd,
    dashboard.netWorth.ars,
    dashboard.cashflow.totalIncome,
    dashboard.cashflow.totalExpenses,
    dashboard.cashflow.savingsRate,
  ]);
 
  return useMemo(() => {
    // ── FIX: Build fallback snapshots only from months that have real data.
    // Previously every cashflow month (including zero-data months) was used,
    // which created phantom 0%-savings entries that triggered false alerts.
    const fallbackSnapshots: Snapshot[] = dashboard.cashflow.monthly
      .filter((row) => row.income > 0 || row.expenses > 0)
      .map((row) => ({
        date: row.month,
        netWorthUsd: dashboard.netWorth.usd,
        netWorthArs: dashboard.netWorth.ars,
        totalIncome: row.income,
        totalExpenses: row.expenses,
        // ── FIX: only compute savings rate when income > 0; use null sentinel
        // represented as 0 only for months where income is present.
        savingsRate: row.income > 0 ? safeDivide(row.net, row.income) : 0,
      }));
 
    const rawHistory = snapshots.length > 0 ? snapshots : fallbackSnapshots;
 
    // ── FIX: Exclude data-incomplete months from ALL trend/metric series.
    // This prevents zero-income months (no entries yet) from dragging down
    // savings-consistency scores and triggering false "negative savings" alerts.
    const history = rawHistory
      .filter(isDataCompleteMonth)
      .sort((a, b) => a.date.localeCompare(b.date));
 
    const incomeSeries = history.map((r) => r.totalIncome);
    const expenseSeries = history.map((r) => r.totalExpenses);
    // ── FIX: Only include months where savings rate is computable (income > 0)
    const savingsSeries = history
      .filter((r) => r.totalIncome > 0)
      .map((r) => r.savingsRate);
    const netWorthSeries = history.map((r) => r.netWorthUsd);
 
    const totalIncome = dashboard.cashflow.totalIncome;
    const totalExpenses = dashboard.cashflow.totalExpenses;
    const savingsRate = Number.isFinite(dashboard.cashflow.savingsRate)
      ? dashboard.cashflow.savingsRate
      : 0;
    const expenseRatio = safeDivide(totalExpenses, totalIncome);
 
    const typeRows = dashboard.allocation.byType;
    const typeCount = typeRows.length;
    const portfolioUsd = Math.max(0, dashboard.portfolio.totals.totalUsd);
    const maxTypeShare = typeRows.reduce(
      (max, row) => Math.max(max, safeDivide(row.valueUsd, portfolioUsd)),
      0,
    );
    const biggestType =
      [...typeRows].sort((a, b) => b.valueUsd - a.valueUsd)[0]?.assetType ?? 'Unknown';
 
    const cryptoType = typeRows.find((r) =>
      r.assetType.toUpperCase().includes('CRYPTO'),
    );
    const cryptoShare = safeDivide(cryptoType?.valueUsd ?? 0, portfolioUsd);
    const cashPosition = safeDivide(dashboard.cash.usd, dashboard.netWorth.usd);
    const netWorthUsd = dashboard.netWorth.usd;
 
    // ── Health score ──────────────────────────────────────────────────────
    const savingsScore =
      savingsRate >= 0.2 ? 100 : savingsRate >= 0.1 ? 75 : savingsRate >= 0 ? 45 : 10;
    const expenseScore =
      expenseRatio <= 0.5 ? 100 : expenseRatio <= 0.7 ? 80 : expenseRatio <= 1 ? 55 : 20;
    const divCountScore =
      typeCount >= 4 ? 100 : typeCount === 3 ? 80 : typeCount === 2 ? 55 : typeCount === 1 ? 20 : 40;
    const divConcentrationScore =
      maxTypeShare <= 0.4 ? 100 : maxTypeShare <= 0.55 ? 75 : maxTypeShare <= 0.7 ? 45 : 15;
    const diversificationScore = divCountScore * 0.5 + divConcentrationScore * 0.5;
    const cashScore =
      cashPosition >= 0.2 ? 100 : cashPosition >= 0.1 ? 75 : cashPosition > 0.05 ? 50 : 20;
 
    let healthScore = clamp(
      Math.round(
        savingsScore * 0.4 + expenseScore * 0.2 + diversificationScore * 0.2 + cashScore * 0.2,
      ),
      0,
      100,
    );
    if (maxTypeShare > 0.7) healthScore -= 15;
 
    let maxCap = 100;
    if (savingsRate < 0) maxCap = Math.min(maxCap, 40);
    if (totalExpenses > totalIncome && totalIncome > 0) maxCap = Math.min(maxCap, 50);
    if (netWorthUsd <= 0) maxCap = Math.min(maxCap, 30);
 
    const completionBonus = Math.min(
      10,
      advisorMemory.memory.lastRecommendations.filter((r) => r.status === 'completed')
        .length * 2,
    );
    healthScore = clamp(Math.min(healthScore, maxCap) + completionBonus, 0, 100);
 
    // ── Insights ──────────────────────────────────────────────────────────
    const insights: ScoredInsight[] = [];
 
    const recentExpenses = expenseSeries.slice(-4);
    if (recentExpenses.length >= 3 && countIncreasingSteps(recentExpenses) >= 2) {
      const start = recentExpenses[0] ?? 0;
      const end = recentExpenses[recentExpenses.length - 1] ?? 0;
      insights.push({
        id: 'expense-multi-month-uptrend',
        type: 'negative',
        category: 'cashflow',
        title: 'Expenses are increasing across multiple months',
        description: `Over the recent window, expenses moved from ${start.toFixed(2)} to ${end.toFixed(2)} (${pct(safeDivide(end - start, start || 1))}).`,
        weight: 95,
      });
    }
 
    if (incomeSeries.length >= 4) {
      const mean = incomeSeries.reduce((s, v) => s + v, 0) / incomeSeries.length;
      const vol = safeDivide(stdDev(incomeSeries), mean || 1);
      if (vol > 0.25) {
        insights.push({
          id: 'income-instability',
          type: 'negative',
          category: 'cashflow',
          title: 'Income is unstable month to month',
          description: `Income volatility is ${pct(vol)} of average income, indicating planning uncertainty.`,
          weight: 90,
        });
      }
    }
 
    // ── FIX: Use the filtered savingsSeries (income > 0 months only)
    if (savingsSeries.length >= 4) {
      const vol = stdDev(savingsSeries);
      if (vol > 0.12) {
        insights.push({
          id: 'savings-volatility',
          type: 'negative',
          category: 'risk',
          title: 'Savings rate is volatile',
          description: `Savings-rate volatility is ${pct(vol)} across recorded months.`,
          weight: 84,
        });
      }
    }
 
    // ── FIX: Consistency denominator uses only months with income data
    const positiveSavingsMonths = savingsSeries.filter((v) => v > 0).length;
    const savingsConsistency = safeDivide(positiveSavingsMonths, savingsSeries.length || 1);
    if (savingsSeries.length >= 4 && savingsConsistency < 0.6) {
      insights.push({
        id: 'weak-savings-consistency',
        type: 'negative',
        category: 'cashflow',
        title: 'Savings consistency is weak',
        description: `Only ${positiveSavingsMonths}/${savingsSeries.length} months with income data had positive savings.`,
        weight: 86,
      });
    }
 
    const recentNetWorth = netWorthSeries.slice(-4);
    if (recentNetWorth.length >= 3) {
      const growthSteps = countIncreasingSteps(recentNetWorth);
      if (growthSteps >= 2) {
        insights.push({
          id: 'networth-growth-trend',
          type: 'positive',
          category: 'investments',
          title: 'Net worth trend is improving',
          description: 'Stored snapshots indicate a consistent upward net-worth trajectory.',
          weight: 75,
        });
      } else if (growthSteps === 0) {
        insights.push({
          id: 'networth-flat-trend',
          type: 'neutral',
          category: 'general',
          title: 'Net worth trend is flat or declining',
          description: 'Recent snapshots do not show sustained net-worth growth.',
          weight: 70,
        });
      }
    }
 
    if (cryptoShare > 0.4) {
      insights.push({
        id: 'high-crypto-volatility',
        type: 'negative',
        category: 'risk',
        title: 'Crypto allocation implies high volatility exposure',
        description: `Crypto is ${pct(cryptoShare)} of the portfolio, which can amplify drawdowns.`,
        weight: 88,
      });
    }
 
    if (maxTypeShare > 0.5) {
      insights.push({
        id: 'allocation-concentration',
        type: 'negative',
        category: 'investments',
        title: `Portfolio concentration is high in ${biggestType.toLowerCase()}`,
        description: `${pct(maxTypeShare)} of invested value sits in a single asset class.`,
        weight: maxTypeShare > 0.7 ? 92 : 80,
      });
    }
 
    if (insights.length === 0) {
      insights.push({
        id: 'balanced-profile',
        type: 'neutral',
        category: 'general',
        title: 'Financial profile appears balanced',
        description: 'No major risk concentration or instability patterns were detected.',
        weight: 50,
      });
    }
 
    // ── Alerts ────────────────────────────────────────────────────────────
    const alerts: Alert[] = [];
 
    if (savingsRate < 0)
      alerts.push({ id: 'negative-savings-rate', severity: 'high', message: 'Savings rate is negative. Spending exceeds retained income.' });
    // ── FIX: Only fire "expenses exceed income" when income > 0 (not on empty data)
    if (totalExpenses > totalIncome && totalIncome > 0)
      alerts.push({ id: 'expenses-exceed-income', severity: 'high', message: 'Total expenses are greater than total income.' });
    if (netWorthUsd <= 0)
      alerts.push({ id: 'non-positive-net-worth', severity: 'high', message: 'Net worth is zero or negative, limiting financial resilience.' });
    if (maxTypeShare > 0.5)
      alerts.push({ id: 'concentration-risk', severity: maxTypeShare > 0.7 ? 'high' : 'medium', message: `Single asset-type concentration is ${pct(maxTypeShare)}.` });
    if (typeCount === 1 && portfolioUsd > 0)
      alerts.push({ id: 'no-diversification', severity: 'medium', message: 'Portfolio has only one asset type (no diversification).' });
    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable)
      alerts.push({ id: 'missing-fx', severity: 'low', message: 'FX conversion data is missing; ARS analytics may be incomplete.' });
 
    const sortedAlerts = [...alerts].sort(
      (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
    );
 
    // ── Recommendations ───────────────────────────────────────────────────
    const recommendations: PrioritizedRecommendation[] = [];
 
    if (totalIncome > 0) {
      const reducedExpenses = totalExpenses * 0.9;
      const improved = safeDivide(totalIncome - reducedExpenses, totalIncome);
      recommendations.push({
        id: 'reduce-expenses-10pct',
        action: `Reducing expenses by 10% could move savings rate from ${pct(savingsRate)} to ${pct(improved)}.`,
        reason: 'Expense control has the fastest direct impact on free cash flow.',
        impact: Math.round(Math.max(0, improved - savingsRate) * 1000),
      });
    }
 
    if (cryptoShare > 0.4) {
      const shifted = Math.max(0, cryptoShare - 0.2);
      recommendations.push({
        id: 'rebalance-crypto-20pct',
        action: `Diversifying 20% of crypto into equities could reduce crypto exposure from ${pct(cryptoShare)} to ~${pct(shifted)}.`,
        reason: 'Rebalancing lowers volatility concentration risk.',
        impact: Math.round((cryptoShare - shifted) * 1000) + 120,
      });
    }
 
    if (maxTypeShare > 0.5) {
      const shifted = Math.max(0, maxTypeShare - 0.2);
      recommendations.push({
        id: 'reduce-top-concentration',
        action: `Shifting 20% from ${biggestType.toLowerCase()} could reduce top concentration from ${pct(maxTypeShare)} to ${pct(shifted)}.`,
        reason: 'Less concentration improves risk-adjusted resilience.',
        impact: Math.round((maxTypeShare - shifted) * 1000) + 100,
      });
    }
 
    if (netWorthUsd > 0 && cashPosition < 0.1) {
      const targetCash = netWorthUsd * 0.1;
      const required = Math.max(0, targetCash - dashboard.cash.usd);
      recommendations.push({
        id: 'build-cash-buffer',
        action: `Increase cash by ${required.toFixed(2)} USD to reach a 10% liquidity buffer.`,
        reason: 'Higher liquidity reduces forced-selling pressure.',
        impact: Math.round(safeDivide(required, Math.max(netWorthUsd, 1)) * 1000),
      });
    }
 
    // ── FIX: Only suggest savings consistency fix when we have enough real data
    if (savingsSeries.length >= 4 && savingsConsistency < 0.6) {
      const target = Math.ceil(savingsSeries.length * 0.8);
      recommendations.push({
        id: 'stabilize-savings-consistency',
        action: `Aim for positive savings in at least ${target}/${savingsSeries.length} months via a fixed spend ceiling.`,
        reason: 'Consistency compounds and improves forecastability.',
        impact: 95,
      });
    }
 
    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      recommendations.push({
        id: 'restore-fx-feed',
        action: 'Restore FX reliability (primary + fallback source) for accurate ARS analytics.',
        reason: 'Missing FX can distort net worth and allocation insights.',
        impact: 80,
      });
    }
 
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'maintain-plan',
        action: 'Maintain contributions and review allocation quarterly.',
        reason: 'No urgent structural issues were detected.',
        impact: 20,
      });
    }
 
    // ── Sort and trim ─────────────────────────────────────────────────────
    const prioritizedInsights = [...insights]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(({ weight: _w, ...insight }) => insight);
 
    const ignoredTexts = advisorMemory.memory.lastRecommendations
      .filter((r) => r.status === 'ignored')
      .map((r) => r.text.toLowerCase());
 
    const prioritizedRecommendations = [...recommendations]
      .map((rec) => ({
        ...rec,
        impact: ignoredTexts.some((ig) => rec.action.toLowerCase().includes(ig))
          ? rec.impact * 0.7
          : rec.impact,
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map(({ impact: _i, ...rec }) => rec);
 
    console.log('[insights] generated', {
      insights: prioritizedInsights.length,
      recommendations: prioritizedRecommendations.length,
      historyPoints: history.length,
      savingsSeriesPoints: savingsSeries.length,
    });
 
    return {
      dashboard,
      healthScore,
      insights: prioritizedInsights,
      alerts: sortedAlerts,
      recommendations: prioritizedRecommendations,
    };
  }, [advisorMemory.memory.lastRecommendations, dashboard, snapshots]);
}
 
