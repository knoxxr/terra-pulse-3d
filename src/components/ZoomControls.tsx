"use client";

import React from "react";
import { Camera, Compass, LocateFixed, Minus, Plus, Share2 } from "lucide-react";

interface ZoomControlsProps {
  zoomPct: number;
  altitudeKm: number;
  inspectorOpen: boolean;
  locating: boolean;
  capturing: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onLocateMe: () => void;
  onCaptureSnapshot: () => void;
  onCopyShareLink: () => void;
}

export default function ZoomControls({
  zoomPct,
  altitudeKm,
  inspectorOpen,
  locating,
  capturing,
  onZoomIn,
  onZoomOut,
  onResetView,
  onLocateMe,
  onCaptureSnapshot,
  onCopyShareLink,
}: ZoomControlsProps) {
  const formattedAlt =
    altitudeKm >= 1000
      ? `${(altitudeKm / 1000).toFixed(1)}k km`
      : `${altitudeKm.toLocaleString()} km`;

  return (
    <div
      className={`zoom-controls ${inspectorOpen ? "has-inspector" : ""}`}
      role="group"
      aria-label="지구본 줌 · 내 위치 · 스냅샷 제어"
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
          id="btn-locate-me"
          type="button"
          className={`zoom-btn ${locating ? "is-busy" : ""}`}
          onClick={onLocateMe}
          disabled={locating}
          title="내 위치 브리핑 (GPS)"
          aria-label="내 위치로 이동 및 실시간 브리핑"
        >
          <LocateFixed size={17} strokeWidth={2} />
        </button>

        <button
          id="btn-capture-snapshot"
          type="button"
          className={`zoom-btn ${capturing ? "is-busy" : ""}`}
          onClick={onCaptureSnapshot}
          disabled={capturing}
          title="3D 스크린샷 저장 · 공유"
          aria-label="현재 3D 지구본 스크린샷 저장"
        >
          <Camera size={17} strokeWidth={2} />
        </button>

        <button
          id="btn-share-link"
          type="button"
          className="zoom-btn"
          onClick={onCopyShareLink}
          title="현재 시점 · 레이어 링크 복사"
          aria-label="현재 시점 공유 링크 복사"
        >
          <Share2 size={16} strokeWidth={2} />
        </button>

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
