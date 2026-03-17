# Mi Patrimonio Pro

## Cron externo para pricing update (cron-job.org)

Este proyecto expone el endpoint seguro:

- `GET /api/pricing/update`

### 1) Configurar secret en Vercel

Agregar variable de entorno:

- `CRON_SECRET=<tu_secret_largo_y_aleatorio>`

### 2) Configurar job en cron-job.org

- **URL**: `https://mi-app.vercel.app/api/pricing/update`
- **Método**: `GET`
- **Intervalo**: Every 5 minutes
- **Header**:
  - `Authorization: Bearer <CRON_SECRET>`

### 3) Seguridad y estabilidad implementadas

- Autenticación obligatoria en producción con `Authorization: Bearer <CRON_SECRET>`.
- Ejecución manual sin header permitida solo en `NODE_ENV=development`.
- Rate limit interno de 60 segundos (`Pricing update skipped (too soon)`).
- Timeout de seguridad de 25 segundos para evitar ejecuciones largas.
- Logs de ejecución:
  - `Pricing update started`
  - `FX updated`
  - `Assets updated: <n>`
  - `Portfolios updated: <n>`
  - `Execution time: <ms>`

## Compatibilidad Linux / Vercel (casing)

Para evitar errores de build por diferencias de mayúsculas/minúsculas:

- Ejecutá `npm run check:linux` antes de abrir PR.
- El script valida:
  - colisiones de archivos que difieren solo por casing
  - imports relativos y con alias (`@/`) cuyo path no respeta el casing real del archivo en disco
- TypeScript también fuerza casing consistente con `forceConsistentCasingInFileNames: true`.

