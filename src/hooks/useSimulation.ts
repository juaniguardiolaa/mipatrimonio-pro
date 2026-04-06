import { useMemo } from 'react';
import { useDashboard } from './useDashboard';
import { useFinancialInsights } from './useFinancialInsights';
import { useFX } from './useFX';
 
const RETURNS: Record<string, number> = {
  CRYPTO: 0.12,
  STOCK: 0.08,
  ETF: 0.07,
  BOND: 0.04,
  CASH: 0.01,
};
 
const VOLATILITY: Record<string, number> = {
  CRYPTO: 0.15,
  STOCK: 0.08,
  ETF: 0.08,
  BOND: 0.03,
  CASH: 0.002,
};
 
const DEFAULT_INFLATION = 0.03;
const FALLBACK_FX_RATE = 1;
 
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
 
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
 
const safeDivide = (n: number, d: number) => {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return n / d;
};
 
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
 
function addMonths(start: Date, months: number) {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + months);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
 
// ── FIX: seededRandom and per-month jitter removed ───────────────────────────
// Old code applied noise via Math.sin(seed) with fixed seeds (11,29,47,71).
// Problems:
//   1. Every user always saw the exact same trajectory — not real uncertainty.
//   2. Same annualVolatility across all scenarios → identical noise amplitude,
//      only phase differed (visually indistinguishable from pure noise).
//   3. The jitter could produce negative returns in early months, misleading
//      users about the expected path.
//
// Scenarios are now differentiated by what is meaningful and explainable:
//   base        → baseline savings, base expected return
//   optimized   → expense reduction applied to savings, base return
//   optimistic  → optimized savings + return × 1.2  (better market)
//   conservative→ optimized savings + return × 0.8  (weaker market)
 
function runScenario(options: {
  months: number;
  startNetWorthUsd: number;
  fxRate: number;
  monthlyContribution: number;
  expectedReturn: number;
  realReturn: number;
  targetAmountUsd?: number;
}): ScenarioResult {
  const {
    months,
    startNetWorthUsd,
    fxRate,
    monthlyContribution,
    expectedReturn,
    realReturn,
    targetAmountUsd,
  } = options;
 
  const now = new Date();
  let currentUsd = startNetWorthUsd;
  let monthsToGoal: number | null = null;
  const simulation: SimulationPoint[] = [];
 
  // Pre-compute once outside the loop
  const monthlyRealReturn = (1 + realReturn) ** (1 / 12) - 1;
 
  for (let index = 1; index <= months; index++) {
    currentUsd = currentUsd * (1 + monthlyRealReturn) + monthlyContribution;
    simulation.push({
      month: addMonths(now, index),
      netWorthUsd: round2(currentUsd),
      netWorthArs: round2(currentUsd * fxRate),
    });
 
    if (
      targetAmountUsd &&
      targetAmountUsd > 0 &&
      monthsToGoal === null &&
      currentUsd >= targetAmountUsd
    ) {
      monthsToGoal = index;
    }
  }
 
  const yearsToGoal = monthsToGoal === null ? null : round2(monthsToGoal / 12);
  console.log('[simulation] goalComputed', { targetAmountUsd, monthsToGoal, yearsToGoal });
 
  return {
    simulation,
    projectedNetWorth: { usd: round2(currentUsd), ars: round2(currentUsd * fxRate) },
    monthsToGoal,
    yearsToGoal,
    expectedReturn,
    realReturn,
  };
}
 
export function useSimulation(input: SimulationInput = {}) {
  const dashboard = useDashboard();
  const insightsLayer = useFinancialInsights();
  const { ccl } = useFX();
 
  return useMemo(() => {
    const years = Math.max(1, Math.floor(input.years ?? 5));
    const months = years * 12;
 
    const weightedExpectedReturn = dashboard.allocation.byType.reduce((acc, row) => {
      const share = safeDivide(row.valueUsd, dashboard.portfolio.totals.totalUsd);
      const baseReturn = RETURNS[row.assetType.toUpperCase()] ?? 0.05;
      return acc + share * baseReturn;
    }, 0);
 
    const weightedAnnualVolatility =
      dashboard.allocation.byType.reduce((acc, row) => {
        const share = safeDivide(row.valueUsd, dashboard.portfolio.totals.totalUsd);
        const baseVol = VOLATILITY[row.assetType.toUpperCase()] ?? 0.06;
        return acc + share * baseVol;
      }, 0) || 0.05;
 
    const expectedReturn =
      input.investmentReturnOverride ?? (weightedExpectedReturn || 0.05);
    const inflation = input.inflation ?? DEFAULT_INFLATION;
    const realReturn = (1 + expectedReturn) / (1 + inflation) - 1;
 
    const monthlyIncome =
      dashboard.cashflow.monthly.length > 0
        ? dashboard.cashflow.monthly.reduce((s, r) => s + r.income, 0) /
          dashboard.cashflow.monthly.length
        : 0;
    const monthlyExpenses =
      dashboard.cashflow.monthly.length > 0
        ? dashboard.cashflow.monthly.reduce((s, r) => s + r.expenses, 0) /
          dashboard.cashflow.monthly.length
        : 0;
 
    const baselineSavings =
      input.monthlySavings ?? Math.max(0, monthlyIncome - monthlyExpenses);
    const expenseReduction = clamp((input.expenseReductionPercent ?? 0) / 100, 0, 1);
    const optimizedSavings = Math.max(
      0,
      baselineSavings + monthlyExpenses * expenseReduction,
    );
 
    const fxRate = ccl && ccl > 0 ? ccl : FALLBACK_FX_RATE;
    if (!ccl) {
      console.warn('[simulation] ccl_unavailable — ARS projections use fxRate=1');
    }
 
    const sharedBase = {
      months,
      startNetWorthUsd: Math.max(0, dashboard.netWorth.usd),
      fxRate,
      targetAmountUsd: input.targetAmountUsd,
    };
 
    const baseScenario = runScenario({
      ...sharedBase,
      monthlyContribution: Math.max(0, baselineSavings),
      expectedReturn,
      realReturn,
    });
 
    const optimizedScenario = runScenario({
      ...sharedBase,
      monthlyContribution: Math.max(0, optimizedSavings),
      expectedReturn,
      realReturn,
    });
 
    const optimisticScenario = runScenario({
      ...sharedBase,
      monthlyContribution: Math.max(0, optimizedSavings),
      expectedReturn: expectedReturn * 1.2,
      realReturn: (1 + expectedReturn * 1.2) / (1 + inflation) - 1,
    });
 
    const conservativeScenario = runScenario({
      ...sharedBase,
      monthlyContribution: Math.max(0, optimizedSavings),
      expectedReturn: expectedReturn * 0.8,
      realReturn: (1 + expectedReturn * 0.8) / (1 + inflation) - 1,
    });
 
    const goalTarget =
      input.targetAmountUsd && input.targetAmountUsd > 0 ? input.targetAmountUsd : null;
    const goalProgress = goalTarget
      ? clamp(safeDivide(dashboard.netWorth.usd, goalTarget), 0, 1)
      : 0;
    const remainingAmount = goalTarget
      ? Math.max(0, goalTarget - dashboard.netWorth.usd)
      : 0;
 
    console.log('[simulation] run', {
      years,
      expectedReturn: round2(expectedReturn * 100) + '%',
      realReturn: round2(realReturn * 100) + '%',
      baselineSavings,
      optimizedSavings,
      fxRate,
      cclSource: ccl ? 'real' : 'fallback',
      annualVolatility: round2(weightedAnnualVolatility * 100) + '%',
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
      optimisticYearsToGoal: optimisticScenario.yearsToGoal,
      conservativeYearsToGoal: conservativeScenario.yearsToGoal,
      goalProgress,
      remainingAmount,
      baseScenario,
      optimizedScenario,
      annualVolatility: weightedAnnualVolatility,
      fxRateUsed: fxRate,
      fxRateIsReal: ccl !== null,
    };
  }, [
    ccl,
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
