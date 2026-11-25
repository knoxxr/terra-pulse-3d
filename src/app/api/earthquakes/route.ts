import { NextRequest, NextResponse } from "next/server";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import { getFallbackEarthquakes } from "@/lib/fallbackData";
import type { ApiEnvelope, EarthquakeEvent, QuakeWindow } from "@/types/telemetry";

export const runtime = "nodejs";

const USGS_FEEDS: Record<QuakeWindow, string> = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
};

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    tsunami: number;
    alert: string | null;
    sig: number | null;
    felt: number | null;
    url: string | null;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

interface UsgsGeoJson {
  features: UsgsFeature[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawWindow = searchParams.get("window") ?? "day";
  const windowParam: QuakeWindow =
    rawWindow === "hour" || rawWindow === "week" ? rawWindow : "day";
  const minMag = Math.max(0, Math.min(9, Number(searchParams.get("minMag") ?? "1.5") || 1.5));

  const ttlSeconds = windowParam === "hour" ? 60 : windowParam === "day" ? 60 : 180;
  const staleSeconds = ttlSeconds * 3;

  const result = await cachedFetch<{ events: EarthquakeEvent[]; rawCount: number }>({
    key: `usgs:${windowParam}`,
    ttlSeconds,
    staleSeconds,
    fetcher: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const res = await fetch(USGS_FEEDS[windowParam], {
          signal: controller.signal,
          headers: { "User-Agent": "TerraPulse3D/1.0 (global-monitor)" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
        const json = (await res.json()) as UsgsGeoJson;
        const features = Array.isArray(json.features) ? json.features : [];
        const events: EarthquakeEvent[] = [];
        for (const f of features) {
          const coords = f.geometry?.coordinates;
          const mag = f.properties?.mag;
          if (!coords || coords.length < 2 || typeof mag !== "number" || Number.isNaN(mag)) {
            continue;
          }
          events.push({
            id: f.id,
            mag: Math.round(mag * 10) / 10,
            place: f.properties.place ?? "Unknown epicenter",
            time: f.properties.time ?? Date.now(),
            lng: Math.round(coords[0] * 1000) / 1000,
            lat: Math.round(coords[1] * 1000) / 1000,
            depthKm: Math.round((coords[2] ?? 0) * 10) / 10,
            tsunami: f.properties.tsunami === 1,
            alert: f.properties.alert ?? null,
            sig: f.properties.sig ?? 0,
            felt: f.properties.felt ?? null,
            url: f.properties.url ?? "https://earthquake.usgs.gov/earthquakes/map/",
          });
        }
        // Sort newest & strongest first, cap to 450 items for ultra-fast mobile WebGL
        events.sort((a, b) => b.mag - a.mag || b.time - a.time);
        return { events: events.slice(0, 450), rawCount: features.length };
      } finally {
        clearTimeout(timeout);
      }
    },
    fallback: () => {
      const fb = getFallbackEarthquakes();
      return { events: fb, rawCount: fb.length };
    },
  });

  const filtered = result.data.events.filter((e) => e.mag >= minMag);

  const envelope: ApiEnvelope<EarthquakeEvent[]> = {
    data: filtered,
    meta: {
      source: `USGS GeoJSON (${windowParam})`,
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: result.data.rawCount,
      returnedCount: filtered.length,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds),
  });
}
