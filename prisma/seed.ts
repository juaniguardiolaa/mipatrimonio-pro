import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('demo12345', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@mipatrimonio.pro' },
    update: {},
    create: { email: 'demo@mipatrimonio.pro', password }
  });

  await prisma.netWorthHistory.deleteMany({ where: { userId: user.id } });
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.liability.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.portfolio.deleteMany({ where: { userId: user.id } });

  await prisma.currency.createMany({
    data: [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
      { code: 'BTC', name: 'Bitcoin', symbol: '₿' }
    ],
    skipDuplicates: true
  });

  await prisma.assetCategory.createMany({
    data: [
      { name: 'Cash', type: 'liquid' },
      { name: 'Stocks', type: 'investment' },
      { name: 'Crypto', type: 'investment' },
      { name: 'Real Estate', type: 'real-estate' }
    ],
    skipDuplicates: true
  });

  await prisma.liabilityCategory.createMany({
    data: [{ name: 'Mortgage' }, { name: 'Credit Card' }, { name: 'Personal Loan' }],
    skipDuplicates: true
  });

  const [cashCategory, stocksCategory, realEstateCategory, mortgageCategory, ccCategory] =
    await Promise.all([
      prisma.assetCategory.findUniqueOrThrow({ where: { name: 'Cash' } }),
      prisma.assetCategory.findUniqueOrThrow({ where: { name: 'Stocks' } }),
      prisma.assetCategory.findUniqueOrThrow({ where: { name: 'Real Estate' } }),
      prisma.liabilityCategory.findUniqueOrThrow({ where: { name: 'Mortgage' } }),
      prisma.liabilityCategory.findUniqueOrThrow({ where: { name: 'Credit Card' } })
    ]);

  const personal = await prisma.portfolio.create({
    data: { userId: user.id, name: 'Personal' }
  });

  const family = await prisma.portfolio.create({
    data: { userId: user.id, name: 'Familia' }
  });

  const checking = await prisma.account.create({
    data: {
      userId: user.id,
      portfolioId: personal.id,
      name: 'Banco Principal',
      type: 'bank',
      currency: 'CLP'
    }
  });

  const brokerage = await prisma.account.create({
    data: {
      userId: user.id,
      portfolioId: personal.id,
      name: 'Broker Global',
      type: 'brokerage',
      currency: 'USD'
    }
  });

  const familyHolding = await prisma.account.create({
    data: {
      userId: user.id,
      portfolioId: family.id,
      name: 'Holding Inmobiliario',
      type: 'real-estate',
      currency: 'USD'
    }
  });

  await prisma.asset.createMany({
    data: [
      {
        userId: user.id,
        portfolioId: personal.id,
        accountId: checking.id,
        categoryId: cashCategory.id,
        currency: 'CLP',
        name: 'Caja de ahorro',
        value: 5200000
      },
      {
        userId: user.id,
        portfolioId: personal.id,
        accountId: brokerage.id,
        categoryId: stocksCategory.id,
        currency: 'USD',
        name: 'ETF S&P 500',
        value: 32000
      },
      {
        userId: user.id,
        portfolioId: family.id,
        accountId: familyHolding.id,
        categoryId: realEstateCategory.id,
        currency: 'USD',
        name: 'Departamento Centro',
        value: 155000
      }
    ]
  });

  await prisma.liability.createMany({
    data: [
      {
        userId: user.id,
        portfolioId: family.id,
        categoryId: mortgageCategory.id,
        currency: 'USD',
        name: 'Hipoteca principal',
        amount: 92000
      },
      {
        userId: user.id,
        portfolioId: personal.id,
        categoryId: ccCategory.id,
        currency: 'CLP',
        name: 'Tarjeta crédito',
        amount: 780000
      }
    ]
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { plan: 'free', status: 'active' },
    create: { userId: user.id, plan: 'free', status: 'active' }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
