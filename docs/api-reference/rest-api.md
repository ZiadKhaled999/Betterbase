# REST API

Complete reference for the BetterBase REST API.

## Base URL

```
http://localhost:3000/api
```

## Authentication Endpoints

### Sign Up

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "...",
    "expiresAt": "2024-01-15T10:30:00Z"
  }
}
```

### Sign In

```http
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

### Sign Out

```http
POST /auth/signout
Authorization: Bearer <token>
```

### Get Session

```http
GET /auth/session
Authorization: Bearer <token>
```

### Refresh Session

```http
POST /auth/refresh
Authorization: Bearer <token>
```

## Auto-REST Endpoints

BetterBase automatically generates CRUD endpoints for each table.

### List Records

```http
GET /:table
GET /users
GET /posts?limit=10&offset=0&sort=createdAt.desc
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of records (default: 20, max: 1000) |
| `offset` | number | Offset for pagination |
| `sort` | string | Sort field and direction (e.g., `createdAt.desc`) |
| `filter` | string | Filter expression |

**Filter Syntax:**

```
GET /users?filter=active.eq.true
GET /posts?filter=published.eq.true&userId.eq.user-123
GET /users?filter=role.in.admin,moderator
```

### Get Single Record

```http
GET /:table/:id
GET /users/user-123
```

### Create Record

```http
POST /:table
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "id": "user-123",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Update Record

```http
PATCH /:table/:id
PATCH /users/user-123
Content-Type: application/json

{
  "name": "Jane Doe"
}
```

### Delete Record

```http
DELETE /:table/:id
DELETE /users/user-123
```

## Storage Endpoints

### Upload File

```http
POST /storage/:bucket
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="image.jpg"
<file content>
--boundary
```

### Download File

```http
GET /storage/:bucket/:path
```

### List Files

```http
GET /storage/:bucket
```

### Delete File

```http
DELETE /storage/:bucket/:path
```

## WebSocket Connection

For realtime subscriptions:

```javascript
const ws = new WebSocket('ws://localhost:3000/realtime/v1')

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  payload: { token: '...' }
}))

// Subscribe
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: {
    event: 'postgres_changes',
    table: 'posts',
    filter: '*'
  }
}))
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "PGRST116",
    "message": "The requested resource was not found",
    "details": "...",
    "hint": "..."
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PGRST116` | 404 | Resource not found |
| `23505` | 409 | Unique constraint violation |
| `42501` | 403 | Permission denied |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_TOKEN` | 401 | Invalid or expired token |

## Rate Limiting

API requests are rate limited:

- **Authenticated:** 1000 requests/minute
- **Unauthenticated:** 100 requests/minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705315800
```

## CORS

Cross-origin requests are supported via CORS headers:

```
Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

## Filtering Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `eq` | `id.eq.user-123` | Equals |
| `neq` | `id.neq.user-123` | Not equals |
| `gt` | `age.gt.18` | Greater than |
| `gte` | `age.gte.18` | Greater or equal |
| `lt` | `age.lt.18` | Less than |
| `lte` | `age.lte.18` | Less or equal |
| `like` | `name.like.%John%` | Pattern match |
| `ilike` | `name.ilike.%john%` | Case-insensitive |
| `in` | `role.in.admin,user` | In array |
| `is` | `deleted.is.null` | Is null |

## Sorting

```
?sort=createdAt.desc
?sort=title.asc,createdAt.desc
```

## Pagination

```
?page=1&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Related

- [Client SDK](./client-sdk.md) - Using REST API from client
- [Database](../features/database.md) - Database operations
- [GraphQL API](./graphql-api.md) - GraphQL reference
