"use client";

import React, { useMemo, useState } from "react";
import { Activity, MapPin, Radio, Waves, X } from "lucide-react";
import { getMagnitudeColor, getPm25Level, timeAgoKo } from "@/lib/geo";
import type {
  AirQualityCluster,
  EarthquakeEvent,
  OceanNode,
  SelectedItem,
} from "@/types/telemetry";

interface EventFeedDrawerProps {
  open: boolean;
  earthquakes: EarthquakeEvent[];
  ocean: OceanNode[];
  airQuality: AirQualityCluster[];
  onClose: () => void;
  onSelect: (item: SelectedItem, altitude?: number) => void;
}

type FeedTab = "quakes" | "korea" | "air" | "ocean";

export default function EventFeedDrawer({
  open,
  earthquakes,
  ocean,
  airQuality,
  onClose,
  onSelect,
}: EventFeedDrawerProps) {
  const [tab, setTab] = useState<FeedTab>("korea");

  const topQuakes = useMemo(
    () => [...earthquakes].sort((a, b) => b.mag - a.mag || b.time - a.time).slice(0, 18),
    [earthquakes]
  );

  const koreaAir = useMemo(
    () =>
      airQuality
        .filter((a) => a.country === "KR")
        .sort((a, b) => b.pm25 - a.pm25)
        .slice(0, 35),
    [airQuality]
  );

  const topAir = useMemo(
    () => [...airQuality].sort((a, b) => b.pm25 - a.pm25).slice(0, 18),
    [airQuality]
  );

  const topOcean = useMemo(
    () => [...ocean].sort((a, b) => b.waveHeightM - a.waveHeightM).slice(0, 18),
    [ocean]
  );

  if (!open) return null;

  return (
    <aside className="feed-drawer" aria-label="실시간 주요 글로벌 및 한국 이벤트 목록">
      <div className="drawer-header">
        <div>
          <h2 className="drawer-title">실시간 글로벌 · 한국 하이라이트</h2>
          <p className="drawer-sub">항목을 선택하면 해당 위치로 지구본이 이동합니다</p>
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="닫기">
          <X size={16} />
        </button>
      </div>

      <div className="feed-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "korea"}
          className={`feed-tab ${tab === "korea" ? "is-active" : ""}`}
          onClick={() => setTab("korea")}
        >
          <MapPin size={13} />
          <span>한국 대기</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quakes"}
          className={`feed-tab ${tab === "quakes" ? "is-active" : ""}`}
          onClick={() => setTab("quakes")}
        >
          <Activity size={13} />
          <span>지진</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "air"}
          className={`feed-tab ${tab === "air" ? "is-active" : ""}`}
          onClick={() => setTab("air")}
        >
          <Radio size={13} />
          <span>글로벌 PM</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ocean"}
          className={`feed-tab ${tab === "ocean" ? "is-active" : ""}`}
          onClick={() => setTab("ocean")}
        >
          <Waves size={13} />
          <span>파고</span>
        </button>
      </div>

      <div className="feed-list">
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
                  {a.pm25.toFixed(0)}
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
                  {a.pm25.toFixed(0)}
                </span>
                <div className="feed-item-body">
                  <div className="feed-item-title">
                    {a.stationName ?? `${a.country} 권역`} · PM2.5 {a.pm25.toFixed(1)} µg/m³
                  </div>
                  <div className="feed-item-meta">
                    <span style={{ color: lvl.color }}>{lvl.label}</span>
                    <span>·</span>
                    <span>{a.provider}</span>
                    {a.pm10 !== null && (
                      <>
                        <span>·</span>
                        <span>PM10 {a.pm10.toFixed(0)}</span>
                      </>
                    )}
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
