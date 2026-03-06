# API_CONTRACT.md

Este documento define el contrato HTTP/JSON de la API interna.

## Convenciones globales

- Base path: `/api`
- Auth: sesión válida (NextAuth JWT)
- Success response: `{ "data": ... , "meta"?: ... }`
- Error response:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Errores comunes:
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `422 VALIDATION_ERROR`
- `500 INTERNAL_SERVER_ERROR`

---

## Assets

### GET `/api/assets`

#### Response 200
```json
{
  "data": [
    {
      "id": "ast_123",
      "userId": "usr_1",
      "name": "Cuenta de Ahorro",
      "category": "Cash",
      "value": 15000,
      "createdAt": "2026-01-01T10:00:00.000Z"
    }
  ]
}
```

#### Errores
- `401` si no hay sesión.
- `500` si falla DB.

### POST `/api/assets`

#### Request body
```json
{
  "name": "ETF S&P 500",
  "category": "Investments",
  "value": 25000
}
```

#### Response 201
```json
{
  "data": {
    "id": "ast_124",
    "userId": "usr_1",
    "name": "ETF S&P 500",
    "category": "Investments",
    "value": 25000,
    "createdAt": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Errores
- `401` sin sesión.
- `422` validación (`name`, `category`, `value > 0`).
- `500` error interno.

### PATCH `/api/assets/:id`

#### Request body
```json
{
  "name": "ETF Global",
  "category": "Investments",
  "value": 26000
}
```

#### Response 200
```json
{
  "data": {
    "id": "ast_124",
    "userId": "usr_1",
    "name": "ETF Global",
    "category": "Investments",
    "value": 26000,
    "createdAt": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Errores
- `401` sin sesión.
- `404` no existe o no pertenece al usuario.
- `422` payload inválido.
- `500` error interno.

### DELETE `/api/assets/:id`

#### Response 200
```json
{
  "data": {
    "id": "ast_124",
    "deleted": true
  }
}
```

#### Errores
- `401` sin sesión.
- `404` no existe o no pertenece al usuario.
- `500` error interno.

---

## Liabilities

### GET `/api/liabilities`

#### Response 200
```json
{
  "data": [
    {
      "id": "lib_123",
      "userId": "usr_1",
      "name": "Tarjeta de Crédito",
      "category": "Credit Card",
      "amount": 1200,
      "createdAt": "2026-01-01T10:00:00.000Z"
    }
  ]
}
```

#### Errores
- `401` sin sesión.
- `500` error interno.

### POST `/api/liabilities`

#### Request body
```json
{
  "name": "Hipoteca",
  "category": "Mortgage",
  "amount": 98000
}
```

#### Response 201
```json
{
  "data": {
    "id": "lib_124",
    "userId": "usr_1",
    "name": "Hipoteca",
    "category": "Mortgage",
    "amount": 98000,
    "createdAt": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Errores
- `401` sin sesión.
- `422` validación (`name`, `category`, `amount > 0`).
- `500` error interno.

### PATCH `/api/liabilities/:id`

#### Request body
```json
{
  "name": "Hipoteca Casa",
  "category": "Mortgage",
  "amount": 95000
}
```

#### Response 200
```json
{
  "data": {
    "id": "lib_124",
    "userId": "usr_1",
    "name": "Hipoteca Casa",
    "category": "Mortgage",
    "amount": 95000,
    "createdAt": "2026-01-02T10:00:00.000Z"
  }
}
```

#### Errores
- `401` sin sesión.
- `404` no existe o no pertenece al usuario.
- `422` payload inválido.
- `500` error interno.

### DELETE `/api/liabilities/:id`

#### Response 200
```json
{
  "data": {
    "id": "lib_124",
    "deleted": true
  }
}
```

#### Errores
- `401` sin sesión.
- `404` no existe o no pertenece al usuario.
- `500` error interno.

---

## Net Worth

### GET `/api/networth/summary`

#### Response 200
```json
{
  "data": {
    "assetsTotal": 40000,
    "liabilitiesTotal": 10000,
    "netWorth": 30000,
    "lastUpdatedAt": "2026-01-03T00:00:00.000Z"
  }
}
```

#### Errores
- `401` sin sesión.
- `500` error interno.

### GET `/api/networth/history`

#### Query params opcionales
- `from`: ISO date
- `to`: ISO date
- `limit`: number (default 180)

#### Response 200
```json
{
  "data": [
    {
      "date": "2026-01-01T00:00:00.000Z",
      "netWorth": 25000
    },
    {
      "date": "2026-01-02T00:00:00.000Z",
      "netWorth": 30000
    }
  ],
  "meta": {
    "count": 2
  }
}
```

#### Errores
- `401` sin sesión.
- `422` rango/params inválidos.
- `500` error interno.

---

## SaaS Extensions

### GET `/api/portfolios`
- Returns user portfolios.

### POST `/api/portfolios`
- Body: `{ name: string }`
- Creates portfolio (free plan limit applies).

### GET `/api/accounts`
- Optional query: `portfolioId`
- Returns accounts by user/portfolio.

### POST `/api/accounts`
- Body: `{ portfolioId, name, type, currency }`

### GET `/api/catalog`
- Returns asset categories, liability categories, currencies.

### GET `/api/billing`
- Returns current subscription state.

### POST `/webhooks/stripe`
- Receives Stripe subscription events.

---

## Broker Integrations

### POST `/api/integrations/binance/connect`
- Body: `{ apiKey: string, apiSecret: string }`
- Guarda o actualiza credenciales Binance.

### POST `/api/integrations/binance/sync`
- Sincroniza balances Binance y los transforma en assets internos.

### POST `/api/integrations/iol/connect`
- Body: `{ apiKey: string, apiSecret: string }`
- Guarda o actualiza credenciales IOL.

### POST `/api/integrations/iol/sync`
- Sincroniza portfolio IOL y lo transforma en assets internos.

### POST `/api/integrations/sync`
- Sincronización manual de todos los brokers conectados del usuario.

### GET `/api/integrations/sync`
- Sincronización automática (cron) para todos los usuarios.
- Requiere `Authorization: Bearer <CRON_SECRET>`.
