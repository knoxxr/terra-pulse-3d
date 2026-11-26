"use client";

import React, { useState } from "react";
import { Cloud, History, SlidersHorizontal, Star } from "lucide-react";
import {
  AirDustIcon,
  DayNightIcon,
  DisasterHazardIcon,
  GlobeSpinIcon,
  MapLabelIcon,
  OceanWaveIcon,
  QuakeIcon,
  TectonicIcon,
  WeatherIcon,
} from "./DomainIcons";
import { QUICK_JUMP_PRESETS } from "@/lib/locations";
import { UI_TEXT, type Lang } from "@/lib/i18n";
import type {
  DisasterCategory,
  LayerVisibility,
  QuakeWindow,
  SavedPin,
} from "@/types/telemetry";

interface LayerDockProps {
  layers: LayerVisibility;
  quakeWindow: QuakeWindow;
  minMag: number;
  airDisplayMode: "pillar" | "bubble";
  badAirOnly: boolean;
  disasterCategories: Record<DisasterCategory, boolean>;
  lang: Lang;
  quakeCount: number;
  disasterCount: number;
  weatherCount: number;
  oceanCount: number;
  airClusterCount: number;
  timelineOpen: boolean;
  savedPins: SavedPin[];
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onToggleTimeline: () => void;
  onChangeQuakeWindow: (w: QuakeWindow) => void;
  onChangeMinMag: (mag: number) => void;
  onChangeAirDisplayMode: (mode: "pillar" | "bubble") => void;
  onToggleBadAirOnly: () => void;
  onToggleDisasterCategory: (cat: DisasterCategory) => void;
  onQuickJump: (lat: number, lng: number, label: string, altitude?: number) => void;
}

export default function LayerDock({
  layers,
  quakeWindow,
  minMag,
  airDisplayMode,
  badAirOnly,
  disasterCategories,
  lang,
  quakeCount,
  disasterCount,
  weatherCount,
  oceanCount,
  airClusterCount,
  timelineOpen,
  savedPins,
  onToggleLayer,
  onToggleTimeline,
  onChangeQuakeWindow,
  onChangeMinMag,
  onChangeAirDisplayMode,
  onToggleBadAirOnly,
  onToggleDisasterCategory,
  onQuickJump,
}: LayerDockProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const t = UI_TEXT[lang];
  const isEn = lang === "en";

  return (
    <div className="dock-container">
      {filterOpen && (
        <div className="dock-popover" role="region" aria-label="관측 필터 및 표시 옵션">
          <div className="popover-section">
            <div className="popover-label">
              {isEn ? "Map Graphics & Geological Overlays" : "지도 그래픽 · 지질 오버레이"}
            </div>
            <div className="segmented-row">
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.tectonic ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("tectonic")}
              >
                <TectonicIcon size={14} />
                <span>{isEn ? "Plates" : "지각판"}</span>
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.clouds ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("clouds")}
              >
                <Cloud size={14} />
                <span>{isEn ? "Clouds" : "구름층"}</span>
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.labels ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("labels")}
              >
                <MapLabelIcon size={14} />
                <span>{isEn ? "Labels" : "지명"}</span>
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.dayNight ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("dayNight")}
              >
                <DayNightIcon size={14} active={layers.dayNight} />
                <span>{isEn ? "Day/Night" : "주야간"}</span>
              </button>
            </div>
          </div>

          <div className="popover-section">
            <div className="popover-label">
              {isEn ? "Air Quality 3D Style & Filter" : "대기질 3D 표현 · 필터"}
            </div>
            <div className="segmented-row">
              <button
                type="button"
                className={`seg-btn ${airDisplayMode === "pillar" ? "is-selected" : ""}`}
                onClick={() => onChangeAirDisplayMode("pillar")}
              >
                {t.airModePillar}
              </button>
              <button
                type="button"
                className={`seg-btn ${airDisplayMode === "bubble" ? "is-selected" : ""}`}
                onClick={() => onChangeAirDisplayMode("bubble")}
              >
                {t.airModeBubble}
              </button>
              <button
                type="button"
                className={`seg-btn ${badAirOnly ? "is-selected is-warn-seg" : ""}`}
                onClick={onToggleBadAirOnly}
              >
                {t.badAirOnly}
              </button>
            </div>
          </div>

          <div className="popover-section">
            <div className="popover-label">
              {isEn ? "Hazard Categories (NASA EONET)" : "자연재해 유형 필터 (NASA EONET)"}
            </div>
            <div className="segmented-row">
              {(
                [
                  ["wildfires", isEn ? "Wildfire" : "산불"],
                  ["volcanoes", isEn ? "Volcano" : "화산"],
                  ["severeStorms", isEn ? "Storm" : "태풍"],
                  ["seaLakeIce", isEn ? "Iceberg" : "빙산"],
                ] as Array<[DisasterCategory, string]>
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  className={`seg-btn ${disasterCategories[cat] ? "is-selected" : ""}`}
                  onClick={() => onToggleDisasterCategory(cat)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="popover-section">
            <div className="popover-label">
              {isEn ? "Quake Window & Min Magnitude" : "지진 수집 기간 · 최소 규모"}{" "}
              <span className="mono">M {minMag.toFixed(1)}+</span>
            </div>
            <div className="segmented-row" style={{ marginBottom: 6 }}>
              {(
                [
                  ["hour", isEn ? "1h" : "1시간"],
                  ["day", isEn ? "24h" : "24시간"],
                  ["week", isEn ? "7d" : "7일"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`seg-btn ${quakeWindow === val ? "is-selected" : ""}`}
                  onClick={() => onChangeQuakeWindow(val)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="segmented-row">
              {[1.5, 2.5, 4.0, 5.0].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`seg-btn mono ${minMag === m ? "is-selected" : ""}`}
                  onClick={() => onChangeMinMag(m)}
                >
                  M{m.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          {savedPins.length > 0 && (
            <div className="popover-section">
              <div className="popover-label">
                {isEn ? "Pinned Locations" : "내 관심 지역 즐겨찾기"}
              </div>
              <div className="jump-chips">
                {savedPins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    className="jump-chip jump-chip-pin"
                    onClick={() => {
                      onQuickJump(pin.lat, pin.lng, pin.label, 1.5);
                      setFilterOpen(false);
                    }}
                  >
                    <Star size={11} fill="#fbbf24" color="#fbbf24" />
                    <span>{pin.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="popover-section">
            <div className="popover-label">{isEn ? "Quick Region Jump" : "빠른 권역 이동"}</div>
            <div className="jump-chips">
              {QUICK_JUMP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="jump-chip"
                  onClick={() => {
                    onQuickJump(p.lat, p.lng, p.label, p.altitude ? p.altitude - 0.35 : 1.9);
                    setFilterOpen(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="legend-row">
            <div className="legend-group">
              <span className="legend-title">{t.quakes}</span>
              <span className="legend-swatch" style={{ background: "#fde047" }} />
              <span>2.5</span>
              <span className="legend-swatch" style={{ background: "#f97316" }} />
              <span>4.5</span>
              <span className="legend-swatch" style={{ background: "#ef4444" }} />
              <span>6.0+</span>
            </div>
            <div className="legend-group">
              <span className="legend-title">PM2.5</span>
              <span className="legend-swatch" style={{ background: "#22c55e" }} />
              <span>{isEn ? "Good" : "좋음"}</span>
              <span className="legend-swatch" style={{ background: "#eab308" }} />
              <span>{isEn ? "Mod" : "보통"}</span>
              <span className="legend-swatch" style={{ background: "#f97316" }} />
              <span>{isEn ? "Bad" : "나쁨"}</span>
              <span className="legend-swatch" style={{ background: "#ef4444" }} />
              <span>{isEn ? "Sev" : "매우나쁨"}</span>
            </div>
          </div>
        </div>
      )}

      <nav className="layer-dock" aria-label="지구본 데이터 레이어 제어">
        <button
          id="layer-earthquakes"
          type="button"
          className={`dock-btn ${layers.earthquakes ? "is-active tone-quake" : ""}`}
          onClick={() => onToggleLayer("earthquakes")}
          aria-pressed={layers.earthquakes}
        >
          <QuakeIcon size={18} />
          <span className="dock-text">{t.quakes}</span>
          <span className="dock-count mono">{quakeCount}</span>
        </button>

        <button
          id="layer-disasters"
          type="button"
          className={`dock-btn ${layers.disasters ? "is-active tone-disaster" : ""}`}
          onClick={() => onToggleLayer("disasters")}
          aria-pressed={layers.disasters}
        >
          <DisasterHazardIcon size={18} />
          <span className="dock-text">{t.disasters}</span>
          <span className="dock-count mono">{disasterCount}</span>
        </button>

        <button
          id="layer-weather"
          type="button"
          className={`dock-btn ${layers.weather ? "is-active tone-weather" : ""}`}
          onClick={() => onToggleLayer("weather")}
          aria-pressed={layers.weather}
        >
          <WeatherIcon size={18} />
          <span className="dock-text">{t.weather}</span>
          <span className="dock-count mono">{weatherCount}</span>
        </button>

        <button
          id="layer-ocean"
          type="button"
          className={`dock-btn ${layers.ocean ? "is-active tone-ocean" : ""}`}
          onClick={() => onToggleLayer("ocean")}
          aria-pressed={layers.ocean}
        >
          <OceanWaveIcon size={18} />
          <span className="dock-text">{t.ocean}</span>
          <span className="dock-count mono">{oceanCount}</span>
        </button>

        <button
          id="layer-air"
          type="button"
          className={`dock-btn ${layers.airQuality ? "is-active tone-air" : ""}`}
          onClick={() => onToggleLayer("airQuality")}
          aria-pressed={layers.airQuality}
        >
          <AirDustIcon size={18} />
          <span className="dock-text">{t.air}</span>
          <span className="dock-count mono">{airClusterCount}</span>
        </button>

        <div className="dock-sep" aria-hidden="true" />

        <button
          id="btn-toggle-timeline"
          type="button"
          className={`dock-icon-btn ${timelineOpen ? "is-active" : ""}`}
          onClick={onToggleTimeline}
          title="타임라인 재생 (지진 리플레이 · +24h 기상 예보)"
          aria-label="타임라인 재생 열기"
        >
          <History size={16} />
        </button>

        <button
          id="btn-layer-filter"
          type="button"
          className={`dock-icon-btn ${filterOpen ? "is-active" : ""}`}
          onClick={() => setFilterOpen((v) => !v)}
          title="필터 · 지각판 · 즐겨찾기 · 권역 이동"
          aria-label="필터 및 표시 옵션 열기"
        >
          <SlidersHorizontal size={16} />
        </button>

        <button
          id="btn-toggle-daynight"
          type="button"
          className={`dock-icon-btn ${layers.dayNight ? "is-active" : ""}`}
          onClick={() => onToggleLayer("dayNight")}
          title={layers.dayNight ? "실시간 주야간 조명 켜짐" : "균일 지도 모드"}
          aria-label="주야간 조명 전환"
        >
          <DayNightIcon size={17} active={layers.dayNight} />
        </button>

        <button
          id="btn-toggle-rotate"
          type="button"
          className={`dock-icon-btn ${layers.autoRotate ? "is-active" : ""}`}
          onClick={() => onToggleLayer("autoRotate")}
          title="자동 자전 전환"
          aria-label="자동 자전 전환"
        >
          <GlobeSpinIcon size={17} spinning={layers.autoRotate} />
        </button>
      </nav>
    </div>
  );
}
