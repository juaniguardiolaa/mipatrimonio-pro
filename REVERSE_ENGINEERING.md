# REVERSE_ENGINEERING

## UI inferida del demo
- Sidebar con navegación principal (Dashboard, Assets, Liabilities).
- Header de dashboard con título y resumen.
- Tarjetas KPI para patrimonio neto, activos y pasivos.
- Gráfico temporal de patrimonio neto.
- Visualización de distribución por categoría.
- Listas/tablas de activos y pasivos recientes.
- Formularios para alta de activos y pasivos.

## Comportamiento inferido
- CRUD de activos/pasivos por usuario autenticado.
- Recalculo automático de patrimonio después de cada mutación.
- Persistencia de historial temporal.
- Vista consolidada en dashboard con métricas y gráficos.

## Entidades detectadas
- User
- Asset
- Liability
- NetWorthHistory

## Endpoints necesarios
- `/api/assets` + `/api/assets/:id`
- `/api/liabilities` + `/api/liabilities/:id`
- `/api/networth/summary`
- `/api/networth/history`
