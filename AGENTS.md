# AGENTS.md

## Purpose
This repository contains `@elliott-w/payload-plugin-switch-env`. Use this file as the minimal orientation guide for where to change code safely.

## Repo Layout
- `src/`: plugin source (edit here).
- `dist/`: generated build output (do not edit).
- `dev/`: local demo app for end-to-end checks.
- `README.md`: public behavior/config documentation.

## Start Here
- `src/plugin.ts`: plugin wiring, registration, and startup behavior.
- `src/lib/collectionConfig.ts`: upload collection transforms, hook toggling, provider/local-storage behavior.
- `src/lib/api-endpoints/switch.ts`: runtime environment switch flow.
- `src/lib/db/*`: adapter and DB connection/copy helpers.
- `src/lib/thumbnailUrl.ts` and `src/lib/handlers.ts`: file URL/read-time and handler behavior.

## Compatibility Notes
- Plugin order matters: storage plugin should run before this plugin.
- Payload hook behavior differs across versions.
- Payload `>= 3.70.0` changed cloud upload hook timing (`beforeChange` vs `afterChange`), so version-aware logic is required.

## Useful Commands
- Build: `pnpm build`
- Run demo app: `pnpm -C dev dev`
- Search code: `rg -n "<term>" src dev`

## Guardrails
- Do not edit `dist/` directly.
- Keep source changes minimal and localized.
