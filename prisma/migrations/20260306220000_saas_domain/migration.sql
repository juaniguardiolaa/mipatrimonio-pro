-- New tables
CREATE TABLE "Portfolio" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiabilityCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "LiabilityCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Currency" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Expand existing tables
ALTER TABLE "Asset" ADD COLUMN "portfolioId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "accountId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "currency" TEXT DEFAULT 'USD';

ALTER TABLE "Liability" ADD COLUMN "portfolioId" TEXT;
ALTER TABLE "Liability" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Liability" ADD COLUMN "currency" TEXT DEFAULT 'USD';

ALTER TABLE "NetWorthHistory" ADD COLUMN "portfolioId" TEXT;
ALTER TABLE "NetWorthHistory" ADD COLUMN "accountId" TEXT;

-- Indexes
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");
CREATE INDEX "Portfolio_userId_createdAt_idx" ON "Portfolio"("userId", "createdAt" DESC);
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Account_portfolioId_idx" ON "Account"("portfolioId");
CREATE INDEX "Account_userId_portfolioId_idx" ON "Account"("userId", "portfolioId");
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");
CREATE UNIQUE INDEX "LiabilityCategory_name_key" ON "LiabilityCategory"("name");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "NetWorthHistory_portfolioId_idx" ON "NetWorthHistory"("portfolioId");
CREATE INDEX "NetWorthHistory_accountId_idx" ON "NetWorthHistory"("accountId");

-- FKs
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- backfill defaults through first related rows where possible
UPDATE "Asset" a
SET "portfolioId" = p."id"
FROM "Portfolio" p
WHERE p."userId" = a."userId"
AND a."portfolioId" IS NULL;

UPDATE "Liability" l
SET "portfolioId" = p."id"
FROM "Portfolio" p
WHERE p."userId" = l."userId"
AND l."portfolioId" IS NULL;

ALTER TABLE "Asset" ALTER COLUMN "portfolioId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "Liability" ALTER COLUMN "portfolioId" SET NOT NULL;
ALTER TABLE "Liability" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Liability" ALTER COLUMN "currency" SET NOT NULL;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currency_fkey" FOREIGN KEY ("currency") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LiabilityCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_currency_fkey" FOREIGN KEY ("currency") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
