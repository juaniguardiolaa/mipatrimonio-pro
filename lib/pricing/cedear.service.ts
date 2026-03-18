import { getIolPrice } from '@/lib/integrations/iol-price.service';
import { getFxRate } from './fx.service';

const CEDEAR_RATIOS: Record<string, number> = {
  AAPL: 10,
  MSFT: 10,
  GOOGL: 58,
  NVDA: 20,
  TSLA: 15,
};

export function getCedearRatio(ticker: string) {
  return CEDEAR_RATIOS[ticker.toUpperCase()] ?? 1;
}

export async function getCedearPriceARS(ticker: string) {
  const usdStock = await getIolPrice(ticker.toUpperCase());
  const ccl = await getFxRate('USD_ARS_CCL');
  if (!usdStock || !ccl) return null;

  const ratio = getCedearRatio(ticker);
  const price = (usdStock.price * ccl) / ratio;

  return {
    ticker: ticker.toUpperCase(),
    price,
    currency: 'ARS',
    stockPriceUSD: usdStock.price,
    ccl,
    ratio,
    timestamp: new Date(),
  };
}
