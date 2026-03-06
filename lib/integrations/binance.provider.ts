import crypto from 'crypto';
import type { BrokerBalance } from '@/types';

interface BinanceAccountResponse {
  balances: Array<{ asset: string; free: string; locked: string }>;
}

const BINANCE_BASE_URL = process.env.BINANCE_API_BASE_URL ?? 'https://api.binance.com';

export async function fetchBinancePortfolio(apiKey: string, apiSecret: string): Promise<BrokerBalance[]> {
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');

  const response = await fetch(`${BINANCE_BASE_URL}/api/v3/account?${query}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`BINANCE_API_ERROR_${response.status}`);
  }

  const data = (await response.json()) as BinanceAccountResponse;

  return data.balances
    .map((balance) => {
      const free = Number(balance.free);
      const locked = Number(balance.locked);
      const total = free + locked;
      return {
        symbol: balance.asset,
        free,
        locked,
        total,
        currency: balance.asset
      } satisfies BrokerBalance;
    })
    .filter((balance) => balance.total > 0);
}
