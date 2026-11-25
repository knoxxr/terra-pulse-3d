"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Droplets,
  Gauge,
  MapPin,
  Thermometer,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  formatCoord,
  getCardinalDirKo,
  getMagnitudeColor,
  getPm25Level,
  getWeatherDescriptionKo,
  haversineKm,
  timeAgoKo,
} from "@/lib/geo";
import type {
  AirQualityCluster,
  ApiEnvelope,
  EarthquakeEvent,
  PointInspectData,
  SelectedItem,
} from "@/types/telemetry";

interface InspectorPanelProps {
  selected: SelectedItem | null;
  earthquakes: EarthquakeEvent[];
  airQuality: AirQualityCluster[];
  onClose: () => void;
}

function TempSparkline({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const W = 280;
  const H = 56;
  const padX = 6;
  const padY = 8;

  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (W - padX * 2);
    const y = H - padY - ((v - min) / span) * (H - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPts = `${padX},${H - padY} ${pts.join(" ")} ${W - padX},${H - padY}`;

  return (
    <div className="sparkline-card">
      <div className="sparkline-header">
        <span>24시간 기온 추이 (UTC)</span>
        <span className="mono">
          {min.toFixed(1)}° ~ {max.toFixed(1)}°C
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" aria-hidden="true">
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#tempFill)" />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="sparkline-axis mono">
        <span>{labels[0] ?? "00:00"}</span>
        <span>{labels[Math.floor(labels.length / 2)] ?? "12:00"}</span>
        <span>{labels[labels.length - 1] ?? "23:00"}</span>
      </div>
    </div>
  );
}

export default function InspectorPanel({
  selected,
  earthquakes,
  airQuality,
  onClose,
}: InspectorPanelProps) {
  const [inspectState, setInspectState] = useState<{
    key: string;
    data: PointInspectData | null;
  } | null>(null);
  const [expandedMobile, setExpandedMobile] = useState(false);

  const coords = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "point") return { lat: selected.lat, lng: selected.lng };
    return { lat: selected.data.lat, lng: selected.data.lng };
  }, [selected]);

  const coordKey = coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : null;

  // Fetch quantized 0.25° Open-Meteo Weather & Marine context for any clicked point/item
  useEffect(() => {
    if (!coords || !coordKey) return;
    let cancelled = false;

    fetch(`/api/point-inspect?lat=${coords.lat.toFixed(3)}&lng=${coords.lng.toFixed(3)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ApiEnvelope<PointInspectData> | null) => {
        if (!cancelled) {
          setInspectState({ key: coordKey, data: json?.data ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInspectState({ key: coordKey, data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coords, coordKey]);

  const inspect = coordKey && inspectState?.key === coordKey ? inspectState.data : null;
  const loading = Boolean(coordKey && inspectState?.key !== coordKey);

  // Compute nearest seismic event & nearest environmental sensor cluster client-side in O(N) (<1ms)
  const nearby = useMemo(() => {
    if (!coords) return { quake: null, sensor: null };

    let nearestQ: (EarthquakeEvent & { distanceKm: number }) | null = null;
    for (const q of earthquakes) {
      const d = haversineKm(coords.lat, coords.lng, q.lat, q.lng);
      if (!nearestQ || d < nearestQ.distanceKm) {
        nearestQ = { ...q, distanceKm: d };
      }
    }

    let nearestS: (AirQualityCluster & { distanceKm: number }) | null = null;
    for (const s of airQuality) {
      const d = haversineKm(coords.lat, coords.lng, s.lat, s.lng);
      if (!nearestS || d < nearestS.distanceKm) {
        nearestS = { ...s, distanceKm: d };
      }
    }
    return { quake: nearestQ, sensor: nearestS };
  }, [coords, earthquakes, airQuality]);

  if (!selected || !coords) return null;

  const renderPrimaryHeader = () => {
    if (selected.kind === "earthquake") {
      const q = selected.data;
      const color = getMagnitudeColor(q.mag);
      const depthType = q.depthKm < 70 ? "천발 지진" : q.depthKm < 300 ? "중발 지진" : "심발 지진";
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color, backgroundColor: `${color}22` }}>
              <Activity size={13} /> M {q.mag.toFixed(1)}
            </span>
            <span className="hero-tag">{depthType}</span>
            {q.tsunami && <span className="tag-warn">쓰나미 경보 확인</span>}
          </div>
          <h2 className="inspector-title">{q.place}</h2>
          <p className="inspector-coord mono">
            {formatCoord(q.lat, q.lng)} · {timeAgoKo(q.time)}
          </p>
        </div>
      );
    }

    if (selected.kind === "weather") {
      const w = selected.data;
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color: "#38bdf8", background: "rgba(56,189,248,0.16)" }}>
              <Thermometer size={13} /> {w.tempC.toFixed(1)}°C
            </span>
            <span className="hero-tag">{getWeatherDescriptionKo(w.weatherCode)}</span>
          </div>
          <h2 className="inspector-title">
            {w.nameKo} <span className="title-sub">{w.name}</span>
          </h2>
          <p className="inspector-coord mono">{formatCoord(w.lat, w.lng)} · Open-Meteo</p>
        </div>
      );
    }

    if (selected.kind === "ocean") {
      const o = selected.data;
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color: "#2dd4bf", background: "rgba(45,212,191,0.16)" }}>
              <Waves size={13} /> 파고 {o.waveHeightM.toFixed(2)} m
            </span>
            <span className="hero-tag">NOAA · ECMWF 해양 모델</span>
          </div>
          <h2 className="inspector-title">
            {o.nameKo} <span className="title-sub">{o.name}</span>
          </h2>
          <p className="inspector-coord mono">{formatCoord(o.lat, o.lng)}</p>
        </div>
      );
    }

    if (selected.kind === "air") {
      const a = selected.data;
      const lvl = getPm25Level(a.pm25);
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color: lvl.color, background: lvl.bg }}>
              PM2.5 {a.pm25.toFixed(1)} µg/m³ · {lvl.label}
            </span>
            <span className="hero-tag">{a.provider}</span>
          </div>
          <h2 className="inspector-title">
            {a.country} 환경 센서 클러스터 ({a.sensorCount}개)
          </h2>
          <p className="inspector-coord mono">{formatCoord(a.lat, a.lng)}</p>
        </div>
      );
    }

    return (
      <div className="inspector-hero">
        <div className="hero-badge-row">
          <span className="hero-pill" style={{ color: "#38bdf8", background: "rgba(56,189,248,0.16)" }}>
            <MapPin size={13} /> 실시간 좌표 관측
          </span>
        </div>
        <h2 className="inspector-title">{selected.label ?? "지정 좌표 텔레메트리"}</h2>
        <p className="inspector-coord mono">{formatCoord(selected.lat, selected.lng)}</p>
      </div>
    );
  };

  return (
    <aside
      className={`inspector-panel ${expandedMobile ? "is-expanded" : ""}`}
      aria-label="선택 지점 실시간 상세 데이터"
    >
      {/* Mobile drag/expand handle */}
      <div className="sheet-handle-bar">
        <button
          type="button"
          className="sheet-expand-btn"
          onClick={() => setExpandedMobile((v) => !v)}
          aria-label={expandedMobile ? "상세 패널 접기" : "상세 패널 펼치기"}
        >
          <span className="sheet-grabber" />
          {expandedMobile ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button type="button" className="close-btn" onClick={onClose} aria-label="패널 닫기">
          <X size={16} />
        </button>
      </div>

      <div className="inspector-scroll">
        {renderPrimaryHeader()}

        {/* Earthquake Specific Metrics */}
        {selected.kind === "earthquake" && (
          <section className="inspector-section">
            <h3 className="section-label">지진 상세 계측 (USGS)</h3>
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">규모 (Mag)</span>
                <strong className="metric-v mono" style={{ color: getMagnitudeColor(selected.data.mag) }}>
                  {selected.data.mag.toFixed(1)}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">진원 깊이</span>
                <strong className="metric-v mono">{selected.data.depthKm.toFixed(1)} km</strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">중요도 지수</span>
                <strong className="metric-v mono">{selected.data.sig}</strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">체감 신고</span>
                <strong className="metric-v mono">{selected.data.felt ?? 0}건</strong>
              </div>
            </div>
            <a
              href={selected.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link-btn"
            >
              <span>USGS 공식 지진 리포트 열기</span>
              <ArrowUpRight size={14} />
            </a>
          </section>
        )}

        {/* Air Quality Sensor Cluster Metrics */}
        {selected.kind === "air" && (
          <section className="inspector-section">
            <h3 className="section-label">실시간 대기질 · 환경 센서 집계</h3>
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">초미세먼지 PM2.5</span>
                <strong className="metric-v mono" style={{ color: getPm25Level(selected.data.pm25).color }}>
                  {selected.data.pm25.toFixed(1)} µg/m³
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">미세먼지 PM10</span>
                <strong className="metric-v mono">
                  {selected.data.pm10 !== null ? `${selected.data.pm10.toFixed(1)} µg/m³` : "—"}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">센서 기온 / 습도</span>
                <strong className="metric-v mono">
                  {selected.data.tempC !== null ? `${selected.data.tempC.toFixed(1)}°C` : "—"} /{" "}
                  {selected.data.humidityPct !== null ? `${selected.data.humidityPct}%` : "—"}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">대기압</span>
                <strong className="metric-v mono">
                  {selected.data.pressureHpa !== null ? `${selected.data.pressureHpa} hPa` : "—"}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Live Atmospheric Weather Telemetry (Open-Meteo) */}
        <section className="inspector-section">
          <h3 className="section-label">
            기상 모델 텔레메트리 {loading && <span className="loading-dot">수신 중...</span>}
          </h3>
          {inspect?.weather ? (
            <>
              <div className="metric-grid">
                <div className="metric-cell">
                  <span className="metric-k">
                    <Thermometer size={12} /> 기온 (체감)
                  </span>
                  <strong className="metric-v mono">
                    {inspect.weather.tempC.toFixed(1)}°C{" "}
                    <span className="metric-sub">({inspect.weather.apparentTempC.toFixed(0)}°)</span>
                  </strong>
                </div>
                <div className="metric-cell">
                  <span className="metric-k">
                    <Wind size={12} /> 풍향 · 풍속
                  </span>
                  <strong className="metric-v mono">
                    {getCardinalDirKo(inspect.weather.windDirDeg)} {inspect.weather.windSpeedKmh} km/h
                  </strong>
                </div>
                <div className="metric-cell">
                  <span className="metric-k">
                    <CloudRain size={12} /> 강수량
                  </span>
                  <strong className="metric-v mono">{inspect.weather.precipMm.toFixed(1)} mm</strong>
                </div>
                <div className="metric-cell">
                  <span className="metric-k">
                    <Droplets size={12} /> 습도 · <Gauge size={12} /> 기압
                  </span>
                  <strong className="metric-v mono">
                    {inspect.weather.humidityPct}% · {inspect.weather.pressureHpa} hPa
                  </strong>
                </div>
              </div>
              <TempSparkline
                values={inspect.weather.hourlyTempC}
                labels={inspect.weather.hourlyLabels}
              />
            </>
          ) : (
            <p className="empty-hint">
              {loading ? "Open-Meteo 모델에서 기상 데이터를 조회하고 있습니다..." : "해당 좌표의 기상 정보를 불러오지 못했습니다."}
            </p>
          )}
        </section>

        {/* Marine / Ocean Telemetry if over sea or ocean node selected */}
        {(inspect?.marine || selected.kind === "ocean") && (
          <section className="inspector-section">
            <h3 className="section-label">해양 모델 (파고 · 해류 · 너울)</h3>
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">
                  <Waves size={12} /> 유의 파고
                </span>
                <strong className="metric-v mono" style={{ color: "#2dd4bf" }}>
                  {(inspect?.marine?.waveHeightM ?? (selected.kind === "ocean" ? selected.data.waveHeightM : 0)).toFixed(2)} m
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">파주기 · 파향</span>
                <strong className="metric-v mono">
                  {(inspect?.marine?.wavePeriodS ?? (selected.kind === "ocean" ? selected.data.wavePeriodS : 0)).toFixed(1)}s ·{" "}
                  {getCardinalDirKo(
                    inspect?.marine?.waveDirDeg ?? (selected.kind === "ocean" ? selected.data.waveDirDeg : 0)
                  )}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">
                  <Compass size={12} /> 표층 해류
                </span>
                <strong className="metric-v mono">
                  {inspect?.marine?.currentVelKmh ?? (selected.kind === "ocean" ? selected.data.currentVelKmh : 0)} km/h
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">너울 파고</span>
                <strong className="metric-v mono">
                  {inspect?.marine?.swellHeightM !== null && inspect?.marine?.swellHeightM !== undefined
                    ? `${inspect.marine.swellHeightM.toFixed(2)} m`
                    : "—"}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Proximity Cross-Layer Telemetry */}
        <section className="inspector-section">
          <h3 className="section-label">인근 크로스 레이어 관측</h3>
          <div className="nearby-stack">
            {nearby.quake && selected.kind !== "earthquake" && (
              <div className="nearby-row">
                <span className="nearby-k">최근접 지진</span>
                <span className="nearby-v mono">
                  M{nearby.quake.mag.toFixed(1)} · {Math.round(nearby.quake.distanceKm).toLocaleString()} km
                </span>
              </div>
            )}
            {nearby.sensor && selected.kind !== "air" && (
              <div className="nearby-row">
                <span className="nearby-k">최근접 환경 센서</span>
                <span className="nearby-v mono" style={{ color: getPm25Level(nearby.sensor.pm25).color }}>
                  PM2.5 {nearby.sensor.pm25.toFixed(1)} · {Math.round(nearby.sensor.distanceKm).toLocaleString()} km
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
