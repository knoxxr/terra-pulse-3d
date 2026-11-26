import * as THREE from "three";

import type { DisasterCategory } from "@/types/telemetry";

export type WeatherIconKey =
  | "sun"
  | "moon"
  | "partly"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export type OceanIconKey = "calm" | "mod" | "high";
export type QuakeIconKey = "minor" | "mod" | "major" | "tsunami";
export type AqiIconKey = "good" | "mod" | "bad" | "vbad";
export type DisasterIconKey = "wildfires" | "volcanoes" | "severeStorms" | "seaLakeIce" | "other";

export interface GlobeIconAtlas {
  weather: Record<WeatherIconKey, THREE.CanvasTexture>;
  ocean: Record<OceanIconKey, THREE.CanvasTexture>;
  quake: Record<QuakeIconKey, THREE.CanvasTexture>;
  aqi: Record<AqiIconKey, THREE.CanvasTexture>;
  disaster: Record<DisasterIconKey, THREE.CanvasTexture>;
  dispose: () => void;
}

export function classifyDisasterIcon(cat: DisasterCategory): DisasterIconKey {
  return cat;
}

export function classifyWeatherIcon(code: number, isDay: boolean): WeatherIconKey {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 1 && code <= 3) return "partly";
  return isDay ? "sun" : "moon";
}

export function classifyOceanIcon(waveM: number): OceanIconKey {
  if (waveM >= 3.5) return "high";
  if (waveM >= 2.0) return "mod";
  return "calm";
}

export function classifyQuakeIcon(mag: number, tsunami: boolean): QuakeIconKey {
  if (tsunami) return "tsunami";
  if (mag >= 5.5) return "major";
  if (mag >= 4.0) return "mod";
  return "minor";
}

export function classifyAqiIcon(pm25: number): AqiIconKey {
  if (pm25 <= 15) return "good";
  if (pm25 <= 35) return "mod";
  if (pm25 <= 75) return "bad";
  return "vbad";
}

function makeSpriteTexture(
  draw: (ctx: CanvasRenderingContext2D, s: number) => void
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawBadgeBg(
  ctx: CanvasRenderingContext2D,
  s: number,
  ringColor: string,
  fillBg = "rgba(8, 15, 28, 0.88)"
) {
  const cx = s / 2;
  const cy = s / 2;
  // Soft outer glow
  const glow = ctx.createRadialGradient(cx, cy, s * 0.22, cx, cy, s * 0.48);
  glow.addColorStop(0, `${ringColor}55`);
  glow.addColorStop(1, `${ringColor}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
  ctx.fill();

  // Crisp dark circular glass coin
  ctx.fillStyle = fillBg;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4.5;
  ctx.stroke();
}

function drawCloudShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx - 12 * scale, cy + 4 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.arc(cx - 2 * scale, cy - 4 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.arc(cx + 12 * scale, cy + 2 * scale, 10.5 * scale, 0, Math.PI * 2);
  ctx.rect(cx - 12 * scale, cy + 2 * scale, 24 * scale, 12 * scale);
  ctx.fill();
}

/**
 * Creates a GPU-cached set of crisp Retina icon sprites for Weather, Ocean Waves,
 * Seismic Epicenters, and Air Quality markers on the 3D Globe.
 */
export function createGlobeIconAtlas(): GlobeIconAtlas {
  const weather: Record<WeatherIconKey, THREE.CanvasTexture> = {
    sun: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#fbbf24");
      const c = s / 2;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 18, c + Math.sin(a) * 18);
        ctx.lineTo(c + Math.cos(a) * 26, c + Math.sin(a) * 26);
        ctx.stroke();
      }
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(c, c, 12.5, 0, Math.PI * 2);
      ctx.fill();
    }),

    moon: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#93c5fd");
      const c = s / 2;
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(c, c, 19, 0.3, Math.PI * 1.82);
      ctx.arc(c + 9, c - 7, 15, Math.PI * 1.4, 0.72, true);
      ctx.closePath();
      ctx.fill();
    }),

    partly: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#38bdf8");
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(s * 0.59, s * 0.42, 12, 0, Math.PI * 2);
      ctx.fill();
      drawCloudShape(ctx, s * 0.47, s * 0.56, 0.92, "#e2e8f0");
    }),

    fog: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#94a3b8");
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      [48, 64, 80].forEach((y, i) => {
        ctx.beginPath();
        ctx.moveTo(38 + i * 4, y);
        ctx.lineTo(86 + (i === 1 ? 6 : 0), y);
        ctx.stroke();
      });
    }),

    rain: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#38bdf8");
      drawCloudShape(ctx, s * 0.5, s * 0.44, 0.92, "#bae6fd");
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      [48, 64, 80].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 76);
        ctx.lineTo(x - 5, 90);
        ctx.stroke();
      });
    }),

    snow: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#7dd3fc");
      const c = s / 2;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(c - Math.cos(a) * 23, c - Math.sin(a) * 23);
        ctx.lineTo(c + Math.cos(a) * 23, c + Math.sin(a) * 23);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(c, c, 6, 0, Math.PI * 2);
      ctx.fill();
    }),

    storm: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#f59e0b");
      drawCloudShape(ctx, s * 0.5, s * 0.42, 0.88, "#cbd5e1");
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(67, 62);
      ctx.lineTo(54, 79);
      ctx.lineTo(64, 79);
      ctx.lineTo(57, 96);
      ctx.lineTo(76, 74);
      ctx.lineTo(66, 74);
      ctx.closePath();
      ctx.fill();
    }),
  };

  const drawWaveIcon = (ringColor: string, waveColor: string) =>
    makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, ringColor);
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Top curling wave crest
      ctx.beginPath();
      ctx.moveTo(36, 62);
      ctx.bezierCurveTo(46, 40, 68, 36, 76, 52);
      ctx.bezierCurveTo(80, 60, 68, 66, 62, 58);
      ctx.stroke();

      // Lower swell line
      ctx.beginPath();
      ctx.moveTo(36, 78);
      ctx.quadraticCurveTo(50, 70, 64, 78);
      ctx.quadraticCurveTo(78, 86, 92, 76);
      ctx.stroke();
    });

  const ocean: Record<OceanIconKey, THREE.CanvasTexture> = {
    calm: drawWaveIcon("#14b8a6", "#5eead4"),
    mod: drawWaveIcon("#22d3ee", "#a5f3fc"),
    high: drawWaveIcon("#f59e0b", "#fde68a"),
  };

  const drawQuakeIcon = (ringColor: string, coreColor: string, isAlert = false) =>
    makeSpriteTexture((ctx, s) => {
      const c = s / 2;
      // Outer glowing halo
      const glow = ctx.createRadialGradient(c, c, 6, c, c, s * 0.48);
      glow.addColorStop(0, `${coreColor}cc`);
      glow.addColorStop(0.55, `${ringColor}48`);
      glow.addColorStop(1, `${ringColor}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c, c, s * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Concentric epicenter rings
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c, c, 34, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(c, c, 21, 0, Math.PI * 2);
      ctx.stroke();

      // Bright epicenter core
      ctx.fillStyle = isAlert ? "#ffffff" : coreColor;
      ctx.beginPath();
      ctx.arc(c, c, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Crisp seismic waveform slash for major/tsunami quakes
      if (isAlert) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(28, c);
        ctx.lineTo(44, c);
        ctx.lineTo(54, c - 18);
        ctx.lineTo(66, c + 18);
        ctx.lineTo(78, c - 10);
        ctx.lineTo(86, c);
        ctx.lineTo(100, c);
        ctx.stroke();
      }
    });

  const quake: Record<QuakeIconKey, THREE.CanvasTexture> = {
    minor: drawQuakeIcon("#facc15", "#fef08a", false),
    mod: drawQuakeIcon("#f97316", "#fdba74", false),
    major: drawQuakeIcon("#ef4444", "#fca5a5", true),
    tsunami: drawQuakeIcon("#ef4444", "#38bdf8", true),
  };

  const drawAqiFaceSprite = (color: string, mood: AqiIconKey) =>
    makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, color);
      const c = s / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c - 11, c - 6, 4.2, 0, Math.PI * 2);
      ctx.arc(c + 11, c - 6, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      if (mood === "good") {
        ctx.beginPath();
        ctx.arc(c, c + 2, 13, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (mood === "mod") {
        ctx.beginPath();
        ctx.moveTo(c - 12, c + 10);
        ctx.lineTo(c + 12, c + 10);
        ctx.stroke();
      } else if (mood === "bad") {
        // Mask badge
        ctx.fillStyle = `${color}55`;
        ctx.beginPath();
        ctx.roundRect(c - 16, c + 4, 32, 16, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(c, c + 18, 12, Math.PI + 0.3, -0.3);
        ctx.stroke();
      }
    });

  const aqi: Record<AqiIconKey, THREE.CanvasTexture> = {
    good: drawAqiFaceSprite("#22c55e", "good"),
    mod: drawAqiFaceSprite("#eab308", "mod"),
    bad: drawAqiFaceSprite("#f97316", "bad"),
    vbad: drawAqiFaceSprite("#ef4444", "vbad"),
  };

  const disaster: Record<DisasterIconKey, THREE.CanvasTexture> = {
    wildfires: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#f97316", "rgba(24, 10, 6, 0.9)");
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(64, 34);
      ctx.bezierCurveTo(78, 52, 86, 62, 84, 76);
      ctx.bezierCurveTo(82, 90, 72, 94, 64, 94);
      ctx.bezierCurveTo(52, 94, 44, 86, 44, 74);
      ctx.bezierCurveTo(44, 62, 54, 52, 56, 44);
      ctx.bezierCurveTo(60, 50, 64, 46, 64, 34);
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(64, 78, 10, 0, Math.PI * 2);
      ctx.fill();
    }),
    volcanoes: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#ef4444", "rgba(26, 8, 10, 0.9)");
      // Ash/lava plume
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.arc(64, 46, 10, 0, Math.PI * 2);
      ctx.arc(54, 42, 7, 0, Math.PI * 2);
      ctx.arc(74, 42, 7, 0, Math.PI * 2);
      ctx.fill();
      // Volcanic cone
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(56, 56);
      ctx.lineTo(72, 56);
      ctx.lineTo(88, 90);
      ctx.lineTo(40, 90);
      ctx.closePath();
      ctx.fill();
      // Glowing lava rim
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(56, 56);
      ctx.lineTo(72, 56);
      ctx.stroke();
    }),
    severeStorms: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#38bdf8", "rgba(6, 16, 28, 0.9)");
      const c = s / 2;
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(c, c, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c + 4, c - 4, 22, -Math.PI * 0.85, Math.PI * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c - 4, c + 4, 22, Math.PI * 0.15, Math.PI * 1.15);
      ctx.stroke();
    }),
    seaLakeIce: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#67e8f9", "rgba(6, 18, 28, 0.9)");
      ctx.fillStyle = "#cffafe";
      ctx.beginPath();
      ctx.moveTo(64, 36);
      ctx.lineTo(84, 72);
      ctx.lineTo(74, 88);
      ctx.lineTo(46, 88);
      ctx.lineTo(40, 68);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(36, 78);
      ctx.lineTo(92, 78);
      ctx.stroke();
    }),
    other: makeSpriteTexture((ctx, s) => {
      drawBadgeBg(ctx, s, "#f59e0b");
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(64, 38);
      ctx.lineTo(88, 84);
      ctx.lineTo(40, 84);
      ctx.closePath();
      ctx.fill();
    }),
  };

  return {
    weather,
    ocean,
    quake,
    aqi,
    disaster,
    dispose: () => {
      Object.values(weather).forEach((t) => t.dispose());
      Object.values(ocean).forEach((t) => t.dispose());
      Object.values(quake).forEach((t) => t.dispose());
      Object.values(aqi).forEach((t) => t.dispose());
      Object.values(disaster).forEach((t) => t.dispose());
    },
  };
}
