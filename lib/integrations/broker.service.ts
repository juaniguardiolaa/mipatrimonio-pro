import { prisma } from '@/lib/db/prisma';
import { fetchBinancePortfolio } from '@/lib/integrations/binance.provider';
import { fetchIOLPortfolio } from '@/lib/integrations/iol.provider';
import { recalculateNetWorthForUser } from '@/lib/services/networth.service';
import type { BrokerBalance } from '@/types';

type BrokerName = 'binance' | 'iol';

function guessCategory(broker: BrokerName) {
  return broker === 'binance' ? 'Crypto' : 'Stocks';
}

async function ensureCurrency(code: string) {
  const clean = code.toUpperCase().slice(0, 3);
  await prisma.currency.upsert({
    where: { code: clean },
    update: {},
    create: { code: clean, name: clean, symbol: clean }
  });
  return clean;
}

async function ensureBrokerPortfolio(userId: string) {
  return prisma.portfolio.upsert({
    where: { id: `broker-portfolio-${userId}` },
    update: { name: 'Broker Sync' },
    create: { id: `broker-portfolio-${userId}`, userId, name: 'Broker Sync' }
  });
}

async function ensureBrokerAccount(userId: string, portfolioId: string, broker: BrokerName) {
  return prisma.account.upsert({
    where: { id: `broker-account-${broker}-${userId}` },
    update: { name: broker.toUpperCase(), type: 'brokerage' },
    create: {
      id: `broker-account-${broker}-${userId}`,
      userId,
      portfolioId,
      name: broker.toUpperCase(),
      type: 'brokerage',
      currency: 'USD'
    }
  });
}

async function ensureAssetCategory(name: string) {
  return prisma.assetCategory.upsert({
    where: { name },
    update: {},
    create: { name, type: 'broker-sync' }
  });
}

async function fetchBalancesForBroker(connection: {
  broker: string;
  apiKey: string;
  apiSecret: string;
}): Promise<BrokerBalance[]> {
  if (connection.broker === 'binance') {
    return fetchBinancePortfolio(connection.apiKey, connection.apiSecret);
  }

  if (connection.broker === 'iol') {
    return fetchIOLPortfolio(connection.apiKey, connection.apiSecret);
  }

  throw new Error('BROKER_NOT_SUPPORTED');
}

export async function connectBroker(
  userId: string,
  broker: BrokerName,
  apiKey: string,
  apiSecret: string
) {
  return prisma.brokerConnection.upsert({
    where: { userId_broker: { userId, broker } },
    update: { apiKey, apiSecret },
    create: { userId, broker, apiKey, apiSecret }
  });
}

export async function syncBrokerConnection(userId: string, broker: BrokerName) {
  const connection = await prisma.brokerConnection.findUnique({ where: { userId_broker: { userId, broker } } });
  if (!connection) {
    throw new Error('BROKER_NOT_CONNECTED');
  }

  const balances = await fetchBalancesForBroker(connection);

  const portfolio = await ensureBrokerPortfolio(userId);
  const account = await ensureBrokerAccount(userId, portfolio.id, broker);
  const category = await ensureAssetCategory(guessCategory(broker));

  await prisma.asset.deleteMany({
    where: {
      userId,
      accountId: account.id,
      name: { startsWith: `[${broker.toUpperCase()}]` }
    }
  });

  for (const balance of balances) {
    const currency = await ensureCurrency(balance.currency);

    await prisma.asset.create({
      data: {
        userId,
        portfolioId: portfolio.id,
        accountId: account.id,
        categoryId: category.id,
        currency,
        name: `[${broker.toUpperCase()}] ${balance.symbol}`,
        value: balance.total
      }
    });
  }

  await recalculateNetWorthForUser(userId, portfolio.id, account.id);

  return {
    broker,
    syncedAssets: balances.length,
    portfolioId: portfolio.id,
    accountId: account.id
  };
}

export async function syncAllBrokersForUser(userId: string) {
  const connections = await prisma.brokerConnection.findMany({ where: { userId } });
  const results = [];
  for (const connection of connections) {
    results.push(await syncBrokerConnection(userId, connection.broker as BrokerName));
  }
  return results;
}

export async function syncAllUsersBrokerConnections() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const output = [];
  for (const user of users) {
    const result = await syncAllBrokersForUser(user.id);
    if (result.length > 0) {
      output.push({ userId: user.id, brokers: result });
    }
  }
  return output;
}
