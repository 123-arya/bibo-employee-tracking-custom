-- +goose Up
-- In-app messages (ticket 145): announcements / surveys / promos shown as a popup
-- in the desktop app, managed by super admins in web-admin. Content is structured
-- JSON (per-locale text, survey fields) — never HTML.
CREATE TABLE messages (
    id          text PRIMARY KEY,
    kind        text NOT NULL CHECK (kind IN ('announcement','survey','promo')),
    active      boolean NOT NULL DEFAULT false,
    start_at    timestamptz,
    end_at      timestamptz,
    audience    jsonb NOT NULL DEFAULT '{}',
    repeat_days integer NOT NULL DEFAULT 0,
    anonymous   boolean NOT NULL DEFAULT true,
    content     jsonb NOT NULL,
    fields      jsonb NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Survey answers. user_id is NULL for anonymous surveys (the default); a named
-- user answers a survey once.
CREATE TABLE message_responses (
    id          bigserial PRIMARY KEY,
    message_id  text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    answers     jsonb NOT NULL,
    app_version text NOT NULL DEFAULT '',
    platform    text NOT NULL DEFAULT '',
    locale      text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_responses_message_idx ON message_responses (message_id);
CREATE UNIQUE INDEX message_responses_user_once ON message_responses (message_id, user_id)
    WHERE user_id IS NOT NULL;

-- Popup analytics. actor is a per-message pseudonym (HMAC of user + message), so
-- unique users can be counted without identifying anyone or linking them across
-- messages. message_id also covers the bundled "whatsnew-<version>" (no FK).
-- 'delivered' (offered by the API) is recorded once per actor per day.
CREATE TABLE message_events (
    id          bigserial PRIMARY KEY,
    message_id  text NOT NULL,
    event       text NOT NULL CHECK (event IN ('delivered','shown','dismissed','later','cta','submitted')),
    actor       text NOT NULL,
    role        text NOT NULL DEFAULT '',
    platform    text NOT NULL DEFAULT '',
    locale      text NOT NULL DEFAULT '',
    app_version text NOT NULL DEFAULT '',
    day         date NOT NULL DEFAULT CURRENT_DATE,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_events_message_idx ON message_events (message_id, created_at);
CREATE UNIQUE INDEX message_events_delivered_daily ON message_events (message_id, actor, day)
    WHERE event = 'delivered';

-- +goose Down
DROP TABLE message_events;
DROP TABLE message_responses;
DROP TABLE messages;
