"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  AirDustIcon,
  AqiGradeIcon,
  DisasterHazardIcon,
  KoreaBadgeIcon,
  OceanWaveIcon,
  QuakeIcon,
} from "./DomainIcons";
import { getMagnitudeColor, getPm25Level, timeAgoKo } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";
import type {
  AirQualityCluster,
  DisasterEvent,
  EarthquakeEvent,
  OceanNode,
  SelectedItem,
} from "@/types/telemetry";

interface EventFeedDrawerProps {
  open: boolean;
  earthquakes: EarthquakeEvent[];
  disasters: DisasterEvent[];
  ocean: OceanNode[];
  airQuality: AirQualityCluster[];
  lang: Lang;
  onClose: () => void;
  onSelect: (item: SelectedItem, altitude?: number) => void;
}

type FeedTab = "korea" | "quakes" | "disasters" | "air" | "ocean";

export default function EventFeedDrawer({
  open,
  earthquakes,
  disasters,
  ocean,
  airQuality,
  lang,
  onClose,
  onSelect,
}: EventFeedDrawerProps) {
  const [tab, setTab] = useState<FeedTab>("korea");
  const [selectedSido, setSelectedSido] = useState<string | null>(null);
  const isEn = lang === "en";

  const topQuakes = useMemo(
    () => [...earthquakes].sort((a, b) => b.mag - a.mag || b.time - a.time).slice(0, 18),
    [earthquakes]
  );

  const allKoreaAir = useMemo(
    () => airQuality.filter((a) => a.country === "KR").sort((a, b) => b.pm25 - a.pm25),
    [airQuality]
  );

  const sidoSummaries = useMemo(() => {
    const map = new Map<
      string,
      { sido: string; sum: number; count: number; topStation: AirQualityCluster }
    >();
    for (const a of allKoreaAir) {
      const sido = a.sidoName || a.stationName?.split(" ")[0] || "기타";
      const cur = map.get(sido);
      if (!cur) {
        map.set(sido, { sido, sum: a.pm25, count: 1, topStation: a });
      } else {
        cur.sum += a.pm25;
        cur.count += 1;
        if (a.pm25 > cur.topStation.pm25) cur.topStation = a;
      }
    }
    return Array.from(map.values())
      .map((s) => ({
        sido: s.sido,
        avgPm25: Math.round((s.sum / s.count) * 10) / 10,
        count: s.count,
        topStation: s.topStation,
      }))
      .sort((a, b) => b.avgPm25 - a.avgPm25);
  }, [allKoreaAir]);

  const koreaAir = useMemo(() => {
    const filtered = selectedSido
      ? allKoreaAir.filter((a) => (a.sidoName || a.stationName?.split(" ")[0] || "기타") === selectedSido)
      : allKoreaAir;
    return filtered.slice(0, 35);
  }, [allKoreaAir, selectedSido]);

  const topAir = useMemo(
    () => [...airQuality].sort((a, b) => b.pm25 - a.pm25).slice(0, 18),
    [airQuality]
  );

  const topOcean = useMemo(
    () => [...ocean].sort((a, b) => b.waveHeightM - a.waveHeightM).slice(0, 18),
    [ocean]
  );

  const topDisasters = useMemo(() => {
    const priority: Record<string, number> = {
      severeStorms: 0,
      volcanoes: 1,
      wildfires: 2,
      seaLakeIce: 3,
      other: 4,
    };
    return [...disasters]
      .sort((a, b) => (priority[a.category] ?? 4) - (priority[b.category] ?? 4))
      .slice(0, 24);
  }, [disasters]);

  if (!open) return null;

  return (
    <aside className="feed-drawer" aria-label="실시간 주요 글로벌 및 한국 이벤트 목록">
      <div className="drawer-header">
        <div>
          <h2 className="drawer-title">
            {isEn ? "Global & Korea Live Feed" : "실시간 글로벌 · 한국 하이라이트"}
          </h2>
          <p className="drawer-sub">
            {isEn
              ? "Select any event to fly the 3D globe directly to its location"
              : "항목을 선택하면 해당 위치로 지구본이 이동합니다"}
          </p>
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="닫기">
          <X size={16} />
        </button>
      </div>

      <div className="feed-tabs feed-tabs-5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "korea"}
          className={`feed-tab ${tab === "korea" ? "is-active" : ""}`}
          onClick={() => setTab("korea")}
        >
          <KoreaBadgeIcon size={13} />
          <span>{isEn ? "KR" : "한국"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quakes"}
          className={`feed-tab ${tab === "quakes" ? "is-active" : ""}`}
          onClick={() => setTab("quakes")}
        >
          <QuakeIcon size={13} />
          <span>{isEn ? "Quake" : "지진"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "disasters"}
          className={`feed-tab ${tab === "disasters" ? "is-active" : ""}`}
          onClick={() => setTab("disasters")}
        >
          <DisasterHazardIcon size={13} />
          <span>{isEn ? "Hazard" : "재해"}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "air"}
          className={`feed-tab ${tab === "air" ? "is-active" : ""}`}
          onClick={() => setTab("air")}
        >
          <AirDustIcon size={13} />
          <span>PM</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ocean"}
          className={`feed-tab ${tab === "ocean" ? "is-active" : ""}`}
          onClick={() => setTab("ocean")}
        >
          <OceanWaveIcon size={13} />
          <span>{isEn ? "Wave" : "파고"}</span>
        </button>
      </div>

      <div className="feed-list">
        {tab === "korea" && sidoSummaries.length > 0 && (
          <div className="sido-summary-wrap">
            <div className="sido-summary-head">
              <span>{isEn ? "Korea Regional PM2.5 Avg" : "전국 시도별 초미세먼지 평균"}</span>
              {selectedSido && (
                <button
                  type="button"
                  className="sido-reset-btn"
                  onClick={() => setSelectedSido(null)}
                >
                  {isEn ? "All" : "전체 보기"}
                </button>
              )}
            </div>
            <div className="sido-mini-grid">
              {sidoSummaries.map((s) => {
                const lvl = getPm25Level(s.avgPm25);
                const active = selectedSido === s.sido;
                return (
                  <button
                    key={s.sido}
                    type="button"
                    className={`sido-chip ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedSido(active ? null : s.sido);
                      onSelect({ kind: "air", data: s.topStation }, 1.38);
                    }}
                    title={`${s.sido} 평균 PM2.5 ${s.avgPm25} µg/m³ (${s.count}개소)`}
                  >
                    <span className="sido-name">{s.sido}</span>
                    <strong className="sido-val mono" style={{ color: lvl.color }}>
                      {Math.round(s.avgPm25)}
                    </strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "korea" &&
          koreaAir.map((a) => {
            const lvl = getPm25Level(a.pm25);
            return (
              <button
                key={a.id}
                type="button"
                className="feed-item"
                onClick={() => onSelect({ kind: "air", data: a }, 1.32)}
              >
                <span
                  className="feed-badge mono"
                  style={{ color: lvl.color, backgroundColor: lvl.bg }}
                >
                  <AqiGradeIcon pm25={a.pm25} size={15} />
                  <span>{a.pm25.toFixed(0)}</span>
                </span>
                <div className="feed-item-body">
                  <div className="feed-item-title">
                    {a.stationName ?? `${a.sidoName ?? "한국"} 측정소`}
                  </div>
                  <div className="feed-item-meta">
                    <span style={{ color: lvl.color }}>{lvl.label}</span>
                    <span>·</span>
                    <span>PM2.5 {a.pm25.toFixed(1)}</span>
                    {a.pm10 !== null && (
                      <>
                        <span>·</span>
                        <span>PM10 {a.pm10.toFixed(0)}</span>
                      </>
                    )}
                    {a.khaiValue != null && (
                      <>
                        <span>·</span>
                        <span>KHAI {a.khaiValue}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

        {tab === "quakes" &&
          topQuakes.map((q) => (
            <button
              key={q.id}
              type="button"
              className="feed-item"
              onClick={() => onSelect({ kind: "earthquake", data: q }, 1.72)}
            >
              <span
                className="feed-badge mono"
                style={{
                  color: getMagnitudeColor(q.mag),
                  backgroundColor: `${getMagnitudeColor(q.mag)}20`,
                }}
              >
                M {q.mag.toFixed(1)}
              </span>
              <div className="feed-item-body">
                <div className="feed-item-title">{q.place}</div>
                <div className="feed-item-meta">
                  <span>깊이 {q.depthKm.toFixed(1)} km</span>
                  <span>·</span>
                  <span>{timeAgoKo(q.time)}</span>
                  {q.tsunami && <span className="tag-warn">쓰나미 주의</span>}
                </div>
              </div>
            </button>
          ))}

        {tab === "disasters" &&
          topDisasters.map((ev) => {
            const color =
              ev.category === "volcanoes"
                ? "#ef4444"
                : ev.category === "wildfires"
                  ? "#f97316"
                  : "#38bdf8";
            return (
              <button
                key={ev.id}
                type="button"
                className="feed-item"
                onClick={() => onSelect({ kind: "disaster", data: ev }, 1.65)}
              >
                <span
                  className="feed-badge"
                  style={{ color, backgroundColor: `${color}22` }}
                >
                  {ev.category === "wildfires"
                    ? "산불"
                    : ev.category === "volcanoes"
                      ? "화산"
                      : ev.category === "severeStorms"
                        ? "태풍"
                        : "빙산"}
                </span>
                <div className="feed-item-body">
                  <div className="feed-item-title">{ev.title}</div>
                  <div className="feed-item-meta">
                    <span>{ev.provider}</span>
                    <span>·</span>
                    <span>{ev.date.slice(0, 10)}</span>
                    {ev.magnitudeValue != null && (
                      <>
                        <span>·</span>
                        <span>
                          {ev.magnitudeValue.toLocaleString()} {ev.magnitudeUnit ?? ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

        {tab === "air" &&
          topAir.map((a) => {
            const lvl = getPm25Level(a.pm25);
            return (
              <button
                key={a.id}
                type="button"
                className="feed-item"
                onClick={() => onSelect({ kind: "air", data: a }, 1.65)}
              >
                <span
                  className="feed-badge mono"
                  style={{ color: lvl.color, backgroundColor: lvl.bg }}
                >
                  <AqiGradeIcon pm25={a.pm25} size={15} />
                  <span>{a.pm25.toFixed(0)}</span>
                </span>
                <div className="feed-item-body">
                  <div className="feed-item-title">
                    {a.stationName ?? `${a.country} 권역`} · PM2.5 {a.pm25.toFixed(1)} µg/m³
                  </div>
                  <div className="feed-item-meta">
                    <span style={{ color: lvl.color }}>{lvl.label}</span>
                    <span>·</span>
                    <span>{a.provider}</span>
                  </div>
                </div>
              </button>
            );
          })}

        {tab === "ocean" &&
          topOcean.map((o) => (
            <button
              key={o.id}
              type="button"
              className="feed-item"
              onClick={() => onSelect({ kind: "ocean", data: o }, 1.95)}
            >
              <span
                className="feed-badge mono"
                style={{
                  color: o.waveHeightM >= 4 ? "#f59e0b" : "#2dd4bf",
                  backgroundColor:
                    o.waveHeightM >= 4 ? "rgba(245, 158, 11, 0.18)" : "rgba(45, 212, 191, 0.16)",
                }}
              >
                {o.waveHeightM.toFixed(1)}m
              </span>
              <div className="feed-item-body">
                <div className="feed-item-title">{o.nameKo}</div>
                <div className="feed-item-meta">
                  <span>주기 {o.wavePeriodS}s</span>
                  <span>·</span>
                  <span>해류 {o.currentVelKmh} km/h</span>
                </div>
              </div>
            </button>
          ))}
      </div>
    </aside>
  );
}
