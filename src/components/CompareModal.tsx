"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Scale, Trash2, X } from "lucide-react";
import { formatCoord, getPm25Level, haversineKm } from "@/lib/geo";
import { UI_TEXT, type Lang } from "@/lib/i18n";
import type {
  AirQualityCluster,
  ApiEnvelope,
  EarthquakeEvent,
  PointInspectData,
} from "@/types/telemetry";

export interface CompareLocation {
  label: string;
  lat: number;
  lng: number;
}

interface CompareModalProps {
  open: boolean;
  slotA: CompareLocation | null;
  slotB: CompareLocation | null;
  earthquakes: EarthquakeEvent[];
  airQuality: AirQualityCluster[];
  lang: Lang;
  onSwap: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

function findNearest<T extends { lat: number; lng: number }>(
  lat: number,
  lng: number,
  list: T[]
): (T & { distanceKm: number }) | null {
  let best: (T & { distanceKm: number }) | null = null;
  for (const item of list) {
    const d = haversineKm(lat, lng, item.lat, item.lng);
    if (!best || d < best.distanceKm) {
      best = { ...item, distanceKm: d };
    }
  }
  return best;
}

function formatDelta(a: number | null | undefined, b: number | null | undefined, unit: string): string {
  if (a == null || b == null) return "—";
  const diff = b - a;
  if (Math.abs(diff) < 0.05) return `0${unit}`;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${unit}`;
}

export default function CompareModal({
  open,
  slotA,
  slotB,
  earthquakes,
  airQuality,
  lang,
  onSwap,
  onClearAll,
  onClose,
}: CompareModalProps) {
  const [cache, setCache] = useState<Record<string, PointInspectData | null>>({});

  const keyA = slotA ? `${slotA.lat.toFixed(3)},${slotA.lng.toFixed(3)}` : null;
  const keyB = slotB ? `${slotB.lat.toFixed(3)},${slotB.lng.toFixed(3)}` : null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadSlot = async (loc: CompareLocation | null, key: string | null) => {
      if (!loc || !key) return;
      try {
        const res = await fetch(
          `/api/point-inspect?lat=${loc.lat.toFixed(3)}&lng=${loc.lng.toFixed(3)}`
        );
        if (!res.ok) return;
        const json = (await res.json()) as ApiEnvelope<PointInspectData>;
        if (!cancelled) {
          setCache((prev) => ({ ...prev, [key]: json.data }));
        }
      } catch {
        if (!cancelled) {
          setCache((prev) => ({ ...prev, [key]: null }));
        }
      }
    };

    void Promise.all([loadSlot(slotA, keyA), loadSlot(slotB, keyB)]);
    return () => {
      cancelled = true;
    };
  }, [open, slotA, slotB, keyA, keyB]);

  const dataA = keyA ? cache[keyA] ?? null : null;
  const dataB = keyB ? cache[keyB] ?? null : null;

  const nearA = useMemo(() => {
    if (!slotA) return { quake: null, air: null };
    return {
      quake: findNearest(slotA.lat, slotA.lng, earthquakes),
      air: findNearest(slotA.lat, slotA.lng, airQuality),
    };
  }, [slotA, earthquakes, airQuality]);

  const nearB = useMemo(() => {
    if (!slotB) return { quake: null, air: null };
    return {
      quake: findNearest(slotB.lat, slotB.lng, earthquakes),
      air: findNearest(slotB.lat, slotB.lng, airQuality),
    };
  }, [slotB, earthquakes, airQuality]);

  if (!open) return null;

  const t = UI_TEXT[lang];
  const isEn = lang === "en";

  const pmA = nearA.air?.pm25 ?? null;
  const pmB = nearB.air?.pm25 ?? null;

  const rows: Array<{
    label: string;
    valA: string;
    valB: string;
    delta: string;
    colorA?: string;
    colorB?: string;
  }> = [
    {
      label: isEn ? "Temperature" : "기온",
      valA: dataA?.weather ? `${dataA.weather.tempC.toFixed(1)}°C` : "—",
      valB: dataB?.weather ? `${dataB.weather.tempC.toFixed(1)}°C` : "—",
      delta: formatDelta(dataA?.weather?.tempC, dataB?.weather?.tempC, "°C"),
    },
    {
      label: isEn ? "Feels Like" : "체감 온도",
      valA: dataA?.weather ? `${dataA.weather.apparentTempC.toFixed(1)}°C` : "—",
      valB: dataB?.weather ? `${dataB.weather.apparentTempC.toFixed(1)}°C` : "—",
      delta: formatDelta(dataA?.weather?.apparentTempC, dataB?.weather?.apparentTempC, "°C"),
    },
    {
      label: isEn ? "Wind Speed" : "풍속",
      valA: dataA?.weather ? `${dataA.weather.windSpeedKmh} km/h` : "—",
      valB: dataB?.weather ? `${dataB.weather.windSpeedKmh} km/h` : "—",
      delta: formatDelta(dataA?.weather?.windSpeedKmh, dataB?.weather?.windSpeedKmh, " km/h"),
    },
    {
      label: isEn ? "Humidity" : "상대 습도",
      valA: dataA?.weather ? `${dataA.weather.humidityPct}%` : "—",
      valB: dataB?.weather ? `${dataB.weather.humidityPct}%` : "—",
      delta: formatDelta(dataA?.weather?.humidityPct, dataB?.weather?.humidityPct, "%"),
    },
    {
      label: isEn ? "Pressure" : "해면 기압",
      valA: dataA?.weather ? `${dataA.weather.pressureHpa} hPa` : "—",
      valB: dataB?.weather ? `${dataB.weather.pressureHpa} hPa` : "—",
      delta: formatDelta(dataA?.weather?.pressureHpa, dataB?.weather?.pressureHpa, " hPa"),
    },
    {
      label: isEn ? "PM2.5 (Nearest)" : "초미세먼지 PM2.5",
      valA: pmA !== null ? `${pmA.toFixed(1)} µg/m³` : "—",
      valB: pmB !== null ? `${pmB.toFixed(1)} µg/m³` : "—",
      delta: formatDelta(pmA, pmB, ""),
      colorA: pmA !== null ? getPm25Level(pmA).color : undefined,
      colorB: pmB !== null ? getPm25Level(pmB).color : undefined,
    },
    {
      label: isEn ? "Wave Height" : "유의 파고",
      valA: dataA?.marine ? `${dataA.marine.waveHeightM.toFixed(2)} m` : isEn ? "Inland" : "내륙",
      valB: dataB?.marine ? `${dataB.marine.waveHeightM.toFixed(2)} m` : isEn ? "Inland" : "내륙",
      delta: formatDelta(dataA?.marine?.waveHeightM, dataB?.marine?.waveHeightM, "m"),
    },
    {
      label: isEn ? "Nearest Quake" : "최근접 지진",
      valA: nearA.quake
        ? `M${nearA.quake.mag.toFixed(1)} (${Math.round(nearA.quake.distanceKm)}km)`
        : "—",
      valB: nearB.quake
        ? `M${nearB.quake.mag.toFixed(1)} (${Math.round(nearB.quake.distanceKm)}km)`
        : "—",
      delta: "—",
    },
  ];

  const distBetween =
    slotA && slotB ? Math.round(haversineKm(slotA.lat, slotA.lng, slotB.lat, slotB.lng)) : null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.compareTitle}>
      <div className="modal-card compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Scale size={18} color="#38bdf8" />
              <span>{t.compareTitle}</span>
            </h2>
            <p className="modal-sub">
              {distBetween !== null
                ? isEn
                  ? `Great-circle distance: ${distBetween.toLocaleString()} km`
                  : `두 지점 간 직선 거리 ${distBetween.toLocaleString()} km`
                : isEn
                  ? "Select two points on the 3D globe to compare live conditions."
                  : "지구본에서 두 지점을 선택해 실시간 기상·대기질·지진을 비교하세요."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {slotA && slotB && (
              <button
                type="button"
                className="close-btn"
                onClick={onSwap}
                title={isEn ? "Swap A / B" : "A / B 위치 바꾸기"}
                aria-label="Swap A and B"
              >
                <ArrowLeftRight size={15} />
              </button>
            )}
            <button
              type="button"
              className="close-btn"
              onClick={onClearAll}
              title={isEn ? "Reset compare slots" : "비교 초기화"}
              aria-label="Clear compare slots"
            >
              <Trash2 size={15} />
            </button>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="compare-headers">
          <div className="compare-slot-box slot-a">
            <span className="slot-badge">A</span>
            <div className="slot-copy">
              <strong>{slotA ? slotA.label : isEn ? "Not selected" : "지점 A 미선택"}</strong>
              <span className="mono">
                {slotA ? formatCoord(slotA.lat, slotA.lng) : "—"}
              </span>
            </div>
          </div>
          <div className="compare-slot-box slot-b">
            <span className="slot-badge">B</span>
            <div className="slot-copy">
              <strong>{slotB ? slotB.label : isEn ? "Pick 2nd location" : "두 번째 지점을 담아주세요"}</strong>
              <span className="mono">
                {slotB ? formatCoord(slotB.lat, slotB.lng) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="compare-table">
          <div className="compare-row compare-row-head">
            <span>{isEn ? "Metric" : "관측 항목"}</span>
            <span>A</span>
            <span>B</span>
            <span>Δ (B−A)</span>
          </div>
          {rows.map((r) => (
            <div key={r.label} className="compare-row">
              <span className="compare-k">{r.label}</span>
              <span className="compare-v mono" style={r.colorA ? { color: r.colorA } : undefined}>
                {r.valA}
              </span>
              <span className="compare-v mono" style={r.colorB ? { color: r.colorB } : undefined}>
                {r.valB}
              </span>
              <span className="compare-delta mono">{r.delta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
