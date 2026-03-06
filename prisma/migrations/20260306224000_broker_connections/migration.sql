CREATE TABLE "BrokerConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "broker" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "apiSecret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrokerConnection_userId_idx" ON "BrokerConnection"("userId");
CREATE UNIQUE INDEX "BrokerConnection_userId_broker_key" ON "BrokerConnection"("userId", "broker");

ALTER TABLE "BrokerConnection"
  ADD CONSTRAINT "BrokerConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
