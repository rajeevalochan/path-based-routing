# EDS is the default Origin

The EDS Origin serves every request that no Publish Path claims. The Publish Origin serves only Route Rules and the built-in Publish Asset Paths. We chose this over the usual migration setup, where the old platform (Publish) is the default and sections move to EDS one at a time. EDS is meant to be the main site, so its root files (`/robots.txt`, `/sitemap.xml`, `/favicon.ico`) and its whole asset surface should work without being listed.

## Consequences

- Publish pages break unless every asset prefix they load is a Publish Asset Path. `docs/asset-paths.md` is the source of truth for that list.
- A broad Route Rule can silently take over EDS assets (Shadowing). The Worker refuses to start if a Route Rule claims a Reserved EDS Path prefix or `/`.
- Reversing this decision means inverting both lists: EDS would then need its own asset rules, and Publish would need none.
