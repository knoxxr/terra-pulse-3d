import { NextRequest, NextResponse } from "next/server";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ApiEnvelope, PointInspectData } from "@/types/telemetry";

export const runtime = "nodejs";

interface ForecastInspectResp {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
  };
}

interface MarineInspectResp {
  current?: {
    wave_height?: number | null;
    wave_direction?: number | null;
    wave_period?: number | null;
    swell_wave_height?: number | null;
    ocean_current_velocity?: number | null;
    ocean_current_direction?: number | null;
  };
}

async function fetchJsonSafe<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TerraPulse3D/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  const rl = checkRateLimit(ip, 80, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many inspect requests. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawLat = Number(searchParams.get("lat"));
  const rawLng = Number(searchParams.get("lng"));

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return NextResponse.json({ error: "Invalid lat/lng parameters" }, { status: 400 });
  }

  const lat = Math.max(-85, Math.min(85, rawLat));
  const lng = Math.max(-180, Math.min(180, rawLng));

  // Quantize to 0.25° grid (~28km) for high Vercel Edge CDN cache hit ratio under heavy load!
  const gridLat = Math.round(lat * 4) / 4;
  const gridLng = Math.round(lng * 4) / 4;

  const ttlSeconds = 300;
  const staleSeconds = 900;

  const result = await cachedFetch<PointInspectData>({
    key: `inspect:${gridLat}:${gridLng}`,
    ttlSeconds,
    staleSeconds,
    fetcher: async () => {
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${gridLat}&longitude=${gridLng}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
        `&hourly=temperature_2m,wind_speed_10m&forecast_days=1&wind_speed_unit=kmh&timezone=GMT`;

      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${gridLat}&longitude=${gridLng}` +
        `&current=wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,ocean_current_direction&timezone=GMT`;

      const [wRes, mRes] = await Promise.all([
        fetchJsonSafe<ForecastInspectResp>(weatherUrl),
        fetchJsonSafe<MarineInspectResp>(marineUrl),
      ]);

      const weather =
        wRes?.current && typeof wRes.current.temperature_2m === "number"
          ? {
              tempC: Math.round(wRes.current.temperature_2m * 10) / 10,
              apparentTempC: Math.round((wRes.current.apparent_temperature ?? wRes.current.temperature_2m) * 10) / 10,
              windSpeedKmh: Math.round((wRes.current.wind_speed_10m ?? 0) * 10) / 10,
              windDirDeg: Math.round(wRes.current.wind_direction_10m ?? 0),
              windGustKmh: Math.round((wRes.current.wind_gusts_10m ?? 0) * 10) / 10,
              precipMm: Math.round((wRes.current.precipitation ?? 0) * 10) / 10,
              humidityPct: Math.round(wRes.current.relative_humidity_2m ?? 0),
              pressureHpa: Math.round(wRes.current.surface_pressure ?? 1013),
              weatherCode: wRes.current.weather_code ?? 0,
              hourlyTempC: (wRes.hourly?.temperature_2m ?? []).slice(0, 24).map((v) => Math.round(v * 10) / 10),
              hourlyWindKmh: (wRes.hourly?.wind_speed_10m ?? []).slice(0, 24).map((v) => Math.round(v * 10) / 10),
              hourlyLabels: (wRes.hourly?.time ?? []).slice(0, 24).map((t) => t.slice(11, 16)),
            }
          : null;

      const marine =
        mRes?.current && typeof mRes.current.wave_height === "number"
          ? {
              waveHeightM: Math.round(mRes.current.wave_height * 100) / 100,
              waveDirDeg: Math.round(mRes.current.wave_direction ?? 0),
              wavePeriodS: Math.round((mRes.current.wave_period ?? 0) * 10) / 10,
              swellHeightM:
                typeof mRes.current.swell_wave_height === "number"
                  ? Math.round(mRes.current.swell_wave_height * 100) / 100
                  : null,
              currentVelKmh:
                typeof mRes.current.ocean_current_velocity === "number"
                  ? Math.round(mRes.current.ocean_current_velocity * 10) / 10
                  : null,
              currentDirDeg:
                typeof mRes.current.ocean_current_direction === "number"
                  ? Math.round(mRes.current.ocean_current_direction)
                  : null,
            }
          : null;

      return {
        lat,
        lng,
        gridLat,
        gridLng,
        weather,
        marine,
        nearestQuake: null,
        nearestSensor: null,
      };
    },
    fallback: () => ({
      lat,
      lng,
      gridLat,
      gridLng,
      weather: null,
      marine: null,
      nearestQuake: null,
      nearestSensor: null,
    }),
  });

  const envelope: ApiEnvelope<PointInspectData> = {
    data: { ...result.data, lat, lng },
    meta: {
      source: "Open-Meteo Weather & Marine (0.25° Grid Cached)",
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: 1,
      returnedCount: 1,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds, result.status),
  });
}
