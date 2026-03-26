import { useMemo } from 'react';
import { useDashboard } from './useDashboard';

export type Insight = {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
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

function countIncreasingStreak(values: number[]) {
  if (values.length < 3) return 0;
  let streak = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) streak += 1;
  }
  return streak;
}

export function useFinancialInsights() {
  const dashboard = useDashboard();

  return useMemo(() => {
    const monthly = [...dashboard.cashflow.monthly].sort((a, b) => a.month.localeCompare(b.month));
    const incomeSeries = monthly.map((row) => row.income);
    const expenseSeries = monthly.map((row) => row.expenses);
    const savingsSeries = monthly.map((row) => safeDivide(row.income - row.expenses, row.income));

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

    // Base weighted score
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

    // Hard-rule caps and penalties
    if (maxTypeShare > 0.7) healthScore -= 15;

    let maxCap = 100;
    if (savingsRate < 0) maxCap = Math.min(maxCap, 40);
    if (totalExpenses > totalIncome) maxCap = Math.min(maxCap, 50);
    if (netWorthUsd <= 0) maxCap = Math.min(maxCap, 30);

    healthScore = clamp(Math.min(healthScore, maxCap), 0, 100);

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

    const expenseIncreaseStreak = countIncreasingStreak(expenseSeries.slice(-3));
    if (expenseSeries.length >= 3 && expenseIncreaseStreak >= 2) {
      const first = expenseSeries[expenseSeries.length - 3] || 0;
      const last = expenseSeries[expenseSeries.length - 1] || 0;
      const expenseTrend = safeDivide(last - first, first || 1);
      insights.push({
        id: 'expense-uptrend',
        type: 'negative',
        title: 'Expenses are on a sustained uptrend',
        description: `Expenses increased for at least 2 consecutive periods, rising ${pct(expenseTrend)} across the last 3 months.`,
        weight: 95,
      });
    }

    if (incomeSeries.length >= 3) {
      const incomeMean = incomeSeries.reduce((sum, value) => sum + value, 0) / incomeSeries.length;
      const incomeVolatility = safeDivide(stdDev(incomeSeries), incomeMean || 1);
      if (incomeVolatility > 0.25) {
        insights.push({
          id: 'income-instability',
          type: 'negative',
          title: 'Income shows high instability',
          description: `Income volatility is ${pct(incomeVolatility)} of average monthly income, which can pressure planning accuracy.`,
          weight: 90,
        });
      }
    }

    if (cryptoShare > 0.4) {
      insights.push({
        id: 'high-crypto-volatility',
        type: 'negative',
        title: 'Portfolio has elevated crypto volatility exposure',
        description: `Crypto represents ${pct(cryptoShare)} of invested assets, increasing drawdown risk during market shocks.`,
        weight: 88,
      });
    }

    const positiveSavingsMonths = savingsSeries.filter((value) => value > 0).length;
    const savingsConsistency = safeDivide(positiveSavingsMonths, savingsSeries.length || 1);
    if (savingsSeries.length >= 3 && savingsConsistency < 0.6) {
      insights.push({
        id: 'weak-savings-consistency',
        type: 'negative',
        title: 'Savings consistency is weak',
        description: `Only ${positiveSavingsMonths}/${savingsSeries.length} recent months had positive savings.`,
        weight: 85,
      });
    } else if (savingsSeries.length >= 3 && savingsConsistency >= 0.8) {
      insights.push({
        id: 'strong-savings-consistency',
        type: 'positive',
        title: 'Savings consistency is strong',
        description: `${positiveSavingsMonths}/${savingsSeries.length} recent months closed with positive savings.`,
        weight: 70,
      });
    }

    if (maxTypeShare > 0.5) {
      insights.push({
        id: 'allocation-concentration',
        type: 'negative',
        title: `High concentration in ${biggestType.toLowerCase()}`,
        description: `${pct(maxTypeShare)} of portfolio value is concentrated in one asset type.`,
        weight: maxTypeShare > 0.7 ? 92 : 80,
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'balanced-profile',
        type: 'neutral',
        title: 'Financial profile is currently balanced',
        description: 'No major risk concentration or instability patterns were detected in recent periods.',
        weight: 50,
      });
    }

    const alerts: Alert[] = [];

    if (savingsRate < 0) {
      alerts.push({ id: 'negative-savings-rate', severity: 'high', message: 'Savings rate is negative. Spending exceeds retained income.' });
    }
    if (totalExpenses > totalIncome) {
      alerts.push({ id: 'expenses-exceed-income', severity: 'high', message: 'Total expenses are greater than total income.' });
    }
    if (netWorthUsd <= 0) {
      alerts.push({ id: 'non-positive-net-worth', severity: 'high', message: 'Net worth is zero or negative, limiting financial resilience.' });
    }
    if (maxTypeShare > 0.5) {
      alerts.push({ id: 'concentration-risk', severity: maxTypeShare > 0.7 ? 'high' : 'medium', message: `Single asset-type concentration is ${pct(maxTypeShare)}.` });
    }
    if (typeCount === 1 && portfolioUsd > 0) {
      alerts.push({ id: 'no-diversification', severity: 'medium', message: 'Portfolio has only one asset type (no diversification).' });
    }
    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      alerts.push({ id: 'missing-fx', severity: 'low', message: 'FX conversion data is missing; ARS-based analytics may be incomplete.' });
    }

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
        action: `Reducing expenses by 10% would improve savings rate from ${pct(savingsRate)} to ${pct(improvedSavingsRate)}.`,
        reason: 'Lower expenses produce an immediate improvement in free cash flow.',
        impact: Math.round(Math.max(0, improvedSavingsRate - savingsRate) * 1000),
      });
    }

    if (cryptoShare > 0.4) {
      const shiftedShare = Math.max(0, cryptoShare - 0.2);
      recommendations.push({
        id: 'rebalance-crypto-20pct',
        action: `Reallocating 20% of crypto into diversified equities would reduce crypto exposure from ${pct(cryptoShare)} to about ${pct(shiftedShare)}.`,
        reason: 'This lowers volatility concentration while keeping market participation.',
        impact: Math.round((cryptoShare - shiftedShare) * 1000) + 120,
      });
    }

    if (maxTypeShare > 0.5) {
      const shiftedConcentration = Math.max(0, maxTypeShare - 0.2);
      recommendations.push({
        id: 'reduce-top-concentration',
        action: `Shifting 20% from ${biggestType.toLowerCase()} could reduce top-type concentration from ${pct(maxTypeShare)} to ${pct(shiftedConcentration)}.`,
        reason: 'Lower concentration typically improves risk-adjusted portfolio stability.',
        impact: Math.round((maxTypeShare - shiftedConcentration) * 1000) + 100,
      });
    }

    if (netWorthUsd > 0 && cashPosition < 0.1) {
      const targetCash = netWorthUsd * 0.1;
      const requiredIncrease = Math.max(0, targetCash - dashboard.cash.usd);
      recommendations.push({
        id: 'build-cash-buffer',
        action: `Increase cash reserves by ${requiredIncrease.toFixed(2)} USD to reach a 10% cash buffer.`,
        reason: 'Adequate liquidity reduces forced selling risk during downturns.',
        impact: Math.round(safeDivide(requiredIncrease, Math.max(netWorthUsd, 1)) * 1000),
      });
    }

    if (savingsSeries.length >= 3 && savingsConsistency < 0.6) {
      const targetPositiveMonths = Math.ceil(savingsSeries.length * 0.8);
      recommendations.push({
        id: 'stabilize-savings-consistency',
        action: `Target positive savings in at least ${targetPositiveMonths}/${savingsSeries.length} months by setting a fixed monthly spend cap.`,
        reason: 'Consistency compounds and improves predictability of wealth growth.',
        impact: 95,
      });
    }

    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      recommendations.push({
        id: 'restore-fx-feed',
        action: 'Restore FX feed reliability (primary + fallback source) to recover accurate ARS analytics.',
        reason: 'Without FX rates, net worth and allocation metrics can be materially distorted.',
        impact: 80,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'maintain-plan',
        action: 'Maintain current contribution cadence and rebalance quarterly.',
        reason: 'Current metrics show no urgent structural issues.',
        impact: 20,
      });
    }

    const prioritizedInsights = [...insights]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(({ weight: _weight, ...insight }) => insight);

    const prioritizedRecommendations = [...recommendations]
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map(({ impact: _impact, ...recommendation }) => recommendation);

    console.log('[insights] generated', {
      insights: prioritizedInsights.length,
      recommendations: prioritizedRecommendations.length,
    });

    return {
      dashboard,
      healthScore,
      insights: prioritizedInsights,
      alerts: sortedAlerts,
      recommendations: prioritizedRecommendations,
    };
  }, [dashboard]);
}
