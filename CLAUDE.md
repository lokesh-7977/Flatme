# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server with hot reload (http://localhost:3000)

bun run lint         # Lint with Biome (auto-fix)
bun run format       # Format with Biome (auto-fix)
bun run check        # Lint + format in one pass
bun run ci           # Biome CI check (no writes — use in CI pipelines)

bun run db:generate  # Generate Drizzle migration files from schema changes
bun run db:migrate   # Apply migrations to the database
bun run db:push      # Push schema directly to DB (dev shortcut, no migration files)
bun run db:studio    # Open Drizzle Studio
```

No test runner is configured.

## Environment Variables

Required in `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (Neon) |
| `JWT_SECRET` | ✅ | — | ≥32-char secret for signing JWTs |
| `GOOGLE_CLIENT_ID` | ✅ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | ✅ | — | Must match Google Console redirect URI |
| `PORT` | ❌ | `3000` | HTTP server port |
| `CORS_ORIGIN` | ❌ | `*` | Comma-separated allowed origins |
| `MAX_SESSIONS_PER_USER` | ❌ | `5` | Max concurrent sessions per user (1–20) |
| `DB_POOL_MAX` | ❌ | `10` | Max pg pool connections (1–100) |

## Architecture

Hono backend running on Bun with a layered architecture:

```
routes → controllers → services → repositories → db
```

- **`src/server.ts`** — Entry point. Mounts `/auth` and `/api` route groups, serves static files from `src/public/`. Registers graceful SIGTERM/SIGINT shutdown.
- **`src/config/env.ts`** — Validates all environment variables at startup via Zod; process exits on any missing/invalid value.
- **`src/routes/apiRoutes.ts`** — All `/api/*` routes. Applies `authMiddleware` globally; each route has Zod body/param validation.
- **`src/routes/authRoutes.ts`** — Auth routes with per-route rate limiting.
- **`src/controllers/`** — Request/response handling. Delegates business logic to services.
- **`src/services/userService.ts`** — Business logic (upsert user on OAuth login, profile updates, session management).
- **`src/repositories/`** — Database queries via Drizzle ORM (`userRepository`, `sessionRepository`).
- **`src/db/auth/index.ts`** — Single source of truth for DB schema: `usersTable` and `sessionsTable` (with indexes).
- **`src/db/schema.ts`** — Re-exports schema from `./auth` for Drizzle Kit.
- **`src/db/index.ts`** — Exports shared `db` instance (node-postgres Pool + Drizzle).
- **`src/lib/jwt.ts`** — JWT helpers via `jose`. Access tokens: 15 min. Refresh tokens: 30 days.
- **`src/lib/hash.ts`** — SHA-256 token hashing (refresh tokens stored hashed in DB).
- **`src/lib/logger.ts`** — Structured logger (JSON in prod, pretty in dev).
- **`src/lib/errors.ts`** — Typed `AppError` subclasses: `UnauthorizedError`, `NotFoundError`, `TokenReuseError`, `SessionExpiredError`.
- **`src/middleware/authMiddleware.ts`** — Reads JWT from `Authorization: Bearer` header or `accessToken` cookie; sets `userId` in Hono context.
- **`src/middleware/rateLimitMiddleware.ts`** — In-memory sliding window rate limiter, keyed by client IP.
- **`src/middleware/requestIdMiddleware.ts`** — Attaches `X-Request-ID` to every request/response.
- **`src/types/hono.d.ts`** — Augments `ContextVariableMap` with `userId` and `requestId`.

## API Endpoints

### Auth (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/google` | No | Initiate Google OAuth (rate limited) |
| GET | `/auth/google/callback` | No | Google OAuth callback (rate limited) |
| POST | `/auth/refresh` | No | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | No | Delete session, clear cookies |

### API (`/api`) — all routes require `Authorization: Bearer <token>` or `accessToken` cookie

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/me` | — | Current user profile (no googleSub) |
| PATCH | `/api/me` | `{ name?, city?, photo?, gender? }` | Update profile |
| GET | `/api/me/sessions` | — | List all active sessions |
| DELETE | `/api/me/sessions/:id` | — | Revoke a specific session |

### System

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check (`{ status, timestamp }`) |

## Security Features

- Refresh tokens stored as SHA-256 hashes in DB
- Token rotation on every refresh (reuse detection kills all sessions)
- Per-user session cap (default 5, configurable)
- IP-based rate limiting on all auth endpoints
- `HttpOnly` + `Secure` + `SameSite=Lax` cookies
- Secure response headers via `hono/secure-headers`
- CORS with configurable origin allowlist
- Verified-email check on Google OAuth callback
- IP spoofing mitigation (first IP from `x-forwarded-for` only)
