import { getIolPrice } from '@/lib/integrations/iol-price.service';

export type BondQuote = {
  ticker: string;
  price: number;
  currency: 'ARS' | 'USD';
  variation?: number;
  timestamp: Date;
};

export async function getBondPrice(ticker: string): Promise<BondQuote | null> {
  const quote = await getIolPrice(ticker.toUpperCase());
  if (!quote) return null;

  return {
    ticker: ticker.toUpperCase(),
    price: quote.price,
    currency: (quote.currency === 'USD' ? 'USD' : 'ARS'),
    variation: quote.variation,
    timestamp: quote.timestamp,
  };
}
