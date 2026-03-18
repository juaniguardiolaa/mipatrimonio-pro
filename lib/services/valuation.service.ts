import { Asset, AssetType } from '@prisma/client';
import { getCryptoPrice } from '@/lib/providers/binance';
import { getStockPrice } from '@/lib/providers/yahoo';
import { getBondPrice } from '@/lib/pricing/bonds.service';
import { getCedearRatio } from '@/lib/pricing/cedear.service';
import { convertArsToUsd, getFxRate } from '@/lib/pricing/fx.service';

export type ValuationResult = {
  marketPrice: number;
  marketPriceUsd: number;
  marketValue: number;
  marketValueUsd: number;
  currency: string;
  source: string;
  timestamp: Date;
  stale: boolean;
};

function buildStaleValuation(asset: Pick<Asset, 'symbol' | 'quantity' | 'currency' | 'marketPrice' | 'marketPriceUsd' | 'lastPriceUpdate'>): ValuationResult | null {
  if (asset.marketPrice === null || asset.marketPrice === undefined || asset.marketPriceUsd === null || asset.marketPriceUsd === undefined) {
    return null;
  }

  return {
    marketPrice: asset.marketPrice,
    marketPriceUsd: asset.marketPriceUsd,
    marketValue: asset.marketPrice * asset.quantity,
    marketValueUsd: asset.marketPriceUsd * asset.quantity,
    currency: asset.currency,
    source: 'STALE_LAST_MARKET_PRICE',
    timestamp: asset.lastPriceUpdate || new Date(),
    stale: true,
  };
}

function ensureNumber(value: number | null | undefined, symbol: string) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    throw new Error(`Invalid price for ${symbol}`);
  }
  return value;
}

function ensureFxRate(rate: number | null, symbol: string) {
  if (!rate || rate <= 0) {
    throw new Error(`Missing FX rate for ${symbol}`);
  }
  return rate;
}

export async function valuateAsset(
  asset: Pick<Asset, 'symbol' | 'assetType' | 'quantity' | 'currency' | 'cedearRatio' | 'marketPrice' | 'marketPriceUsd' | 'lastPriceUpdate'>,
): Promise<ValuationResult | null> {
  const symbol = asset.symbol.toUpperCase();
  const ccl = await getFxRate('USD_ARS_CCL');
  const now = new Date();

  try {
    if (asset.assetType === AssetType.CRYPTO) {
      const quote = await getCryptoPrice(symbol);
      const priceUsd = ensureNumber(quote?.priceUsd, symbol);
      const priceArs = priceUsd * ensureFxRate(ccl, 'USD_ARS_CCL');
      console.log('Market data quote:', { symbol, priceUsd, source: quote?.source || 'BINANCE' });

      return {
        marketPrice: priceArs,
        marketPriceUsd: priceUsd,
        marketValue: priceArs * asset.quantity,
        marketValueUsd: priceUsd * asset.quantity,
        currency: 'ARS',
        source: quote?.source || 'BINANCE',
        timestamp: quote?.timestamp || now,
        stale: false,
      };
    }

    if (asset.assetType === AssetType.STOCK || asset.assetType === AssetType.ETF) {
      const quote = await getStockPrice(symbol);
      const providerPrice = ensureNumber(quote?.priceUsd, symbol);
      const priceArs = quote?.currency === 'USD'
        ? providerPrice * ensureFxRate(ccl, 'USD_ARS_CCL')
        : providerPrice;
      const marketPriceUsd = quote?.currency === 'USD'
        ? providerPrice
        : (await convertArsToUsd(providerPrice)) ?? 0;
      const validatedMarketPriceUsd = ensureNumber(marketPriceUsd, symbol);
      console.log('Market data quote:', { symbol, priceUsd: validatedMarketPriceUsd, source: quote?.source || 'YAHOO_FINANCE' });

      return {
        marketPrice: priceArs,
        marketPriceUsd: validatedMarketPriceUsd,
        marketValue: priceArs * asset.quantity,
        marketValueUsd: validatedMarketPriceUsd * asset.quantity,
        currency: quote?.currency || 'USD',
        source: quote?.source || 'YAHOO_FINANCE',
        timestamp: quote?.timestamp || now,
        stale: false,
      };
    }

    if (asset.assetType === AssetType.CEDEAR) {
      const quote = await getStockPrice(symbol);
      const priceUsd = ensureNumber(quote?.priceUsd, symbol);
      const ratio = asset.cedearRatio || getCedearRatio(symbol);
      const fx = ensureFxRate(ccl, 'USD_ARS_CCL');
      const underlyingUsdPerCedear = priceUsd / ratio;
      const priceArs = underlyingUsdPerCedear * fx;
      console.log('Market data quote:', { symbol, priceUsd: underlyingUsdPerCedear, source: `${quote?.source || 'YAHOO_FINANCE'}+CCL/CEDEAR_RATIO` });

      return {
        marketPrice: priceArs,
        marketPriceUsd: underlyingUsdPerCedear,
        marketValue: priceArs * asset.quantity,
        marketValueUsd: underlyingUsdPerCedear * asset.quantity,
        currency: 'ARS',
        source: 'YAHOO_FINANCE_CEDEAR',
        timestamp: quote?.timestamp || now,
        stale: false,
      };
    }

    if (asset.assetType === AssetType.BOND) {
      const bond = await getBondPrice(symbol);
      const marketPriceUsd = bond?.currency === 'USD'
        ? ensureNumber(bond.price, symbol)
        : ensureNumber(await convertArsToUsd(ensureNumber(bond?.price, symbol)), symbol);
      const marketPriceArs = bond?.currency === 'USD'
        ? marketPriceUsd * ensureFxRate(ccl, 'USD_ARS_CCL')
        : ensureNumber(bond?.price, symbol);
      console.log('Market data quote:', { symbol, priceUsd: marketPriceUsd, source: 'IOL_BONDS' });

      return {
        marketPrice: marketPriceArs,
        marketPriceUsd,
        marketValue: marketPriceArs * asset.quantity,
        marketValueUsd: marketPriceUsd * asset.quantity,
        currency: bond?.currency || 'ARS',
        source: 'IOL_BONDS',
        timestamp: bond?.timestamp || now,
        stale: false,
      };
    }

    if (asset.assetType === AssetType.CASH) {
      const arsValue = asset.currency === 'ARS' ? asset.quantity : asset.quantity * ensureFxRate(ccl, 'USD_ARS_CCL');
      const usdValue = asset.currency === 'USD' ? asset.quantity : (await convertArsToUsd(asset.quantity)) ?? 0;
      return {
        marketPrice: arsValue,
        marketPriceUsd: usdValue,
        marketValue: arsValue,
        marketValueUsd: usdValue,
        currency: asset.currency,
        source: 'NOMINAL',
        timestamp: now,
        stale: false,
      };
    }

    return buildStaleValuation(asset);
  } catch (error) {
    console.error('Valuation failed, falling back to last stored market price', {
      symbol,
      assetType: asset.assetType,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return buildStaleValuation(asset);
  }
}
