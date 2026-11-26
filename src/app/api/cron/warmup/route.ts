import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Cache pre-warming endpoint for Vercel Cron or external uptime pings.
 * Pre-populates Vercel Edge / Upstash Redis / serverless memory caches
 * so first-time visitors experience instant sub-50ms responses.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const targets = [
    "/api/earthquakes?window=day&minMag=2.5",
    "/api/disasters",
    "/api/weather-ocean",
    "/api/air-quality",
  ];

  const started = Date.now();
  const results = await Promise.all(
    targets.map(async (path) => {
      try {
        const res = await fetch(`${origin}${path}`, { cache: "no-store" });
        return { path, status: res.status };
      } catch {
        return { path, status: 0 };
      }
    })
  );

  return NextResponse.json(
    {
      warmed: true,
      elapsedMs: Date.now() - started,
      results,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
