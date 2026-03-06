# Mi Patrimonio Pro

SaaS multi-usuario para seguimiento de patrimonio personal con dashboards, portfolios, cuentas, categorías normalizadas y base de billing.

## Stack
- Next.js 14 + React + TypeScript
- TailwindCSS
- Prisma + PostgreSQL
- NextAuth (credentials + JWT)
- Recharts
- Stripe Billing (base endpoints + webhook)
- Vercel deployment target

## Arquitectura
- App Router con zonas públicas (`/`, `/pricing`, `/features`) y privadas (`/dashboard`, `/assets`, `/liabilities`, `/onboarding`)
- APIs internas `app/api/*` + webhook `app/webhooks/stripe`
- Capa de dominio en `lib/services/*`
- Esquema y migraciones en `prisma/*`
- Tipos compartidos en `types/*`

## Variables de entorno
Usa `.env.example` como base:

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
BINANCE_API_BASE_URL="https://api.binance.com"
IOL_API_BASE_URL="https://api.invertironline.com"
CRON_SECRET="..."
```

## Instalación
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Scripts
```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run format
npm run prisma:migrate
npm run prisma:seed
```

## Stripe
- Estado de suscripción: `GET /api/billing`
- Webhook: `POST /webhooks/stripe`
- Modelo: `Subscription` (`plan`, `status`, IDs de Stripe)

## Deploy en Vercel
1. Conecta el repo en Vercel.
2. Configura variables `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STRIPE_*`.
3. Build command: `npm run build`.
4. Ejecuta migraciones Prisma en pipeline de deploy.


## Integraciones de brokers
- Endpoints de conexión/sync:
  - `POST /api/integrations/binance/connect`
  - `POST /api/integrations/binance/sync`
  - `POST /api/integrations/iol/connect`
  - `POST /api/integrations/iol/sync`
- Sync automático por cron en `/api/integrations/sync` (Vercel cron + `CRON_SECRET`).
