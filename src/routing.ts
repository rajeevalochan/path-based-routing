import { PUBLISH_ASSET_PATHS, RESERVED_EDS_PREFIXES } from "./paths";

export type OriginName = "publish" | "eds";

export type RoutingDecision =
  | { origin: "publish"; reason: "publish-asset" | "route-rule"; prefix: string }
  | { origin: "eds"; reason: "default" };

/**
 * Segment-prefix match: `/a` matches `/a`, `/a/` and `/a/b`, but not `/ab` or `/a.html`.
 * Case-sensitive. `pathname` must not include the query string.
 */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname.startsWith("/");
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Publish Asset Paths first, then Route Rules, otherwise the EDS Origin. */
export function decideRoute(pathname: string, routeRules: readonly string[]): RoutingDecision {
  for (const prefix of PUBLISH_ASSET_PATHS) {
    if (matchesPrefix(pathname, prefix)) return { origin: "publish", reason: "publish-asset", prefix };
  }
  for (const prefix of routeRules) {
    if (matchesPrefix(pathname, prefix)) return { origin: "publish", reason: "route-rule", prefix };
  }
  return { origin: "eds", reason: "default" };
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidConfigError";
  }
}

/** Parses the ROUTE_RULES JSON and rejects malformed rules and Shadowing. */
export function parseRouteRules(raw: string | undefined): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "");
  } catch {
    throw new InvalidConfigError(`ROUTE_RULES must be a JSON array of strings, got: ${raw}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((r) => typeof r === "string")) {
    throw new InvalidConfigError(`ROUTE_RULES must be a JSON array of strings, got: ${raw}`);
  }

  return parsed.map((rule) => {
    if (!rule.startsWith("/")) throw new InvalidConfigError(`Route Rule must start with "/": ${rule}`);
    if (/[?#*]/.test(rule)) throw new InvalidConfigError(`Route Rule must be a plain path prefix: ${rule}`);
    const normalized = rule.length > 1 ? rule.replace(/\/+$/, "") || "/" : rule;

    const shadowed = RESERVED_EDS_PREFIXES.find(
      (reserved) =>
        normalized === reserved ||
        (reserved !== "/" && (matchesPrefix(normalized, reserved) || matchesPrefix(reserved, normalized))),
    );
    if (shadowed) {
      throw new InvalidConfigError(
        `Route Rule "${rule}" shadows Reserved EDS Path "${shadowed}" (see docs/asset-paths.md)`,
      );
    }
    return normalized;
  });
}
