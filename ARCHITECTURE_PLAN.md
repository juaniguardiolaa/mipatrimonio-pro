# ARCHITECTURE_PLAN.md

## 0) Contexto y objetivo

Este documento define la arquitectura objetivo para transformar el prototipo **Mi Patrimonio Pro (Base44)** en una aplicación SaaS lista para producción, escalable y mantenible.

Objetivo funcional principal:
- Registrar activos y pasivos por usuario.
- Calcular patrimonio neto (`Net Worth = Assets - Liabilities`) en tiempo real.
- Persistir historial de patrimonio para análisis temporal.
- Presentar un dashboard con métricas, gráficos y tablas accionables.

Objetivo técnico principal:
- Usar un stack moderno full-stack con **Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + Recharts + NextAuth**.
- Implementar una arquitectura modular, testeable y preparada para despliegue en **Vercel**.

---

## 1) Stack tecnológico (requerido)

### Frontend
- **Next.js 14 (App Router)**
- **React 18+**
- **TypeScript**
- **TailwindCSS**

### Backend
- **Next.js Route Handlers** (`app/api/*`) para endpoints REST internos.

### Persistencia
- **PostgreSQL**
- **Prisma ORM**

### Gráficos
- **Recharts**

### Autenticación
- **NextAuth (JWT session strategy)**
  - Provider inicial: Credentials (email/password).
  - Evolución futura: OAuth providers (Google, GitHub).

### Deployment / Infra
- **Vercel** (frontend + API)
- **PostgreSQL gestionado** (Neon, Supabase, Railway o RDS)

---

## 2) Reverse engineering funcional (resumen para diseño)

A partir del comportamiento esperado de un net-worth dashboard estilo Base44, se define la siguiente estructura funcional a replicar:

### 2.1 Estructura del Dashboard
- Header con título + contexto temporal.
- Tarjetas KPI de alto nivel.
- Sección de gráficos (evolución temporal + distribución).
- Secciones tabulares/listas para activos y pasivos recientes.
- CTA para crear/editar/eliminar activos y pasivos.

### 2.2 Componentes visuales inferidos
- **KPI Cards**:
  - Patrimonio neto actual.
  - Total de activos.
  - Total de pasivos.
  - Variación mensual/periodo.
- **Charts**:
  - Línea/área de evolución de patrimonio.
  - Donut o barras apiladas por categoría.
- **Data Tables / Lists**:
  - Activos por categoría y valor.
  - Pasivos por categoría y monto.
- **Forms / Modals**:
  - Alta/edición de activo.
  - Alta/edición de pasivo.
- **Navegación**:
  - Sidebar: Dashboard, Assets, Liabilities (y potencialmente Settings).

### 2.3 Flujo de usuario inferido
1. Usuario inicia sesión.
2. Ingresa al dashboard con snapshot de su patrimonio.
3. Registra activos/pasivos.
4. Sistema recalcula net worth automáticamente.
5. Se guarda snapshot en historial.
6. Usuario analiza evolución en gráficos.

### 2.4 Entidades y datos mostrados
- Usuario
- Asset (nombre, categoría, valor)
- Liability (nombre, categoría, monto)
- NetWorthHistory (net worth + fecha)
- Totales agregados por categoría y por periodo

### 2.5 Endpoints necesarios (alto nivel)
- `POST /api/auth/*` (NextAuth)
- `GET/POST /api/assets`
- `PATCH/DELETE /api/assets/:id`
- `GET/POST /api/liabilities`
- `PATCH/DELETE /api/liabilities/:id`
- `GET /api/networth/summary`
- `GET /api/networth/history`
- `POST /api/networth/recalculate` (opcional interno)

---

## 3) Arquitectura de Frontend

### 3.1 Principios
- App Router con separación clara entre:
  - **Server Components** para fetch inicial y composición de páginas.
  - **Client Components** para interacciones (formularios, filtros, charts dinámicos).
- Reutilización mediante design system liviano de componentes UI.
- Accesibilidad básica (focus states, labels, contraste).

### 3.2 Estructura propuesta de rutas
- `/` → landing/redirección a dashboard
- `/login` → autenticación
- `/dashboard` → vista consolidada
- `/assets` → gestión de activos
- `/liabilities` → gestión de pasivos

### 3.3 Componentes clave
- `components/ui/*`
  - `Card`, `Button`, `Input`, `Select`, `Table`, `Modal`, `Badge`
- `components/charts/*`
  - `NetWorthTrendChart`
  - `AllocationByCategoryChart`
- `components/forms/*`
  - `AssetForm`
  - `LiabilityForm`
- `components/dashboard/*`
  - `KpiCards`
  - `RecentAssetsTable`
  - `RecentLiabilitiesTable`

### 3.4 Estrategia de datos en frontend
- Fetch inicial en Server Components (SSR/streaming).
- Mutaciones desde Client Components contra `app/api/*`.
- Revalidación con `router.refresh()` o invalidación selectiva.
- Normalización mínima en capa `lib/services`.

---

## 4) Arquitectura de Backend (Next.js API Routes)

### 4.1 Capas internas
- **Route Handlers** (`app/api/*/route.ts`): parsing/response HTTP.
- **Service Layer** (`lib/services/*`): reglas de negocio.
- **Data Access Layer** (`lib/db/*`): consultas Prisma encapsuladas.

### 4.2 Reglas de negocio críticas
- Cada operación está scopeada por `userId` (multi-tenant por propietario).
- No permitir acceso CRUD a recursos de otro usuario.
- Recalcular patrimonio tras mutaciones de assets/liabilities.
- Persistir snapshot de historial de forma consistente.

### 4.3 Validación
- Esquemas de validación de entrada/salida (recomendado: Zod).
- Mensajes de error consistentes (`400`, `401`, `403`, `404`, `422`, `500`).

### 4.4 Observabilidad mínima
- Logging estructurado en servidor para errores y eventos críticos.
- Preparación para agregar tracing/analytics en iteraciones futuras.

---

## 5) Modelo de datos (Prisma + PostgreSQL)

### 5.1 Entidades mínimas
- **User**
  - `id` (String/UUID)
  - `email` (unique)
  - `password` (hash)
  - `createdAt`
- **Asset**
  - `id`
  - `userId` (FK User)
  - `name`
  - `category`
  - `value` (Decimal)
  - `createdAt`
- **Liability**
  - `id`
  - `userId` (FK User)
  - `name`
  - `category`
  - `amount` (Decimal)
  - `createdAt`
- **NetWorthHistory**
  - `id`
  - `userId` (FK User)
  - `netWorth` (Decimal)
  - `date` (DateTime)

### 5.2 Índices recomendados
- `User.email` único.
- Índices por `userId` en Asset, Liability, NetWorthHistory.
- Índice compuesto `(userId, date desc)` para historial.

### 5.3 Consideraciones de precisión monetaria
- Usar `Decimal` en DB/Prisma (nunca float).
- Formateo monetario únicamente en capa de presentación.

---

## 6) Estrategia de autenticación

### 6.1 Implementación
- NextAuth con provider de credenciales.
- Password hash con `bcrypt`.
- Sesión por JWT (`session.strategy = "jwt"`).

### 6.2 Seguridad
- Rutas protegidas mediante middleware (`/dashboard`, `/assets`, `/liabilities`).
- CSRF/session management manejado por NextAuth.
- Secrets en variables de entorno.
- Nunca exponer password hash al cliente.

### 6.3 Evolución
- Soporte futuro de MFA, OAuth social y RBAC para cuentas compartidas.

---

## 7) Estructura de carpetas objetivo

```txt
/app
  /(auth)
    /login
  /(protected)
    /dashboard
    /assets
    /liabilities
  /api
    /auth/[...nextauth]
    /assets
    /assets/[id]
    /liabilities
    /liabilities/[id]
    /networth/summary
    /networth/history
/components
  /ui
  /charts
  /forms
  /dashboard
/lib
  /db
  /services
  /auth
  /utils
/prisma
  schema.prisma
  seed.ts
/middleware.ts
```

---

## 8) Flujo de datos end-to-end

1. Usuario autenticado solicita `/dashboard`.
2. Server Component consulta:
   - resumen net worth
   - historial
   - últimos activos/pasivos
3. Render inicial SSR con KPIs + charts.
4. Usuario crea/edita asset o liability (form client).
5. API valida input + ownership + guarda en DB.
6. Service recalcula net worth y guarda snapshot en `NetWorthHistory`.
7. Frontend revalida y actualiza métricas/gráficos.

---

## 9) Estrategia de estado

- Estado remoto principal: servidor/API (fuente de verdad).
- Estado local UI: formularios, modales, filtros y loading states.
- Evitar estado global innecesario en fase inicial.
- Introducir librería de cache (TanStack Query) solo si aumenta complejidad de lectura/escritura.

---

## 10) Estrategia de gráficos (Recharts)

### 10.1 Gráficos iniciales
- **NetWorthTrendChart** (line/area)
  - Eje X: fecha
  - Eje Y: patrimonio neto
- **AllocationByCategoryChart** (donut/bar)
  - Distribución de activos y/o pasivos por categoría

### 10.2 Reglas UX
- Tooltips con formato monetario local.
- Colores consistentes por tipo (activo/pasivo).
- Estados vacíos amigables cuando no hay datos.

---

## 11) Estrategia de escalabilidad

### 11.1 Escalabilidad técnica
- Separar capa de servicios desde inicio para facilitar extracción futura a microservicios si aplica.
- Queries Prisma optimizadas con índices.
- Paginación para tablas crecientes.
- Caching selectivo de lecturas (ISR/route cache cuando aplique).

### 11.2 Escalabilidad de producto
- Categorías custom por usuario.
- Múltiples cuentas/portafolios por usuario.
- Importación CSV/Open Banking (futuro).
- Alertas y objetivos financieros.

### 11.3 Calidad y mantenibilidad
- Lint + Typecheck + tests básicos (unit/integration).
- Convenciones de commits (Conventional Commits).
- CI para checks automáticos antes de deploy.

---

## 12) Plan de implementación progresiva (alineado a fases)

1. Inicializar Next.js 14 + TypeScript + Tailwind.
2. Configurar Prisma + PostgreSQL.
3. Definir schema y migraciones.
4. Implementar NextAuth (credentials).
5. Construir CRUD API para assets/liabilities.
6. Implementar servicios de cálculo net worth + historial.
7. Construir layout y componentes dashboard.
8. Integrar charts con datos reales.
9. Seed inicial para demo funcional.
10. Hardening para producción + documentación y deploy.

---

## 13) Configuración de entorno y deployment (Vercel)

Variables requeridas:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Recomendaciones:
- Ejecutar migraciones en pipeline de deploy.
- Mantener secretos en Vercel Project Settings.
- Configurar `prisma generate` en build.

---

## 14) Criterios de aceptación de arquitectura

Se considera válida esta arquitectura si:
- Permite reconstruir visualmente el dashboard del demo.
- Soporta CRUD completo de activos/pasivos por usuario autenticado.
- Calcula y persiste historial de patrimonio automáticamente.
- Puede desplegarse en Vercel con PostgreSQL sin cambios estructurales.
- Mantiene una base de código modular y extensible para evolución SaaS.


## 15) Contratos API detallados (especificación mínima de implementación)

Para evitar ambigüedad entre frontend y backend, los endpoints deberán versionarse internamente como contrato estable `v1` (sin prefijo de URL por ahora, pero versionado semántico en docs).

### Convenciones
- Todas las respuestas JSON usan forma:
  - éxito: `{ data: ..., meta?: ... }`
  - error: `{ error: { code: string, message: string, details?: unknown } }`
- `Content-Type: application/json` en requests con body.
- Valores monetarios en API se serializan como `number` (conversión desde Prisma Decimal en server).

### Contratos iniciales requeridos
- Assets: `GET/POST/PATCH/DELETE /api/assets[/id]`
- Liabilities: `GET/POST/PATCH/DELETE /api/liabilities[/id]`
- Net worth: `GET /api/networth/summary`, `GET /api/networth/history`

---

## 16) Tipos TypeScript compartidos

Se define carpeta `/types` como fuente compartida de contratos:
- `User`
- `Asset`
- `Liability`
- `NetWorthSummary`
- `NetWorthHistoryPoint`

Reglas:
- Backend retorna DTOs compatibles con estos tipos.
- Frontend consume únicamente estos contratos para evitar drift.
- Cualquier cambio breaking requiere actualización simultánea de `docs/API_CONTRACT.md`.

---

## 17) Estrategia de cálculo de patrimonio (detallada)

### Fórmulas
- `assetsTotal = SUM(asset.value)`
- `liabilitiesTotal = SUM(liability.amount)`
- `netWorth = assetsTotal - liabilitiesTotal`

### Reglas de persistencia histórica
- Trigger lógico en capa de servicio tras cualquier mutación de assets/liabilities.
- `recalculateNetWorthForUser(userId)`:
  1. Agrega totales desde DB.
  2. Calcula net worth.
  3. Inserta snapshot en `NetWorthHistory` con `date=now`.
  4. Retorna `NetWorthSummary`.
- Opción de deduplicación futura (ej: 1 snapshot por día) queda fuera de MVP.

### Reglas de consistencia
- Ejecutar mutación + recálculo en transacción Prisma cuando sea posible.
- Nunca calcular patrimonio en cliente como fuente oficial (solo para preview UX).

---

## 18) Estructura de componentes UI (desglose)

### Dashboard shell
- `DashboardLayout`
- `SidebarNav`
- `Topbar`

### Métricas y datos
- `KpiCard`
- `KpiCardsGrid`
- `AssetsTable`
- `LiabilitiesTable`

### Formularios
- `AssetForm` (create/update)
- `LiabilityForm` (create/update)

### Gráficos
- `NetWorthTrendChart`
- `CategoryAllocationChart`

### Principios de composición
- Componentes `ui/*` totalmente presentacionales.
- Componentes `dashboard/*` orquestan datos y composición visual.
- `forms/*` encapsulan validación y submit handlers.
- `charts/*` reciben data ya transformada y formateada.

---

## 19) SaaS Evolution Addendum

### 19.1 Multi-portfolio and accounts
- User can manage multiple portfolios.
- Each portfolio can have multiple accounts.
- Assets belong to accounts and portfolios.
- Liabilities belong to portfolios.

### 19.2 Normalized catalogs
- Asset and liability categories are normalized in dedicated tables.
- Currency catalog enables ISO-based multi-currency handling.

### 19.3 Billing and monetization
- `Subscription` model added for Stripe lifecycle state.
- Free plan enforces limits:
  - up to 1 portfolio
  - up to 20 assets
- Pro plan unlocks unlimited portfolios and advanced analytics.

### 19.4 Product surface
- Public marketing pages: `/`, `/pricing`, `/features`.
- Auth pages: `/login`, `/signup`.
- Onboarding flow: `/onboarding` (first portfolio, first account, first asset).

### 19.5 Production hardening
- API rate limiting in route handlers.
- Structured logging utilities for operational visibility.
- Uniform error envelopes for client-side resilience.
