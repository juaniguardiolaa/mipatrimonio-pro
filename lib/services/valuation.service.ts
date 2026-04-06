import { Asset, AssetType } from '@prisma/client';
// ── FIX: import from the single canonical CoinGecko provider ─────────────────
import { getCryptoPrice } from '@/lib/providers/coingecko';
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
 
function buildFallbackValuation(
  asset: Pick<
    Asset,
    | 'symbol'
    | 'quantity'
    | 'currency'
    | 'marketPrice'
    | 'marketPriceUsd'
    | 'marketValue'
    | 'marketValueUsd'
    | 'lastPriceUpdate'
  >,
): ValuationFailure {
  console.warn('[valuation] fallback_used', { symbol: asset.symbol });
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
 
function buildSuccessValuation(
  input: Omit<ValuationResult, 'success'>,
): ValuationResult {
  return { success: true, ...input };
}
 
export async function valuateAsset(
  asset: Pick<
    Asset,
    | 'symbol'
    | 'assetType'
    | 'quantity'
    | 'currency'
    | 'cedearRatio'
    | 'marketPrice'
    | 'marketPriceUsd'
    | 'marketValue'
    | 'marketValueUsd'
    | 'lastPriceUpdate'
  >,
): Promise<ValuationOutcome> {
  const symbol = asset.symbol.toUpperCase();
  const ccl = await getFxRate('USD_ARS_CCL');
  const now = new Date();
 
  // ── CRYPTO ────────────────────────────────────────────────────────────────
  if (asset.assetType === AssetType.CRYPTO) {
    const quote = await getCryptoPrice(symbol);
    if (!quote) return buildFallbackValuation(asset);
 
    const priceUsd = quote.priceUsd;
    const fx = ccl && ccl > 0 ? ccl : 1;
    const priceArs = priceUsd * fx;
 
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
 
  // ── STOCK / ETF ───────────────────────────────────────────────────────────
  if (asset.assetType === AssetType.STOCK || asset.assetType === AssetType.ETF) {
    const quote = await getStockPrice(symbol);
    if (!quote) return buildFallbackValuation(asset);
 
    const priceUsd =
      quote.currency === 'USD'
        ? quote.priceUsd
        : (await convertArsToUsd(quote.priceUsd)) ?? null;
 
    if (!priceUsd) return buildFallbackValuation(asset);
 
    const priceArs = ccl && ccl > 0 ? priceUsd * ccl : priceUsd;
 
    return buildSuccessValuation({
      marketPrice: priceArs,
      marketPriceUsd: priceUsd,
      marketValue: priceArs * asset.quantity,
      marketValueUsd: priceUsd * asset.quantity,
      currency: quote.currency,
      source: 'YAHOO_FINANCE',
      timestamp: quote.timestamp,
      stale: false,
    });
  }
 
  // ── CEDEAR ────────────────────────────────────────────────────────────────
  if (asset.assetType === AssetType.CEDEAR) {
    const quote = await getStockPrice(symbol);
    if (!quote || !ccl) return buildFallbackValuation(asset);
 
    const ratio = asset.cedearRatio ?? getCedearRatio(symbol);
    if (!ratio || ratio <= 0) {
      console.warn('[valuation] cedear_ratio_missing', { symbol });
      return buildFallbackValuation(asset);
    }
 
    // priceUsd here is the underlying (e.g. AAPL) stock price in USD.
    // One CEDEAR represents (1/ratio) of one underlying share.
    const underlyingUsdPerCedear = quote.priceUsd / ratio;
    const priceArs = underlyingUsdPerCedear * ccl;
 
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
 
  // ── BOND ──────────────────────────────────────────────────────────────────
  if (asset.assetType === AssetType.BOND) {
    const bond = await getBondPrice(symbol);
    if (!bond) return buildFallbackValuation(asset);
 
    const marketPriceUsd =
      bond.currency === 'USD'
        ? bond.price
        : (await convertArsToUsd(bond.price)) ?? null;
 
    if (!marketPriceUsd) return buildFallbackValuation(asset);
 
    const marketPriceArs =
      bond.currency === 'USD' ? marketPriceUsd * (ccl && ccl > 0 ? ccl : 1) : bond.price;
 
    return buildSuccessValuation({
      marketPrice: marketPriceArs,
      marketPriceUsd,
      marketValue: marketPriceArs * asset.quantity,
      marketValueUsd: marketPriceUsd * asset.quantity,
      currency: bond.currency,
      source: 'IOL_BONDS',
      timestamp: bond.timestamp,
      stale: false,
    });
  }
 
  // ── CASH ──────────────────────────────────────────────────────────────────
  if (asset.assetType === AssetType.CASH) {
    const fx = ccl && ccl > 0 ? ccl : 1;
    const arsValue =
      asset.currency === 'ARS' ? asset.quantity : asset.quantity * fx;
    const usdValue =
      asset.currency === 'USD'
        ? asset.quantity
        : (await convertArsToUsd(asset.quantity)) ?? 0;
 
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
 
