# HerbAlly API Documentation

**Version:** 1.0.0  
**Last Updated:** May 11, 2026  
**Base URL:** `https://herbally.app/api`

---

## Overview

HerbAlly API provides programmatic access to our medicinal herb database, AI-powered interactions, and dosage calculations.

### Authentication

Most endpoints are public. Authenticated endpoints require a valid Supabase session.

### Rate Limiting

- **Default:** 100 requests/minute per IP
- **Authenticated:** 500 requests/minute per user

---

## Endpoints

### Health & Status

#### `GET /api/health`

Check system health and service status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-05-11T12:00:00.000Z",
  "version": "0.1.0",
  "services": {
    "supabase": "healthy",
    "openrouter": "healthy",
    "stripe": "healthy",
    "rateLimit": "healthy"
  }
}
```

**Status Codes:**

- `200` - All systems operational
- `503` - One or more services degraded

---

### Herbs

#### `GET /api/herbs/search?q=<query>`

Search for herbs by name, common names, or traditional uses.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `category` | string | No | Filter by category |
| `limit` | number | No | Max results (default: 20) |
| `offset` | number | No | Pagination offset |

**Example:**

```bash
curl "https://herbally.app/api/herbs/search?q=ginger&limit=10"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "herbs": [
      {
        "id": "uuid",
        "name": "Ginger",
        "scientific_name": "Zingiber officinale",
        "slug": "ginger",
        "common_names": ["Ginger Root", "Zingiber"],
        "category": "Digestive",
        "evidence_grade": "A",
        "safety_rating": "Generally Safe"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

#### `GET /api/herbs/random`

Get a random herb (for "surprise me" feature).

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Turmeric",
    "scientific_name": "Curcuma longa",
    "slug": "turmeric"
  }
}
```

---

### AI Chat

#### `POST /api/chat`

Interact with the AI-powered virtual herbalist.

**Authentication:** Required (Supabase session)

**Request Body:**

```json
{
  "message": "Can I take ginger with blood thinners?",
  "sessionId": "optional-session-id",
  "context": {
    "currentHerb": "ginger",
    "userMedications": ["warfarin"],
    "age": 45,
    "weight": 70
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "response": "Ginger may interact with blood thinners like warfarin...",
    "sessionId": "session-id",
    "sources": [
      {
        "title": "Herb-Drug Interactions",
        "url": "https://example.com/study"
      }
    ],
    "disclaimer": "This is not medical advice..."
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - AI service error

---

### Drug Interactions

#### `POST /api/interpret-search`

Analyze potential herb-drug interactions.

**Authentication:** Required

**Request Body:**

```json
{
  "herbs": ["ginger", "turmeric"],
  "medications": ["warfarin", "aspirin"],
  "userId": "optional-user-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "herb": "ginger",
        "medication": "warfarin",
        "severity": "moderate",
        "description": "Ginger may increase bleeding risk when taken with warfarin.",
        "recommendation": "Monitor INR closely. Consult healthcare provider."
      }
    ],
    "summary": "2 potential interactions found"
  }
}
```

---

### External APIs

#### `GET /api/rxnorm?q=<drug_name>`

Proxy to RxNorm API for drug information.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Drug name |

**Response:** RxNorm API response (proxied)

#### `GET /api/openfda?q=<drug_name>`

Proxy to OpenFDA API for adverse events.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Drug name |
| `limit` | number | No | Max results (default: 10) |

**Response:** OpenFDA API response (proxied)

---

### Analytics

#### `POST /api/analytics/vitals`

Submit Web Vitals metrics.

**Request Body:**

```json
{
  "vitals": [
    {
      "name": "LCP",
      "value": 2.3,
      "rating": "good"
    },
    {
      "name": "INP",
      "value": 150,
      "rating": "good"
    },
    {
      "name": "CLS",
      "value": 0.05,
      "rating": "good"
    }
  ],
  "url": "/herbs/ginger",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**

```json
{
  "success": true
}
```

---

### Donations

#### `POST /api/donate`

Create a Stripe checkout session for donations.

**Authentication:** Optional

**Request Body:**

```json
{
  "amount": 1000,
  "currency": "usd",
  "frequency": "one-time",
  "donor": {
    "email": "donor@example.com",
    "name": "John Doe"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_...",
    "url": "https://checkout.stripe.com/..."
  }
}
```

#### `POST /api/webhooks/stripe`

Handle Stripe webhook events.

**Events Handled:**

- `checkout.session.completed` - Record donation
- `checkout.session.expired` - Log expired session
- `payment_intent.payment_failed` - Log failed payment

**Security:** Requires `Stripe-Signature` header

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code                  | HTTP Status | Description                |
| --------------------- | ----------- | -------------------------- |
| `BAD_REQUEST`         | 400         | Invalid request parameters |
| `UNAUTHORIZED`        | 401         | Authentication required    |
| `FORBIDDEN`           | 403         | Insufficient permissions   |
| `NOT_FOUND`           | 404         | Resource not found         |
| `RATE_LIMITED`        | 429         | Too many requests          |
| `INTERNAL_ERROR`      | 500         | Server error               |
| `SERVICE_UNAVAILABLE` | 503         | External service down      |

---

## Rate Limiting

### Limits

| Tier          | Requests/Minute | Requests/Day |
| ------------- | --------------- | ------------ |
| Anonymous     | 100             | 1,000        |
| Authenticated | 500             | 10,000       |
| Premium       | 2,000           | 50,000       |

### Headers

Rate limit info included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

### Exceeded Limit Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
// Example usage
const response = await fetch("/api/herbs/search?q=ginger");
const data = await response.json();
```

### cURL Examples

```bash
# Search for herbs
curl "https://herbally.app/api/herbs/search?q=ginger"

# Get random herb
curl "https://herbally.app/api/herbs/random"

# Chat with AI (requires auth)
curl -X POST "https://herbally.app/api/chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Is ginger safe?"}'
```

---

## Changelog

### v1.0.0 (May 11, 2026)

- Initial API documentation
- Health check endpoint
- Herb search and random endpoints
- AI chat endpoint
- Drug interaction checker
- Stripe donation integration
- Web Vitals analytics

---

## Support

- **Documentation:** https://herbally.app/docs
- **Status:** https://status.herbally.app
- **Contact:** support@herbally.app
- **GitHub:** https://github.com/yab007-glitch/herbally

---

_API subject to change. Version in URL path for breaking changes (e.g., `/api/v2/...`)._
