# 145 — In-app messages: What's new, announcements, surveys, promos (+ super-admin area)

**Date:** 2026-09-27 · **Status: Implemented (not deployed)**

## What

- **Desktop popup**, checked on launch and whenever the window comes to the front:
  - **What's new** — bundled per version (`apps/desktop/src/messages/whatsNew.ts`), shown
    once on the first launch after an update. Works offline / in personal mode; a fresh
    install shows nothing. Add an entry per release (7 locales).
  - **Announcement / survey / promo** — managed in web-admin, stored in the DB.
- **Web-admin "Messages" menu** (super admins only): create / edit / activate / pause /
  delete messages with a live preview, and per-message analytics + survey results with
  CSV export.

## Super admins

`SUPER_ADMINS` (comma-separated usernames or emails) on the backend. Prod: add
`SUPER_ADMINS=ngnclht` to `/opt/bibotracking/.env`. Unset = nobody. The backend enforces it
on every `/v1/admin/*` route (403 otherwise); `/v1/me` and the login `user` carry
`is_super_admin`, which shows the menu (web-admin refreshes `/me` on load, so existing
sessions pick it up).

## Display rules (desktop)

- Checked on launch and **every time the window comes to the front** — incl. reopening
  from the tray/Dock (Rust emits `app-focused` on `WindowEvent::Focused`; the webview's
  DOM focus event doesn't fire there). Server fetch at most every 30 s. One popup on
  screen at a time, **at most one backend popup per hour** (What's new exempt); each
  message's own rules decide repeats. Seen/dismissed state is **per signed-in user**
  (`bibo.messages:<user>` in localStorage), so users sharing a machine don't mix.
- Priority: What's new → announcement → survey → promo.
- `repeat_days: 0` = once; `N` = after ✕ / button, again in N days. "Remind me later" =
  tomorrow. A submitted survey never shows again.
- **Promos: owners only, never anyone in a family workspace** — enforced server-side.
- Surveys are **anonymous by default**; a named survey is answered once per user.
  Anonymous answers are stored **to the day only**, and their `submitted` event gets a
  random actor instead of the user's pseudonym — so an answer can't be matched to a
  user by timestamp or by their other events.
- Answers are accepted only if the survey is **eligible for that user** (active, in its
  dates, audience match) — same check as the message list.
- Once a survey has answers it can be reworded / translated / paused, but its type,
  question ids, question types and option values are **locked** (409; the editor
  disables them). Create a new survey to restructure.
- Only messages switched **Active** and within start/end are offered.
- Content is structured data rendered as plain text — never remote HTML/JS; image and
  button links must be `https://`, the button opens the browser.

- Paused messages show a banner with a one-click **Activate**; the list has
  Activate/Pause toggles. (CORS now allows `PUT` for cross-origin web-admin builds.)

## Analytics

Events per message: `delivered` (offered by the API, once per user per day), `shown`,
`dismissed`, `later`, `cta`, `submitted`; What's new reports as `whatsnew-<version>`.
Stored in `message_events` with a **per-message pseudonym** (HMAC of user + message,
keyed by `JWT_SECRET`) — unique users are countable, but nobody is identifiable or
linkable across messages, so anonymous surveys stay anonymous. Also sent to Aptabase.

The stats page shows unique users + total events, click rate (cta ÷ viewed), completion
(submitted ÷ viewed), the last 60 days, breakdowns by language / platform / app version /
role, and for surveys: per-option share, star average, NPS (% 9–10 − % 0–6) with the full
0–10 distribution, free-text answers, and CSV export.

## API

- Desktop: `GET /v1/messages?platform&version&locale`, `POST /v1/messages/:id/response`,
  `POST /v1/messages/:id/events`.
- Super admin: `GET/POST /v1/admin/messages`, `GET/PUT/DELETE /v1/admin/messages/:id`,
  `GET /v1/admin/messages/:id/stats`.
- Migration `00011_messages.sql`: `messages`, `message_responses`, `message_events`.

## Verified 2026-09-27

- Go tests: targeting (roles, kinds, platform, locale, version range, dates, active flag,
  promo gate), validation (ids, https, button label+link, survey questions/options, dates),
  answer validation, locale fallback, super-admin matching, survey summary / NPS math.
  `go vet`, `cargo check`, desktop + web-admin `tsc` and `vite build` pass.
- End-to-end, real backend + isolated Postgres + web-admin in a browser:
  - `ngnclht` sees the Messages menu; a normal owner doesn't, `/internal/messages` sends
    them home, and `/v1/admin/*` returns 403.
  - Survey (radio + NPS + long text, EN + VI) and promo created through the UI; an
    `http://` link is rejected with the server's message.
  - Real users: owner offered survey + promo, employees survey only; delivered counted
    once per user per day; bad event → 400, unknown message → 404.
  - Stats: delivered 4, viewed 4 (5 events), submitted 2 = 50%, NPS 0 from a 10 and a 6,
    avg 8.0; promo 100% click rate; breakdowns by platform/role; CSV has the answers and
    no user ids (anonymous). Light + dark mode checked.
- Desktop popup (earlier, same branch): What's new after an update, daily cap, survey
  submit → stored, promo button opens the browser.

## Notes

- **Migration number:** this is `00011_messages.sql`; `00010` stays with WIP PR #26
  (ticket 143, already applied on the local dev DB). **Ship #26 first** (or together). If
  this ships alone first, prod jumps 9 → 11 and #26's `00010` must then be renumbered to
  `00012`, or goose refuses the out-of-order migration and the backend won't start.
- Local dev: add `SUPER_ADMINS=ngnclht` to `apps/backend/.env` and restart the backend.
- Local testing gotcha: Postgres.app holds connections from unknown programs behind an
  "allow app" dialog (trust auth); tests used a separate password-auth Postgres instead.
