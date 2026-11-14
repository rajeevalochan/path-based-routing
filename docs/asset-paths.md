# Asset paths: AEM Publish and EDS

This is the source of truth for which supporting-file paths each Origin needs, so no page loses its images, CSS, JS or fonts. Terms are defined in [`GLOSSARY.md`](../GLOSSARY.md). Background: [ADR 0001](adr/0001-eds-is-the-default-origin.md).

The code must match this file exactly:

- Publish Asset Paths → `PUBLISH_ASSET_PATHS` in `src/paths.ts`
- Reserved EDS Path prefixes → `RESERVED_EDS_PREFIXES` in `src/paths.ts`

## How a request is routed

1. If the path matches a **Publish Asset Path**, it goes to the Publish Origin.
2. Otherwise, if it matches a **Route Rule**, it goes to the Publish Origin.
3. Otherwise it goes to the **EDS Origin**.

A prefix matches whole path segments, case-sensitively, ignoring the query string. A prefix `/a` matches `/a`, `/a/` and `/a/b`, but not `/ab` or `/a.html`.

## Publish Asset Paths (built in, always go to Publish)

EDS is the default, so Publish pages break unless every prefix they load assets from is listed here.

| Prefix | What lives there |
| --- | --- |
| `/etc.clientlibs` | Client libraries: CSS, JS, fonts, and icons/favicons packaged in clientlibs |
| `/content/dam` | DAM assets: images, PDFs, videos, downloads |
| `/libs` | Product resources, for example core component scripts and styles |
| `/content/experience-fragments` | Experience Fragments loaded on the client side |
| `/adobe/dynamicmedia/deliver` | Dynamic Media with OpenAPI image and video delivery |

### Covered without an entry

- **Image renditions under a page**, such as `/content/site/en/page/_jcr_content/root/image.coreimg.jpeg/123/photo.jpeg`, sit under the page's own path. They go wherever that page goes (its Route Rule).
- **Pages with `.html`**: `/search.html` is **not** matched by the Route Rule `/search`. If a Publish section serves `.html` URLs at its top level, add them as their own Route Rule.

### Watch for

- Assets referenced from **another host**, such as Scene7 (`*.scene7.com`) or a separate DAM CDN, don't pass through the Worker and need no rule.
- A custom project path such as `/etc/designs` (legacy) or `/conf/...` needs a new entry here first, then in code.

## Reserved EDS Paths (EDS must keep these)

EDS already gets these, because it's the default. They're listed so no Route Rule takes them over (**Shadowing**).

### Prefixes (checked: a Route Rule that overlaps one stops the Worker)

| Prefix | What lives there |
| --- | --- |
| `/` | The site root. A Route Rule of `/` would send everything to Publish. |
| `/scripts` | `aem.js`, `scripts.js`, `delayed.js` |
| `/styles` | `styles.css`, `fonts.css`, `lazy-styles.css` |
| `/blocks` | Block JS and CSS (`/blocks/<name>/<name>.js`) |
| `/icons` | SVG icons used through `:icon:` notation |
| `/fonts` | Web fonts |
| `/fragments` | Shared content fragments |

"Overlap" works in both directions. `/scripts` and `/scripts/legacy` both count as Shadowing.

### Patterns (documented only, not checked)

These appear at the end of a URL or at the root, so a prefix check can't catch them. Under a Route Rule, the Route Rule wins: a Publish section never contains EDS fragments.

| Pattern | What it is |
| --- | --- |
| `/nav.plain.html`, `/footer.plain.html`, `*.plain.html` | Header, footer and fragment markup |
| `media_<hash>.<ext>` next to a page, such as `/blog/media_1a2b.jpg?width=750` | Images uploaded with the page's content |
| `/placeholders.json`, `/query-index.json`, `/metadata.json`, `*.json` spreadsheets | Indexes and spreadsheet-backed data |
| `/robots.txt`, `/sitemap.xml`, `/sitemap-index.xml`, `/favicon.ico`, `/manifest.json` | Root-level site files, served by EDS by design |

## Checklist when adding a Route Rule

1. Make sure it doesn't overlap a Reserved EDS Path prefix (the Worker and the tests enforce this).
2. Open a page in that section and confirm every asset request in DevTools comes back with `X-Routed-Origin: publish`.
3. If an asset loads from a prefix not listed above, add it to this document and to `PUBLISH_ASSET_PATHS`.
