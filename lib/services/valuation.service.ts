import { Asset, AssetType } from '@prisma/client';
import { getBinancePrice } from '@/lib/integrations/binance-price.service';
import { getIolPrice } from '@/lib/integrations/iol-price.service';
import { getBondPrice } from '@/lib/pricing/bonds.service';
import { getCedearPriceARS, getCedearRatio } from '@/lib/pricing/cedear.service';
import { convertArsToUsd, getFxRate } from '@/lib/pricing/fx.service';

export type ValuationResult = {
  marketPrice: number;
  marketPriceUsd: number;
  marketValue: number;
  marketValueUsd: number;
  currency: string;
  source: string;
  timestamp: Date;
};

export async function valuateAsset(asset: Pick<Asset, 'symbol' | 'ticker' | 'assetType' | 'quantity' | 'currency' | 'cedearRatio'>): Promise<ValuationResult | null> {
  const ticker = (asset.ticker || asset.symbol).toUpperCase();
  const now = new Date();

  if (asset.assetType === AssetType.CRYPTO) {
    const quote = await getBinancePrice(ticker);
    if (!quote) return null;
    const priceUsd = quote.price;
    const ccl = await getFxRate('USD_ARS_CCL');
    const priceArs = ccl ? priceUsd * ccl : priceUsd;
    return {
      marketPrice: priceArs,
      marketPriceUsd: priceUsd,
      marketValue: priceArs * asset.quantity,
      marketValueUsd: priceUsd * asset.quantity,
      currency: 'ARS',
      source: 'BINANCE+CCL',
      timestamp: now,
    };
  }

  if (asset.assetType === AssetType.CEDEAR) {
    const quote = await getCedearPriceARS(ticker);
    if (!quote) return null;
    const ratio = asset.cedearRatio || getCedearRatio(ticker);
    const usdPrice = (quote.price * ratio) / quote.ccl;
    return {
      marketPrice: quote.price,
      marketPriceUsd: usdPrice,
      marketValue: quote.price * asset.quantity,
      marketValueUsd: usdPrice * asset.quantity,
      currency: 'ARS',
      source: 'CEDEAR_FORMULA',
      timestamp: quote.timestamp,
    };
  }

  if (asset.assetType === AssetType.BOND) {
    const bond = await getBondPrice(ticker);
    if (!bond) return null;
    const marketValue = bond.price * asset.quantity;
    const marketValueUsd = bond.currency === 'USD' ? marketValue : (await convertArsToUsd(marketValue)) ?? 0;
    const marketPriceUsd = bond.currency === 'USD' ? bond.price : (await convertArsToUsd(bond.price)) ?? 0;
    return {
      marketPrice: bond.currency === 'ARS' ? bond.price : bond.price * ((await getFxRate('USD_ARS_CCL')) ?? 1),
      marketPriceUsd,
      marketValue: bond.currency === 'ARS' ? marketValue : marketValue * ((await getFxRate('USD_ARS_CCL')) ?? 1),
      marketValueUsd,
      currency: bond.currency,
      source: 'IOL_BONDS',
      timestamp: bond.timestamp,
    };
  }

  if (asset.assetType === AssetType.CASH) {
    const nominal = asset.quantity;
    const usd = asset.currency === 'USD' ? nominal : (await convertArsToUsd(nominal)) ?? 0;
    const ars = asset.currency === 'ARS' ? nominal : nominal * ((await getFxRate('USD_ARS_CCL')) ?? 1);
    return {
      marketPrice: ars,
      marketPriceUsd: usd,
      marketValue: ars,
      marketValueUsd: usd,
      currency: asset.currency,
      source: 'NOMINAL',
      timestamp: now,
    };
  }

  // STOCK / ETF
  const stock = await getIolPrice(ticker);
  if (!stock) return null;
  const isUsd = stock.currency === 'USD';
  const ccl = await getFxRate('USD_ARS_CCL');
  const marketPriceArs = isUsd ? stock.price * (ccl ?? 1) : stock.price;
  const marketPriceUsd = isUsd ? stock.price : (await convertArsToUsd(stock.price)) ?? 0;

  return {
    marketPrice: marketPriceArs,
    marketPriceUsd,
    marketValue: marketPriceArs * asset.quantity,
    marketValueUsd: marketPriceUsd * asset.quantity,
    currency: isUsd ? 'USD' : 'ARS',
    source: 'IOL_EQUITIES',
    timestamp: stock.timestamp,
  };
}
