import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as quoteRoute from "@/app/api/quote/route";
import * as trackRoute from "@/app/api/track/route";

const req = (url: string) => new NextRequest(new URL(url, "http://localhost"));

afterEach(() => vi.unstubAllEnvs());

describe("legacy /api/quote", () => {
  it("has no GET handler, so customer data can never be listed", () => {
    expect("GET" in quoteRoute).toBe(false);
  });

  it("rejects submissions with 503 and no data", async () => {
    const res = quoteRoute.POST();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "SUBMISSION_UNAVAILABLE", message: expect.any(String) });
  });
});

describe("/api/track", () => {
  it("exposes no write handlers", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(method in trackRoute).toBe(false);
  });

  it("returns 404 for the demo reference when demo data is off (default)", async () => {
    const res = await trackRoute.GET(req("/api/track?reference=MLDEMO000001"));
    expect(res.status).toBe(404);
  });

  it("never serves demo data in production even with the flag on", async () => {
    vi.stubEnv("ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NODE_ENV", "production");
    const res = await trackRoute.GET(req("/api/track?reference=MLDEMO000001"));
    expect(res.status).toBe(404);
  });

  it("serves demo data only in development with the flag on, without inventing events", async () => {
    vi.stubEnv("ENABLE_DEMO_DATA", "true");
    vi.stubEnv("NODE_ENV", "development");
    const first = await (await trackRoute.GET(req("/api/track?reference=mldemo000001"))).json();
    const second = await (await trackRoute.GET(req("/api/track?reference=MLDEMO000001"))).json();
    expect(first.demo).toBe(true);
    expect(second.data.events).toEqual(first.data.events);
  });

  it("rejects malformed references with 400", async () => {
    const res = await trackRoute.GET(req("/api/track?reference=%3Cscript%3E"));
    expect(res.status).toBe(400);
  });
});
