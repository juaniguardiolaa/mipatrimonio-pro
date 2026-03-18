export type EquityMarketQuote = {
  symbol: string;
  priceUsd: number;
  currency: string;
  source: 'STOCK_FALLBACK';
  timestamp: Date;
};

export async function getStockPrice(symbol: string): Promise<EquityMarketQuote | null> {
  console.log('Pricing asset:', symbol);
  console.log('Normalized:', symbol.toUpperCase());
  console.warn('Stock pricing fallback for', symbol);
  return null;
}
