# Clinic Booking API

A booking API for a clinic (list slots, book, cancel, look up and page through bookings) plus a small web page that uses it. Built for the Koya Cohort 4 assessment, Task 1; implements the contract at `koyaacademy.com/assessment-api` through level 5.

**Stack:** Node 22, Express, TypeScript, PostgreSQL (Neon), deployed on Render. Validation with Zod. Tests with Vitest + Supertest against a real database. Web page: React, Vite, TypeScript, Tailwind CSS.

## Endpoints

All requests need an `X-API-Key` header (except `/health` and the web page at `/`). Errors are always `{ "error": "<message>" }`.

| Method | Path | Level | Notes |
| --- | --- | --- | --- |
| POST | `/reset` | 1 | Replaces all slots, deletes all bookings |
| GET | `/slots?provider=` | 1 | Earliest first, with `available` |
| POST | `/bookings` | 1-5 | 201 / 400 / 404 / 409 / 422 / 429 |
| GET | `/bookings/:id` | 1 | 200 / 404 |
| DELETE | `/bookings/:id` | 3 | 200 / 404 / 409 |
| GET | `/bookings?email=&limit=&cursor=` | 4 | Cursor pagination, oldest first |

## Structure

```
src/
  server.ts        start-up: migrate, seed, listen, graceful shutdown
  app.ts           builds the Express app (no listening, so tests can import it)
  config.ts        reads and validates environment variables once
  routes/          HTTP only: parse input, call a service, send the result
  services/        business rules and transactions (bookingService is the heart)
  repositories/    all SQL, one file per table concern
  middleware/      API-key auth, async wrapper, error handler
  validation/      Zod schemas
  db/              connection pool, transaction helper, migration runner
migrations/        versioned .sql files, applied once each on start-up
web/               the web page: React + Vite + TypeScript + Tailwind
  src/components/  SlotPicker, BookingForm, Confirmation, ApiKeyInput
  src/hooks/       useSlots (loading/refresh), useApiKey
  src/lib/api.ts   typed API client; ApiError carries status and Retry-After
test/              integration tests, one describe block per level
```

`npm run build` builds the web app into `web/dist`, then compiles the API. Express serves `web/dist` at `/`, so the page and the API share one URL and need no CORS.

Routes never touch SQL and repositories never know about HTTP, so each layer can be read (and changed) on its own.

## Two big decisions

### 1. The database enforces "no double booking", not the application

Checking "is this slot free?" and then inserting is a race: two requests can both see it free. Instead the schema has a partial unique index:

```sql
CREATE UNIQUE INDEX bookings_one_confirmed_per_slot ON bookings (slot_id) WHERE status = 'confirmed';
```

and the insert is `INSERT ... ON CONFLICT DO NOTHING`. When 25 requests arrive at once for one slot, Postgres lets exactly one row in; the others get no row back and the API answers 409. Cancelling flips the row to `cancelled`, which leaves the index, so the slot is free again and can be rebooked. This holds across multiple server instances and restarts, which an in-memory lock would not.

### 2. Idempotency and rate limiting live in Postgres too

Keeping state in the process (a Map, an in-memory counter) breaks the moment Render restarts or scales the service. So:

- **Idempotency:** the response for each `Idempotency-Key` is stored with a hash of the request body. Same key + same body replays the stored status and body (same booking id); same key + different body returns 422. A per-key advisory lock makes a *simultaneous* retry wait for the first request to finish, then replay it, rather than racing it.
- **Rate limit:** every booking attempt for a valid email is recorded, and the 6th within 60 seconds gets 429 with a `Retry-After` computed from when the oldest attempt expires. A per-email advisory lock stops concurrent requests slipping past the count. The attempt row is written in the same transaction as the booking, and expected failures (404, 409...) are returned as results rather than thrown, so they commit and still count ("failed attempts included").

## Behaviours worth knowing

- Check order in `POST /bookings`: replay stored idempotent response, valid email (the limiter needs it), rate limit, other fields, slot exists (404), slot not started (400), atomic insert (409).
- A replayed request is not counted as a new attempt, and a 429 is never stored against an idempotency key, so the client can retry the same key after waiting.
- Bookings list includes cancelled bookings (with `status`), matched case-insensitively, ordered by an internal monotonic sequence so pages stay stable while new bookings arrive.
- The web page is public but asks the visitor for the API key (kept in their browser); it never ships the key in its source. It sends an `Idempotency-Key` per logical submit (same slot and details) so a double-click or a retry after a network error cannot book twice.
- On a fresh database the app seeds 7 days of demo slots; `/reset` replaces them.

## Run locally

```bash
cp .env.example .env     # set API_KEY and DATABASE_URL
npm install && npm --prefix web install
npm run dev              # API on :3000; migrations run automatically on start-up
npm --prefix web run dev # web page on :5173, proxying API calls to :3000
```

## Tests

Tests run against a real Postgres (the concurrency guarantees are the point, so mocks would prove nothing). **They wipe the database**, so point `TEST_DATABASE_URL` at a throwaway one.

```bash
TEST_DATABASE_URL=postgres://... npm test
```

## Deploy

1. Create a Neon project and copy its connection string.
2. On Render, create a Web Service from this repo (`render.yaml` is included). Set `DATABASE_URL` to the Neon string and `API_KEY` to a long random value.
3. The web page is served from the same URL as the API.

## What I would do next

- Run the free-tier cold start problem down with a keep-alive or a paid instance.
- Expire old idempotency keys and rate-limit rows with a scheduled job (rate rows are already pruned per email on use).
- Per-IP limiting in addition to per-email, and structured request logging with request ids.
- Add component and end-to-end tests for the web page.
