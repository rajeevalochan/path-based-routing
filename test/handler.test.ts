import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const env: Env = {
  ROUTE_RULES: '["/search", "/maps"]',
  PUBLISH_ORIGIN: "https://www.google.com",
  EDS_ORIGIN: "https://www.instagram.com",
};

function mockUpstream(response: Response) {
  const spy = vi.fn(async (_url: URL, _init: RequestInit) => response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

const call = (url: string, e: Env = env, init?: RequestInit) =>
  worker.fetch(new Request(url, init), e);

afterEach(() => vi.unstubAllGlobals());

describe("worker", () => {
  it("proxies Route Rule paths to the Publish Origin with path and query intact", async () => {
    const spy = mockUpstream(new Response("ok"));
    const res = await call("https://pbr.example.workers.dev/search?q=cats");

    const [url, init] = spy.mock.calls[0];
    expect(url.toString()).toBe("https://www.google.com/search?q=cats");
    expect(new Headers(init.headers).get("X-Forwarded-Host")).toBe("pbr.example.workers.dev");
    expect(init.redirect).toBe("manual");
    expect(res.headers.get("X-Routed-Origin")).toBe("publish");
    expect(res.headers.get("X-Routed-By")).toBe("route-rule:/search");
  });

  it("proxies everything else to the EDS Origin", async () => {
    const spy = mockUpstream(new Response("ok"));
    const res = await call("https://pbr.example.workers.dev/explore/");

    expect(spy.mock.calls[0][0].toString()).toBe("https://www.instagram.com/explore/");
    expect(res.headers.get("X-Routed-Origin")).toBe("eds");
    expect(res.headers.get("X-Routed-By")).toBe("default");
  });

  it("sends X-AEM-Edge-Key only to Publish, and only when set", async () => {
    const withKey = { ...env, AEM_EDGE_KEY: "secret" };
    const spy = mockUpstream(new Response("ok"));
    await call("https://pbr.example.workers.dev/search", withKey);
    await call("https://pbr.example.workers.dev/about", withKey);
    await call("https://pbr.example.workers.dev/search", env);

    const keys = spy.mock.calls.map(([, init]) => new Headers(init.headers).get("X-AEM-Edge-Key"));
    expect(keys).toEqual(["secret", null, null]);
  });

  it.each([
    ["https://www.google.com/search?hl=en", "https://pbr.example.workers.dev/search?hl=en"],
    ["/maps/place", "https://pbr.example.workers.dev/maps/place"],
    ["https://www.instagram.com/accounts/login/", "https://pbr.example.workers.dev/accounts/login/"],
    ["https://consent.google.com/ml", "https://consent.google.com/ml"],
  ])("rewrites Location %s → %s", async (location, expected) => {
    mockUpstream(new Response(null, { status: 302, headers: { Location: location } }));
    const res = await call("https://pbr.example.workers.dev/search");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(expected);
  });

  it("forwards method and body", async () => {
    const spy = mockUpstream(new Response("ok"));
    await call("https://pbr.example.workers.dev/maps/api", env, { method: "POST", body: "payload" });

    const [, init] = spy.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(await new Response(init.body).text()).toBe("payload");
  });

  it("refuses to route with Shadowing config", async () => {
    const spy = mockUpstream(new Response("ok"));
    const res = await call("https://pbr.example.workers.dev/", { ...env, ROUTE_RULES: '["/scripts"]' });

    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/shadows Reserved EDS Path "\/scripts"/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("passes origin errors through without fallback", async () => {
    const spy = mockUpstream(new Response("boom", { status: 503 }));
    const res = await call("https://pbr.example.workers.dev/search");

    expect(res.status).toBe(503);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
