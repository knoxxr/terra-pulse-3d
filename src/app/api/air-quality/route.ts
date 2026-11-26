import { NextResponse } from "next/server";
import { fetchKoreaAirQuality } from "@/lib/airKorea";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import { getFallbackAirQuality } from "@/lib/fallbackData";
import type {
  AirQualityCluster,
  AirQualityPayload,
  ApiEnvelope,
} from "@/types/telemetry";

export const runtime = "nodejs";

interface SensorCommunityItem {
  timestamp?: string;
  location?: {
    latitude?: string | number;
    longitude?: string | number;
    country?: string;
    indoor?: number;
  };
  sensordatavalues?: Array<{
    value_type?: string;
    value?: string | number;
  }>;
}

interface GridBucket {
  latSum: number;
  lngSum: number;
  coordCount: number;
  pm25Sum: number;
  pm25Count: number;
  pm10Sum: number;
  pm10Count: number;
  tempSum: number;
  tempCount: number;
  humSum: number;
  humCount: number;
  presSum: number;
  presCount: number;
  sensorCount: number;
  country: string;
  provider: "Sensor.Community" | "PurpleAir";
  latestTimestamp: string;
}

const GRID_STEP = 0.85;

function bucketKey(lat: number, lng: number): string {
  const bLat = Math.round(lat / GRID_STEP);
  const bLng = Math.round(lng / GRID_STEP);
  return `${bLat}:${bLng}`;
}

function isInsideSouthKorea(lat: number, lng: number, country: string): boolean {
  if (country === "KR") return true;
  return lat >= 33.0 && lat <= 38.7 && lng >= 124.5 && lng <= 131.1;
}

async function fetchJsonSafe<T>(url: string, timeoutMs = 15000, headers?: HeadersInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TerraPulse3D/1.0 (environmental-globe)",
        ...headers,
      },
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

export async function GET() {
  const ttlSeconds = 300; // 5 min Edge CDN cache
  const staleSeconds = 900;

  const [globalResult, koreaResult] = await Promise.all([
    cachedFetch<AirQualityPayload>({
      key: "sensor-community:global-aq:v2",
      ttlSeconds,
      staleSeconds,
      fetcher: async () => {
        const [dustData, tempData] = await Promise.all([
          fetchJsonSafe<SensorCommunityItem[]>(
            "https://data.sensor.community/static/v2/data.dust.min.json",
            16000
          ),
          fetchJsonSafe<SensorCommunityItem[]>(
            "https://data.sensor.community/static/v2/data.temp.min.json",
            16000
          ),
        ]);

        if (!dustData || !Array.isArray(dustData) || dustData.length === 0) {
          throw new Error("Sensor.Community dust feed unavailable");
        }

        const buckets = new Map<string, GridBucket>();

        const getOrCreate = (
          lat: number,
          lng: number,
          country: string,
          ts: string,
          provider: "Sensor.Community" | "PurpleAir" = "Sensor.Community"
        ): GridBucket => {
          const key = bucketKey(lat, lng);
          let b = buckets.get(key);
          if (!b) {
            b = {
              latSum: 0,
              lngSum: 0,
              coordCount: 0,
              pm25Sum: 0,
              pm25Count: 0,
              pm10Sum: 0,
              pm10Count: 0,
              tempSum: 0,
              tempCount: 0,
              humSum: 0,
              humCount: 0,
              presSum: 0,
              presCount: 0,
              sensorCount: 0,
              country: country || "UN",
              provider,
              latestTimestamp: ts,
            };
            buckets.set(key, b);
          }
          return b;
        };

        for (const item of dustData) {
          const loc = item.location;
          if (!loc || loc.indoor === 1) continue;
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

          let p2: number | null = null;
          let p1: number | null = null;
          for (const v of item.sensordatavalues ?? []) {
            const num = Number(v.value);
            if (!Number.isFinite(num)) continue;
            if (v.value_type === "P2" && num >= 0 && num <= 800) p2 = num;
            else if (v.value_type === "P1" && num >= 0 && num <= 1200) p1 = num;
          }
          if (p2 === null) continue;

          const b = getOrCreate(lat, lng, loc.country ?? "UN", item.timestamp ?? "");
          b.latSum += lat;
          b.lngSum += lng;
          b.coordCount += 1;
          b.pm25Sum += p2;
          b.pm25Count += 1;
          if (p1 !== null) {
            b.pm10Sum += p1;
            b.pm10Count += 1;
          }
          b.sensorCount += 1;
          if (item.timestamp && item.timestamp > b.latestTimestamp) {
            b.latestTimestamp = item.timestamp;
          }
        }

        const climateArr = Array.isArray(tempData) ? tempData : [];
        for (const item of climateArr) {
          const loc = item.location;
          if (!loc || loc.indoor === 1) continue;
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

          const key = bucketKey(lat, lng);
          const b = buckets.get(key);
          if (!b) continue;

          for (const v of item.sensordatavalues ?? []) {
            const num = Number(v.value);
            if (!Number.isFinite(num)) continue;
            if (v.value_type === "temperature" && num >= -55 && num <= 60) {
              b.tempSum += num;
              b.tempCount += 1;
            } else if (v.value_type === "humidity" && num >= 0 && num <= 100) {
              b.humSum += num;
              b.humCount += 1;
            } else if (
              (v.value_type === "pressure_at_sealevel" || v.value_type === "pressure") &&
              num >= 85000 &&
              num <= 108000
            ) {
              b.presSum += num / 100;
              b.presCount += 1;
            }
          }
        }

        const purpleKey = process.env.PURPLEAIR_API_KEY;
        let purpleCount = 0;
        if (purpleKey) {
          interface PurpleResp {
            data?: Array<[number, number, number, number | null, number | null, number | null]>;
          }
          const pa = await fetchJsonSafe<PurpleResp>(
            "https://api.purpleair.com/v1/sensors?fields=latitude,longitude,pm2.5_10minute,temperature,humidity,pressure&location_type=0&max_age=1800",
            8000,
            { "X-API-Key": purpleKey }
          );
          if (pa?.data && Array.isArray(pa.data)) {
            const nowIso = new Date().toISOString();
            for (const row of pa.data) {
              const [, lat, lng, pm25, tempF, hum] = row;
              if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof pm25 !== "number") continue;
              if (pm25 < 0 || pm25 > 800) continue;
              const b = getOrCreate(lat, lng, "PA", nowIso, "PurpleAir");
              b.latSum += lat;
              b.lngSum += lng;
              b.coordCount += 1;
              b.pm25Sum += pm25;
              b.pm25Count += 1;
              if (typeof tempF === "number") {
                b.tempSum += ((tempF - 32) * 5) / 9;
                b.tempCount += 1;
              }
              if (typeof hum === "number" && hum >= 0 && hum <= 100) {
                b.humSum += hum;
                b.humCount += 1;
              }
              b.sensorCount += 1;
              purpleCount += 1;
            }
          }
        }

        const clusters: AirQualityCluster[] = [];
        let pm25TotalSum = 0;
        let idx = 0;

        for (const b of buckets.values()) {
          if (b.pm25Count === 0 || b.coordCount === 0) continue;
          const avgPm25 = Math.round((b.pm25Sum / b.pm25Count) * 10) / 10;
          pm25TotalSum += avgPm25;
          clusters.push({
            id: `aq-${idx++}`,
            lat: Math.round((b.latSum / b.coordCount) * 100) / 100,
            lng: Math.round((b.lngSum / b.coordCount) * 100) / 100,
            pm25: avgPm25,
            pm10: b.pm10Count > 0 ? Math.round((b.pm10Sum / b.pm10Count) * 10) / 10 : null,
            tempC: b.tempCount > 0 ? Math.round((b.tempSum / b.tempCount) * 10) / 10 : null,
            humidityPct: b.humCount > 0 ? Math.round(b.humSum / b.humCount) : null,
            pressureHpa: b.presCount > 0 ? Math.round(b.presSum / b.presCount) : null,
            sensorCount: b.sensorCount,
            country: b.country,
            provider: b.provider,
            timestamp: b.latestTimestamp || new Date().toISOString(),
          });
        }

        clusters.sort((a, b) => b.sensorCount - a.sensorCount || b.pm25 - a.pm25);
        const capped = clusters.slice(0, 820);
        const totalRawSensors = dustData.length + climateArr.length + purpleCount;

        return {
          clusters: capped,
          totalRawSensors,
          dustSensorCount: dustData.length + purpleCount,
          climateSensorCount: climateArr.length,
          globalAvgPm25:
            clusters.length > 0 ? Math.round((pm25TotalSum / clusters.length) * 10) / 10 : 0,
          koreaStationCount: 0,
          koreaSource: "none",
        };
      },
      fallback: getFallbackAirQuality,
    }),
    fetchKoreaAirQuality(),
  ]);

  // Merge high-precision South Korea AirKorea / CAMS stations at the front,
  // removing overlapping coarse Sensor.Community cells inside South Korea
  const hasKorea = koreaResult.stations.length > 0;
  const filteredGlobal = hasKorea
    ? globalResult.data.clusters.filter((c) => !isInsideSouthKorea(c.lat, c.lng, c.country))
    : globalResult.data.clusters;

  const mergedClusters = [...koreaResult.stations, ...filteredGlobal];
  const mergedRawTotal = globalResult.data.totalRawSensors + koreaResult.rawCount;

  const sourceParts: string[] = [];
  if (koreaResult.source === "data.go.kr") sourceParts.push("AirKorea (data.go.kr)");
  else if (koreaResult.source === "open-meteo-cams") sourceParts.push("Open-Meteo CAMS (KR)");
  sourceParts.push("Sensor.Community");
  if (process.env.PURPLEAIR_API_KEY) sourceParts.push("PurpleAir");

  const payload: AirQualityPayload = {
    ...globalResult.data,
    clusters: mergedClusters,
    totalRawSensors: mergedRawTotal,
    koreaStationCount: koreaResult.rawCount,
    koreaSource: koreaResult.source,
  };

  const envelope: ApiEnvelope<AirQualityPayload> = {
    data: payload,
    meta: {
      source: sourceParts.join(" + "),
      status: globalResult.status === "live" || koreaResult.status === "live" ? "live" : globalResult.status,
      updatedAt: globalResult.updatedAt,
      ttlSeconds,
      rawCount: mergedRawTotal,
      returnedCount: mergedClusters.length,
      latencyMs: Math.max(globalResult.latencyMs, koreaResult.latencyMs),
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds, envelope.meta.status),
  });
}
