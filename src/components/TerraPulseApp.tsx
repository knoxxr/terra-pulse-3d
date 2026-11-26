"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import TopBar from "./TopBar";
import LayerDock from "./LayerDock";
import EventFeedDrawer from "./EventFeedDrawer";
import InspectorPanel from "./InspectorPanel";
import ArchitectureModal from "./ArchitectureModal";
import ZoomControls from "./ZoomControls";
import TelemetryHud from "./TelemetryHud";
import TimelinePlayer, { type TimelineMode } from "./TimelinePlayer";
import { exportGlobeSnapshot } from "@/lib/snapshot";
import { haversineKm } from "@/lib/geo";
import type {
  AirQualityPayload,
  ApiEnvelope,
  CameraTelemetry,
  DataSourceStatus,
  DisasterEvent,
  EarthquakeEvent,
  LayerVisibility,
  QuakeWindow,
  SavedPin,
  SelectedItem,
  WeatherOceanPayload,
  ZoomCommand,
} from "@/types/telemetry";

const EarthGlobe = dynamic(() => import("./EarthGlobe"), {
  ssr: false,
  loading: () => (
    <div className="globe-loading">
      <div className="globe-spinner" />
      <p>고정밀 50m 3D 지구본 텔레메트리 엔진 초기화 중...</p>
    </div>
  ),
});

interface FeedMeta {
  source: string;
  status: DataSourceStatus;
  updatedAt: string;
  ttlSeconds: number;
  rawCount: number;
  returnedCount: number;
}

const DEFAULT_META: FeedMeta = {
  source: "수신 대기 중",
  status: "cached",
  updatedAt: new Date().toISOString(),
  ttlSeconds: 60,
  rawCount: 0,
  returnedCount: 0,
};

const PINS_STORAGE_KEY = "terrapulse_saved_pins_v1";

function loadInitialPins(): SavedPin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPin[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export default function TerraPulseApp() {
  const [layers, setLayers] = useState<LayerVisibility>({
    earthquakes: true,
    disasters: true,
    weather: true,
    ocean: true,
    airQuality: true,
    tectonic: true,
    dayNight: true,
    clouds: true,
    labels: true,
    autoRotate: false,
  });

  const [quakeWindow, setQuakeWindow] = useState<QuakeWindow>("day");
  const [minMag, setMinMag] = useState<number>(2.5);

  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [weatherOcean, setWeatherOcean] = useState<WeatherOceanPayload>({
    weather: [],
    ocean: [],
    modelInfo: "Open-Meteo",
  });
  const [airQuality, setAirQuality] = useState<AirQualityPayload>({
    clusters: [],
    totalRawSensors: 0,
    dustSensorCount: 0,
    climateSensorCount: 0,
    globalAvgPm25: 0,
    koreaStationCount: 0,
    koreaSource: "none",
  });

  const [quakeMeta, setQuakeMeta] = useState<FeedMeta>(DEFAULT_META);
  const [disasterMeta, setDisasterMeta] = useState<FeedMeta>(DEFAULT_META);
  const [weatherMeta, setWeatherMeta] = useState<FeedMeta>(DEFAULT_META);
  const [airMeta, setAirMeta] = useState<FeedMeta>(DEFAULT_META);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lng: number;
    altitude?: number;
    nonce: number;
  } | null>(null);
  const [zoomCommand, setZoomCommand] = useState<ZoomCommand | null>(null);
  const [telemetry, setTelemetry] = useState<CameraTelemetry>({
    altitudeKm: 10512,
    zoomPct: 58,
    cameraLat: 33,
    cameraLng: 128,
    cameraDist: 2.65,
    cursorLat: null,
    cursorLng: null,
  });

  // Timeline playback state
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("quakes");
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSpeed, setTimelineSpeed] = useState<1 | 3>(1);
  const [quakeReplayProgress, setQuakeReplayProgress] = useState(1);
  const [forecastIndex, setForecastIndex] = useState(0);

  // Saved pins (localStorage), GPS & Snapshot UI state
  const [savedPins, setSavedPins] = useState<SavedPin[]>(loadInitialPins);
  const [locating, setLocating] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone?: "info" | "warn" } | null>(null);

  const [feedOpen, setFeedOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);

  const nonceRef = useRef(1);
  const captureRef = useRef<(() => string | null) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertShownRef = useRef(false);

  const showToast = useCallback((text: string, tone: "info" | "warn" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const triggerFlyTo = useCallback((lat: number, lng: number, altitude?: number) => {
    nonceRef.current += 1;
    setFlyToTarget({ lat, lng, altitude, nonce: nonceRef.current });
  }, []);

  const triggerZoom = useCallback((action: ZoomCommand["action"]) => {
    nonceRef.current += 1;
    setZoomCommand({ action, nonce: nonceRef.current });
  }, []);

  // Parse shared deep-link URL (?lat=...&lng=...&alt=...&layers=...) once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const alt = Number(params.get("alt"));
    const layerParam = params.get("layers");

    if (layerParam) {
      const set = new Set(layerParam.split(","));
      // Apply asynchronously via microtask to satisfy React 19 lint rules
      queueMicrotask(() => {
        setLayers((prev) => ({
          ...prev,
          earthquakes: set.has("q"),
          disasters: set.has("d"),
          weather: set.has("w"),
          ocean: set.has("o"),
          airQuality: set.has("a"),
          tectonic: set.has("t"),
        }));
      });
    }

    if (Number.isFinite(lat) && Number.isFinite(lng) && params.has("lat") && params.has("lng")) {
      queueMicrotask(() => {
        triggerFlyTo(lat, lng, Number.isFinite(alt) && alt >= 1.13 && alt <= 4.8 ? alt : 1.9);
      });
    }
  }, [triggerFlyTo]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        triggerZoom("in");
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        triggerZoom("out");
      } else if (e.key === "0") {
        e.preventDefault();
        triggerZoom("reset");
      } else if (e.key === "Escape") {
        setSelected(null);
        setArchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerZoom]);

  // Live visibility-aware polling for all 4 telemetry feeds
  useEffect(() => {
    let active = true;
    const fetchQuakes = async () => {
      try {
        const res = await fetch(`/api/earthquakes?window=${quakeWindow}&minMag=${minMag}`);
        if (!res.ok) return;
        const json = (await res.json()) as ApiEnvelope<EarthquakeEvent[]>;
        if (!active) return;
        setEarthquakes(json.data);
        setQuakeMeta(json.meta);
      } catch {
        // Keep previous data
      }
    };
    void fetchQuakes();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchQuakes();
    }, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [quakeWindow, minMag]);

  useEffect(() => {
    let active = true;
    const fetchDisasters = async () => {
      try {
        const res = await fetch("/api/disasters");
        if (!res.ok) return;
        const json = (await res.json()) as ApiEnvelope<DisasterEvent[]>;
        if (!active) return;
        setDisasters(json.data);
        setDisasterMeta(json.meta);
      } catch {
        // Keep previous data
      }
    };
    void fetchDisasters();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchDisasters();
    }, 300_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchWeatherOcean = async () => {
      try {
        const res = await fetch("/api/weather-ocean");
        if (!res.ok) return;
        const json = (await res.json()) as ApiEnvelope<WeatherOceanPayload>;
        if (!active) return;
        setWeatherOcean(json.data);
        setWeatherMeta(json.meta);
      } catch {
        // Keep previous data
      }
    };
    void fetchWeatherOcean();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchWeatherOcean();
    }, 300_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchAirQuality = async () => {
      try {
        const res = await fetch("/api/air-quality");
        if (!res.ok) return;
        const json = (await res.json()) as ApiEnvelope<AirQualityPayload>;
        if (!active) return;
        setAirQuality(json.data);
        setAirMeta(json.meta);
      } catch {
        // Keep previous data
      }
    };
    void fetchAirQuality();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchAirQuality();
    }, 300_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Threshold monitoring toast for user's saved favorite locations (zero-DB client check)
  useEffect(() => {
    if (alertShownRef.current || savedPins.length === 0) return;
    if (earthquakes.length === 0 && airQuality.clusters.length === 0) return;

    for (const pin of savedPins) {
      const nearQuake = earthquakes.find(
        (q) => q.mag >= 4.0 && haversineKm(pin.lat, pin.lng, q.lat, q.lng) <= 350
      );
      if (nearQuake) {
        alertShownRef.current = true;
        queueMicrotask(() => {
          showToast(
            `관심 지역 [${pin.label}] 인근 M${nearQuake.mag.toFixed(1)} 지진 감지`,
            "warn"
          );
        });
        return;
      }
      const nearBadAir = airQuality.clusters.find(
        (a) => a.pm25 >= 36 && haversineKm(pin.lat, pin.lng, a.lat, a.lng) <= 65
      );
      if (nearBadAir) {
        alertShownRef.current = true;
        queueMicrotask(() => {
          showToast(
            `관심 지역 [${pin.label}] 초미세먼지 나쁨 (PM2.5 ${nearBadAir.pm25.toFixed(0)})`,
            "warn"
          );
        });
        return;
      }
    }
  }, [savedPins, earthquakes, airQuality.clusters, showToast]);

  // Derived timeline data: filtered earthquakes (replay mode) & forecasted weather (+0h..+24h)
  const { quakeTimeRange, displayedEarthquakes } = useMemo(() => {
    if (earthquakes.length === 0) {
      return { quakeTimeRange: { min: 0, max: 0 }, displayedEarthquakes: earthquakes };
    }
    let minT = earthquakes[0].time;
    let maxT = earthquakes[0].time;
    for (const q of earthquakes) {
      if (q.time < minT) minT = q.time;
      if (q.time > maxT) maxT = q.time;
    }
    if (!timelineOpen || timelineMode !== "quakes" || quakeReplayProgress >= 0.999) {
      return { quakeTimeRange: { min: minT, max: maxT }, displayedEarthquakes: earthquakes };
    }
    const cutoff = minT + (maxT - minT) * quakeReplayProgress;
    return {
      quakeTimeRange: { min: minT, max: maxT },
      displayedEarthquakes: earthquakes.filter((q) => q.time <= cutoff),
    };
  }, [earthquakes, timelineOpen, timelineMode, quakeReplayProgress]);

  const quakeCutoffMs =
    quakeTimeRange.min + (quakeTimeRange.max - quakeTimeRange.min) * quakeReplayProgress;

  const displayedWeather = useMemo(() => {
    if (!timelineOpen || timelineMode !== "forecast" || forecastIndex === 0) {
      return weatherOcean.weather;
    }
    return weatherOcean.weather.map((w) => {
      const step = w.forecastSteps?.[forecastIndex];
      if (!step) return w;
      return {
        ...w,
        tempC: step.tempC,
        windSpeedKmh: step.windSpeedKmh,
        windDirDeg: step.windDirDeg,
        weatherCode: step.weatherCode,
      };
    });
  }, [weatherOcean.weather, timelineOpen, timelineMode, forecastIndex]);

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSelectItem = useCallback(
    (item: SelectedItem, altitude?: number) => {
      setSelected(item);
      const lat = item.kind === "point" ? item.lat : item.data.lat;
      const lng = item.kind === "point" ? item.lng : item.data.lng;
      triggerFlyTo(lat, lng, altitude);
      if (typeof window !== "undefined" && window.innerWidth < 900) {
        setFeedOpen(false);
      }
    },
    [triggerFlyTo]
  );

  const handleSearchLocation = useCallback(
    (lat: number, lng: number, label: string, altitude?: number) => {
      setSelected({ kind: "point", lat, lng, label });
      triggerFlyTo(lat, lng, altitude ?? 1.72);
    },
    [triggerFlyTo]
  );

  // Feature 4: 1-tap GPS My Location briefing
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("이 브라우저에서는 위치 정보(GPS)를 지원하지 않습니다.", "warn");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setSelected({ kind: "point", lat: latitude, lng: longitude, label: "내 현재 위치 브리핑" });
        triggerFlyTo(latitude, longitude, 1.38);
        showToast("현재 위치의 실시간 기상·대기질·지진 브리핑을 불러옵니다.");
      },
      () => {
        setLocating(false);
        showToast("위치 권한이 거부되었거나 GPS를 확인할 수 없습니다.", "warn");
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 60_000 }
    );
  }, [triggerFlyTo, showToast]);

  // Feature 4: Toggle favorite saved pin in localStorage
  const selectedIsPinned = useMemo(() => {
    if (!selected) return false;
    const lat = selected.kind === "point" ? selected.lat : selected.data.lat;
    const lng = selected.kind === "point" ? selected.lng : selected.data.lng;
    return savedPins.some((p) => haversineKm(p.lat, p.lng, lat, lng) < 12);
  }, [selected, savedPins]);

  const handleTogglePin = useCallback(
    (label: string, lat: number, lng: number) => {
      setSavedPins((prev) => {
        const exists = prev.find((p) => haversineKm(p.lat, p.lng, lat, lng) < 12);
        const next = exists
          ? prev.filter((p) => p.id !== exists.id)
          : [
              { id: `pin-${Date.now()}`, label: label.slice(0, 28), lat, lng, createdAt: Date.now() },
              ...prev,
            ].slice(0, 12);
        try {
          window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        showToast(exists ? `관심 지역 [${exists.label}] 해제됨` : `관심 지역 [${label.slice(0, 20)}] 저장됨`);
        return next;
      });
    },
    [showToast]
  );

  // Feature 1: 3D Screenshot PNG capture & mobile Share Sheet
  const handleCaptureSnapshot = useCallback(async () => {
    const captureFn = captureRef.current;
    if (!captureFn) return;
    setCapturing(true);
    try {
      const rawUrl = captureFn();
      if (!rawUrl) throw new Error("WebGL canvas unavailable");
      const highlightText =
        selected?.kind === "earthquake"
          ? `M${selected.data.mag.toFixed(1)} ${selected.data.place}`
          : selected?.kind === "disaster"
            ? `${selected.data.categoryKo} ${selected.data.title}`
            : selected?.kind === "air"
              ? `${selected.data.stationName ?? selected.data.country} PM2.5 ${selected.data.pm25}`
              : selected?.kind === "weather"
                ? `${selected.data.nameKo} ${selected.data.tempC}°C`
                : undefined;

      const outcome = await exportGlobeSnapshot(rawUrl, {
        altitudeKm: telemetry.altitudeKm,
        cameraLat: telemetry.cameraLat,
        cameraLng: telemetry.cameraLng,
        quakeCount: displayedEarthquakes.length,
        disasterCount: disasters.length,
        sensorCount: airQuality.totalRawSensors,
        highlightText,
      });
      showToast(outcome === "shared" ? "3D 스냅샷 공유 완료" : "고화질 3D 스크린샷(PNG) 저장 완료");
    } catch {
      showToast("스크린샷 생성 중 오류가 발생했습니다.", "warn");
    } finally {
      setCapturing(false);
    }
  }, [telemetry, displayedEarthquakes.length, disasters.length, airQuality.totalRawSensors, selected, showToast]);

  // Feature 1: Copy camera view & active layers deep-link URL
  const handleCopyShareLink = useCallback(async () => {
    const activeCodes: string[] = [];
    if (layers.earthquakes) activeCodes.push("q");
    if (layers.disasters) activeCodes.push("d");
    if (layers.weather) activeCodes.push("w");
    if (layers.ocean) activeCodes.push("o");
    if (layers.airQuality) activeCodes.push("a");
    if (layers.tectonic) activeCodes.push("t");

    const url = new URL(window.location.href);
    url.searchParams.set("lat", telemetry.cameraLat.toFixed(2));
    url.searchParams.set("lng", telemetry.cameraLng.toFixed(2));
    url.searchParams.set("alt", telemetry.cameraDist.toFixed(2));
    url.searchParams.set("layers", activeCodes.join(","));

    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("현재 시점 · 레이어 공유 링크가 복사되었습니다.");
    } catch {
      showToast("클립보드 복사에 실패했습니다.", "warn");
    }
  }, [layers, telemetry, showToast]);

  const overallStatus = useMemo<DataSourceStatus>(() => {
    const statuses = [quakeMeta.status, disasterMeta.status, weatherMeta.status, airMeta.status];
    if (statuses.includes("live")) return "live";
    if (statuses.includes("cached")) return "cached";
    if (statuses.includes("stale")) return "stale";
    return "fallback";
  }, [quakeMeta.status, disasterMeta.status, weatherMeta.status, airMeta.status]);

  const archFeeds = useMemo(() => {
    const krClusterCount = airQuality.clusters.filter((c) => c.country === "KR").length;
    return [
      { name: "지진 (USGS)", ...quakeMeta },
      { name: "자연재해 (NASA EONET)", ...disasterMeta },
      { name: "기상 · 해양 모델 (+24h 예보)", ...weatherMeta },
      {
        name: "한국 대기질 (data.go.kr)",
        source:
          airQuality.koreaSource === "data.go.kr"
            ? "한국환경공단 에어코리아 공식 측정망"
            : "Open-Meteo CAMS 대체 (DATA_GO_KR_API_KEY 설정 시 자동 전환)",
        status: airMeta.status,
        updatedAt: airMeta.updatedAt,
        ttlSeconds: airQuality.koreaSource === "data.go.kr" ? 900 : 600,
        rawCount: airQuality.koreaStationCount,
        returnedCount: krClusterCount,
      },
      { name: "글로벌 환경 센서망", ...airMeta },
    ];
  }, [quakeMeta, disasterMeta, weatherMeta, airMeta, airQuality]);

  return (
    <main className="app-shell">
      <EarthGlobe
        earthquakes={displayedEarthquakes}
        disasters={disasters}
        weather={displayedWeather}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        layers={layers}
        selected={selected}
        flyToTarget={flyToTarget}
        zoomCommand={zoomCommand}
        captureRef={captureRef}
        onSelect={handleSelectItem}
        onTelemetry={setTelemetry}
      />

      <TopBar
        totalEarthquakes={displayedEarthquakes.length}
        totalRawSensors={airQuality.totalRawSensors}
        overallStatus={overallStatus}
        feedOpen={feedOpen}
        onToggleFeed={() => setFeedOpen((v) => !v)}
        onOpenArchitecture={() => setArchOpen(true)}
        onSelectLocation={handleSearchLocation}
      />

      <TelemetryHud
        telemetry={telemetry}
        earthquakes={displayedEarthquakes}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        onQuickSelect={handleSelectItem}
      />

      {toast && (
        <div className={`hud-toast toast-${toast.tone ?? "info"}`} role="status">
          {toast.text}
        </div>
      )}

      <ZoomControls
        zoomPct={telemetry.zoomPct}
        altitudeKm={telemetry.altitudeKm}
        inspectorOpen={Boolean(selected)}
        locating={locating}
        capturing={capturing}
        onZoomIn={() => triggerZoom("in")}
        onZoomOut={() => triggerZoom("out")}
        onResetView={() => triggerZoom("reset")}
        onLocateMe={handleLocateMe}
        onCaptureSnapshot={() => void handleCaptureSnapshot()}
        onCopyShareLink={() => void handleCopyShareLink()}
      />

      <EventFeedDrawer
        open={feedOpen}
        earthquakes={displayedEarthquakes}
        disasters={disasters}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        onClose={() => setFeedOpen(false)}
        onSelect={handleSelectItem}
      />

      <InspectorPanel
        selected={selected}
        earthquakes={displayedEarthquakes}
        airQuality={airQuality.clusters}
        isPinned={selectedIsPinned}
        onTogglePin={handleTogglePin}
        onClose={() => setSelected(null)}
      />

      <TimelinePlayer
        open={timelineOpen}
        mode={timelineMode}
        playing={timelinePlaying}
        speed={timelineSpeed}
        progress={quakeReplayProgress}
        forecastIndex={forecastIndex}
        quakeCutoffMs={quakeCutoffMs}
        visibleQuakeCount={displayedEarthquakes.length}
        totalQuakeCount={earthquakes.length}
        onChangeMode={(m) => {
          setTimelineMode(m);
          setTimelinePlaying(false);
        }}
        onTogglePlay={() => setTimelinePlaying((p) => !p)}
        onToggleSpeed={() => setTimelineSpeed((s) => (s === 1 ? 3 : 1))}
        onChangeProgress={(p) => setQuakeReplayProgress(p)}
        onChangeForecastIndex={(idx) => setForecastIndex(idx)}
        onReset={() => {
          setTimelinePlaying(false);
          setQuakeReplayProgress(1);
          setForecastIndex(0);
        }}
        onClose={() => {
          setTimelinePlaying(false);
          setTimelineOpen(false);
          setQuakeReplayProgress(1);
          setForecastIndex(0);
        }}
      />

      <LayerDock
        layers={layers}
        quakeWindow={quakeWindow}
        minMag={minMag}
        quakeCount={displayedEarthquakes.length}
        disasterCount={disasters.length}
        weatherCount={displayedWeather.length}
        oceanCount={weatherOcean.ocean.length}
        airClusterCount={airQuality.clusters.length}
        timelineOpen={timelineOpen}
        savedPins={savedPins}
        onToggleLayer={handleToggleLayer}
        onToggleTimeline={() => setTimelineOpen((v) => !v)}
        onChangeQuakeWindow={setQuakeWindow}
        onChangeMinMag={setMinMag}
        onQuickJump={handleSearchLocation}
      />

      <ArchitectureModal
        open={archOpen}
        feeds={archFeeds}
        onClose={() => setArchOpen(false)}
      />
    </main>
  );
}
