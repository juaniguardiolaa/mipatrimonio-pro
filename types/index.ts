export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  portfolioId: string;
  name: string;
  type: string;
  currency: string;
  createdAt: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  type: string;
}

export interface LiabilityCategory {
  id: string;
  name: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface Asset {
  id: string;
  userId: string;
  portfolioId: string;
  accountId: string;
  categoryId: string;
  currency: string;
  name: string;
  value: number;
  createdAt: string;
}

export interface Liability {
  id: string;
  userId: string;
  portfolioId: string;
  categoryId: string;
  currency: string;
  name: string;
  amount: number;
  createdAt: string;
}

export interface NetWorthSummary {
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
  monthlyChange: number;
  lastUpdatedAt: string | null;
}

export interface NetWorthHistoryPoint {
  date: string;
  netWorth: number;
  portfolioId?: string | null;
}

export interface PortfolioNetWorth {
  portfolioId: string;
  portfolioName: string;
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}


export interface BrokerConnection {
  id: string;
  userId: string;
  broker: 'binance' | 'iol';
  apiKey: string;
  apiSecret: string;
  createdAt: string;
}

export interface BrokerBalance {
  symbol: string;
  free: number;
  locked?: number;
  total: number;
  currency: string;
}
