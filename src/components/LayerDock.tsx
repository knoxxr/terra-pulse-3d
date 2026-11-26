"use client";

import React, { useState } from "react";
import { Cloud, SlidersHorizontal } from "lucide-react";
import {
  AirDustIcon,
  DayNightIcon,
  GlobeSpinIcon,
  MapLabelIcon,
  OceanWaveIcon,
  QuakeIcon,
  WeatherIcon,
} from "./DomainIcons";
import { QUICK_JUMP_PRESETS } from "@/lib/locations";
import type { LayerVisibility, QuakeWindow } from "@/types/telemetry";

interface LayerDockProps {
  layers: LayerVisibility;
  quakeWindow: QuakeWindow;
  minMag: number;
  quakeCount: number;
  weatherCount: number;
  oceanCount: number;
  airClusterCount: number;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onChangeQuakeWindow: (w: QuakeWindow) => void;
  onChangeMinMag: (mag: number) => void;
  onQuickJump: (lat: number, lng: number, label: string, altitude?: number) => void;
}

export default function LayerDock({
  layers,
  quakeWindow,
  minMag,
  quakeCount,
  weatherCount,
  oceanCount,
  airClusterCount,
  onToggleLayer,
  onChangeQuakeWindow,
  onChangeMinMag,
  onQuickJump,
}: LayerDockProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="dock-container">
      {filterOpen && (
        <div className="dock-popover" role="region" aria-label="관측 필터 및 표시 옵션">
          <div className="popover-section">
            <div className="popover-label">지도 그래픽 표시 옵션</div>
            <div className="segmented-row">
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.clouds ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("clouds")}
              >
                <Cloud size={14} />
                <span>구름층</span>
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.labels ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("labels")}
              >
                <MapLabelIcon size={14} />
                <span>지명·기온</span>
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn-icon ${layers.dayNight ? "is-selected" : ""}`}
                onClick={() => onToggleLayer("dayNight")}
              >
                <DayNightIcon size={14} active={layers.dayNight} />
                <span>주야간 조명</span>
              </button>
            </div>
          </div>

          <div className="popover-section">
            <div className="popover-label">지진 수집 기간 (USGS)</div>
            <div className="segmented-row">
              {(
                [
                  ["hour", "1시간"],
                  ["day", "24시간"],
                  ["week", "7일"],
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
          </div>

          <div className="popover-section">
            <div className="popover-label">
              최소 지진 규모 <span className="mono">M {minMag.toFixed(1)}+</span>
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

          <div className="popover-section">
            <div className="popover-label">빠른 권역 이동</div>
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
              <span className="legend-title">지진</span>
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
              <span>좋음</span>
              <span className="legend-swatch" style={{ background: "#eab308" }} />
              <span>보통</span>
              <span className="legend-swatch" style={{ background: "#f97316" }} />
              <span>나쁨</span>
              <span className="legend-swatch" style={{ background: "#ef4444" }} />
              <span>매우나쁨</span>
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
          <span className="dock-text">지진</span>
          <span className="dock-count mono">{quakeCount}</span>
        </button>

        <button
          id="layer-weather"
          type="button"
          className={`dock-btn ${layers.weather ? "is-active tone-weather" : ""}`}
          onClick={() => onToggleLayer("weather")}
          aria-pressed={layers.weather}
        >
          <WeatherIcon size={18} />
          <span className="dock-text">기상</span>
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
          <span className="dock-text">해양</span>
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
          <span className="dock-text">대기질</span>
          <span className="dock-count mono">{airClusterCount}</span>
        </button>

        <div className="dock-sep" aria-hidden="true" />

        <button
          id="btn-layer-filter"
          type="button"
          className={`dock-icon-btn ${filterOpen ? "is-active" : ""}`}
          onClick={() => setFilterOpen((v) => !v)}
          title="필터 · 그래픽 옵션 · 권역 이동"
          aria-label="필터 및 표시 옵션 열기"
        >
          <SlidersHorizontal size={16} />
        </button>

        <button
          id="btn-toggle-labels"
          type="button"
          className={`dock-icon-btn ${layers.labels ? "is-active" : ""}`}
          onClick={() => onToggleLayer("labels")}
          title={layers.labels ? "지명·기온 라벨 표시 중" : "지명 라벨 숨김"}
          aria-label="지명 라벨 전환"
        >
          <MapLabelIcon size={16} />
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
