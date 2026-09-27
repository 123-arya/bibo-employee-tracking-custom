# 147 — Web admin blanked by ad blockers: rename `ad-*` classes to `admin-*`

**Status:** Done

## Problem
EasyList-based blockers (uBlock, Brave, AdGuard…) have exact cosmetic rules for
`.ad-rail`, `.ad-panel`, `.ad-table`, `.ad-pagehead`, `.ad-link`, `.ad-notice` — all
web-admin classes. Hiding `.ad-rail` drops the sidebar out of the `.app` grid, so `<main>`
lands in the 76 px column: header clipped, page blank. Reported externally (Firefox).

## Fix
Mechanical rename `ad-` → `admin-` across `apps/web-admin/src` (TSX + `theme.css`,
comments included). No layout/style/copy changes. None of the new `admin-*` names match
an EasyList rule (checked against the live list).

## Verify
- `rg -n '\bad-' apps/web-admin/src` → nothing
- `tsc --noEmit` + `vite build` pass
