import { useEffect, useMemo, useState } from 'react';
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

const SEVERITY_WEIGHT: SeverityWeight = {
  high: 3,
  medium: 2,
  low: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeDivide = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

function countIncreasingSteps(values: number[]) {
  if (values.length < 3) return 0;
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) count += 1;
  }
  return count;
}

function nowMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function useFinancialInsights() {
  const dashboard = useDashboard();
  const advisorMemory = useAdvisorMemory();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (dashboard.loading) return;

    let mounted = true;

    const syncSnapshots = async () => {
      const res = await fetch('/api/snapshots', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const existing = Array.isArray((data as any).snapshots) ? ((data as any).snapshots as Snapshot[]) : [];

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
          const createdData = await createRes.json().catch(() => ({}));
          const created = (createdData as any).snapshot as Snapshot | undefined;
          const nextSnapshots = created ? [...existing, created] : [...existing, payload];
          if (mounted) setSnapshots(nextSnapshots.sort((a, b) => a.date.localeCompare(b.date)));
          return;
        }
      }

      if (mounted) setSnapshots(existing.sort((a, b) => a.date.localeCompare(b.date)));
    };

    syncSnapshots().catch((error) => {
      console.warn('[snapshots:sync:error]', { message: error instanceof Error ? error.message : 'unknown_error' });
    });

    return () => {
      mounted = false;
    };
  }, [dashboard.loading, dashboard.netWorth.usd, dashboard.netWorth.ars, dashboard.cashflow.totalIncome, dashboard.cashflow.totalExpenses, dashboard.cashflow.savingsRate]);

  return useMemo(() => {
    const fallbackSnapshots: Snapshot[] = dashboard.cashflow.monthly.map((row) => ({
      date: row.month,
      netWorthUsd: dashboard.netWorth.usd,
      netWorthArs: dashboard.netWorth.ars,
      totalIncome: row.income,
      totalExpenses: row.expenses,
      savingsRate: safeDivide(row.net, row.income),
    }));

    const history = snapshots.length > 0 ? snapshots : fallbackSnapshots;
    const orderedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));

    const incomeSeries = orderedHistory.map((row) => row.totalIncome);
    const expenseSeries = orderedHistory.map((row) => row.totalExpenses);
    const savingsSeries = orderedHistory.map((row) => row.savingsRate);
    const netWorthSeries = orderedHistory.map((row) => row.netWorthUsd);

    const totalIncome = dashboard.cashflow.totalIncome;
    const totalExpenses = dashboard.cashflow.totalExpenses;
    const savingsRate = Number.isFinite(dashboard.cashflow.savingsRate) ? dashboard.cashflow.savingsRate : 0;
    const expenseRatio = safeDivide(totalExpenses, totalIncome);

    const typeRows = dashboard.allocation.byType;
    const typeCount = typeRows.length;
    const portfolioUsd = Math.max(0, dashboard.portfolio.totals.totalUsd);
    const maxTypeShare = typeRows.reduce((max, row) => Math.max(max, safeDivide(row.valueUsd, portfolioUsd)), 0);
    const biggestType = [...typeRows].sort((a, b) => b.valueUsd - a.valueUsd)[0]?.assetType ?? 'Unknown';

    const cryptoType = typeRows.find((row) => row.assetType.toUpperCase().includes('CRYPTO'));
    const cryptoShare = safeDivide(cryptoType?.valueUsd ?? 0, portfolioUsd);

    const cashPosition = safeDivide(dashboard.cash.usd, dashboard.netWorth.usd);
    const netWorthUsd = dashboard.netWorth.usd;

    const savingsScore = savingsRate >= 0.2 ? 100 : savingsRate >= 0.1 ? 75 : savingsRate >= 0 ? 45 : 10;
    const expenseScore = expenseRatio <= 0.5 ? 100 : expenseRatio <= 0.7 ? 80 : expenseRatio <= 1 ? 55 : 20;
    const diversificationCountScore = typeCount >= 4 ? 100 : typeCount === 3 ? 80 : typeCount === 2 ? 55 : typeCount === 1 ? 20 : 40;
    const diversificationConcentrationScore = maxTypeShare <= 0.4 ? 100 : maxTypeShare <= 0.55 ? 75 : maxTypeShare <= 0.7 ? 45 : 15;
    const diversificationScore = (diversificationCountScore * 0.5) + (diversificationConcentrationScore * 0.5);
    const cashScore = cashPosition >= 0.2 ? 100 : cashPosition >= 0.1 ? 75 : cashPosition > 0.05 ? 50 : 20;

    let healthScore = clamp(Math.round(
      (savingsScore * 0.4)
      + (expenseScore * 0.2)
      + (diversificationScore * 0.2)
      + (cashScore * 0.2),
    ), 0, 100);

    if (maxTypeShare > 0.7) healthScore -= 15;

    let maxCap = 100;
    if (savingsRate < 0) maxCap = Math.min(maxCap, 40);
    if (totalExpenses > totalIncome) maxCap = Math.min(maxCap, 50);
    if (netWorthUsd <= 0) maxCap = Math.min(maxCap, 30);

    const completedCount = advisorMemory.memory.lastRecommendations.filter((recommendation) => recommendation.status === 'completed').length;
    const completionBonus = Math.min(10, completedCount * 2);
    healthScore = clamp(Math.min(healthScore, maxCap) + completionBonus, 0, 100);

    console.log('[healthScore] computed', {
      savingsScore,
      expenseScore,
      diversificationScore,
      cashScore,
      maxTypeShare,
      maxCap,
      healthScore,
    });

    const insights: ScoredInsight[] = [];

    const recentExpenses = expenseSeries.slice(-4);
    if (recentExpenses.length >= 3 && countIncreasingSteps(recentExpenses) >= 2) {
      const start = recentExpenses[0] || 0;
      const end = recentExpenses[recentExpenses.length - 1] || 0;
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
      const incomeMean = incomeSeries.reduce((sum, value) => sum + value, 0) / incomeSeries.length;
      const incomeVolatility = safeDivide(stdDev(incomeSeries), incomeMean || 1);
      if (incomeVolatility > 0.25) {
        insights.push({
          id: 'income-instability',
          type: 'negative',
          category: 'cashflow',
          title: 'Income is unstable month to month',
          description: `Income volatility is ${pct(incomeVolatility)} of average income, indicating planning uncertainty.`,
          weight: 90,
        });
      }
    }

    if (savingsSeries.length >= 4) {
      const savingsVolatility = stdDev(savingsSeries);
      if (savingsVolatility > 0.12) {
        insights.push({
          id: 'savings-volatility',
          type: 'negative',
          category: 'risk',
          title: 'Savings rate is volatile',
          description: `Savings-rate volatility is ${pct(savingsVolatility)} across stored monthly snapshots.`,
          weight: 84,
        });
      }
    }

    const positiveSavingsMonths = savingsSeries.filter((value) => value > 0).length;
    const savingsConsistency = safeDivide(positiveSavingsMonths, savingsSeries.length || 1);
    if (savingsSeries.length >= 4 && savingsConsistency < 0.6) {
      insights.push({
        id: 'weak-savings-consistency',
        type: 'negative',
        category: 'cashflow',
        title: 'Savings consistency is weak',
        description: `Only ${positiveSavingsMonths}/${savingsSeries.length} snapshot months had positive savings.`,
        weight: 86,
      });
    }

    const recentNetWorth = netWorthSeries.slice(-4);
    if (recentNetWorth.length >= 3) {
      const netWorthGrowthSteps = countIncreasingSteps(recentNetWorth);
      if (netWorthGrowthSteps >= 2) {
        insights.push({
          id: 'networth-growth-trend',
          type: 'positive',
          category: 'investments',
          title: 'Net worth trend is improving',
          description: 'Stored snapshots indicate a consistent upward net-worth trajectory.',
          weight: 75,
        });
      } else if (netWorthGrowthSteps === 0) {
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

    const alerts: Alert[] = [];

    if (savingsRate < 0) alerts.push({ id: 'negative-savings-rate', severity: 'high', message: 'Savings rate is negative. Spending exceeds retained income.' });
    if (totalExpenses > totalIncome) alerts.push({ id: 'expenses-exceed-income', severity: 'high', message: 'Total expenses are greater than total income.' });
    if (netWorthUsd <= 0) alerts.push({ id: 'non-positive-net-worth', severity: 'high', message: 'Net worth is zero or negative, limiting financial resilience.' });
    if (maxTypeShare > 0.5) alerts.push({ id: 'concentration-risk', severity: maxTypeShare > 0.7 ? 'high' : 'medium', message: `Single asset-type concentration is ${pct(maxTypeShare)}.` });
    if (typeCount === 1 && portfolioUsd > 0) alerts.push({ id: 'no-diversification', severity: 'medium', message: 'Portfolio has only one asset type (no diversification).' });
    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) alerts.push({ id: 'missing-fx', severity: 'low', message: 'FX conversion data is missing; ARS analytics may be incomplete.' });

    const sortedAlerts = [...alerts].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);

    console.log('[alerts] triggered', {
      count: sortedAlerts.length,
      ids: sortedAlerts.map((alert) => `${alert.severity}:${alert.id}`),
    });

    const recommendations: PrioritizedRecommendation[] = [];

    if (totalIncome > 0) {
      const reducedExpenses = totalExpenses * 0.9;
      const improvedSavingsRate = safeDivide(totalIncome - reducedExpenses, totalIncome);
      recommendations.push({
        id: 'reduce-expenses-10pct',
        action: `Reducing expenses by 10% could move savings rate from ${pct(savingsRate)} to ${pct(improvedSavingsRate)}.`,
        reason: 'Expense control has the fastest direct impact on free cash flow.',
        impact: Math.round(Math.max(0, improvedSavingsRate - savingsRate) * 1000),
      });
    }

    if (cryptoShare > 0.4) {
      const shiftedShare = Math.max(0, cryptoShare - 0.2);
      recommendations.push({
        id: 'rebalance-crypto-20pct',
        action: `Diversifying 20% of crypto into equities could reduce crypto exposure from ${pct(cryptoShare)} to ~${pct(shiftedShare)}.`,
        reason: 'Rebalancing lowers volatility concentration risk.',
        impact: Math.round((cryptoShare - shiftedShare) * 1000) + 120,
      });
    }

    if (maxTypeShare > 0.5) {
      const shiftedConcentration = Math.max(0, maxTypeShare - 0.2);
      recommendations.push({
        id: 'reduce-top-concentration',
        action: `Shifting 20% from ${biggestType.toLowerCase()} could reduce top concentration from ${pct(maxTypeShare)} to ${pct(shiftedConcentration)}.`,
        reason: 'Less concentration improves risk-adjusted resilience.',
        impact: Math.round((maxTypeShare - shiftedConcentration) * 1000) + 100,
      });
    }

    if (netWorthUsd > 0 && cashPosition < 0.1) {
      const targetCash = netWorthUsd * 0.1;
      const requiredIncrease = Math.max(0, targetCash - dashboard.cash.usd);
      recommendations.push({
        id: 'build-cash-buffer',
        action: `Increase cash by ${requiredIncrease.toFixed(2)} USD to reach a 10% liquidity buffer.`,
        reason: 'Higher liquidity reduces forced-selling pressure.',
        impact: Math.round(safeDivide(requiredIncrease, Math.max(netWorthUsd, 1)) * 1000),
      });
    }

    if (savingsSeries.length >= 4 && savingsConsistency < 0.6) {
      const targetPositiveMonths = Math.ceil(savingsSeries.length * 0.8);
      recommendations.push({
        id: 'stabilize-savings-consistency',
        action: `Aim for positive savings in at least ${targetPositiveMonths}/${savingsSeries.length} months via a fixed spend ceiling.`,
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

    const prioritizedInsights = [...insights]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(({ weight: _weight, ...insight }) => insight);

    const ignoredRecommendations = advisorMemory.memory.lastRecommendations
      .filter((item) => item.status === 'ignored')
      .map((item) => item.text.toLowerCase());

    const prioritizedRecommendations = [...recommendations]
      .map((recommendation) => ({
        ...recommendation,
        impact: ignoredRecommendations.some((ignored) => recommendation.action.toLowerCase().includes(ignored.toLowerCase()))
          ? recommendation.impact * 0.7
          : recommendation.impact,
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map(({ impact: _impact, ...recommendation }) => recommendation);

    console.log('[insights] generated', {
      insights: prioritizedInsights.length,
      recommendations: prioritizedRecommendations.length,
      historyPoints: orderedHistory.length,
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
