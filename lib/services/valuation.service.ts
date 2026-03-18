import { Asset, AssetType } from '@prisma/client';
import { getCryptoPrice } from '@/lib/providers/binance';
import { getStockPrice } from '@/lib/providers/yahoo';
import { getBondPrice } from '@/lib/pricing/bonds.service';
import { getCedearRatio } from '@/lib/pricing/cedear.service';
import { convertArsToUsd, getFxRate } from '@/lib/pricing/fx.service';

export type ValuationResult = {
  success: true;
  marketPrice: number;
  marketPriceUsd: number;
  marketValue: number;
  marketValueUsd: number;
  currency: string;
  source: string;
  timestamp: Date;
  stale: boolean;
};

export type ValuationFailure = {
  success: false;
  reason: 'no_price';
  stale: boolean;
  marketPrice: number | null;
  marketPriceUsd: number | null;
  marketValue: number;
  marketValueUsd: number;
  currency: string;
  source: string;
  timestamp: Date;
};

export type ValuationOutcome = ValuationResult | ValuationFailure;

function buildFallbackValuation(asset: Pick<Asset, 'symbol' | 'quantity' | 'currency' | 'marketPrice' | 'marketPriceUsd' | 'marketValue' | 'marketValueUsd' | 'lastPriceUpdate'>): ValuationFailure {
  console.warn('Fallback for', asset.symbol);

  return {
    success: false,
    reason: 'no_price',
    stale: true,
    marketPrice: asset.marketPrice ?? null,
    marketPriceUsd: asset.marketPriceUsd ?? null,
    marketValue: asset.marketValue ?? 0,
    marketValueUsd: asset.marketValueUsd ?? 0,
    currency: asset.currency,
    source: 'STALE_LAST_MARKET_PRICE',
    timestamp: asset.lastPriceUpdate || new Date(),
  };
}

function buildSuccessValuation(input: Omit<ValuationResult, 'success'>): ValuationResult {
  return { success: true, ...input };
}

export async function valuateAsset(
  asset: Pick<Asset, 'symbol' | 'assetType' | 'quantity' | 'currency' | 'cedearRatio' | 'marketPrice' | 'marketPriceUsd' | 'marketValue' | 'marketValueUsd' | 'lastPriceUpdate'>,
): Promise<ValuationOutcome> {
  const symbol = asset.symbol.toUpperCase();
  const ccl = await getFxRate('USD_ARS_CCL');
  const now = new Date();

  if (asset.assetType === AssetType.CRYPTO) {
    const quote = await getCryptoPrice(symbol);
    const priceUsd = quote?.priceUsd ?? null;
    console.log('Price result:', priceUsd);
    if (!quote || !priceUsd) return buildFallbackValuation(asset);

    const fx = ccl && ccl > 0 ? ccl : 1;
    const priceArs = priceUsd * fx;
    console.log('Market data quote:', { symbol, priceUsd, source: quote.source });

    return buildSuccessValuation({
      marketPrice: priceArs,
      marketPriceUsd: priceUsd,
      marketValue: priceArs * asset.quantity,
      marketValueUsd: priceUsd * asset.quantity,
      currency: 'ARS',
      source: quote.source,
      timestamp: quote.timestamp,
      stale: false,
    });
  }

  if (asset.assetType === AssetType.STOCK || asset.assetType === AssetType.ETF) {
    const quote = await getStockPrice(symbol);
    const quotedPrice = quote?.priceUsd ?? null;
    console.log('Price result:', quotedPrice);
    if (!quote || !quotedPrice) return buildFallbackValuation(asset);

    const priceUsd = quote.currency === 'USD' ? quotedPrice : (await convertArsToUsd(quotedPrice)) ?? null;
    if (!priceUsd) return buildFallbackValuation(asset);

    const priceArs = quote.currency === 'USD' ? priceUsd * (ccl && ccl > 0 ? ccl : 1) : quote.priceUsd;
    console.log('Market data quote:', { symbol, priceUsd, source: quote.source });

    return buildSuccessValuation({
      marketPrice: priceArs,
      marketPriceUsd: priceUsd,
      marketValue: priceArs * asset.quantity,
      marketValueUsd: priceUsd * asset.quantity,
      currency: quote.currency,
      source: quote.source,
      timestamp: quote.timestamp,
      stale: false,
    });
  }

  if (asset.assetType === AssetType.CEDEAR) {
    const quote = await getStockPrice(symbol);
    const quotedPrice = quote?.priceUsd ?? null;
    console.log('Price result:', quotedPrice);
    if (!quote || !quotedPrice || !ccl) return buildFallbackValuation(asset);

    const ratio = asset.cedearRatio || getCedearRatio(symbol);
    const underlyingUsdPerCedear = quotedPrice / ratio;
    const priceArs = underlyingUsdPerCedear * ccl;
    console.log('Market data quote:', { symbol, priceUsd: underlyingUsdPerCedear, source: `${quote.source}+CCL/CEDEAR_RATIO` });

    return buildSuccessValuation({
      marketPrice: priceArs,
      marketPriceUsd: underlyingUsdPerCedear,
      marketValue: priceArs * asset.quantity,
      marketValueUsd: underlyingUsdPerCedear * asset.quantity,
      currency: 'ARS',
      source: 'YAHOO_FINANCE_CEDEAR',
      timestamp: quote.timestamp,
      stale: false,
    });
  }

  if (asset.assetType === AssetType.BOND) {
    const bond = await getBondPrice(symbol);
    const bondPrice = bond?.price ?? null;
    console.log('Price result:', bondPrice);
    if (!bond || !bondPrice) return buildFallbackValuation(asset);

    const marketPriceUsd = bond.currency === 'USD' ? bondPrice : (await convertArsToUsd(bondPrice)) ?? null;
    if (!marketPriceUsd) return buildFallbackValuation(asset);

    const marketPriceArs = bond.currency === 'USD' ? marketPriceUsd * (ccl && ccl > 0 ? ccl : 1) : bondPrice;
    console.log('Market data quote:', { symbol, priceUsd: marketPriceUsd, source: 'IOL_BONDS' });

    return buildSuccessValuation({
      marketPrice: marketPriceArs,
      marketPriceUsd: marketPriceUsd,
      marketValue: marketPriceArs * asset.quantity,
      marketValueUsd: marketPriceUsd * asset.quantity,
      currency: bond.currency,
      source: 'IOL_BONDS',
      timestamp: bond.timestamp,
      stale: false,
    });
  }

  if (asset.assetType === AssetType.CASH) {
    const fx = ccl && ccl > 0 ? ccl : 1;
    const arsValue = asset.currency === 'ARS' ? asset.quantity : asset.quantity * fx;
    const usdValue = asset.currency === 'USD' ? asset.quantity : (await convertArsToUsd(asset.quantity)) ?? 0;
    console.log('Price result:', usdValue);

    return buildSuccessValuation({
      marketPrice: arsValue,
      marketPriceUsd: usdValue,
      marketValue: arsValue,
      marketValueUsd: usdValue,
      currency: asset.currency,
      source: 'NOMINAL',
      timestamp: now,
      stale: false,
    });
  }

  return buildFallbackValuation(asset);
}
