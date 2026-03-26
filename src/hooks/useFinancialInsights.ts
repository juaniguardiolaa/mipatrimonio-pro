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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeDivide = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
};

const normalizeRatioScore = (ratio: number, thresholds: [number, number, number]) => {
  if (!Number.isFinite(ratio)) return 50;
  const [excellent, good, weak] = thresholds;
  if (ratio >= excellent) return 100;
  if (ratio >= good) return 75;
  if (ratio >= weak) return 45;
  return 10;
};

export function useFinancialInsights() {
  const dashboard = useDashboard();

  return useMemo(() => {
    const savingsRate = Number.isFinite(dashboard.cashflow.savingsRate) ? dashboard.cashflow.savingsRate : 0;
    const expenseRatio = safeDivide(dashboard.cashflow.totalExpenses, dashboard.cashflow.totalIncome);

    const typeRows = dashboard.allocation.byType;
    const typeCount = typeRows.length;
    const maxTypeShare = typeRows.reduce((max, row) => Math.max(max, safeDivide(row.valueUsd, dashboard.portfolio.totals.totalUsd)), 0);

    const cashPosition = safeDivide(dashboard.cash.usd, dashboard.netWorth.usd);

    const savingsScore = normalizeRatioScore(savingsRate, [0.2, 0.1, 0]);
    const expenseScore = expenseRatio <= 0.5 ? 100 : expenseRatio <= 0.7 ? 80 : expenseRatio <= 1 ? 55 : 20;
    const diversificationCountScore = typeCount >= 4 ? 100 : typeCount === 3 ? 80 : typeCount === 2 ? 55 : typeCount === 1 ? 20 : 40;
    const diversificationConcentrationScore = maxTypeShare <= 0.4 ? 100 : maxTypeShare <= 0.55 ? 75 : maxTypeShare <= 0.7 ? 45 : 15;
    const diversificationScore = (diversificationCountScore * 0.5) + (diversificationConcentrationScore * 0.5);
    const cashScore = cashPosition >= 0.2 ? 100 : cashPosition >= 0.1 ? 75 : cashPosition > 0.05 ? 50 : 20;

    const healthScore = clamp(Math.round(
      (savingsScore * 0.4)
      + (expenseScore * 0.2)
      + (diversificationScore * 0.2)
      + (cashScore * 0.2),
    ), 0, 100);

    console.log('[healthScore] computed', {
      savingsScore,
      expenseScore,
      diversificationScore,
      cashScore,
      healthScore,
    });

    const monthly = [...dashboard.cashflow.monthly].sort((a, b) => a.month.localeCompare(b.month));
    const lastMonth = monthly[monthly.length - 1];
    const previousMonth = monthly[monthly.length - 2];

    const insights: Insight[] = [];

    if (lastMonth && previousMonth) {
      const previousSavingsRate = safeDivide(previousMonth.income - previousMonth.expenses, previousMonth.income);
      const currentSavingsRate = safeDivide(lastMonth.income - lastMonth.expenses, lastMonth.income);
      if (currentSavingsRate > previousSavingsRate + 0.02) {
        insights.push({
          id: 'savings-rate-improved',
          type: 'positive',
          title: 'Savings rate improved this month',
          description: `Savings rate moved from ${(previousSavingsRate * 100).toFixed(1)}% to ${(currentSavingsRate * 100).toFixed(1)}%.`,
        });
      } else if (currentSavingsRate < previousSavingsRate - 0.02) {
        insights.push({
          id: 'savings-rate-declined',
          type: 'negative',
          title: 'Savings rate declined this month',
          description: `Savings rate moved from ${(previousSavingsRate * 100).toFixed(1)}% to ${(currentSavingsRate * 100).toFixed(1)}%.`,
        });
      }

      if (lastMonth.expenses > previousMonth.expenses * 1.1) {
        const increase = safeDivide(lastMonth.expenses - previousMonth.expenses, previousMonth.expenses || 1) * 100;
        insights.push({
          id: 'expenses-increased',
          type: 'negative',
          title: 'Expenses increased compared to last month',
          description: `Monthly expenses rose by ${increase.toFixed(1)}% month-over-month.`,
        });
      } else if (lastMonth.expenses < previousMonth.expenses * 0.9 && previousMonth.expenses > 0) {
        const decrease = safeDivide(previousMonth.expenses - lastMonth.expenses, previousMonth.expenses) * 100;
        insights.push({
          id: 'expenses-decreased',
          type: 'positive',
          title: 'Expenses decreased compared to last month',
          description: `Monthly expenses dropped by ${decrease.toFixed(1)}% month-over-month.`,
        });
      }

      if (lastMonth.income > previousMonth.income * 1.1) {
        const growth = safeDivide(lastMonth.income - previousMonth.income, previousMonth.income || 1) * 100;
        insights.push({
          id: 'income-growth',
          type: 'positive',
          title: 'Income grew compared to last month',
          description: `Income increased by ${growth.toFixed(1)}% month-over-month.`,
        });
      } else if (lastMonth.income < previousMonth.income * 0.9 && previousMonth.income > 0) {
        const decline = safeDivide(previousMonth.income - lastMonth.income, previousMonth.income) * 100;
        insights.push({
          id: 'income-decline',
          type: 'negative',
          title: 'Income declined compared to last month',
          description: `Income fell by ${decline.toFixed(1)}% month-over-month.`,
        });
      }
    }

    if (maxTypeShare > 0.5 && typeRows.length > 0) {
      const primaryType = [...typeRows].sort((a, b) => b.valueUsd - a.valueUsd)[0]?.assetType || 'single asset class';
      insights.push({
        id: 'concentration-risk',
        type: 'negative',
        title: `High concentration in ${primaryType.toLowerCase()} assets`,
        description: `${(maxTypeShare * 100).toFixed(1)}% of your portfolio is concentrated in one asset type.`,
      });
    } else if (typeRows.length >= 3) {
      insights.push({
        id: 'good-diversification',
        type: 'positive',
        title: 'Portfolio diversification is healthy',
        description: `Your assets are spread across ${typeRows.length} categories, lowering concentration risk.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'stable-overview',
        type: 'neutral',
        title: 'Financial activity is stable',
        description: 'No major month-over-month changes detected in your cashflow or allocation.',
      });
    }

    if (insights.length < 3) {
      insights.push({
        id: 'savings-benchmark',
        type: savingsRate >= 0.1 ? 'positive' : 'neutral',
        title: 'Savings benchmark status',
        description: `Current savings rate is ${(savingsRate * 100).toFixed(1)}%, with a target benchmark above 10%.`,
      });
    }
    if (insights.length < 3) {
      insights.push({
        id: 'expense-ratio-status',
        type: expenseRatio <= 0.7 ? 'positive' : 'negative',
        title: 'Expense ratio trend',
        description: `Expenses currently represent ${(expenseRatio * 100).toFixed(1)}% of income.`,
      });
    }
    if (insights.length < 3) {
      insights.push({
        id: 'liquidity-status',
        type: cashPosition >= 0.1 ? 'positive' : 'neutral',
        title: 'Liquidity position',
        description: `Cash allocation stands at ${(cashPosition * 100).toFixed(1)}% of net worth.`,
      });
    }

    const alerts: Alert[] = [];

    if (savingsRate < 0) {
      alerts.push({ id: 'negative-savings-rate', severity: 'high', message: 'Savings rate is negative. You are spending more than you save.' });
    }

    if (dashboard.cashflow.totalExpenses > dashboard.cashflow.totalIncome) {
      alerts.push({ id: 'expenses-exceed-income', severity: 'high', message: 'Total expenses are higher than total income.' });
    }

    if (maxTypeShare > 0.5) {
      alerts.push({ id: 'single-asset-high-concentration', severity: 'medium', message: `A single asset type represents ${(maxTypeShare * 100).toFixed(1)}% of your portfolio.` });
    }

    if (typeCount === 1 && dashboard.portfolio.totals.totalUsd > 0) {
      alerts.push({ id: 'no-diversification', severity: 'medium', message: 'Your portfolio has no diversification (single asset type).' });
    }

    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      alerts.push({ id: 'missing-fx', severity: 'low', message: 'FX conversion data is missing. ARS values may be incomplete.' });
    }

    console.log('[alerts] triggered', { count: alerts.length, ids: alerts.map((alert) => alert.id) });

    const recommendations: Recommendation[] = [];

    if (savingsRate < 0) {
      const targetExpense = dashboard.cashflow.totalIncome * 0.9;
      const reduction = Math.max(0, dashboard.cashflow.totalExpenses - targetExpense);
      recommendations.push({
        id: 'reduce-expenses',
        action: `Reduce monthly expenses by ${reduction > 0 ? `$${reduction.toFixed(2)}` : 'at least 10%'}.`,
        reason: 'This would move savings rate closer to positive territory.',
      });
    }

    if (maxTypeShare > 0.5) {
      recommendations.push({
        id: 'diversify-portfolio',
        action: 'Diversify into additional asset types beyond your largest concentration.',
        reason: 'Lowering concentration helps reduce drawdown risk from one market segment.',
      });
    }

    if (cashPosition < 0.1 && dashboard.netWorth.usd > 0) {
      const cashTarget = dashboard.netWorth.usd * 0.1;
      const gap = Math.max(0, cashTarget - dashboard.cash.usd);
      recommendations.push({
        id: 'increase-cash-buffer',
        action: `Increase cash reserves by ${gap > 0 ? `$${gap.toFixed(2)}` : 'building toward 10% of net worth'}.`,
        reason: 'A stronger cash buffer improves resilience and liquidity.',
      });
    }

    if (dashboard.fx.requiresConversion && !dashboard.fx.rateAvailable) {
      recommendations.push({
        id: 'retry-fx-source',
        action: 'Refresh FX data or add a fallback conversion source for ARS valuation.',
        reason: 'Reliable conversion is needed for accurate net worth and allocation analytics.',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'keep-consistency',
        action: 'Keep contributing regularly and review allocation monthly.',
        reason: 'Current metrics do not show major structural issues.',
      });
    }

    if (recommendations.length < 3) {
      recommendations.push({
        id: 'budget-guardrail',
        action: `Set a spending guardrail near ${(Math.min(90, expenseRatio * 100)).toFixed(0)}% of monthly income.`,
        reason: 'This helps maintain a consistent savings margin in volatile months.',
      });
    }
    if (recommendations.length < 3) {
      recommendations.push({
        id: 'automate-savings',
        action: 'Automate a monthly transfer to savings or low-risk assets right after income is received.',
        reason: 'Automation improves consistency and reduces overspending risk.',
      });
    }

    const constrainedInsights = insights.slice(0, 6);
    const constrainedRecommendations = recommendations.slice(0, 5);

    console.log('[insights] generated', {
      insights: constrainedInsights.length,
      recommendations: constrainedRecommendations.length,
    });

    return {
      dashboard,
      healthScore,
      insights: constrainedInsights,
      alerts,
      recommendations: constrainedRecommendations,
    };
  }, [dashboard]);
}
