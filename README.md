# path-based-routing

A proof-of-concept Cloudflare Worker that serves one public site from two Adobe platforms. Requests matching a **Publish Path** are proxied to the **Publish Origin** (AEM Publish). Everything else goes to the **EDS Origin** (AEM Edge Delivery Services).

- Vocabulary: [`GLOSSARY.md`](GLOSSARY.md)
- Which asset paths go where: [`docs/asset-paths.md`](docs/asset-paths.md)
- Why EDS is the default: [`docs/adr/0001-eds-is-the-default-origin.md`](docs/adr/0001-eds-is-the-default-origin.md)

For the POC, `www.google.com` stands in for AEM Publish and `www.instagram.com` stands in for EDS. Their pages render partly broken behind the Worker, which is expected. Check routing with the response headers instead.

## Usage

```sh
npm install
npm test             # matcher, Shadowing guard, docs/code sync, handler
npm run typecheck
npm run dev          # http://localhost:8787
npm run deploy       # publishes to <name>.<account>.workers.dev
```

```sh
curl -sI localhost:8787/search?q=cats | grep -i x-routed
# X-Routed-By: route-rule:/search
# X-Routed-Origin: publish
```

## Configuration (`wrangler.toml` → `[vars]`)

| Variable | Meaning |
| --- | --- |
| `ROUTE_RULES` | JSON array of Route Rule prefixes, such as `'["/search", "/maps"]'` |
| `PUBLISH_ORIGIN` | Publish Origin base URL |
| `EDS_ORIGIN` | EDS Origin base URL |
| `AEM_EDGE_KEY` (secret, optional) | Sent as `X-AEM-Edge-Key` to Publish only: `npx wrangler secret put AEM_EDGE_KEY` |

If a Route Rule claims a Reserved EDS Path prefix, the Worker returns `500` for every request and `npm test` fails.

## Behaviour

- Proxies requests and never redirects. Path, query, method, body and cookies pass through unchanged.
- Sets `X-Forwarded-Host` to the Public Host.
- Rewrites `Location` headers that point at either Origin to the Public Host. Other hosts are left alone.
- Adds `X-Routed-Origin` (`publish` | `eds`) and `X-Routed-By` (`route-rule:<prefix>` | `publish-asset:<prefix>` | `default`).
- Passes Origin errors through, with no fallback. Uses Cloudflare's default caching.

## Not yet (out of scope for the POC)

- Rewriting the `Set-Cookie` domain
- Rewriting links inside HTML bodies
- Custom caching
- Custom domains and routes
- Failover between Origins
