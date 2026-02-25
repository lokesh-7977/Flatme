# Authentication

This app uses Google OAuth for login. There's no username/password — users sign in with their Google account and we issue our own JWTs from there.

---

## How it works at a high level

When someone logs in, we give them two tokens:

- **Access token** — short-lived (1 hour), used on every API request
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
    Google-->>App: { id, name, email }
    App->>DB: Find user by googleSub
    alt New user
        DB-->>App: Not found
        App->>DB: Insert new user
    else Existing user
        DB-->>App: Return user
    end
    App->>App: Generate sessionId (uuidv7)
    App->>App: Sign accessToken + refreshToken in parallel
    App->>DB: Insert session row
    App-->>User: Set accessToken cookie (1h) + refreshToken cookie (30d)
    App-->>User: Redirect to /
```

---

## Refreshing the access token

The access token expires after 1 hour. When that happens, the client calls `POST /auth/refresh`. The refresh token gets rotated on every call — the old one is thrown away and a new one is issued.

```mermaid
sequenceDiagram
    actor Client
    participant App
    participant DB

    Client->>App: POST /auth/refresh (refreshToken cookie)
    App->>App: Verify JWT signature + expiry
    App->>App: Sign new accessToken + refreshToken in parallel
    App->>DB: UPDATE session SET refreshToken = new WHERE id = ? AND refreshToken = old
    alt Row updated (token was valid)
        DB-->>App: Updated session
        App-->>Client: Set new accessToken cookie + new refreshToken cookie
    else Row not updated (token already used)
        DB-->>App: 0 rows
        App->>DB: Delete ALL sessions for this user
        App-->>Client: 401 Token reuse detected
    end
```

### Why rotate the refresh token?

If someone steals a refresh token and uses it, the next time the real user tries to refresh, the old token won't match what's in the DB. We detect that and kill every session for that account.

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

## Database tables

### users

| Column | Type | Notes |
|---|---|---|
| id | text | UUIDv7, primary key |
| name | varchar(255) | From Google profile |
| email | varchar(255) | Unique |
| google_sub | varchar(255) | Google's user ID, unique |
| city | varchar(255) | Optional |
| photo | varchar(500) | Optional |
| gender | enum | `male`, `female`, `other` |
| created_at | timestamp | Auto |
| updated_at | timestamp | Auto |

### sessions

| Column | Type | Notes |
|---|---|---|
| id | text | UUIDv7, primary key |
| user_id | text | FK → users.id, cascade delete |
| refresh_token | text | Rotated on every refresh |
| expires_at | timestamp | 30 days from creation |
| last_used_at | timestamp | Updated on every refresh |
| user_agent | varchar(500) | Browser/device info |
| ip_address | varchar(45) | Supports IPv6 |

One user can have multiple sessions (multiple devices). Deleting a user cascades to all their sessions.

---

## Cookies

| Cookie | HttpOnly | Secure (prod) | SameSite | Max-Age |
|---|---|---|---|---|
| accessToken | yes | yes | Lax | 1 hour |
| refreshToken | yes | yes | Lax | 30 days |

`Secure` is only set in production (`NODE_ENV=production`) so local dev over HTTP still works.

---

## Endpoints

| Method | Path | Auth required | What it does |
|---|---|---|---|
| GET | /auth/google | No | Kicks off Google OAuth |
| GET | /auth/google/callback | No | Google redirects here after consent |
| POST | /auth/refresh | No | Rotates refresh token, issues new access token |
| POST | /auth/logout | No | Deletes session, clears cookies |
| GET | /api/me | Yes | Returns current user (no googleSub) |

---

## Token lifetimes

```mermaid
gantt
    title Token lifetimes
    dateFormat  X
    axisFormat  %s

    section Access Token
    Valid (1 hour)     : 0, 3600

    section Refresh Token
    Valid (30 days)    : 0, 2592000
```
