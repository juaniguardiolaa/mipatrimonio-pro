import type { BrokerBalance } from '@/types';

interface IolPortfolioResponse {
  positions: Array<{
    ticker: string;
    quantity: number;
    marketValue: number;
    currency?: string;
  }>;
}

const IOL_API_BASE_URL = process.env.IOL_API_BASE_URL ?? 'https://api.invertironline.com';

export async function fetchIOLPortfolio(apiKey: string, apiSecret: string): Promise<BrokerBalance[]> {
  const response = await fetch(`${IOL_API_BASE_URL}/api/v2/portfolio`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-IOL-SECRET': apiSecret
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`IOL_API_ERROR_${response.status}`);
  }

  const data = (await response.json()) as IolPortfolioResponse;

  return data.positions
    .map((position) => ({
      symbol: position.ticker,
      free: position.quantity,
      total: Number(position.marketValue),
      currency: position.currency ?? 'USD'
    }))
    .filter((balance) => balance.total > 0);
}
