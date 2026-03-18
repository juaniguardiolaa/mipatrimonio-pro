export type EquityMarketQuote = {
  symbol: string;
  priceUsd: number;
  currency: string;
  source: 'YAHOO_FINANCE';
  timestamp: Date;
};

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

export async function getStockPrice(symbol: string): Promise<EquityMarketQuote | null> {
  const normalized = symbol.toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(normalized)}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MiPatrimonioPro/1.0)',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          regularMarketPrice?: number;
          currency?: string;
        }>;
      };
    };

    const quote = data.quoteResponse?.result?.[0];
    const priceUsd = Number(quote?.regularMarketPrice);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

    return {
      symbol: quote?.symbol?.toUpperCase() || normalized,
      priceUsd,
      currency: quote?.currency || 'USD',
      source: 'YAHOO_FINANCE',
      timestamp: new Date(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
