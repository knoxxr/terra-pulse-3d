export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/**
 * Convert geographic latitude/longitude (degrees) to 3D Cartesian coordinates
 * matching standard Three.js SphereGeometry equirectangular UV mapping.
 */
export function latLngToVector3(lat: number, lng: number, radius = 1): [number, number, number] {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

/**
 * Convert a 3D point on a unit sphere back to latitude/longitude (degrees).
 */
export function vector3ToLatLng(x: number, y: number, z: number): { lat: number; lng: number } {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  const nx = x / len;
  const ny = Math.max(-1, Math.min(1, y / len));
  const nz = z / len;
  const lat = Math.asin(ny) * RAD2DEG;
  const theta = Math.atan2(nz, -nx);
  let lng = theta * RAD2DEG - 180;
  if (lng < -180) lng += 360;
  if (lng > 180) lng -= 360;
  return { lat, lng };
}

/**
 * Haversine great-circle distance in kilometers.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG2RAD) *
      Math.cos(lat2 * DEG2RAD) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute approximate real-time subsolar point (lat, lng) for UTC time
 * to drive the real-time Day/Night terminator shader on the 3D Earth.
 */
export function getSubsolarPoint(date: Date = new Date()): { lat: number; lng: number } {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = (date.getTime() - startOfYear) / 86400000;
  // Solar declination approximation (-23.44° to +23.44°)
  const declination = -23.44 * Math.cos(((360 / 365) * (dayOfYear + 10)) * DEG2RAD);
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  // Sun is at 0° longitude around 12:00 UTC, moving westward 15°/hour
  let lng = (12 - utcHours) * 15;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: declination, lng };
}

export function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
}

export function getPm25Level(pm25: number): {
  label: string;
  color: string;
  bg: string;
  grade: 1 | 2 | 3 | 4;
} {
  if (pm25 <= 15) {
    return { label: "좋음", color: "#22c55e", bg: "rgba(34, 197, 94, 0.16)", grade: 1 };
  }
  if (pm25 <= 35) {
    return { label: "보통", color: "#eab308", bg: "rgba(234, 179, 8, 0.16)", grade: 2 };
  }
  if (pm25 <= 75) {
    return { label: "나쁨", color: "#f97316", bg: "rgba(249, 115, 22, 0.18)", grade: 3 };
  }
  return { label: "매우 나쁨", color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)", grade: 4 };
}

export function getMagnitudeColor(mag: number): string {
  if (mag >= 6.0) return "#ef4444";
  if (mag >= 4.5) return "#f97316";
  if (mag >= 3.0) return "#f59e0b";
  return "#fde047";
}

export function getWeatherDescriptionKo(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 조금 / 흐림";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈보라";
  if (code >= 95) return "뇌우 / 돌풍";
  return "변화무쌍";
}

export function getCardinalDirKo(deg: number): string {
  const dirs = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function timeAgoKo(epochMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
}
