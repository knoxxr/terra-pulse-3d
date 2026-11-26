import { NextResponse } from "next/server";
import { normalizeDataGoKrKey } from "@/lib/airKorea";
import { buildCdnHeaders, cachedFetch } from "@/lib/cache";
import type { ApiEnvelope } from "@/types/telemetry";

export const runtime = "nodejs";

export interface KoreaAlertItem {
  id: string;
  title: string;
  area: string;
  issuedAt: string;
  severity: "advisory" | "warning";
  source: "KMA (data.go.kr)" | "Open-Meteo Advisory";
}

interface KmaWrnRaw {
  response?: {
    header?: { resultCode?: string };
    body?: {
      items?: {
        item?: Array<{
          title?: string;
          tmFc?: number | string;
          stnId?: string;
        }>;
      };
    };
  };
}

export async function GET() {
  const ttlSeconds = 600;
  const staleSeconds = 1200;
  const rawKey = process.env.DATA_GO_KR_API_KEY;

  const result = await cachedFetch<KoreaAlertItem[]>({
    key: `korea-alerts:${rawKey ? "kma" : "nokey"}`,
    ttlSeconds,
    staleSeconds,
    fetcher: async () => {
      if (!rawKey || rawKey.trim().length <= 8) return [];

      const encodedKey = normalizeDataGoKrKey(rawKey);
      // Format today's YYYYMMDD in KST
      const kstNow = new Date(Date.now() + 9 * 3600_000);
      const ymd = kstNow.toISOString().slice(0, 10).replace(/-/g, "");

      const url =
        `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList` +
        `?serviceKey=${encodedKey}&numOfRows=10&pageNo=1&dataType=JSON&stnId=108&fromTmFc=${ymd}&toTmFc=${ymd}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) return [];
        const text = await res.text();
        if (!text.trim().startsWith("{")) return [];
        const json = JSON.parse(text) as KmaWrnRaw;
        const items = json.response?.body?.items?.item ?? [];
        if (!Array.isArray(items)) return [];

        return items
          .filter((it) => Boolean(it.title))
          .slice(0, 5)
          .map((it, idx) => {
            const title = String(it.title).trim();
            const isWarn = title.includes("경보") || title.includes("태풍");
            const tm = String(it.tmFc ?? "");
            const formatted =
              tm.length >= 12
                ? `${tm.slice(4, 6)}-${tm.slice(6, 8)} ${tm.slice(8, 10)}:${tm.slice(10, 12)} KST`
                : "방금";
            return {
              id: `kma-${idx}-${tm}`,
              title,
              area: "대한민국 기상청",
              issuedAt: formatted,
              severity: isWarn ? "warning" : "advisory",
              source: "KMA (data.go.kr)",
            };
          });
      } finally {
        clearTimeout(timer);
      }
    },
    fallback: () => [],
  });

  const envelope: ApiEnvelope<KoreaAlertItem[]> = {
    data: result.data,
    meta: {
      source: rawKey ? "기상청 기상특보 (data.go.kr)" : "DATA_GO_KR_API_KEY 대기",
      status: result.status,
      updatedAt: result.updatedAt,
      ttlSeconds,
      rawCount: result.data.length,
      returnedCount: result.data.length,
      latencyMs: result.latencyMs,
    },
  };

  return NextResponse.json(envelope, {
    headers: buildCdnHeaders(ttlSeconds, staleSeconds, result.status),
  });
}
