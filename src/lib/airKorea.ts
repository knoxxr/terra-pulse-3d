import { cachedFetch } from "@/lib/cache";
import { KOREA_MAJOR_ANCHORS, resolveKoreaStationCoord } from "@/lib/koreaStations";
import type { AirQualityCluster, DataSourceStatus } from "@/types/telemetry";

interface AirKoreaMeasureItem {
  stationName?: string;
  sidoName?: string;
  mangName?: string;
  dataTime?: string;
  pm25Value?: string;
  pm10Value?: string;
  o3Value?: string;
  no2Value?: string;
  coValue?: string;
  so2Value?: string;
  khaiValue?: string;
  khaiGrade?: string;
}

interface AirKoreaStationItem {
  stationName?: string;
  addr?: string;
  dmX?: string; // WGS84 Latitude
  dmY?: string; // WGS84 Longitude
}

interface AirKoreaResponse<T> {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: T[];
      totalCount?: number;
    };
  };
}

interface OpenMeteoAirItem {
  current?: {
    time?: string;
    pm2_5?: number | null;
    pm10?: number | null;
    ozone?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    carbon_monoxide?: number | null;
  };
}

export interface KoreaAirResult {
  stations: AirQualityCluster[];
  rawCount: number;
  source: "data.go.kr" | "open-meteo-cams" | "none";
  status: DataSourceStatus;
  updatedAt: string;
  latencyMs: number;
}

/**
 * Handles BOTH Encoding keys (containing %2B, %2F, %3D) and Decoding keys
 * from data.go.kr without double-encoding!
 */
export function normalizeDataGoKrKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return trimmed;
  }
  return encodeURIComponent(trimmed);
}

function parseAirNum(val: string | undefined): number | null {
  if (!val || val === "-" || val === "통신장애") return null;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function fetchJsonTimeout<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TerraPulse3D/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Optional 24-hour cached station coordinate lookup via data.go.kr MsrstnInfoInqireSvc.
 * Consumes at most 1 call/day. If the user only subscribed to ArpltnInforInqireSvc,
 * gracefully returns an empty Map and falls back to KOREA_DISTRICT_COORDS!
 */
async function getDynamicStationCoords(encodedKey: string): Promise<Map<string, [number, number]>> {
  const res = await cachedFetch<Array<[string, number, number]>>({
    key: "datagokr:station-coords:v1",
    ttlSeconds: 86400, // 24h cache -> max 1 call/day
    staleSeconds: 86400,
    fetcher: async () => {
      const url =
        `https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList` +
        `?serviceKey=${encodedKey}&returnType=json&numOfRows=1000&pageNo=1`;
      const json = await fetchJsonTimeout<AirKoreaResponse<AirKoreaStationItem>>(url, 10000);
      const items = json?.response?.body?.items;
      if (!Array.isArray(items) || items.length === 0) return [];

      const pairs: Array<[string, number, number]> = [];
      for (const st of items) {
        if (!st.stationName || !st.dmX || !st.dmY) continue;
        const lat = Number(st.dmX);
        const lng = Number(st.dmY);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (lat < 32 || lat > 39.5 || lng < 124 || lng > 132) continue;
        const sido = st.addr ? st.addr.split(" ")[0].slice(0, 2) : "";
        if (sido) pairs.push([`${sido}:${st.stationName}`, lat, lng]);
        pairs.push([st.stationName, lat, lng]);
      }
      return pairs;
    },
    fallback: () => [],
  });

  const map = new Map<string, [number, number]>();
  for (const [k, lat, lng] of res.data) {
    map.set(k, [lat, lng]);
  }
  return map;
}

/**
 * Compute approximate Korean KHAI (통합대기환경지수) from PM2.5 / PM10 for Open-Meteo CAMS fallback.
 */
function estimateKhai(pm25: number, pm10: number | null): { value: number; grade: number } {
  const idx25 =
    pm25 <= 15
      ? (pm25 / 15) * 50
      : pm25 <= 35
        ? 50 + ((pm25 - 15) / 20) * 50
        : pm25 <= 75
          ? 100 + ((pm25 - 35) / 40) * 150
          : 250 + Math.min(250, ((pm25 - 75) / 75) * 150);
  const p10 = pm10 ?? 0;
  const idx10 =
    p10 <= 30
      ? (p10 / 30) * 50
      : p10 <= 80
        ? 50 + ((p10 - 30) / 50) * 50
        : p10 <= 150
          ? 100 + ((p10 - 80) / 70) * 150
          : 250 + Math.min(250, ((p10 - 150) / 150) * 150);

  const value = Math.round(Math.max(idx25, idx10));
  const grade = value <= 50 ? 1 : value <= 100 ? 2 : value <= 250 ? 3 : 4;
  return { value, grade };
}

/**
 * Fetches official South Korea real-time air quality via data.go.kr (AirKorea)
 * with 15-minute Singleflight + Edge CDN caching (protects 500 calls/day quota!).
 *
 * When DATA_GO_KR_API_KEY is not configured, seamlessly fetches live South Korea
 * 35-city air quality from Open-Meteo CAMS Air Quality API (zero key required).
 */
export async function fetchKoreaAirQuality(): Promise<KoreaAirResult> {
  const rawKey = process.env.DATA_GO_KR_API_KEY;

  if (rawKey && rawKey.trim().length > 8) {
    const encodedKey = normalizeDataGoKrKey(rawKey);
    const cached = await cachedFetch<{ stations: AirQualityCluster[]; rawCount: number }>({
      key: "datagokr:airkorea-nationwide:v1",
      ttlSeconds: 900, // 15 min cache -> max 96 calls/day (AirKorea updates hourly!)
      staleSeconds: 2700,
      fetcher: async () => {
        const measureUrl =
          `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty` +
          `?serviceKey=${encodedKey}&returnType=json&numOfRows=1000&pageNo=1` +
          `&sidoName=${encodeURIComponent("전국")}&ver=1.3`;

        const [measureJson, coordMap] = await Promise.all([
          fetchJsonTimeout<AirKoreaResponse<AirKoreaMeasureItem>>(measureUrl, 13000),
          getDynamicStationCoords(encodedKey),
        ]);

        const resultCode = measureJson?.response?.header?.resultCode;
        const items = measureJson?.response?.body?.items;
        if (resultCode && resultCode !== "00") {
          throw new Error(`data.go.kr error ${resultCode}: ${measureJson?.response?.header?.resultMsg ?? ""}`);
        }
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("Empty data.go.kr AirKorea response");
        }

        // Spatial micro-bucket (0.14° ~ 15km) keeps Korea ultra-detailed at deep zoom
        // while keeping marker count crisp (~95-140 active Korean points on globe!)
        interface KrBucket {
          latSum: number;
          lngSum: number;
          pm25Sum: number;
          pm25Cnt: number;
          pm10Sum: number;
          pm10Cnt: number;
          o3Sum: number;
          o3Cnt: number;
          no2Sum: number;
          no2Cnt: number;
          coSum: number;
          coCnt: number;
          so2Sum: number;
          so2Cnt: number;
          khaiMax: number | null;
          khaiGradeMax: number | null;
          count: number;
          repStation: string;
          sido: string;
          mangName: string | null;
          dataTime: string;
        }

        const buckets = new Map<string, KrBucket>();
        const KR_GRID = 0.14;

        for (const item of items) {
          const sido = item.sidoName?.trim() || "한국";
          const station = item.stationName?.trim();
          if (!station) continue;

          const pm25 = parseAirNum(item.pm25Value);
          const pm10 = parseAirNum(item.pm10Value);
          if (pm25 === null && pm10 === null) continue;

          const coords = resolveKoreaStationCoord(sido, station, coordMap);
          if (!coords) continue;

          const bKey = `${Math.round(coords[0] / KR_GRID)}:${Math.round(coords[1] / KR_GRID)}`;
          let b = buckets.get(bKey);
          if (!b) {
            b = {
              latSum: 0,
              lngSum: 0,
              pm25Sum: 0,
              pm25Cnt: 0,
              pm10Sum: 0,
              pm10Cnt: 0,
              o3Sum: 0,
              o3Cnt: 0,
              no2Sum: 0,
              no2Cnt: 0,
              coSum: 0,
              coCnt: 0,
              so2Sum: 0,
              so2Cnt: 0,
              khaiMax: null,
              khaiGradeMax: null,
              count: 0,
              repStation: station,
              sido,
              mangName: item.mangName ?? null,
              dataTime: item.dataTime ?? new Date().toISOString(),
            };
            buckets.set(bKey, b);
          }

          b.latSum += coords[0];
          b.lngSum += coords[1];
          b.count += 1;

          if (pm25 !== null) {
            b.pm25Sum += pm25;
            b.pm25Cnt += 1;
          }
          if (pm10 !== null) {
            b.pm10Sum += pm10;
            b.pm10Cnt += 1;
          }
          const o3 = parseAirNum(item.o3Value);
          if (o3 !== null) {
            b.o3Sum += o3;
            b.o3Cnt += 1;
          }
          const no2 = parseAirNum(item.no2Value);
          if (no2 !== null) {
            b.no2Sum += no2;
            b.no2Cnt += 1;
          }
          const co = parseAirNum(item.coValue);
          if (co !== null) {
            b.coSum += co;
            b.coCnt += 1;
          }
          const so2 = parseAirNum(item.so2Value);
          if (so2 !== null) {
            b.so2Sum += so2;
            b.so2Cnt += 1;
          }
          const khai = parseAirNum(item.khaiValue);
          if (khai !== null) {
            b.khaiMax = b.khaiMax === null ? khai : Math.max(b.khaiMax, khai);
          }
          const grade = parseAirNum(item.khaiGrade);
          if (grade !== null) {
            b.khaiGradeMax = b.khaiGradeMax === null ? grade : Math.max(b.khaiGradeMax, grade);
          }
        }

        const stations: AirQualityCluster[] = [];
        let idx = 0;
        for (const b of buckets.values()) {
          const avgPm25 =
            b.pm25Cnt > 0
              ? Math.round((b.pm25Sum / b.pm25Cnt) * 10) / 10
              : Math.round(((b.pm10Sum / Math.max(1, b.pm10Cnt)) * 0.55) * 10) / 10;
          const avgPm10 = b.pm10Cnt > 0 ? Math.round((b.pm10Sum / b.pm10Cnt) * 10) / 10 : null;
          const est = estimateKhai(avgPm25, avgPm10);

          stations.push({
            id: `kr-ak-${idx++}`,
            lat: Math.round((b.latSum / b.count) * 1000) / 1000,
            lng: Math.round((b.lngSum / b.count) * 1000) / 1000,
            pm25: avgPm25,
            pm10: avgPm10,
            tempC: null,
            humidityPct: null,
            pressureHpa: null,
            sensorCount: b.count,
            country: "KR",
            provider: "AirKorea (data.go.kr)",
            timestamp: b.dataTime,
            stationName: b.count > 1 ? `${b.sido} ${b.repStation} 외 ${b.count - 1}` : `${b.sido} ${b.repStation}`,
            sidoName: b.sido,
            mangName: b.mangName,
            khaiValue: b.khaiMax ?? est.value,
            khaiGrade: b.khaiGradeMax ?? est.grade,
            o3Ppm: b.o3Cnt > 0 ? Math.round((b.o3Sum / b.o3Cnt) * 1000) / 1000 : null,
            no2Ppm: b.no2Cnt > 0 ? Math.round((b.no2Sum / b.no2Cnt) * 1000) / 1000 : null,
            coPpm: b.coCnt > 0 ? Math.round((b.coSum / b.coCnt) * 100) / 100 : null,
            so2Ppm: b.so2Cnt > 0 ? Math.round((b.so2Sum / b.so2Cnt) * 1000) / 1000 : null,
          });
        }

        return { stations, rawCount: items.length };
      },
      fallback: () => ({ stations: [], rawCount: 0 }),
    });

    if (cached.data.stations.length > 0) {
      return {
        stations: cached.data.stations,
        rawCount: cached.data.rawCount,
        source: "data.go.kr",
        status: cached.status,
        updatedAt: cached.updatedAt,
        latencyMs: cached.latencyMs,
      };
    }
  }

  // Seamless zero-key fallback: Open-Meteo CAMS Air Quality for 35 Korean cities (1 batched HTTP call!)
  const cams = await cachedFetch<{ stations: AirQualityCluster[]; rawCount: number }>({
    key: "open-meteo:korea-aq-cams:v1",
    ttlSeconds: 600,
    staleSeconds: 1800,
    fetcher: async () => {
      const lats = KOREA_MAJOR_ANCHORS.map((a) => a.lat).join(",");
      const lngs = KOREA_MAJOR_ANCHORS.map((a) => a.lng).join(",");
      const url =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}` +
        `&current=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide&timezone=Asia%2FSeoul`;

      const raw = await fetchJsonTimeout<OpenMeteoAirItem | OpenMeteoAirItem[]>(url, 10000);
      if (!raw) throw new Error("Open-Meteo Air Quality unavailable");
      const arr = Array.isArray(raw) ? raw : [raw];

      const stations: AirQualityCluster[] = [];
      for (let i = 0; i < KOREA_MAJOR_ANCHORS.length; i++) {
        const anchor = KOREA_MAJOR_ANCHORS[i];
        const cur = arr[i]?.current;
        if (!cur || typeof cur.pm2_5 !== "number") continue;

        const pm25 = Math.round(cur.pm2_5 * 10) / 10;
        const pm10 = typeof cur.pm10 === "number" ? Math.round(cur.pm10 * 10) / 10 : null;
        // Convert µg/m³ -> ppm at 25°C, 1 atm (standard AirKorea unit)
        const o3Ppm = typeof cur.ozone === "number" ? Math.round((cur.ozone / 1962) * 1000) / 1000 : null;
        const no2Ppm =
          typeof cur.nitrogen_dioxide === "number"
            ? Math.round((cur.nitrogen_dioxide / 1880) * 1000) / 1000
            : null;
        const so2Ppm =
          typeof cur.sulphur_dioxide === "number"
            ? Math.round((cur.sulphur_dioxide / 2620) * 1000) / 1000
            : null;
        const coPpm =
          typeof cur.carbon_monoxide === "number"
            ? Math.round((cur.carbon_monoxide / 1145) * 100) / 100
            : null;

        const est = estimateKhai(pm25, pm10);
        stations.push({
          id: anchor.id,
          lat: anchor.lat,
          lng: anchor.lng,
          pm25,
          pm10,
          tempC: null,
          humidityPct: null,
          pressureHpa: null,
          sensorCount: 1,
          country: "KR",
          provider: "Open-Meteo CAMS (KR)",
          timestamp: cur.time ? `${cur.time.replace("T", " ")} KST` : new Date().toISOString(),
          stationName: `${anchor.sido} ${anchor.name}`,
          sidoName: anchor.sido,
          mangName: "CAMS 대기모델",
          khaiValue: est.value,
          khaiGrade: est.grade,
          o3Ppm,
          no2Ppm,
          coPpm,
          so2Ppm,
        });
      }
      return { stations, rawCount: stations.length };
    },
    fallback: () => ({ stations: [], rawCount: 0 }),
  });

  return {
    stations: cams.data.stations,
    rawCount: cams.data.rawCount,
    source: cams.data.stations.length > 0 ? "open-meteo-cams" : "none",
    status: cams.status,
    updatedAt: cams.updatedAt,
    latencyMs: cams.latencyMs,
  };
}
