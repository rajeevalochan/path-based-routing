import { decideRoute, InvalidConfigError, parseRouteRules, type OriginName } from "./routing";

export interface Env {
  ROUTE_RULES: string;
  PUBLISH_ORIGIN: string;
  EDS_ORIGIN: string;
  /** Optional secret, sent only to the Publish Origin. Set with `wrangler secret put AEM_EDGE_KEY`. */
  AEM_EDGE_KEY?: string;
}

interface Config {
  routeRules: string[];
  origins: Record<OriginName, URL>;
}

let cached: { key: string; config: Config } | undefined;

function loadConfig(env: Env): Config {
  const key = `${env.ROUTE_RULES}|${env.PUBLISH_ORIGIN}|${env.EDS_ORIGIN}`;
  if (cached?.key === key) return cached.config;
  const config: Config = {
    routeRules: parseRouteRules(env.ROUTE_RULES),
    origins: { publish: parseOrigin("PUBLISH_ORIGIN", env.PUBLISH_ORIGIN), eds: parseOrigin("EDS_ORIGIN", env.EDS_ORIGIN) },
  };
  cached = { key, config };
  return config;
}

function parseOrigin(name: string, value: string | undefined): URL {
  try {
    return new URL(value ?? "");
  } catch {
    throw new InvalidConfigError(`${name} must be an absolute URL, got: ${value}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let config: Config;
    try {
      config = loadConfig(env);
    } catch (err) {
      // Fail loudly: a bad config must never route traffic.
      const message = err instanceof Error ? err.message : String(err);
      return new Response(`Invalid routing configuration: ${message}\n`, { status: 500 });
    }

    const publicUrl = new URL(request.url);
    const decision = decideRoute(publicUrl.pathname, config.routeRules);
    const origin = config.origins[decision.origin];

    const upstreamUrl = new URL(publicUrl.pathname + publicUrl.search, origin);
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", publicUrl.host);
    if (decision.origin === "publish" && env.AEM_EDGE_KEY) {
      headers.set("X-AEM-Edge-Key", env.AEM_EDGE_KEY);
    }

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    const response = new Response(upstream.body, upstream);
    rewriteLocation(response, upstreamUrl, publicUrl, Object.values(config.origins));
    response.headers.set("X-Routed-Origin", decision.origin);
    response.headers.set("X-Routed-By", decision.origin === "eds" ? "default" : `${decision.reason}:${decision.prefix}`);
    return response;
  },
} satisfies ExportedHandler<Env>;

/** Keeps visitors on the Public Host when an Origin redirects to its own hostname. */
export function rewriteLocation(response: Response, upstreamUrl: URL, publicUrl: URL, origins: URL[]): void {
  const location = response.headers.get("Location");
  if (!location) return;
  const target = new URL(location, upstreamUrl);
  if (!origins.some((o) => o.host === target.host)) return;
  target.protocol = publicUrl.protocol;
  target.host = publicUrl.host;
  response.headers.set("Location", target.toString());
}
