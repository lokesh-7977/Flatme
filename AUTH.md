# Authentication

This app uses Google OAuth for login. There's no username/password — users sign in with their Google account and we issue our own JWTs from there.

---

## How it works at a high level

When someone logs in, we give them two tokens:

- **Access token** — short-lived (15 minutes), used on every API request
- **Refresh token** — long-lived (30 days), used only to get a new access token

Both are stored as `HttpOnly` cookies, so JavaScript on the page can never read them.

---

## Login flow

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Google
    participant DB

    User->>App: GET /auth/google
    App->>Google: Redirect to Google OAuth consent
    Google->>User: Show consent screen
    User->>Google: Approve
    Google->>App: GET /auth/google/callback?code=...
    App->>Google: Exchange code for profile
    Google-->>App: { id, name, email, verified_email }
    App->>App: Reject if verified_email == false
    App->>DB: Find user by googleSub
    alt New user
        DB-->>App: Not found
        App->>DB: Insert new user
    else Existing user
        DB-->>App: Return user
    end
    App->>App: Generate sessionId (uuidv7)
    App->>App: Sign accessToken + refreshToken in parallel
    App->>DB: Enforce session cap (delete oldest if > MAX_SESSIONS_PER_USER)
    App->>DB: Insert session row (refreshToken stored as SHA-256 hash)
    App-->>User: Set accessToken cookie (15 min) + refreshToken cookie (30 days)
    App-->>User: Redirect to /
```

---

## Refreshing the access token

The access token expires after 15 minutes. When that happens, the client calls `POST /auth/refresh`. The refresh token gets rotated on every call — the old one is thrown away and a new one is issued.

```mermaid
sequenceDiagram
    actor Client
    participant App
    participant DB

    Client->>App: POST /auth/refresh (refreshToken cookie)
    App->>App: Verify JWT signature + expiry
    App->>App: Sign new accessToken + refreshToken in parallel
    App->>DB: UPDATE session SET refreshToken = hash(new) WHERE id = ? AND refreshToken = hash(old)
    alt Row updated (token was valid)
        DB-->>App: Updated session
        App->>App: Check session.expiresAt — reject if expired
        App-->>Client: Set new accessToken cookie + new refreshToken cookie
    else Row not updated (token already used — reuse attack)
        DB-->>App: 0 rows
        App->>DB: Delete ALL sessions for this user
        App-->>Client: 401 TOKEN_REUSE
    end
```

### Why rotate the refresh token?

If someone steals a refresh token and uses it, the next time the real user tries to refresh, the old token won't match what's in the DB. We detect that and kill every session for that account.

### Why hash the refresh token?

Refresh tokens are stored as SHA-256 hashes in the DB. A full DB breach can't yield tokens that could be replayed — the raw values only ever live in the signed JWT cookies.

---

## Logout

```mermaid
sequenceDiagram
    actor User
    participant App
    participant DB

    User->>App: POST /auth/logout (refreshToken cookie)
    App->>App: Verify refresh token to extract sessionId
    App->>DB: Delete session row (fire and forget)
    App-->>User: Clear accessToken + refreshToken cookies
    App-->>User: 200 Logged out
```

The session delete is fire-and-forget — cookies are cleared regardless of whether the DB call succeeds.

---

## How protected routes work

```mermaid
flowchart LR
    Request-->MW{authMiddleware}
    MW-->|No token|401A[401 Unauthorized]
    MW-->|Invalid / expired token|401B[401 Unauthorized]
    MW-->|Valid token|Handler[Route handler\nuserId in context]
```

The middleware checks the `Authorization: Bearer` header first, then falls back to the `accessToken` cookie. Either way works.

---

## Session management

Users can list and revoke their own sessions. This is useful for "sign out everywhere" flows or auditing active devices.

```mermaid
sequenceDiagram
    actor User
    participant App
    participant DB

    User->>App: GET /api/me/sessions (accessToken)
    App->>DB: SELECT sessions WHERE userId = ? ORDER BY lastUsedAt DESC
    DB-->>App: [ { id, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt } ]
    App-->>User: 200 { sessions: [...] }

    User->>App: DELETE /api/me/sessions/:id (accessToken)
    App->>DB: Verify session.userId == requestingUserId
    App->>DB: DELETE session
    App-->>User: 200 { message: "Session revoked" }
```

Raw `refreshToken` hashes are never returned — only metadata.

---

## Database tables

### users

| Column | Type | Notes |
|---|---|---|
| id | text | UUIDv7, primary key |
| name | varchar(255) | From Google profile |
| email | varchar(255) | Unique, indexed |
| google_sub | varchar(255) | Google's user ID, unique, indexed |
| city | varchar(255) | Optional, user-editable |
| photo | varchar(500) | Optional, user-editable |
| gender | enum | `male`, `female`, `other`, user-editable |
| created_at | timestamp | Auto |
| updated_at | timestamp | Updated on every `PATCH /api/me` |

### sessions

| Column | Type | Notes |
|---|---|---|
| id | text | UUIDv7, primary key |
| user_id | text | FK → users.id, cascade delete, indexed |
| refresh_token | text | SHA-256 hash of the raw token |
| expires_at | timestamp | 30 days from creation, indexed |
| created_at | timestamp | Auto |
| last_used_at | timestamp | Updated on every token rotation |
| user_agent | varchar(500) | Browser/device info |
| ip_address | varchar(45) | First IP from x-forwarded-for; supports IPv6 |

One user can have multiple sessions (multiple devices). Max concurrent sessions is configurable via `MAX_SESSIONS_PER_USER` (default 5). Oldest sessions are pruned automatically when the cap is hit. Deleting a user cascades to all their sessions.

---

## Cookies

| Cookie | HttpOnly | Secure (prod) | SameSite | Max-Age |
|---|---|---|---|---|
| accessToken | yes | yes | Lax | 15 minutes |
| refreshToken | yes | yes | Lax | 30 days |

`Secure` is only set in production (`NODE_ENV=production`) so local dev over HTTP still works.

---

## Endpoints

### Auth

| Method | Path | Auth | Rate limit | What it does |
|---|---|---|---|---|
| GET | `/auth/google` | No | 20 / 15 min | Initiate Google OAuth |
| GET | `/auth/google/callback` | No | 20 / 15 min | Google redirects here after consent |
| POST | `/auth/refresh` | No | 30 / 15 min | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | No | 20 / 15 min | Delete session, clear cookies |

### User profile & sessions

| Method | Path | Auth | Body | What it does |
|---|---|---|---|---|
| GET | `/api/me` | Yes | — | Current user profile (googleSub excluded) |
| PATCH | `/api/me` | Yes | `{ name?, city?, photo?, gender? }` | Update profile fields |
| GET | `/api/me/sessions` | Yes | — | List all active sessions (no token hashes) |
| DELETE | `/api/me/sessions/:id` | Yes | — | Revoke a specific session by ID |

### System

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/health` | No | `{ status: "ok", timestamp }` |

---

## Token lifetimes

```mermaid
gantt
    title Token lifetimes
    dateFormat  X
    axisFormat  %s

    section Access Token
    Valid (15 minutes)     : 0, 900

    section Refresh Token
    Valid (30 days)    : 0, 2592000
```
