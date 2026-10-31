-- Runs on YugabyteDB (YSQL) and plain PostgreSQL.

CREATE TABLE IF NOT EXISTS donors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  phone                 TEXT NOT NULL UNIQUE,
  blood_group           TEXT NOT NULL CHECK (blood_group IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  sex                   TEXT NOT NULL CHECK (sex IN ('male','female','other')),
  date_of_birth         DATE NOT NULL,
  weight_kg             INT  NOT NULL,
  area                  TEXT NOT NULL,
  lat                   DOUBLE PRECISION NOT NULL,
  lng                   DOUBLE PRECISION NOT NULL,
  last_donated_on       DATE,
  available             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Set by the donor's first inbound WhatsApp message. Nobody is alerted without it,
  -- because WhatsApp requires opt-in and the number has to be theirs.
  whatsapp_verified_at  TIMESTAMPTZ,
  -- Seed data only. Simulated donors are never sent real messages.
  simulated             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donors_group_lat_idx ON donors (blood_group, lat);

CREATE TABLE IF NOT EXISTS requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_group     TEXT NOT NULL CHECK (blood_group IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  units_needed    INT  NOT NULL CHECK (units_needed BETWEEN 1 AND 10),
  hospital        TEXT NOT NULL,
  area            TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  contact_name    TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  raw_text        TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','cancelled')),
  accepted_count  INT  NOT NULL DEFAULT 0,
  current_wave    INT  NOT NULL DEFAULT 0,
  radius_index    INT  NOT NULL DEFAULT 0,
  wave_started_at TIMESTAMPTZ,
  -- Set once a wave's alerts are all recorded. See advanceRequest.
  wave_launched_at TIMESTAMPTZ,
  -- Every ring has been tried. The request stays open so a late YES still counts.
  exhausted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_contact_phone_idx ON requests (contact_phone, status);

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  donor_id      UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  wave          INT  NOT NULL,
  distance_km   DOUBLE PRECISION NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','declined','closed','failed')),
  reply_text    TEXT,
  donated_on    DATE,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  UNIQUE (request_id, donor_id)
);

CREATE INDEX IF NOT EXISTS notifications_donor_idx ON notifications (donor_id, status);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  message     TEXT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS events_request_idx ON events (request_id, at);

CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('in','out')),
  body         TEXT NOT NULL,
  status       TEXT NOT NULL,
  request_id   UUID REFERENCES requests(id) ON DELETE CASCADE,
  provider_sid TEXT,
  error        TEXT,
  simulated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS messages_phone_idx ON messages (phone, created_at);
CREATE INDEX IF NOT EXISTS messages_provider_sid_idx ON messages (provider_sid);
