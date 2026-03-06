# SAAS_ARCHITECTURE

## SaaS Scope
Mi Patrimonio Pro evoluciona de MVP a SaaS multi-tenant con:
- Multi-portfolio por usuario
- Sistema de cuentas por portfolio
- Categorías normalizadas
- Multi-moneda
- Billing con Stripe (base)
- Onboarding guiado

## Domain model
- User 1..n Portfolio
- Portfolio 1..n Account
- Account 1..n Asset
- Portfolio 1..n Liability
- Catálogos: AssetCategory, LiabilityCategory, Currency
- Subscription 1..1 User

## Application layers
- API routes: `app/api/*`
- Services: `lib/services/*`
- Data access: Prisma via `lib/db/prisma.ts`
- UI composition: `components/*`

## Monetization
- Free: 1 portfolio, hasta 20 assets
- Pro: ilimitado

## Production hardening
- API rate limiting in-memory fallback
- Structured logging helpers
- Standardized error envelopes
- Vercel-compatible deployment

## External broker integrations
- Integration layer in `lib/integrations/*`.
- Supported providers: Binance and InvertirOnline.
- Connection credentials stored in `BrokerConnection`.
- Sync flow:
  1) connect broker
  2) store credentials
  3) fetch balances
  4) map balances to internal assets
  5) recalculate net worth
- Supports manual sync and automatic cron sync.
