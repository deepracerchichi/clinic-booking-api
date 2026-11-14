CREATE TABLE slots (
  id        text PRIMARY KEY,
  provider  text NOT NULL,
  -- The original strings are returned verbatim; start_ts is the parsed value used for ordering and "already started".
  start_raw text NOT NULL,
  end_raw   text NOT NULL,
  start_ts  timestamptz NOT NULL
);
CREATE INDEX slots_order_idx ON slots (start_ts, id);

CREATE TABLE bookings (
  seq        bigserial NOT NULL UNIQUE, -- monotonic; drives stable cursor pagination
  id         text PRIMARY KEY,
  slot_id    text NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL,
  status     text NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- The double-booking guarantee lives in the database, not in application code:
-- a slot can have at most ONE confirmed booking, no matter how many requests race.
CREATE UNIQUE INDEX bookings_one_confirmed_per_slot ON bookings (slot_id) WHERE status = 'confirmed';
CREATE INDEX bookings_email_seq_idx ON bookings (email, seq);

CREATE TABLE idempotency_keys (
  key        text PRIMARY KEY,
  body_hash  text NOT NULL,
  status     integer NOT NULL,
  response   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE booking_attempts (
  id    bigserial PRIMARY KEY,
  email text NOT NULL,
  ts    timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX booking_attempts_email_ts_idx ON booking_attempts (email, ts);
