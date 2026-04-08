export type EquityMarketQuote = {
  symbol: string;
  priceUsd: number;
  currency: string;
  source: 'YAHOO_FINANCE';
  timestamp: Date;
};
 
const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_CHART_BASE_FALLBACK = 'https://query2.finance.yahoo.com/v8/finance/chart';
 
async function fetchYahooQuote(
  symbol: string,
  baseUrl: string,
): Promise<EquityMarketQuote | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
 
  try {
    const url = `${baseUrl}/${encodeURIComponent(symbol.toUpperCase())}?interval=1d&range=1d`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
 
    if (!response.ok) {
      console.warn('[yahoo] http_error', { symbol, status: response.status, baseUrl });
      return null;
    }
 
    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            currency?: string;
          };
        }>;
        error?: { code?: string; description?: string } | null;
      };
    };
 
    if (data?.chart?.error) {
      console.warn('[yahoo] api_error', { symbol, error: data.chart.error });
      return null;
    }
 
    const meta = data?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice ?? null);
 
    if (!Number.isFinite(price) || price <= 0) {
      console.warn('[yahoo] invalid_price', { symbol, price, meta });
      return null;
    }
 
    const currency = meta?.currency ?? 'USD';
 
    return {
      symbol: symbol.toUpperCase(),
      priceUsd: price,
      currency,
      source: 'YAHOO_FINANCE',
      timestamp: new Date(),
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.warn('[yahoo] timeout', { symbol, baseUrl });
    } else {
      console.warn('[yahoo] fetch_error', {
        symbol,
        baseUrl,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
 
export async function getStockPrice(symbol: string): Promise<EquityMarketQuote | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
 
  console.log('[yahoo] fetching', { symbol: normalized });
 
  // Try primary host first, fall back to query2
  const result =
    (await fetchYahooQuote(normalized, YAHOO_CHART_BASE)) ??
    (await fetchYahooQuote(normalized, YAHOO_CHART_BASE_FALLBACK));
 
  if (!result) {
    console.warn('[yahoo] price_not_found', { symbol: normalized });
    return null;
  }
 
  console.log('[yahoo] price_fetched', { symbol: normalized, price: result.priceUsd, currency: result.currency });
  return result;
}
 
