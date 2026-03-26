import { useMemo } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';

const RETURNS: Record<string, number> = {
  CRYPTO: 0.12,
  STOCK: 0.08,
  ETF: 0.07,
  BOND: 0.04,
  CASH: 0.01,
};

const DEFAULT_INFLATION = 0.03;

type SimulationInput = {
  monthlySavings?: number;
  expenseReductionPercent?: number;
  investmentReturnOverride?: number;
  inflation?: number;
  years?: number;
  targetAmountUsd?: number;
};

type SimulationPoint = {
  month: string;
  netWorthUsd: number;
  netWorthArs: number;
};

type ScenarioResult = {
  simulation: SimulationPoint[];
  projectedNetWorth: { usd: number; ars: number };
  monthsToGoal: number | null;
  yearsToGoal: number | null;
  expectedReturn: number;
  realReturn: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeDivide = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function addMonths(start: Date, months: number) {
  const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function runScenario(options: {
  months: number;
  startNetWorthUsd: number;
  fxRate: number;
  monthlyContribution: number;
  expectedReturn: number;
  realReturn: number;
  targetAmountUsd?: number;
}) {
  const {
    months,
    startNetWorthUsd,
    fxRate,
    monthlyContribution,
    expectedReturn,
    realReturn,
    targetAmountUsd,
  } = options;

  const monthlyRealReturn = (1 + realReturn) ** (1 / 12) - 1;
  const now = new Date();
  let currentUsd = startNetWorthUsd;
  let monthsToGoal: number | null = null;

  const simulation: SimulationPoint[] = [];

  for (let index = 1; index <= months; index += 1) {
    currentUsd = (currentUsd * (1 + monthlyRealReturn)) + monthlyContribution;
    const point: SimulationPoint = {
      month: addMonths(now, index),
      netWorthUsd: round2(currentUsd),
      netWorthArs: round2(currentUsd * fxRate),
    };

    simulation.push(point);

    if (targetAmountUsd && targetAmountUsd > 0 && monthsToGoal === null && currentUsd >= targetAmountUsd) {
      monthsToGoal = index;
    }
  }

  const yearsToGoal = monthsToGoal === null ? null : round2(monthsToGoal / 12);

  console.log('[simulation] goalComputed', {
    targetAmountUsd: targetAmountUsd ?? null,
    monthsToGoal,
    yearsToGoal,
  });

  return {
    simulation,
    projectedNetWorth: {
      usd: round2(currentUsd),
      ars: round2(currentUsd * fxRate),
    },
    monthsToGoal,
    yearsToGoal,
    expectedReturn,
    realReturn,
  } satisfies ScenarioResult;
}

export function useSimulation(input: SimulationInput = {}) {
  const dashboard = useDashboard();
  const insightsLayer = useFinancialInsights();

  return useMemo(() => {
    const years = Math.max(1, Math.floor(input.years ?? 5));
    const months = years * 12;

    const weightedExpectedReturn = dashboard.allocation.byType.reduce((acc, row) => {
      const share = safeDivide(row.valueUsd, dashboard.portfolio.totals.totalUsd);
      const baseReturn = RETURNS[row.assetType.toUpperCase()] ?? 0.05;
      return acc + (share * baseReturn);
    }, 0);

    const expectedReturn = input.investmentReturnOverride ?? (weightedExpectedReturn || 0.05);
    const inflation = input.inflation ?? DEFAULT_INFLATION;
    const realReturn = ((1 + expectedReturn) / (1 + inflation)) - 1;

    const monthlyIncome = dashboard.cashflow.monthly.length > 0
      ? dashboard.cashflow.monthly.reduce((sum, row) => sum + row.income, 0) / dashboard.cashflow.monthly.length
      : 0;
    const monthlyExpenses = dashboard.cashflow.monthly.length > 0
      ? dashboard.cashflow.monthly.reduce((sum, row) => sum + row.expenses, 0) / dashboard.cashflow.monthly.length
      : 0;

    const baselineSavings = input.monthlySavings ?? Math.max(0, monthlyIncome - monthlyExpenses);
    const expenseReduction = clamp((input.expenseReductionPercent ?? 0) / 100, 0, 1);
    const optimizedSavings = Math.max(0, baselineSavings + (monthlyExpenses * expenseReduction));

    const inferredFx = dashboard.netWorth.usd > 0 ? dashboard.netWorth.ars / dashboard.netWorth.usd : 0;
    const fxRate = inferredFx > 0 ? inferredFx : 1;

    const baseScenario = runScenario({
      months,
      startNetWorthUsd: Math.max(0, dashboard.netWorth.usd),
      fxRate,
      monthlyContribution: Math.max(0, baselineSavings),
      expectedReturn,
      realReturn,
      targetAmountUsd: input.targetAmountUsd,
    });

    const optimizedScenario = runScenario({
      months,
      startNetWorthUsd: Math.max(0, dashboard.netWorth.usd),
      fxRate,
      monthlyContribution: Math.max(0, optimizedSavings),
      expectedReturn,
      realReturn,
      targetAmountUsd: input.targetAmountUsd,
    });

    console.log('[simulation] run', {
      years,
      months,
      expectedReturn,
      realReturn,
      baselineSavings,
      optimizedSavings,
      fxRate,
      healthScore: insightsLayer.healthScore,
    });

    return {
      dashboard,
      insights: insightsLayer,
      simulation: optimizedScenario.simulation,
      projectedNetWorth: optimizedScenario.projectedNetWorth,
      monthsToGoal: optimizedScenario.monthsToGoal,
      yearsToGoal: optimizedScenario.yearsToGoal,
      expectedReturn,
      realReturn,
      baseScenario,
      optimizedScenario,
    };
  }, [
    dashboard,
    insightsLayer,
    input.expenseReductionPercent,
    input.inflation,
    input.investmentReturnOverride,
    input.monthlySavings,
    input.targetAmountUsd,
    input.years,
  ]);
}
