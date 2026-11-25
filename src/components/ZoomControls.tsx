"use client";

import React from "react";
import { Compass, Minus, Plus } from "lucide-react";

interface ZoomControlsProps {
  zoomPct: number;
  altitudeKm: number;
  inspectorOpen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export default function ZoomControls({
  zoomPct,
  altitudeKm,
  inspectorOpen,
  onZoomIn,
  onZoomOut,
  onResetView,
}: ZoomControlsProps) {
  const formattedAlt =
    altitudeKm >= 1000
      ? `${(altitudeKm / 1000).toFixed(1)}k km`
      : `${altitudeKm.toLocaleString()} km`;

  return (
    <div
      className={`zoom-controls ${inspectorOpen ? "has-inspector" : ""}`}
      role="group"
      aria-label="지구본 줌 및 카메라 제어"
    >
      <div className="zoom-alt-pill mono" title="현재 카메라 고도">
        ALT {formattedAlt}
      </div>

      <div className="zoom-rail">
        <button
          id="btn-zoom-in"
          type="button"
          className="zoom-btn"
          onClick={onZoomIn}
          disabled={zoomPct >= 99}
          title="줌 인 (+)"
          aria-label="지구본 확대 (줌 인)"
        >
          <Plus size={18} strokeWidth={2.2} />
        </button>

        <div className="zoom-meter" aria-hidden="true">
          <div className="zoom-meter-track">
            <div className="zoom-meter-fill" style={{ height: `${zoomPct}%` }} />
          </div>
        </div>

        <button
          id="btn-zoom-out"
          type="button"
          className="zoom-btn"
          onClick={onZoomOut}
          disabled={zoomPct <= 1}
          title="줌 아웃 (-)"
          aria-label="지구본 축소 (줌 아웃)"
        >
          <Minus size={18} strokeWidth={2.2} />
        </button>

        <div className="zoom-divider" aria-hidden="true" />

        <button
          id="btn-zoom-reset"
          type="button"
          className="zoom-btn"
          onClick={onResetView}
          title="기본 시점 복귀 (0)"
          aria-label="기본 시점 및 북쪽 정렬"
        >
          <Compass size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
