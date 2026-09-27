# 144 — bibotracking 4xx/5xx alerts to Telegram (`bibomon watch`)

**Date:** 2026-09-27 · **Status: Done** (deployed 2026-09-27)

## Why

The 140 bibomon stack (agent → mac server → dashboard) was torn down from both boxes on
2026-09-27 for a rework, leaving prod with no alerting. This is the first piece back: a
Telegram alert when bibotracking's error responses spike.

## Design

- New mode `bibomon watch` in `apps/monitor` (`internal/watch`), runs **only on Oracle** as
  systemd `bibomon-watch` (user `opc`, in `systemd-journal`). No mac server, no SSH tunnel,
  no listening port — Telegram is called outbound from the box.
- Every `interval_secs` (60) it reads the last `window_mins` (5) of the unit's journal,
  parses gin access lines (reuses `internal/parse`) and counts 4xx and 5xx separately.
- Per class: 🔥 when count ≥ threshold (with top status/method/path lines), re-sent at most
  every `repeat_mins` (30) while still over, ✅ once back under. A failed journal read skips
  the tick (never auto-resolves). A 👀 message is sent on start = Telegram self-test.
- Config: template `apps/monitor/config/watch.example.toml`, real file
  `/opt/bibomon/watch.toml` (holds the bot token, mode 600).

## Thresholds

Baseline from `backend.log` 2026-09-18..27, per 5-minute window:

| | median | p99 | max | threshold |
|---|---|---|---|---|
| 4xx | 6 | 19 | 73 | **100** |
| 5xx | 0 | 2 | 4 | **10** |

4xx is ~85% `401 /v1/sync/batch` (normal token-expiry → refresh). Neither threshold was
reached in those 9 days.

Also seen (not fixed here): ~100/day `500 /v1/sync/batch` and ~2.6k `400 /v1/sync/screenshots`
in the 9 days — worth a separate investigation.

## Verified locally

- `go vet`, `go test ./...` (counting + fire/repeat/resolve state machine), `go build`.
- End-to-end with a fake `journalctl` spike: 👀 → one 🔥 (repeat suppressed) with top paths
  → ✅.
- End-to-end against the **real local backend** (throwaway DB, :8099, fake `journalctl`
  replaying its real gin output by window; test thresholds 4xx≥20 / 5xx≥5, 1m window):
  30× unauthenticated `/v1/sync/batch` → 🔥 4xx (`30× 401 POST /v1/sync/batch`) → ✅ after
  the window cleared; DB dropped under the running backend + 12× `/v1/businesses/mine` →
  🔥 5xx (`12× 500 GET /v1/businesses/mine`) → ✅. Real query checked read-only on Oracle as `opc`: `journalctl -u bibotracking --since
  -5min -o cat` exits 0.

- Real Telegram: same local run with the @biboinfra_bot token → 👀, 🔥 4xx, 🔥 5xx, ✅, ✅
  delivered (no send errors).

## Deploy (done 2026-09-27)

`TG_TOKEN=<token> deploy/deploy-watch.sh` (first deploy only needs `TG_TOKEN`; later runs keep
`/opt/bibomon/watch.toml`). Prod: `bibomon-watch` active + enabled, 👀 sent from
`[oracle-a1]`, first journal read clean. Bot token: BotFather → /mybots → @biboinfra_bot →
API Token (it lives only in `/opt/bibomon/watch.toml` on the box).

```bash
ssh oracle 'journalctl -u bibomon-watch -f'          # alerts + errors
ssh oracle 'sudo systemctl restart bibomon-watch'   # after editing thresholds in watch.toml
```
