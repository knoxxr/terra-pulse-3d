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
import type {
  AirQualityPayload,
  ApiEnvelope,
  CameraTelemetry,
  DataSourceStatus,
  EarthquakeEvent,
  LayerVisibility,
  QuakeWindow,
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

export default function TerraPulseApp() {
  const [layers, setLayers] = useState<LayerVisibility>({
    earthquakes: true,
    weather: true,
    ocean: true,
    airQuality: true,
    dayNight: true,
    clouds: true,
    labels: true,
    autoRotate: false,
  });

  const [quakeWindow, setQuakeWindow] = useState<QuakeWindow>("day");
  const [minMag, setMinMag] = useState<number>(2.5);

  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
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
    cursorLat: null,
    cursorLng: null,
  });

  const [feedOpen, setFeedOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);

  const nonceRef = useRef(1);

  const triggerFlyTo = useCallback((lat: number, lng: number, altitude?: number) => {
    nonceRef.current += 1;
    setFlyToTarget({ lat, lng, altitude, nonce: nonceRef.current });
  }, []);

  const triggerZoom = useCallback((action: ZoomCommand["action"]) => {
    nonceRef.current += 1;
    setZoomCommand({ action, nonce: nonceRef.current });
  }, []);

  // Keyboard zoom & close shortcuts (+ / - / 0 / Escape)
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

  // Initial parallel load & visibility-aware polling
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
        // Keep previous data silently
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

  const overallStatus = useMemo<DataSourceStatus>(() => {
    const statuses = [quakeMeta.status, weatherMeta.status, airMeta.status];
    if (statuses.includes("live")) return "live";
    if (statuses.includes("cached")) return "cached";
    if (statuses.includes("stale")) return "stale";
    return "fallback";
  }, [quakeMeta.status, weatherMeta.status, airMeta.status]);

  const archFeeds = useMemo(() => {
    const krClusterCount = airQuality.clusters.filter((c) => c.country === "KR").length;
    return [
      { name: "지진 · 자연재해", ...quakeMeta },
      { name: "기상 · 해양 모델", ...weatherMeta },
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
  }, [quakeMeta, weatherMeta, airMeta, airQuality]);

  return (
    <main className="app-shell">
      <EarthGlobe
        earthquakes={earthquakes}
        weather={weatherOcean.weather}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        layers={layers}
        selected={selected}
        flyToTarget={flyToTarget}
        zoomCommand={zoomCommand}
        onSelect={handleSelectItem}
        onTelemetry={setTelemetry}
      />

      <TopBar
        totalEarthquakes={earthquakes.length}
        totalRawSensors={airQuality.totalRawSensors}
        overallStatus={overallStatus}
        feedOpen={feedOpen}
        onToggleFeed={() => setFeedOpen((v) => !v)}
        onOpenArchitecture={() => setArchOpen(true)}
        onSelectLocation={handleSearchLocation}
      />

      <TelemetryHud
        telemetry={telemetry}
        earthquakes={earthquakes}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        onQuickSelect={handleSelectItem}
      />

      <ZoomControls
        zoomPct={telemetry.zoomPct}
        altitudeKm={telemetry.altitudeKm}
        inspectorOpen={Boolean(selected)}
        onZoomIn={() => triggerZoom("in")}
        onZoomOut={() => triggerZoom("out")}
        onResetView={() => triggerZoom("reset")}
      />

      <EventFeedDrawer
        open={feedOpen}
        earthquakes={earthquakes}
        ocean={weatherOcean.ocean}
        airQuality={airQuality.clusters}
        onClose={() => setFeedOpen(false)}
        onSelect={handleSelectItem}
      />

      <InspectorPanel
        selected={selected}
        earthquakes={earthquakes}
        airQuality={airQuality.clusters}
        onClose={() => setSelected(null)}
      />

      <LayerDock
        layers={layers}
        quakeWindow={quakeWindow}
        minMag={minMag}
        quakeCount={earthquakes.length}
        weatherCount={weatherOcean.weather.length}
        oceanCount={weatherOcean.ocean.length}
        airClusterCount={airQuality.clusters.length}
        onToggleLayer={handleToggleLayer}
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
