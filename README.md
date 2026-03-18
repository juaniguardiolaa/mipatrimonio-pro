# Mi Patrimonio Pro

Aplicación financiera en Next.js + Prisma con autenticación real por credenciales.

## Configuración rápida

1. Copiá variables de entorno:

```bash
cp .env.example .env
```

2. Completá `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` y `CRON_SECRET`.

3. Instalá dependencias y sincronizá Prisma:

```bash
npm install
# en producción (Vercel build): prisma migrate deploy
npx prisma db push
npm run dev
```

## Autenticación

- Registro: `POST /api/auth/register` (hash seguro con `crypto.scrypt` + salt).
- Login por credenciales (`/login`) con sesión persistida en Prisma.
- Sesión disponible en server con `getAuthSession()`.
- Rutas privadas protegidas por middleware:
  - `/dashboard`
  - `/accounts`
  - `/investments`

## Flujo funcional esperado

1. `/signup` crear cuenta.
2. `/login` iniciar sesión.
3. Crear cuenta financiera en `/accounts`.
4. Crear inversión en `/investments`.
5. Ver dashboard valorizado en `/dashboard`.

## Cron externo para pricing update (cron-job.org)

Endpoint seguro:

- `GET /api/pricing/update`

### Configurar job

- URL: `https://mi-app.vercel.app/api/pricing/update`
- Método: `GET`
- Header: `Authorization: Bearer <CRON_SECRET>`

### Seguridad

- En producción exige `Authorization`.
- En desarrollo permite ejecución manual.
- Rate limit interno de 60s.
- Timeout de seguridad de 25s.

## Compatibilidad Linux / Vercel (casing)

- Ejecutá `npm run check:linux` antes de abrir PR.
- Valida colisiones por casing de archivos.
- Valida imports (`./`, `../`, `@/`) con casing exacto.
- TypeScript fuerza consistencia con `forceConsistentCasingInFileNames`.


## Diagnóstico de registro (500)

El endpoint `POST /api/auth/register` ahora valida conectividad Prisma y existencia de tablas críticas (`User`, `Session`).
Si faltan tablas responde `503` con mensaje explícito para correr migraciones (`prisma migrate deploy`).
También emite logs detallados con `requestId` para trazabilidad en Vercel.


## Market data real

El pricing engine usa market data real:

- `CRYPTO` → Binance (`/api/v3/ticker/price`)
- `STOCK` / `ETF` → Yahoo Finance (`/v7/finance/quote`)
- `CEDEAR` → precio USD del underlying + CCL / ratio
- `BOND` → provider de bonos

`purchasePrice` se mantiene como costo histórico.
`marketPrice` / `marketPriceUsd` se actualizan solo con market data o con el último precio de mercado guardado si el provider falla.
