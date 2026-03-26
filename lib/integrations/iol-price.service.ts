export type EquityPriceQuote = {
  ticker: string;
  price: number;
  currency: string;
  timestamp: Date;
  variation?: number;
};

const IOL_BASE_URL = process.env.IOL_MARKET_URL || 'https://api.invertironline.com/api/v2';

export async function getIolPrice(ticker: string): Promise<EquityPriceQuote | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${IOL_BASE_URL}/Cotizaciones/${ticker.toUpperCase()}`, {
      signal: controller.signal,
      headers: process.env.IOL_TOKEN ? { Authorization: `Bearer ${process.env.IOL_TOKEN}` } : undefined,
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json() as { ultimoPrecio?: number; variacionPorcentual?: number; moneda?: string };

    if (!data.ultimoPrecio) return null;

    return {
      ticker: ticker.toUpperCase(),
      price: Number(data.ultimoPrecio),
      currency: data.moneda || 'USD',
      variation: data.variacionPorcentual,
      timestamp: new Date(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
