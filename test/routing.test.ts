import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLISH_ASSET_PATHS, RESERVED_EDS_PREFIXES } from "../src/paths";
import { decideRoute, InvalidConfigError, matchesPrefix, parseRouteRules } from "../src/routing";

describe("matchesPrefix with Route Rule /search", () => {
  it.each([
    ["/search", true],
    ["/search/", true],
    ["/search/images", true],
    ["/searching", false],
    ["/search.html", false],
    ["/Search", false],
  ])("%s → %s", (pathname, expected) => {
    expect(matchesPrefix(pathname, "/search")).toBe(expected);
  });
});

describe("decideRoute", () => {
  const rules = ["/search", "/maps"];

  it("sends Route Rule paths to Publish", () => {
    expect(decideRoute("/search/images", rules)).toEqual({ origin: "publish", reason: "route-rule", prefix: "/search" });
  });

  it("ignores the query string (the handler passes only the pathname)", () => {
    expect(decideRoute(new URL("https://x.dev/search?q=x").pathname, rules).origin).toBe("publish");
  });

  it.each(PUBLISH_ASSET_PATHS)("sends Publish Asset Path %s to Publish", (prefix) => {
    expect(decideRoute(`${prefix}/some/file.css`, rules)).toEqual({ origin: "publish", reason: "publish-asset", prefix });
  });

  it.each(["/", "/about", "/scripts/aem.js", "/nav.plain.html", "/robots.txt", "/searching", "/search.html"])(
    "sends %s to EDS",
    (pathname) => {
      expect(decideRoute(pathname, rules)).toEqual({ origin: "eds", reason: "default" });
    },
  );

  it("lets a Route Rule win over an EDS pattern under it", () => {
    expect(decideRoute("/search/nav.plain.html", rules).origin).toBe("publish");
  });

  it("allows a Route Rule broader than a Publish Asset Path", () => {
    expect(decideRoute("/content/site/en/page", ["/content"]).origin).toBe("publish");
  });
});

describe("parseRouteRules", () => {
  it("parses and strips trailing slashes", () => {
    expect(parseRouteRules('["/search/", "/maps"]')).toEqual(["/search", "/maps"]);
  });

  it.each(['"/search"', "not json", '[1]', '["search"]', '["/search*"]', '["/a?b"]'])("rejects malformed %s", (raw) => {
    expect(() => parseRouteRules(raw)).toThrow(InvalidConfigError);
  });

  it.each(["/", "//", "/scripts", "/scripts/", "/scripts/legacy", "/blocks/hero", "/fonts"])(
    "rejects Shadowing by %s",
    (rule) => {
      expect(() => parseRouteRules(JSON.stringify([rule]))).toThrow(/shadows Reserved EDS Path/);
    },
  );

  it.each(["/scripts-legacy", "/stylesheet", "/content"])("allows non-overlapping %s", (rule) => {
    expect(parseRouteRules(JSON.stringify([rule]))).toEqual([rule]);
  });

  it("accepts the ROUTE_RULES in wrangler.toml", () => {
    const toml = readFileSync(resolve(import.meta.dirname, "../wrangler.toml"), "utf8");
    const raw = toml.match(/^ROUTE_RULES\s*=\s*'(.*)'\s*$/m)?.[1];
    expect(raw).toBeDefined();
    expect(() => parseRouteRules(raw)).not.toThrow();
  });
});

describe("docs/asset-paths.md matches src/paths.ts", () => {
  const doc = readFileSync(resolve(import.meta.dirname, "../docs/asset-paths.md"), "utf8");

  /** First-column prefixes of the table under the given heading. */
  function tablePrefixes(heading: string): string[] {
    const section = doc.split(heading)[1]?.split(/\n#{2,3} /)[0] ?? "";
    return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
  }

  it("Publish Asset Paths", () => {
    expect(tablePrefixes("## Publish Asset Paths")).toEqual([...PUBLISH_ASSET_PATHS]);
  });

  it("Reserved EDS Path prefixes", () => {
    expect(tablePrefixes("### Prefixes")).toEqual([...RESERVED_EDS_PREFIXES]);
  });
});
