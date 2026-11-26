"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Droplets,
  Gauge,
  MapPin,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import {
  AqiGradeIcon,
  OceanWaveIcon,
  QuakeIcon,
  WeatherConditionIcon,
} from "./DomainIcons";
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

function formatKstTime(epochMs: number): string {
  const kst = new Date(epochMs + 9 * 3600_000);
  return `${kst.toISOString().slice(5, 10)} ${kst.toISOString().slice(11, 16)} KST`;
}

function WindCompassDial({
  deg,
  speedKmh,
  label = "풍향",
  accent = "#38bdf8",
}: {
  deg: number;
  speedKmh: number;
  label?: string;
  accent?: string;
}) {
  return (
    <div className="compass-widget">
      <svg viewBox="0 0 64 64" className="compass-svg" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
        <text x="32" y="11" textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="600">N</text>
        <text x="32" y="58" textAnchor="middle" fill="#64748b" fontSize="6.5">S</text>
        <text x="55" y="34" textAnchor="middle" fill="#64748b" fontSize="6.5">E</text>
        <text x="9" y="34" textAnchor="middle" fill="#64748b" fontSize="6.5">W</text>
        <g transform={`rotate(${deg} 32 32)`}>
          <line x1="32" y1="44" x2="32" y2="17" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="32,12 27.5,21 36.5,21" fill={accent} />
          <circle cx="32" cy="32" r="3" fill="#f8fafc" />
        </g>
      </svg>
      <div className="compass-info">
        <span className="metric-k">{label} · 방위</span>
        <strong className="metric-v mono">
          {getCardinalDirKo(deg)} ({deg}°)
        </strong>
        <span className="compass-speed mono" style={{ color: accent }}>
          {speedKmh.toFixed(1)} km/h
        </span>
      </div>
    </div>
  );
}

function DualForecastChart({
  temps,
  winds,
  labels,
}: {
  temps: number[];
  winds: number[];
  labels: string[];
}) {
  if (temps.length < 2) return null;
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const spanT = Math.max(1, maxT - minT);
  const maxW = Math.max(10, ...winds);
  const W = 280;
  const H = 68;
  const padX = 6;
  const padY = 8;

  const tempPts = temps.map((v, i) => {
    const x = padX + (i / (temps.length - 1)) * (W - padX * 2);
    const y = H - padY - ((v - minT) / spanT) * (H - padY * 2 - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const windPts = winds.map((v, i) => {
    const x = padX + (i / Math.max(1, winds.length - 1)) * (W - padX * 2);
    const y = H - padY - (v / maxW) * (H - padY * 2) * 0.55;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaPts = `${padX},${H - padY} ${tempPts.join(" ")} ${W - padX},${H - padY}`;

  return (
    <div className="sparkline-card">
      <div className="sparkline-header">
        <span>24시간 기온 · 풍속 추이 (UTC)</span>
        <span className="mono">
          {minT.toFixed(1)}° ~ {maxT.toFixed(1)}°C
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" aria-hidden="true">
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={H * 0.5} x2={W - padX} y2={H * 0.5} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <polygon points={areaPts} fill="url(#tempFill)" />
        {windPts.length > 1 && (
          <polyline
            points={windPts.join(" ")}
            fill="none"
            stroke="rgba(45, 212, 191, 0.55)"
            strokeWidth="1.4"
            strokeDasharray="2.5 2.5"
          />
        )}
        <polyline
          points={tempPts.join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="sparkline-axis mono">
        <span>{labels[0] ?? "00:00"}</span>
        <span className="sparkline-legend">
          <i className="dot-sky" /> 기온 <i className="dot-teal" /> 풍속
        </span>
        <span>{labels[labels.length - 1] ?? "23:00"}</span>
      </div>
    </div>
  );
}

function Pm25SpectrumBar({ pm25 }: { pm25: number }) {
  const pct = Math.max(2, Math.min(98, (pm25 / 110) * 100));
  const lvl = getPm25Level(pm25);
  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <span>WHO / 한국 대기질 지수 (PM2.5)</span>
        <strong className="mono" style={{ color: lvl.color }}>
          {lvl.label} ({pm25.toFixed(1)} µg/m³)
        </strong>
      </div>
      <div className="spectrum-bar">
        <div className="spectrum-seg seg-good" style={{ width: "18%" }} />
        <div className="spectrum-seg seg-mod" style={{ width: "22%" }} />
        <div className="spectrum-seg seg-bad" style={{ width: "30%" }} />
        <div className="spectrum-seg seg-vbad" style={{ width: "30%" }} />
        <span className="spectrum-needle" style={{ left: `${pct}%`, borderColor: lvl.color }} />
      </div>
      <div className="gauge-ticks mono">
        <span>0 좋음</span>
        <span>15</span>
        <span>35 보통</span>
        <span>75 나쁨</span>
        <span>110+</span>
      </div>
    </div>
  );
}

function QuakeDepthMeter({ mag, depthKm }: { mag: number; depthKm: number }) {
  const magPct = Math.max(6, Math.min(98, ((mag - 1) / 7.5) * 100));
  const depthPct = Math.max(3, Math.min(97, (depthKm / 650) * 100));
  const color = getMagnitudeColor(mag);
  const depthZone = depthKm < 70 ? "천발 (0–70km)" : depthKm < 300 ? "중발 (70–300km)" : "심발 (300km+)";

  return (
    <div className="gauge-stack">
      <div className="gauge-card">
        <div className="gauge-header">
          <span>리히터 규모 스케일</span>
          <strong className="mono" style={{ color }}>
            M {mag.toFixed(1)}
          </strong>
        </div>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${magPct}%`, background: color }} />
        </div>
        <div className="gauge-ticks mono">
          <span>M1.0</span>
          <span>M3.0</span>
          <span>M5.0</span>
          <span>M7.0+</span>
        </div>
      </div>

      <div className="gauge-card">
        <div className="gauge-header">
          <span>진원 깊이 단면 · {depthZone}</span>
          <strong className="mono">{depthKm.toFixed(1)} km</strong>
        </div>
        <div className="depth-track">
          <span className="depth-zone-mark" style={{ left: "11%" }} />
          <span className="depth-zone-mark" style={{ left: "46%" }} />
          <span className="depth-pin" style={{ left: `${depthPct}%`, background: color }} />
        </div>
        <div className="gauge-ticks mono">
          <span>지표 0km</span>
          <span>70km</span>
          <span>300km</span>
          <span>650km</span>
        </div>
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
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color, backgroundColor: `${color}22` }}>
              <QuakeIcon size={15} color={color} /> M {q.mag.toFixed(1)}
            </span>
            <span className="hero-tag">{timeAgoKo(q.time)}</span>
            {q.tsunami && <span className="tag-warn">쓰나미 경보 확인</span>}
          </div>
          <h2 className="inspector-title">{q.place}</h2>
          <p className="inspector-coord mono">
            {formatCoord(q.lat, q.lng)} · {formatKstTime(q.time)}
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
              <WeatherConditionIcon code={w.weatherCode} isDay={w.isDay} size={16} /> {w.tempC.toFixed(1)}°C
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
      const seaState =
        o.waveHeightM < 1.25
          ? "잔잔함"
          : o.waveHeightM < 2.5
            ? "보통 물결"
            : o.waveHeightM < 4.0
              ? "높은 파고"
              : "매우 거침";
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color: "#2dd4bf", background: "rgba(45,212,191,0.16)" }}>
              <OceanWaveIcon size={15} color="#2dd4bf" /> 파고 {o.waveHeightM.toFixed(2)} m
            </span>
            <span className="hero-tag">{seaState}</span>
          </div>
          <h2 className="inspector-title">
            {o.nameKo} <span className="title-sub">{o.name}</span>
          </h2>
          <p className="inspector-coord mono">{formatCoord(o.lat, o.lng)} · NOAA/ECMWF Marine</p>
        </div>
      );
    }

    if (selected.kind === "air") {
      const a = selected.data;
      const lvl = getPm25Level(a.pm25);
      const isKorea = a.country === "KR" && Boolean(a.stationName);
      return (
        <div className="inspector-hero">
          <div className="hero-badge-row">
            <span className="hero-pill mono" style={{ color: lvl.color, background: lvl.bg }}>
              <AqiGradeIcon pm25={a.pm25} size={16} />
              PM2.5 {a.pm25.toFixed(1)} µg/m³ · {lvl.label}
            </span>
            {a.khaiValue != null && (
              <span className="hero-tag mono">통합지수 KHAI {a.khaiValue}</span>
            )}
            <span className="hero-tag">{a.provider}</span>
          </div>
          <h2 className="inspector-title">
            {isKorea
              ? `${a.stationName}${a.mangName ? ` · ${a.mangName}` : ""}`
              : `${a.country} 환경 센서 클러스터 (${a.sensorCount}개)`}
          </h2>
          <p className="inspector-coord mono">
            {formatCoord(a.lat, a.lng)} · {a.timestamp}
          </p>
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

        {selected.kind === "earthquake" && (
          <section className="inspector-section">
            <h3 className="section-label">지진 상세 계측 (USGS)</h3>
            <QuakeDepthMeter mag={selected.data.mag} depthKm={selected.data.depthKm} />
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">중요도 지수 (Sig)</span>
                <strong className="metric-v mono">{selected.data.sig}</strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">체감 신고 (DYFI)</span>
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

        {selected.kind === "air" && (
          <section className="inspector-section">
            <h3 className="section-label">
              {selected.data.country === "KR"
                ? `한국 대기질 상세 (${selected.data.provider})`
                : "실시간 대기질 · 환경 센서 집계"}
            </h3>
            <Pm25SpectrumBar pm25={selected.data.pm25} />
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">미세먼지 PM10</span>
                <strong className="metric-v mono">
                  {selected.data.pm10 !== null ? `${selected.data.pm10.toFixed(1)} µg/m³` : "—"}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">
                  {selected.data.khaiValue != null ? "통합대기지수 (KHAI)" : "센서 수 / 제공"}
                </span>
                <strong className="metric-v mono">
                  {selected.data.khaiValue != null
                    ? `${selected.data.khaiValue} (${selected.data.sensorCount}개소)`
                    : `${selected.data.sensorCount}개 활성`}
                </strong>
              </div>
              {selected.data.o3Ppm != null || selected.data.no2Ppm != null ? (
                <>
                  <div className="metric-cell">
                    <span className="metric-k">오존 (O₃)</span>
                    <strong className="metric-v mono">
                      {selected.data.o3Ppm != null ? `${selected.data.o3Ppm.toFixed(3)} ppm` : "—"}
                    </strong>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-k">이산화질소 (NO₂)</span>
                    <strong className="metric-v mono">
                      {selected.data.no2Ppm != null ? `${selected.data.no2Ppm.toFixed(3)} ppm` : "—"}
                    </strong>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-k">일산화탄소 (CO)</span>
                    <strong className="metric-v mono">
                      {selected.data.coPpm != null ? `${selected.data.coPpm.toFixed(2)} ppm` : "—"}
                    </strong>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-k">아황산가스 (SO₂)</span>
                    <strong className="metric-v mono">
                      {selected.data.so2Ppm != null ? `${selected.data.so2Ppm.toFixed(3)} ppm` : "—"}
                    </strong>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </section>
        )}

        <section className="inspector-section">
          <h3 className="section-label">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {inspect?.weather && (
                <WeatherConditionIcon code={inspect.weather.weatherCode} size={16} />
              )}
              <span>
                기상 모델 텔레메트리
                {inspect?.weather ? ` · ${getWeatherDescriptionKo(inspect.weather.weatherCode)}` : ""}
              </span>
            </span>
            {loading && <span className="loading-dot">수신 중...</span>}
          </h3>
          {inspect?.weather ? (
            <>
              <WindCompassDial
                deg={inspect.weather.windDirDeg}
                speedKmh={inspect.weather.windSpeedKmh}
                label={`풍향 (돌풍 ${inspect.weather.windGustKmh} km/h)`}
              />
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
                    <CloudRain size={12} /> 강수 · 날씨
                  </span>
                  <strong className="metric-v mono">
                    {inspect.weather.precipMm.toFixed(1)} mm
                  </strong>
                </div>
                <div className="metric-cell">
                  <span className="metric-k">
                    <Droplets size={12} /> 상대 습도
                  </span>
                  <strong className="metric-v mono">{inspect.weather.humidityPct}%</strong>
                </div>
                <div className="metric-cell">
                  <span className="metric-k">
                    <Gauge size={12} /> 해면 기압
                  </span>
                  <strong className="metric-v mono">{inspect.weather.pressureHpa} hPa</strong>
                </div>
              </div>
              <DualForecastChart
                temps={inspect.weather.hourlyTempC}
                winds={inspect.weather.hourlyWindKmh}
                labels={inspect.weather.hourlyLabels}
              />
            </>
          ) : (
            <p className="empty-hint">
              {loading
                ? "Open-Meteo 모델에서 기상 데이터를 조회하고 있습니다..."
                : "해당 좌표의 기상 정보를 불러오지 못했습니다."}
            </p>
          )}
        </section>

        {(inspect?.marine || selected.kind === "ocean") && (
          <section className="inspector-section">
            <h3 className="section-label">해양 모델 (파고 · 해류 · 너울)</h3>
            <WindCompassDial
              deg={
                inspect?.marine?.waveDirDeg ??
                (selected.kind === "ocean" ? selected.data.waveDirDeg : 0)
              }
              speedKmh={
                inspect?.marine?.currentVelKmh ??
                (selected.kind === "ocean" ? selected.data.currentVelKmh : 0)
              }
              label="파향 · 표층 해류"
              accent="#2dd4bf"
            />
            <div className="metric-grid">
              <div className="metric-cell">
                <span className="metric-k">
                  <OceanWaveIcon size={13} color="#2dd4bf" /> 유의 파고
                </span>
                <strong className="metric-v mono" style={{ color: "#2dd4bf" }}>
                  {(
                    inspect?.marine?.waveHeightM ??
                    (selected.kind === "ocean" ? selected.data.waveHeightM : 0)
                  ).toFixed(2)}{" "}
                  m
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">
                  <Wind size={12} /> 파주기
                </span>
                <strong className="metric-v mono">
                  {(
                    inspect?.marine?.wavePeriodS ??
                    (selected.kind === "ocean" ? selected.data.wavePeriodS : 0)
                  ).toFixed(1)}{" "}
                  sec
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">
                  <Compass size={12} /> 너울 파고
                </span>
                <strong className="metric-v mono">
                  {inspect?.marine?.swellHeightM !== null &&
                  inspect?.marine?.swellHeightM !== undefined
                    ? `${inspect.marine.swellHeightM.toFixed(2)} m`
                    : "—"}
                </strong>
              </div>
              <div className="metric-cell">
                <span className="metric-k">해류 유속</span>
                <strong className="metric-v mono">
                  {inspect?.marine?.currentVelKmh ??
                    (selected.kind === "ocean" ? selected.data.currentVelKmh : 0)}{" "}
                  km/h
                </strong>
              </div>
            </div>
          </section>
        )}

        <section className="inspector-section">
          <h3 className="section-label">인근 크로스 레이어 관측</h3>
          <div className="nearby-stack">
            {nearby.quake && selected.kind !== "earthquake" && (
              <div className="nearby-row">
                <span className="nearby-k">최근접 지진</span>
                <span className="nearby-v mono">
                  M{nearby.quake.mag.toFixed(1)} ·{" "}
                  {Math.round(nearby.quake.distanceKm).toLocaleString()} km
                </span>
              </div>
            )}
            {nearby.sensor && selected.kind !== "air" && (
              <div className="nearby-row">
                <span className="nearby-k">최근접 환경 센서</span>
                <span
                  className="nearby-v mono"
                  style={{ color: getPm25Level(nearby.sensor.pm25).color }}
                >
                  PM2.5 {nearby.sensor.pm25.toFixed(1)} ·{" "}
                  {Math.round(nearby.sensor.distanceKm).toLocaleString()} km
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
