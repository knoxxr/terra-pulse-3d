"use client";

import React, { useMemo, useRef, useState } from "react";
import { Info, Search, X } from "lucide-react";
import { GlobeSpinIcon, RadarAlertIcon } from "./DomainIcons";
import {
  GLOBAL_OCEAN_ANCHORS,
  GLOBAL_WEATHER_ANCHORS,
  QUICK_JUMP_PRESETS,
} from "@/lib/locations";
import type { DataSourceStatus } from "@/types/telemetry";

interface SearchCandidate {
  id: string;
  label: string;
  sub: string;
  lat: number;
  lng: number;
  kind: "city" | "ocean" | "region";
}

interface TopBarProps {
  totalEarthquakes: number;
  totalRawSensors: number;
  overallStatus: DataSourceStatus;
  feedOpen: boolean;
  onToggleFeed: () => void;
  onOpenArchitecture: () => void;
  onSelectLocation: (lat: number, lng: number, label: string, altitude?: number) => void;
}

const ALL_SEARCHABLE: SearchCandidate[] = [
  ...QUICK_JUMP_PRESETS.map((p) => ({
    id: `preset-${p.id}`,
    label: p.label,
    sub: "추천 관측 권역",
    lat: p.lat,
    lng: p.lng,
    kind: "region" as const,
  })),
  ...GLOBAL_WEATHER_ANCHORS.map((a) => ({
    id: `city-${a.id}`,
    label: a.nameKo,
    sub: `${a.name} · ${a.region ?? "주요 도시"}`,
    lat: a.lat,
    lng: a.lng,
    kind: "city" as const,
  })),
  ...GLOBAL_OCEAN_ANCHORS.map((o) => ({
    id: `ocean-${o.id}`,
    label: o.nameKo,
    sub: `${o.name} · 해양 모델`,
    lat: o.lat,
    lng: o.lng,
    kind: "ocean" as const,
  })),
];

export default function TopBar({
  totalEarthquakes,
  totalRawSensors,
  overallStatus,
  feedOpen,
  onToggleFeed,
  onOpenArchitecture,
  onSelectLocation,
}: TopBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_SEARCHABLE.slice(0, 7);

    // Check direct "lat, lng" input
    const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [
          {
            id: "direct-coord",
            label: `좌표 이동 (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
            sub: "직접 입력 좌표 실시간 관측",
            lat,
            lng,
            kind: "region" as const,
          },
        ];
      }
    }

    return ALL_SEARCHABLE.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q)
    ).slice(0, 7);
  }, [query]);

  const handlePick = (item: SearchCandidate) => {
    onSelectLocation(item.lat, item.lng, item.label, item.kind === "region" ? 2.4 : 2.05);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  const statusText =
    overallStatus === "live"
      ? "LIVE"
      : overallStatus === "cached"
        ? "CDN CACHE"
        : overallStatus === "stale"
          ? "STALE"
          : "SNAPSHOT";

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <div className="brand-chip">
          <div className="brand-emblem" aria-hidden="true">
            <GlobeSpinIcon size={18} />
          </div>
          <div className="brand-copy">
            <h1 className="brand-title">TerraPulse 3D</h1>
            <span className="brand-sub">실시간 지구 환경 · 재해 관측</span>
          </div>
        </div>

        <button
          id="btn-architecture-info"
          type="button"
          className={`status-pill status-${overallStatus}`}
          onClick={onOpenArchitecture}
          title="실시간 데이터 파이프라인 및 Vercel CDN 캐시 상태 보기"
        >
          <span className="status-dot" />
          <span className="mono">{statusText}</span>
          <span className="status-divider" />
          <span className="status-metric mono">
            지진 {totalEarthquakes} · 센서 {(totalRawSensors / 1000).toFixed(1)}k
          </span>
          <Info size={13} />
        </button>
      </div>

      <div className="top-bar-right">
        <div className="search-wrap">
          <div className={`search-box ${focused ? "is-focused" : ""}`}>
            <Search size={15} className="search-icon" />
            <input
              ref={inputRef}
              id="input-globe-search"
              type="text"
              value={query}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 160)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  handlePick(results[0]);
                } else if (e.key === "Escape") {
                  setFocused(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder="도시 · 해역 · 위경도 검색 (예: 서울, 도쿄, 35.6, 139.7)"
              aria-label="도시, 해역 또는 좌표 검색"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="icon-clear-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery("")}
                aria-label="검색어 지우기"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {focused && results.length > 0 && (
            <div className="search-dropdown" role="listbox">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePick(item);
                  }}
                >
                  <span className="search-item-main">{item.label}</span>
                  <span className="search-item-sub">{item.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          id="btn-toggle-feed"
          type="button"
          className={`hud-action-btn ${feedOpen ? "is-active" : ""}`}
          onClick={onToggleFeed}
          aria-pressed={feedOpen}
        >
          <RadarAlertIcon size={17} />
          <span className="btn-label-desktop">실시간 특보</span>
        </button>
      </div>
    </header>
  );
}
