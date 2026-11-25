import { NextRequest, NextResponse } from "next/server";
import { fetchKoreaAirQuality } from "@/lib/airKorea";
import { buildCdnHeaders } from "@/lib/cache";
import type { AirQualityCluster, ApiEnvelope } from "@/types/telemetry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sidoFilter = searchParams.get("sido")?.trim() || null;

  const result = await fetchKoreaAirQuality();
  const filtered = sidoFilter
    ? result.stations.filter((s) => s.sidoName === sidoFilter || s.stationName?.includes(sidoFilter))
    : result.stations;

  const ttlSeconds = result.source === "data.go.kr" ? 900 : 600;
  const staleSeconds = ttlSeconds * 2;

  const envelope: ApiEnvelope<{
    stations: AirQualityCluster[];
    koreaSource: "data.go.kr" | "open-meteo-cams" | "none";
    apiKeyConfigured: boolean;
  }> = {
    data: {
      stations: filtered,
      koreaSource: result.source,
      apiKeyConfigured: Boolean(process.env.DATA_GO_KR_API_KEY?.trim()),
    },
    meta: {
      source:
        result.source === "data.go.kr"
          ? "한국환경공단 에어코리아 (data.go.kr)"
          : "Open-Meteo CAMS Korea (DATA_GO_KR_API_KEY 미설정 대체)",
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: result.rawCount,
      returnedCount: filtered.length,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds),
  });
}
