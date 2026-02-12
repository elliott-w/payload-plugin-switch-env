# Slug Conflict Summary (Payload + Mongo Versions)

## Context

This summarizes an edge case where a collection and a global share the same `slug` while versions are enabled, and how that affects this plugin.

## What we found

1. Payload config sanitization enforces duplicate checks for collection slugs, but does not appear to enforce cross-type uniqueness between collection slugs and global slugs.
2. Payload API routing separates collections and globals (`/api/:collection` vs `/api/globals/:global`), so route resolution itself is namespaced.
3. In the Mongo adapter, version models for both collections and globals are stored in a shared `versions` map keyed only by slug.
4. Mongo version collection/model naming for both types follows the same pattern: `_<dbNameOrSlug>_versions`.

## Why this is a problem

If a collection and a global use the same slug and both have versions enabled:

1. One version model can overwrite/collide with the other in the shared slug-keyed map.
2. Version collection/model names can collide at the database/model layer.
3. Version reads/writes and any plugin logic that depends on version model resolution can become ambiguous or incorrect.

## Is this a plugin issue?

Not primarily. This appears to be an upstream Payload + Mongo edge case.  
However, the plugin can and should guard against it to avoid confusing behavior.

## Recommended plugin safeguards

1. Fail fast on startup if the same slug exists in both a collection and a global and both have versions enabled.
2. Detect duplicate resolved version collection names and block ambiguous configurations.
3. Prefer config-derived version collection naming over relying solely on `payload.db.versions[slug]`.
4. If a collision is detected and hard-failing is not desired, fall back to a conservative copy behavior and emit a strong warning.

## Practical recommendation

Treat shared collection/global slugs with versions enabled as unsupported for Mongo-backed projects until upstream behavior is clarified or fixed.
