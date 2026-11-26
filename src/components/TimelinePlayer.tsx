"use client";

import React, { useEffect } from "react";
import { FastForward, Pause, Play, RotateCcw, X } from "lucide-react";
import { UI_TEXT, type Lang } from "@/lib/i18n";

export type TimelineMode = "quakes" | "forecast";

interface TimelinePlayerProps {
  open: boolean;
  mode: TimelineMode;
  playing: boolean;
  speed: 1 | 3;
  progress: number; // 0..1 for quake replay
  forecastIndex: number; // 0..8 (+0h..+24h in 3h steps)
  quakeCutoffMs: number;
  visibleQuakeCount: number;
  totalQuakeCount: number;
  lang: Lang;
  onChangeMode: (m: TimelineMode) => void;
  onTogglePlay: () => void;
  onToggleSpeed: () => void;
  onChangeProgress: (p: number) => void;
  onChangeForecastIndex: (idx: number) => void;
  onReset: () => void;
  onClose: () => void;
}

function formatKstShort(epochMs: number): string {
  if (!epochMs) return "Loading...";
  const d = new Date(epochMs + 9 * 3600_000);
  return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)} KST`;
}

export default function TimelinePlayer({
  open,
  mode,
  playing,
  speed,
  progress,
  forecastIndex,
  quakeCutoffMs,
  visibleQuakeCount,
  totalQuakeCount,
  lang,
  onChangeMode,
  onTogglePlay,
  onToggleSpeed,
  onChangeProgress,
  onChangeForecastIndex,
  onReset,
  onClose,
}: TimelinePlayerProps) {
  useEffect(() => {
    if (!open || !playing) return;

    if (mode === "quakes") {
      const id = setInterval(() => {
        onChangeProgress(progress >= 1 ? 0.05 : Math.min(1, progress + 0.018 * speed));
      }, 120);
      return () => clearInterval(id);
    }

    const id = setInterval(() => {
      onChangeForecastIndex((forecastIndex + 1) % 9);
    }, speed === 3 ? 650 : 1250);
    return () => clearInterval(id);
  }, [open, playing, mode, speed, progress, forecastIndex, onChangeProgress, onChangeForecastIndex]);

  if (!open) return null;

  const t = UI_TEXT[lang];
  const forecastHours = forecastIndex * 3;

  return (
    <div className="timeline-player" role="region" aria-label="타임라인 재생 컨트롤">
      <div className="timeline-top">
        <div className="timeline-mode-tabs">
          <button
            type="button"
            className={`tl-tab ${mode === "quakes" ? "is-active" : ""}`}
            onClick={() => onChangeMode("quakes")}
          >
            {t.timelineQuakes}
          </button>
          <button
            type="button"
            className={`tl-tab ${mode === "forecast" ? "is-active" : ""}`}
            onClick={() => onChangeMode("forecast")}
          >
            {t.timelineForecast}
          </button>
        </div>

        <div className="timeline-readout mono">
          {mode === "quakes" ? (
            <>
              <span>{formatKstShort(quakeCutoffMs)}</span>
              <span className="tl-count">
                {visibleQuakeCount}/{totalQuakeCount}
                {lang === "en" ? "" : "건"}
              </span>
            </>
          ) : (
            <>
              <span>
                {forecastHours === 0
                  ? lang === "en"
                    ? "Live Now"
                    : "현재 실황"
                  : lang === "en"
                    ? `+${forecastHours}h Forecast`
                    : `+${forecastHours}시간 후 예보`}
              </span>
              <span className="tl-count">Open-Meteo</span>
            </>
          )}
        </div>

        <button type="button" className="tl-close" onClick={onClose} aria-label="타임라인 닫기">
          <X size={14} />
        </button>
      </div>

      <div className="timeline-controls">
        <button
          type="button"
          className="tl-ctrl-btn"
          onClick={onTogglePlay}
          aria-label={playing ? "일시정지" : "재생"}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <button
          type="button"
          className={`tl-speed-btn mono ${speed === 3 ? "is-fast" : ""}`}
          onClick={onToggleSpeed}
          title="재생 속도 전환"
        >
          <FastForward size={12} />
          <span>{speed}x</span>
        </button>

        {mode === "quakes" ? (
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(progress * 100)}
            onChange={(e) => onChangeProgress(Number(e.target.value) / 100)}
            className="tl-slider"
            aria-label="지진 발생 시점 슬라이더"
          />
        ) : (
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={forecastIndex}
            onChange={(e) => onChangeForecastIndex(Number(e.target.value))}
            className="tl-slider"
            aria-label="24시간 기상 예보 시간 슬라이더"
          />
        )}

        <button
          type="button"
          className="tl-ctrl-btn"
          onClick={onReset}
          title="현재 시점으로 초기화"
          aria-label="초기화"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
