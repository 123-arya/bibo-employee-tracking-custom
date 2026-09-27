# 146 — Remove unauthenticated `GET /v1/public/businesses` (security)

**Status:** Done

## Problem
`GET /v1/public/businesses` returned every business on the hosted service with its
UUID, name and owner display name — no auth. Anyone could enumerate all workspaces and
their owners (reported externally).

## Fix
The endpoint only existed for the old desktop "find your company" login picker, which
was removed in 1.0.0; login resolves the business from membership server-side. Nothing
calls it any more, so it's deleted outright (now 404):
- backend: route, `AuthHandler.PublicBusinesses`, `Store.ListPublicBusinesses`
- desktop: `list_businesses` Tauri command + `BackendClient::list_businesses`
- web-admin: unused `listPublicBusinesses` + `PublicBusiness` type
- docs/11-backend-and-sync.md API list

`POST /v1/auth/login` still accepts an optional `business_id` (membership-checked).

## Verify
`curl -i https://bibotracker.com/v1/public/businesses` → 404 after deploy.
