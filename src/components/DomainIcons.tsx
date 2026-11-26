"use client";

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/** Concentric epicenter + seismograph pulse — unmistakable Earthquake icon */
export function QuakeIcon({ size = 18, className, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.32" />
      <circle cx="12" cy="12" r="5.5" opacity="0.58" />
      <path d="M2.5 12h4l2-4.5 2.6 9 2.4-6.2 1.5 1.7h6.5" strokeWidth="2.1" />
    </svg>
  );
}

/** Sun behind soft cloud — immediately recognizable Weather icon */
export function WeatherIcon({ size = 18, className, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="15.5" cy="8.5" r="3" />
      <path d="M15.5 2.5v1.5M20.5 8.5h1.5M19.2 4.8l1-1M11.8 4.8l-1-1" opacity="0.7" />
      <path d="M7 19h9.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 7.2 11a3.5 3.5 0 0 0-.2 8Z" fill="currentColor" fillOpacity="0.14" />
    </svg>
  );
}

/** Layered curling ocean wave crest — unmistakable Marine/Wave icon */
export function OceanWaveIcon({ size = 18, className, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 10.5c2.2-2.6 4.6-4 7.5-4 2.4 0 3.7 1.3 3.7 2.8 0 1.2-.9 2-2 2-.9 0-1.6-.6-1.6-1.4" />
      <path d="M2 14.5c2 1.2 4 1.2 6 0s4-1.2 6 0 4 1.2 6 0 2-.5 2-.5" />
      <path d="M2 19c2 1.1 4 1.1 6 0s4-1.1 6 0 4 1.1 6 0 2-.5 2-.5" opacity="0.65" />
    </svg>
  );
}

/** Fine dust PM2.5 particles + breeze cloud — immediately reads as Air Quality / Fine Dust */
export function AirDustIcon({ size = 18, className, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 9h9.5a2.5 2.5 0 1 0-2.4-3.2" />
      <path d="M3 13.5h13a2.5 2.5 0 1 1-2.4 3.2" />
      <circle cx="18.5" cy="7" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="11" r="1.1" fill="currentColor" stroke="none" opacity="0.8" />
      <circle cx="19" cy="16.5" r="1.3" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" opacity="0.65" />
    </svg>
  );
}

/** Korean Peninsula / Taegeuk inspired clean Korea badge icon */
export function KoreaBadgeIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15 3.75 3.75 0 0 1 0-7.5 3.75 3.75 0 0 0 0-7.5Z" fill="#38bdf8" />
      <path d="M12 4.5a7.5 7.5 0 0 0 0 15 3.75 3.75 0 0 0 0-7.5 3.75 3.75 0 0 1 0-7.5Z" fill="#ef4444" />
    </svg>
  );
}

/** Day/Night Earth Terminator icon (half sun, half night crescent) */
export function DayNightIcon({ size = 17, active = true, className }: IconProps & { active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      {active ? (
        <path d="M12 3.5a8.5 8.5 0 0 0 0 17V3.5Z" fill="currentColor" fillOpacity="0.82" />
      ) : (
        <>
          <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.25" />
          <path d="M12 1.5v1.5M12 21v1.5M1.5 12H3M21 12h1.5" />
        </>
      )}
    </svg>
  );
}

/** Orbiting Globe auto-rotate icon */
export function GlobeSpinIcon({ size = 17, spinning = false, className }: IconProps & { spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className ?? ""} ${spinning ? "spin-slow" : ""}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.8" ry="8.5" />
      <path d="M3.8 12h16.4" />
    </svg>
  );
}

/** Map Pin + Label icon (clearer than generic Tag) */
export function MapLabelIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="3.5" />
      <path d="M7.5 10h9M12 16v4" />
      <circle cx="12" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Live Radar Alert icon for Event Feed toggle */
export function RadarAlertIcon({ size = 17, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.35" />
      <circle cx="12" cy="12" r="5" opacity="0.65" />
      <path d="M12 12l5.8-5.8" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Weather condition specific icon based on WMO weather code */
export function WeatherConditionIcon({
  code,
  isDay = true,
  size = 18,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
}) {
  // Thunderstorm
  if (code >= 95) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 15h10.5a3.5 3.5 0 0 0 .5-6.96A5.2 5.2 0 0 0 7.2 7.2 3.8 3.8 0 0 0 6.5 15Z" fill="#94a3b8" fillOpacity="0.3" stroke="#cbd5e1" strokeWidth="1.7" />
        <path d="M13 13l-2.8 4.5h2.6L11.5 22l4.8-5.6h-2.7L15 13h-2Z" fill="#fbbf24" />
      </svg>
    );
  }
  // Snow
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#bae6fd" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
        <circle cx="12" cy="12" r="2.2" fill="#e0f2fe" />
      </svg>
    );
  }
  // Rain / Drizzle / Showers
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 14.5h10.5a3.5 3.5 0 0 0 .5-6.96A5.2 5.2 0 0 0 7.2 6.7 3.8 3.8 0 0 0 6.5 14.5Z" fill="#38bdf8" fillOpacity="0.22" stroke="#7dd3fc" strokeWidth="1.7" />
        <path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3" stroke="#38bdf8" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  // Fog
  if (code >= 45 && code <= 48) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
        <path d="M4 9h14M6 13h14M3 17h13" />
      </svg>
    );
  }
  // Partly cloudy / Cloudy
  if (code >= 1 && code <= 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="15.8" cy="8.2" r="3.2" fill="#fbbf24" fillOpacity="0.85" />
        <path d="M6.5 18h10a3.5 3.5 0 0 0 .4-6.98A4.8 4.8 0 0 0 7.3 10.2 3.5 3.5 0 0 0 6.5 18Z" fill="#cbd5e1" fillOpacity="0.3" stroke="#e2e8f0" strokeWidth="1.7" />
      </svg>
    );
  }
  // Clear Sky (Sun or Moon)
  if (!isDay) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" fill="#fde68a" fillOpacity="0.85" stroke="#fef3c7" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="#fbbf24" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke="#fbbf24" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** Intuitive AirKorea 4-stage AQI status face icon */
export function AqiGradeIcon({ pm25, size = 18 }: { pm25: number; size?: number }) {
  if (pm25 <= 15) {
    // 좋음: Happy fresh green face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="rgba(34,197,94,0.16)" />
        <circle cx="9" cy="10" r="1" fill="#22c55e" stroke="none" />
        <circle cx="15" cy="10" r="1" fill="#22c55e" stroke="none" />
        <path d="M8.5 14.2c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3" />
      </svg>
    );
  }
  if (pm25 <= 35) {
    // 보통: Calm neutral amber-yellow face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="rgba(234,179,8,0.16)" />
        <circle cx="9" cy="10" r="1" fill="#eab308" stroke="none" />
        <circle cx="15" cy="10" r="1" fill="#eab308" stroke="none" />
        <path d="M9 15h6" />
      </svg>
    );
  }
  if (pm25 <= 75) {
    // 나쁨: Mask-wearing orange face
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="rgba(249,115,22,0.18)" />
        <circle cx="9" cy="9.5" r="1" fill="#f97316" stroke="none" />
        <circle cx="15" cy="9.5" r="1" fill="#f97316" stroke="none" />
        <rect x="7.5" y="13" width="9" height="4.2" rx="1.6" fill="rgba(249,115,22,0.35)" />
      </svg>
    );
  }
  // 매우 나쁨: Alert red warning face
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgba(239,68,68,0.22)" />
      <path d="M8 9l2 1.5M16 9l-2 1.5" />
      <path d="M8.5 16c1-1.4 2.2-2 3.5-2s2.5.6 3.5 2" />
    </svg>
  );
}

/** Compact Unicode weather glyph for zero-overhead 3D projected labels */
export function getWeatherGlyph(code: number, isDay = true): string {
  if (code >= 95) return "⛈";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "❄";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "🌧";
  if (code >= 45 && code <= 48) return "🌫";
  if (code >= 1 && code <= 3) return "⛅";
  return isDay ? "☀" : "☾";
}
