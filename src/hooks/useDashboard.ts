import { useEffect, useMemo, useState } from 'react';
import { useFX } from './useFX';
import { usePortfolio } from './usePortfolio';
 
type AssetLike = {
  id: string;
  symbol: string;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
  cedearRatio?: number | null;
};
 
type AccountLike = {
  id: string;
  name?: string;
  balance?: number;
  currency?: string;
};
 
type CashflowRow = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};
 
const safeSum = (values: Array<number | null | undefined>) =>
  values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
 
function roundMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}
 
function toMonthKey(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
 
function toAmount(value: unknown) {
  const n = Number(value ?? null);
  return Number.isFinite(n) ? n : 0;
}
 
export function useDashboard() {
  const [assets, setAssets] = useState<AssetLike[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<AccountLike[]>([]);
  const [loading, setLoading] = useState(true);
 
  // useFX now returns { ccl, loading, error } from our internal /api/fx/ccl route
  const { ccl } = useFX();
  const portfolio = usePortfolio(assets);
 
  useEffect(() => {
    let mounted = true;
 
    const load = async () => {
      try {
        setLoading(true);
        const [assetsRes, incomeRes, expensesRes, accountsRes] = await Promise.allSettled([
          fetch('/api/assets', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/income', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/expenses', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/accounts', { cache: 'no-store', credentials: 'include' }),
        ]);
 
        if (!mounted) return;
 
        const parse = async (result: PromiseSettledResult<Response>) => {
          if (result.status !== 'fulfilled' || !result.value.ok) return {};
          return result.value.json().catch(() => ({}));
        };
 
        const [assetsData, incomeData, expensesData, accountsData] = await Promise.all([
          parse(assetsRes),
          parse(incomeRes),
          parse(expensesRes),
          parse(accountsRes),
        ]);
 
        setAssets(
          Array.isArray((assetsData as any).assets) ? (assetsData as any).assets : [],
        );
        // /api/income returns { items: [...] }
        setIncome(
          Array.isArray((incomeData as any).items)
            ? (incomeData as any).items
            : Array.isArray((incomeData as any).income)
              ? (incomeData as any).income
              : [],
        );
        // /api/expenses returns { items: [...] }
        setExpenses(
          Array.isArray((expensesData as any).items)
            ? (expensesData as any).items
            : Array.isArray((expensesData as any).expenses)
              ? (expensesData as any).expenses
              : [],
        );
        setAccounts(
          Array.isArray((accountsData as any).accounts)
            ? (accountsData as any).accounts
            : [],
        );
      } catch (error) {
        console.warn('[dashboard:error]', {
          message: error instanceof Error ? error.message : 'unknown_error',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };
 
    load().catch(() => undefined);
    return () => { mounted = false; };
  }, []);
 
  return useMemo(() => {
    // ── Cash from HoldingAccounts ─────────────────────────────────────────
    const usdAccountsTotal = safeSum(
      accounts.map((a) =>
        (a.currency || 'ARS').toUpperCase() === 'USD' ? toAmount(a.balance) : 0,
      ),
    );
    const arsAccountsTotal = safeSum(
      accounts.map((a) =>
        (a.currency || 'ARS').toUpperCase() === 'ARS' ? toAmount(a.balance) : 0,
      ),
    );
 
    const cashUsd = usdAccountsTotal + (ccl && ccl > 0 ? arsAccountsTotal / ccl : 0);
    const cashArs = arsAccountsTotal + (ccl && ccl > 0 ? usdAccountsTotal * ccl : 0);
 
    const fxRateAvailable = Boolean(ccl && ccl > 0);
    const requiresFx =
      arsAccountsTotal > 0 ||
      assets.some((a) => {
        const cur = (a.currency || '').toUpperCase();
        return cur === 'ARS' || a.assetType === 'CEDEAR';
      });
 
    // ── Net worth ─────────────────────────────────────────────────────────
    const netWorthUsd = safeSum([portfolio.totals.totalUsd, cashUsd]);
    const netWorthArs = safeSum([portfolio.totals.totalArs, cashArs]);
 
    // ── Cashflow: aggregate income + expenses by month ────────────────────
    const monthMap = new Map<string, { income: number; expenses: number }>();
 
    income.forEach((item) => {
      const month = toMonthKey(
        (item as any).date ?? (item as any).timestamp ?? (item as any).createdAt,
      );
      if (!month) return;
      const current = monthMap.get(month) || { income: 0, expenses: 0 };
      current.income += toAmount((item as any).amount);
      monthMap.set(month, current);
    });
 
    expenses.forEach((item) => {
      const month = toMonthKey(
        (item as any).date ?? (item as any).timestamp ?? (item as any).createdAt,
      );
      if (!month) return;
      const current = monthMap.get(month) || { income: 0, expenses: 0 };
      current.expenses += toAmount((item as any).amount);
      monthMap.set(month, current);
    });
 
    const monthly: CashflowRow[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        income: roundMoney(v.income) ?? 0,
        expenses: roundMoney(v.expenses) ?? 0,
        net: roundMoney(v.income - v.expenses) ?? 0,
      }));
 
    const totalIncome = safeSum(monthly.map((r) => r.income));
    const totalExpenses = safeSum(monthly.map((r) => r.expenses));
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;
 
    // ── Allocation ────────────────────────────────────────────────────────
    const validPositions = portfolio.positions.filter(
      (p) => p.isRealPrice && p.marketValueUsd !== null,
    );
    const totalMarketUsd = safeSum(validPositions.map((p) => p.marketValueUsd));
 
    const byAsset = validPositions.map((p) => ({
      symbol: p.symbol,
      valueUsd: roundMoney(p.marketValueUsd) ?? 0,
      percentage: totalMarketUsd > 0 ? ((p.marketValueUsd ?? 0) / totalMarketUsd) * 100 : 0,
    }));
 
    const byTypeMap = new Map<string, number>();
    validPositions.forEach((p) =>
      byTypeMap.set(p.assetType, (byTypeMap.get(p.assetType) || 0) + (p.marketValueUsd ?? 0)),
    );
    const byType = Array.from(byTypeMap.entries()).map(([assetType, valueUsd]) => ({
      assetType,
      valueUsd: roundMoney(valueUsd) ?? 0,
      percentage: totalMarketUsd > 0 ? (valueUsd / totalMarketUsd) * 100 : 0,
    }));
 
    // ── Movers ────────────────────────────────────────────────────────────
    // ── FIX: Exclude CASH positions from the movers table.
    // CASH PnL is driven entirely by CCL fluctuation (buying power drift), not
    // by an investment decision. Showing cash as a "top loser" is misleading
    // because the user cannot act on it the same way as an equity position.
    // Also filter out positions with no USD PnL data and tiny positions (<$100).
    const moversSource = validPositions
      .filter((p) => p.assetType !== 'CASH')
      .filter((p) => (p.marketValueUsd ?? 0) > 100)
      .filter((p) => p.profitLossUsd !== null)
      .sort((a, b) => (b.profitLossUsd ?? 0) - (a.profitLossUsd ?? 0));
 
    const gainers = moversSource.slice(0, 3);
    const losers = [...moversSource].reverse().slice(0, 3);
 
    const result = {
      netWorth: {
        usd: roundMoney(netWorthUsd) ?? 0,
        ars: roundMoney(netWorthArs) ?? 0,
      },
      cash: {
        usd: roundMoney(cashUsd) ?? 0,
        ars: roundMoney(cashArs) ?? 0,
      },
      cashflow: {
        monthly,
        totalIncome: roundMoney(totalIncome) ?? 0,
        totalExpenses: roundMoney(totalExpenses) ?? 0,
        savingsRate,
      },
      allocation: { byAsset, byType },
      movers: { gainers, losers },
      portfolio,
      fx: {
        rateAvailable: fxRateAvailable,
        requiresConversion: requiresFx,
      },
      loading,
    };
 
    console.log('[dashboard] computed', {
      positions: portfolio.positions.length,
      monthlyRows: monthly.length,
      netWorthUsd: result.netWorth.usd,
    });
 
    return result;
  }, [accounts, assets, ccl, expenses, income, loading, portfolio]);
}
 
