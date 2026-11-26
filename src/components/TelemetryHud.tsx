"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Clock, Crosshair } from "lucide-react";
import { AirDustIcon, OceanWaveIcon, QuakeIcon } from "./DomainIcons";
import { formatCoord, getMagnitudeColor, getPm25Level } from "@/lib/geo";
import { UI_TEXT, type Lang } from "@/lib/i18n";
import type {
  AirQualityCluster,
  CameraTelemetry,
  EarthquakeEvent,
  OceanNode,
  SelectedItem,
} from "@/types/telemetry";

interface TelemetryHudProps {
  telemetry: CameraTelemetry;
  earthquakes: EarthquakeEvent[];
  ocean: OceanNode[];
  airQuality: AirQualityCluster[];
  lang: Lang;
  onQuickSelect: (item: SelectedItem, altitude?: number) => void;
}

export default function TelemetryHud({
  telemetry,
  earthquakes,
  ocean,
  airQuality,
  lang,
  onQuickSelect,
}: TelemetryHudProps) {
  const t = UI_TEXT[lang];
  const [clockText, setClockText] = useState<{ kst: string; utc: string }>(() => ({
    kst: "--:--",
    utc: "--:--",
  }));

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const utc = now.toISOString().slice(11, 16);
      const kstDate = new Date(now.getTime() + 9 * 3600_000);
      const kst = kstDate.toISOString().slice(11, 16);
      setClockText({ kst, utc });
    };
    updateClock();
    const id = setInterval(updateClock, 15_000);
    return () => clearInterval(id);
  }, []);

  const strongestQuake = useMemo(() => {
    if (earthquakes.length === 0) return null;
    return earthquakes.reduce((best, q) => (q.mag > best.mag ? q : best), earthquakes[0]);
  }, [earthquakes]);

  const highestWave = useMemo(() => {
    if (ocean.length === 0) return null;
    return ocean.reduce((best, o) => (o.waveHeightM > best.waveHeightM ? o : best), ocean[0]);
  }, [ocean]);

  const highestPm25 = useMemo(() => {
    if (airQuality.length === 0) return null;
    return airQuality.reduce((best, a) => (a.pm25 > best.pm25 ? a : best), airQuality[0]);
  }, [airQuality]);

  return (
    <>
      {/* Compact Global Extremes Quick-Jump Strip */}
      <div className="extremes-strip" aria-label="실시간 지구 주요 극값 바로가기">
        {strongestQuake && (
          <button
            type="button"
            className="extreme-chip"
            onClick={() => onQuickSelect({ kind: "earthquake", data: strongestQuake }, 1.68)}
            title={`최대 규모 지진 이동: ${strongestQuake.place}`}
          >
            <QuakeIcon size={15} color={getMagnitudeColor(strongestQuake.mag)} />
            <span className="extreme-k">{t.maxQuake}</span>
            <strong className="extreme-v mono" style={{ color: getMagnitudeColor(strongestQuake.mag) }}>
              M {strongestQuake.mag.toFixed(1)}
            </strong>
          </button>
        )}

        {highestWave && (
          <button
            type="button"
            className="extreme-chip"
            onClick={() => onQuickSelect({ kind: "ocean", data: highestWave }, 1.95)}
            title={`최고 파고 해역 이동: ${highestWave.nameKo}`}
          >
            <OceanWaveIcon size={15} color="#2dd4bf" />
            <span className="extreme-k">{t.maxWave}</span>
            <strong className="extreme-v mono" style={{ color: "#2dd4bf" }}>
              {highestWave.waveHeightM.toFixed(1)}m
            </strong>
          </button>
        )}

        {highestPm25 && (
          <button
            type="button"
            className="extreme-chip"
            onClick={() => onQuickSelect({ kind: "air", data: highestPm25 }, 1.65)}
            title={`최고 초미세먼지 권역 이동: ${highestPm25.stationName ?? highestPm25.country}`}
          >
            <AirDustIcon size={15} color={getPm25Level(highestPm25.pm25).color} />
            <span className="extreme-k">{t.maxPm25}</span>
            <strong
              className="extreme-v mono"
              style={{ color: getPm25Level(highestPm25.pm25).color }}
            >
              {highestPm25.pm25.toFixed(0)}
            </strong>
          </button>
        )}
      </div>

      {/* Bottom-left Aerospace Coordinate & Time Telemetry Bar (Desktop) */}
      <div className="telemetry-bar mono" aria-label="실시간 좌표 및 고도 텔레메트리">
        <div className="telemetry-seg">
          <Crosshair size={12} />
          <span>
            {telemetry.cursorLat !== null && telemetry.cursorLng !== null
              ? formatCoord(telemetry.cursorLat, telemetry.cursorLng)
              : t.pointerIdle}
          </span>
        </div>
        <span className="telemetry-sep" />
        <div className="telemetry-seg">
          <span>ALT {telemetry.altitudeKm.toLocaleString()} km</span>
        </div>
        <span className="telemetry-sep" />
        <div className="telemetry-seg">
          <Clock size={12} />
          <span>
            KST {clockText.kst} · UTC {clockText.utc}
          </span>
        </div>
      </div>
    </>
  );
}
