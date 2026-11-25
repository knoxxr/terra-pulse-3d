import { NextResponse } from "next/server";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import { getFallbackWeatherOcean } from "@/lib/fallbackData";
import { GLOBAL_OCEAN_ANCHORS, GLOBAL_WEATHER_ANCHORS } from "@/lib/locations";
import type {
  ApiEnvelope,
  OceanNode,
  WeatherNode,
  WeatherOceanPayload,
} from "@/types/telemetry";

export const runtime = "nodejs";

interface OpenMeteoForecastItem {
  current?: {
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    precipitation?: number | null;
    weather_code?: number | null;
    surface_pressure?: number | null;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
    is_day?: number | null;
  };
}

interface OpenMeteoMarineItem {
  current?: {
    wave_height?: number | null;
    wave_direction?: number | null;
    wave_period?: number | null;
    ocean_current_velocity?: number | null;
    ocean_current_direction?: number | null;
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 11000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TerraPulse3D/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 64)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const ttlSeconds = 600; // 10 min Edge CDN cache -> absorbs massive global traffic
  const staleSeconds = 1200;

  const result = await cachedFetch<WeatherOceanPayload>({
    key: "open-meteo:global-weather-ocean:v1",
    ttlSeconds,
    staleSeconds,
    fetcher: async () => {
      const wLats = GLOBAL_WEATHER_ANCHORS.map((a) => a.lat).join(",");
      const wLngs = GLOBAL_WEATHER_ANCHORS.map((a) => a.lng).join(",");
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${wLats}&longitude=${wLngs}` +
        `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,is_day` +
        `&wind_speed_unit=kmh&timezone=GMT`;

      const oLats = GLOBAL_OCEAN_ANCHORS.map((a) => a.lat).join(",");
      const oLngs = GLOBAL_OCEAN_ANCHORS.map((a) => a.lng).join(",");
      const marineUrl =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${oLats}&longitude=${oLngs}` +
        `&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction` +
        `&timezone=GMT`;

      const [wRaw, oRaw] = await Promise.all([
        fetchJsonWithTimeout<OpenMeteoForecastItem | OpenMeteoForecastItem[]>(weatherUrl),
        fetchJsonWithTimeout<OpenMeteoMarineItem | OpenMeteoMarineItem[]>(marineUrl),
      ]);

      const wArr = Array.isArray(wRaw) ? wRaw : [wRaw];
      const oArr = Array.isArray(oRaw) ? oRaw : [oRaw];

      const weather: WeatherNode[] = [];
      for (let i = 0; i < GLOBAL_WEATHER_ANCHORS.length; i++) {
        const anchor = GLOBAL_WEATHER_ANCHORS[i];
        const cur = wArr[i]?.current;
        if (!cur || typeof cur.temperature_2m !== "number") continue;
        weather.push({
          id: anchor.id,
          name: anchor.name,
          nameKo: anchor.nameKo,
          lat: anchor.lat,
          lng: anchor.lng,
          tempC: Math.round(cur.temperature_2m * 10) / 10,
          windSpeedKmh: Math.round((cur.wind_speed_10m ?? 0) * 10) / 10,
          windDirDeg: Math.round(cur.wind_direction_10m ?? 0),
          precipMm: Math.round((cur.precipitation ?? 0) * 10) / 10,
          weatherCode: cur.weather_code ?? 0,
          humidityPct: Math.round(cur.relative_humidity_2m ?? 0),
          pressureHpa: Math.round(cur.surface_pressure ?? 1013),
          isDay: cur.is_day === 1,
        });
      }

      const ocean: OceanNode[] = [];
      for (let i = 0; i < GLOBAL_OCEAN_ANCHORS.length; i++) {
        const anchor = GLOBAL_OCEAN_ANCHORS[i];
        const cur = oArr[i]?.current;
        if (!cur || typeof cur.wave_height !== "number") continue;
        ocean.push({
          id: anchor.id,
          name: anchor.name,
          nameKo: anchor.nameKo,
          lat: anchor.lat,
          lng: anchor.lng,
          waveHeightM: Math.round(cur.wave_height * 100) / 100,
          waveDirDeg: Math.round(cur.wave_direction ?? 0),
          wavePeriodS: Math.round((cur.wave_period ?? 0) * 10) / 10,
          currentVelKmh: Math.round((cur.ocean_current_velocity ?? 0) * 10) / 10,
          currentDirDeg: Math.round(cur.ocean_current_direction ?? 0),
        });
      }

      if (weather.length === 0 && ocean.length === 0) {
        throw new Error("Empty Open-Meteo response");
      }

      return {
        weather,
        ocean,
        modelInfo: "Open-Meteo (ECMWF IFS · NOAA GFS · Marine WAM)",
      };
    },
    fallback: getFallbackWeatherOcean,
  });

  const envelope: ApiEnvelope<WeatherOceanPayload> = {
    data: result.data,
    meta: {
      source: result.data.modelInfo,
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: GLOBAL_WEATHER_ANCHORS.length + GLOBAL_OCEAN_ANCHORS.length,
      returnedCount: result.data.weather.length + result.data.ocean.length,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds),
  });
}
