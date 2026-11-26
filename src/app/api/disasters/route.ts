import { NextResponse } from "next/server";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import type { ApiEnvelope, DisasterCategory, DisasterEvent } from "@/types/telemetry";

export const runtime = "nodejs";

interface EonetEventRaw {
  id: string;
  title: string;
  link?: string;
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: Array<{
    date?: string;
    type?: string;
    coordinates?: number[] | number[][] | number[][][];
    magnitudeValue?: number | null;
    magnitudeUnit?: string | null;
  }>;
}

interface EonetResponse {
  events?: EonetEventRaw[];
}

function mapCategory(rawId?: string): { cat: DisasterCategory; ko: string } {
  switch (rawId) {
    case "wildfires":
      return { cat: "wildfires", ko: "산불" };
    case "volcanoes":
      return { cat: "volcanoes", ko: "화산 활동" };
    case "severeStorms":
      return { cat: "severeStorms", ko: "태풍 · 열대저기압" };
    case "seaLakeIce":
      return { cat: "seaLakeIce", ko: "빙산 · 해빙" };
    default:
      return { cat: "other", ko: "자연재해" };
  }
}

function getFallbackDisasters(): DisasterEvent[] {
  const now = new Date().toISOString();
  return [
    {
      id: "fb-eonet-1",
      title: "Sakurajima Volcano Activity, Japan",
      category: "volcanoes",
      categoryKo: "화산 활동",
      lat: 31.585,
      lng: 130.657,
      date: now,
      magnitudeValue: null,
      magnitudeUnit: null,
      sourceUrl: "https://eonet.gsfc.nasa.gov/",
      provider: "NASA EONET",
    },
    {
      id: "fb-eonet-2",
      title: "Kilauea Volcanic Activity, Hawaii",
      category: "volcanoes",
      categoryKo: "화산 활동",
      lat: 19.421,
      lng: -155.287,
      date: now,
      magnitudeValue: null,
      magnitudeUnit: null,
      sourceUrl: "https://eonet.gsfc.nasa.gov/",
      provider: "NASA EONET",
    },
  ];
}

function isPrescribedBurn(title: string): boolean {
  return /\bprescribed\b|\brx\b|rx[-_\s]/i.test(title);
}

function cleanTitle(raw: string): string {
  return raw.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function parseEonetEvents(
  rawEvents: EonetEventRaw[],
  options?: { excludePrescribed?: boolean; maxAgeDays?: number }
): DisasterEvent[] {
  const cutoffMs = options?.maxAgeDays
    ? Date.now() - options.maxAgeDays * 86_400_000
    : null;
  const events: DisasterEvent[] = [];

  for (const ev of rawEvents) {
    const geoms = Array.isArray(ev.geometry) ? ev.geometry : [];
    if (geoms.length === 0) continue;

    const pointGeoms = geoms.filter(
      (g) => g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2
    );
    if (pointGeoms.length === 0) continue;

    const latest = pointGeoms[pointGeoms.length - 1];
    const coords = latest.coordinates as number[];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const title = cleanTitle(ev.title);
    const { cat, ko } = mapCategory(ev.categories?.[0]?.id);

    // Filter out USFS/IRWIN planned/prescribed controlled burns ("Prescribed Fire", "RX")
    if (options?.excludePrescribed && cat === "wildfires" && isPrescribedBurn(title)) {
      continue;
    }

    const eventDate = latest.date ?? new Date().toISOString();
    if (cutoffMs !== null) {
      const ts = Date.parse(eventDate);
      if (Number.isFinite(ts) && ts < cutoffMs) continue;
    }

    let track: Array<[number, number]> | undefined;
    if (pointGeoms.length >= 2) {
      track = pointGeoms.slice(-16).map((g) => {
        const c = g.coordinates as number[];
        return [Math.round(Number(c[1]) * 100) / 100, Math.round(Number(c[0]) * 100) / 100];
      });
    }

    events.push({
      id: ev.id,
      title,
      category: cat,
      categoryKo: ko,
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      date: eventDate,
      magnitudeValue:
        typeof latest.magnitudeValue === "number" ? latest.magnitudeValue : null,
      magnitudeUnit: latest.magnitudeUnit ?? null,
      sourceUrl: ev.sources?.[0]?.url ?? ev.link ?? "https://eonet.gsfc.nasa.gov/",
      provider: "NASA EONET",
      track,
    });
  }

  return events;
}

export async function GET() {
  const ttlSeconds = 300;
  const staleSeconds = 900;

  const result = await cachedFetch<{ events: DisasterEvent[]; rawCount: number }>({
    key: "nasa:eonet-open-events:v2",
    ttlSeconds,
    staleSeconds,
    fetcher: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 11000);
      try {
        // Fetch global volcanoes/storms/icebergs separately from recent wildfires
        // so US IRWIN wildfire/prescribed-burn volume never crowds out global hazards.
        const [hazardsRes, firesRes] = await Promise.all([
          fetch(
            "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes,severeStorms,seaLakeIce&limit=45",
            {
              signal: controller.signal,
              headers: { "User-Agent": "TerraPulse3D/1.0" },
              cache: "no-store",
            }
          ),
          fetch(
            "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&days=21&limit=80",
            {
              signal: controller.signal,
              headers: { "User-Agent": "TerraPulse3D/1.0" },
              cache: "no-store",
            }
          ),
        ]);

        if (!hazardsRes.ok && !firesRes.ok) {
          throw new Error(`NASA EONET HTTP ${hazardsRes.status}/${firesRes.status}`);
        }

        const hazardsJson: EonetResponse = hazardsRes.ok ? await hazardsRes.json() : {};
        const firesJson: EonetResponse = firesRes.ok ? await firesRes.json() : {};

        const rawHazards = Array.isArray(hazardsJson.events) ? hazardsJson.events : [];
        const rawFires = Array.isArray(firesJson.events) ? firesJson.events : [];

        const nonFireEvents = parseEonetEvents(rawHazards);
        const realWildfires = parseEonetEvents(rawFires, {
          excludePrescribed: true,
          maxAgeDays: 21,
        }).slice(0, 25);

        // Deduplicate by event ID just in case
        const seen = new Set<string>();
        const combined: DisasterEvent[] = [];
        for (const ev of [...nonFireEvents, ...realWildfires]) {
          if (seen.has(ev.id)) continue;
          seen.add(ev.id);
          combined.push(ev);
        }

        return {
          events: combined,
          rawCount: rawHazards.length + rawFires.length,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    fallback: () => {
      const fb = getFallbackDisasters();
      return { events: fb, rawCount: fb.length };
    },
  });

  const envelope: ApiEnvelope<DisasterEvent[]> = {
    data: result.data.events,
    meta: {
      source: "NASA EONET v3 (실제 산불 21일 · 활화산 · 태풍 · 빙산)",
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: result.data.rawCount,
      returnedCount: result.data.events.length,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds, result.status),
  });
}
