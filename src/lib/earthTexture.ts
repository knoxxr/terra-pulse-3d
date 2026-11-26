import * as THREE from "three";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countriesAtlas50m from "world-atlas/countries-50m.json";
import { GLOBAL_WEATHER_ANCHORS } from "./locations";
import { latLngToVector3 } from "./geo";

type GeoRing = Array<[number, number]>;

export interface EarthAssets {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  coastlineGeometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
  graticuleGeometry: THREE.BufferGeometry;
  dispose: () => void;
}

function lngToX(lng: number, width: number): number {
  return ((lng + 180) / 360) * width;
}

function latToY(lat: number, height: number): number {
  return ((90 - lat) / 180) * height;
}

function traceRing(ctx: CanvasRenderingContext2D, ring: GeoRing, width: number, height: number) {
  if (ring.length < 2) return;
  let prevLng = ring[0][0];
  ctx.moveTo(lngToX(prevLng, width), latToY(ring[0][1], height));
  for (let i = 1; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const x = lngToX(lng, width);
    const y = latToY(lat, height);
    if (Math.abs(lng - prevLng) > 180) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    prevLng = lng;
  }
}

function drawPolygonCoords(
  ctx: CanvasRenderingContext2D,
  rings: GeoRing[],
  width: number,
  height: number
) {
  for (const ring of rings) {
    traceRing(ctx, ring, width, height);
  }
}

/**
 * Fast deterministic 2D value noise (periodic along X so equirectangular seam at ±180° is invisible!)
 */
function hash2(ix: number, iy: number, periodX: number): number {
  const wx = ((ix % periodX) + periodX) % periodX;
  const n = Math.sin(wx * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number, periodX: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy, periodX);
  const b = hash2(ix + 1, iy, periodX);
  const c = hash2(ix, iy + 1, periodX);
  const d = hash2(ix + 1, iy + 1, periodX);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmPeriodic(u: number, v: number, baseFreqX: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freqX = baseFreqX;
  let freqY = baseFreqX * 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(u * freqX, v * freqY, Math.round(freqX));
    norm += amp;
    freqX *= 2;
    freqY *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

// Major mountain belts & arid zones for realistic cartographic biome shading
const MOUNTAIN_ZONES: Array<[number, number, number, number]> = [
  // [lat, lng, radiusDeg, elevationWeight]
  [31, 86, 16, 1.0], // Himalayas & Tibetan Plateau
  [38, 72, 11, 0.85], // Pamir / Tian Shan
  [-18, -69, 14, 0.9], // Central Andes
  [-36, -70, 12, 0.8], // Southern Andes
  [5, -75, 10, 0.75], // Northern Andes
  [44, -111, 15, 0.78], // Rocky Mountains
  [62, -148, 9, 0.8], // Alaska Range
  [46.5, 10, 7, 0.75], // European Alps
  [42, 44, 6, 0.72], // Caucasus
  [37, 128.5, 4.5, 0.45], // Baekdudaegan (Korea)
  [36.5, 138, 4.5, 0.58], // Japanese Alps
  [9, 39, 8, 0.65], // Ethiopian Highlands
  [-43.5, 170.5, 4, 0.6], // Southern Alps NZ
];

const ARID_ZONES: Array<[number, number, number, number]> = [
  [23, 12, 22, 0.95], // Sahara
  [24, 46, 14, 0.9], // Arabian Desert
  [42, 98, 15, 0.72], // Gobi / Taklamakan
  [-24, 132, 15, 0.82], // Australian Outback
  [33, -112, 10, 0.65], // Mojave / Sonoran
  [-23, 17, 9, 0.72], // Kalahari / Namib
  [42, 62, 10, 0.62], // Central Asian Steppe
];

// High-density metropolitan night-light clusters
const NIGHT_LIGHT_HUBS: Array<[number, number, number]> = [
  // East Asia
  [37.56, 126.98, 1.4], [37.45, 126.7, 0.95], [35.18, 129.07, 1.05], [35.87, 128.6, 0.85],
  [36.35, 127.38, 0.75], [35.16, 126.85, 0.7], [33.5, 126.53, 0.55],
  [35.68, 139.69, 1.5], [34.69, 135.5, 1.28], [35.18, 136.9, 1.05], [33.59, 130.4, 0.9],
  [43.06, 141.35, 0.75], [39.9, 116.4, 1.4], [39.13, 117.2, 1.05], [31.23, 121.47, 1.45],
  [32.06, 118.79, 1.05], [30.27, 120.15, 1.0], [23.13, 113.26, 1.38], [22.54, 114.06, 1.25],
  [22.32, 114.17, 1.2], [25.03, 121.56, 1.15], [22.62, 120.3, 0.85], [30.67, 104.06, 0.95],
  [29.56, 106.55, 0.9], [34.26, 108.94, 0.85], [30.59, 114.3, 0.95], [14.6, 120.98, 1.0],
  [13.75, 100.5, 1.05], [1.35, 103.82, 1.1], [3.14, 101.69, 0.95], [-6.2, 106.84, 1.0],
  [21.03, 105.85, 0.85], [10.82, 106.63, 0.9],
  // South Asia & Middle East
  [28.61, 77.21, 1.38], [19.08, 72.88, 1.25], [12.97, 77.59, 1.05], [17.38, 78.48, 0.95],
  [13.08, 80.27, 0.95], [22.57, 88.36, 1.05], [31.52, 74.36, 1.0], [24.86, 67.0, 0.95],
  [25.2, 55.27, 1.15], [24.45, 54.37, 0.9], [25.29, 51.53, 0.9], [24.71, 46.68, 1.0],
  [21.48, 39.19, 0.9], [30.04, 31.24, 1.32], [31.2, 29.92, 0.95], [32.08, 34.78, 1.0],
  [41.01, 28.98, 1.22], [39.93, 32.86, 0.85], [35.69, 51.39, 1.05],
  // Europe
  [51.5, -0.12, 1.45], [53.48, -2.24, 1.1], [55.86, -4.25, 0.85], [53.35, -6.26, 0.85],
  [48.85, 2.35, 1.4], [45.76, 4.84, 0.9], [43.3, 5.37, 0.85], [50.85, 4.35, 1.25],
  [52.37, 4.9, 1.3], [51.92, 4.48, 1.1], [51.23, 6.77, 1.3], [50.11, 8.68, 1.1],
  [52.52, 13.4, 1.25], [53.55, 9.99, 1.0], [48.14, 11.58, 1.05], [47.37, 8.54, 0.95],
  [45.46, 9.19, 1.32], [45.07, 7.69, 0.95], [44.49, 11.34, 0.9], [41.9, 12.5, 1.1],
  [40.85, 14.27, 0.95], [40.42, -3.7, 1.2], [41.39, 2.17, 1.05], [38.72, -9.14, 0.9],
  [52.23, 21.01, 1.1], [50.06, 19.94, 0.95], [50.08, 14.44, 1.0], [48.21, 16.37, 1.0],
  [47.5, 19.04, 0.95], [55.76, 37.62, 1.4], [59.93, 30.33, 1.05], [59.33, 18.07, 0.95],
  [55.68, 12.57, 0.9], [59.91, 10.75, 0.8], [60.17, 24.94, 0.8], [37.98, 23.73, 0.9],
  [50.45, 30.52, 0.95], [44.43, 26.1, 0.85],
  // North America
  [40.71, -74.01, 1.5], [39.95, -75.16, 1.15], [42.36, -71.06, 1.2], [38.9, -77.04, 1.2],
  [41.88, -87.63, 1.3], [42.33, -83.05, 1.05], [43.65, -79.38, 1.2], [45.5, -73.57, 1.05],
  [33.75, -84.39, 1.1], [25.76, -80.19, 1.1], [28.54, -81.38, 0.95], [29.76, -95.37, 1.2],
  [32.78, -96.8, 1.2], [30.27, -97.74, 0.95], [39.74, -104.99, 1.0], [33.45, -112.07, 1.0],
  [36.17, -115.14, 0.95], [34.05, -118.24, 1.4], [32.72, -117.16, 1.05], [37.77, -122.42, 1.25],
  [45.52, -122.68, 0.9], [47.61, -122.33, 1.05], [49.28, -123.12, 0.95], [19.43, -99.13, 1.3],
  [20.66, -103.35, 0.9], [25.69, -100.32, 0.95],
  // South America, Africa & Oceania
  [-23.55, -46.63, 1.3], [-22.91, -43.17, 1.1], [-19.92, -43.94, 0.85], [-34.6, -58.38, 1.2],
  [-33.45, -70.67, 1.0], [-12.05, -77.04, 0.9], [4.71, -74.07, 0.95], [6.52, 3.38, 0.95],
  [-26.2, 28.05, 1.05], [-33.92, 18.42, 0.9], [33.57, -7.59, 0.85], [36.75, 3.06, 0.85],
  [-1.29, 36.82, 0.75], [-33.87, 151.21, 1.1], [-37.81, 144.96, 1.05], [-27.47, 153.03, 0.9],
  [-31.95, 115.86, 0.8], [-36.85, 174.76, 0.85],
];

function buildLineSegmentsFromMultiLine(
  lines: Array<GeoRing>,
  radius: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const ring of lines) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      // Skip degenerate antimeridian jumps
      if (Math.abs(lng2 - lng1) > 120) continue;
      const [x1, y1, z1] = latLngToVector3(lat1, lng1, radius);
      const [x2, y2, z2] = latLngToVector3(lat2, lng2, radius);
      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function buildGraticuleGeometry(radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  // Parallels every 15 deg
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lng = -180; lng < 180; lng += 4) {
      const [x1, y1, z1] = latLngToVector3(lat, lng, radius);
      const [x2, y2, z2] = latLngToVector3(lat, lng + 4, radius);
      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }
  // Meridians every 15 deg
  for (let lng = -180; lng < 180; lng += 15) {
    for (let lat = -80; lat < 80; lat += 4) {
      const [x1, y1, z1] = latLngToVector3(lat, lng, radius);
      const [x2, y2, z2] = latLngToVector3(lat + 4, lng, radius);
      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

/**
 * Stage 1 ultra-fast (<25ms) initial Earth assets so the 3D globe renders immediately
 * before Stage 2 upgrades to full 4K topographic relief, bathymetry, bump map & clouds!
 */
export function createQuickEarthAssets(): EarthAssets {
  const width = 1024;
  const height = 512;

  const topo = countriesAtlas50m as unknown as Topology<{
    countries: GeometryCollection;
    land: GeometryCollection;
  }>;
  const landGeo = feature(topo, topo.objects.land);
  const countryBorders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const outerCoastlines = mesh(topo, topo.objects.land);

  const buildLandPath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    const features = "features" in landGeo ? landGeo.features : [landGeo];
    for (const feat of features) {
      const geom = feat.geometry;
      if (!geom) continue;
      if (geom.type === "Polygon") {
        drawPolygonCoords(ctx, geom.coordinates as GeoRing[], width, height);
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
          drawPolygonCoords(ctx, poly as GeoRing[], width, height);
        }
      }
    }
  };

  const dayCanvas = document.createElement("canvas");
  dayCanvas.width = width;
  dayCanvas.height = height;
  const dCtx = dayCanvas.getContext("2d")!;
  const oceanGrad = dCtx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#0a192c");
  oceanGrad.addColorStop(0.5, "#092846");
  oceanGrad.addColorStop(1, "#0a192c");
  dCtx.fillStyle = oceanGrad;
  dCtx.fillRect(0, 0, width, height);
  buildLandPath(dCtx);
  dCtx.fillStyle = "#223b3b";
  dCtx.fill();

  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = width;
  nightCanvas.height = height;
  const nCtx = nightCanvas.getContext("2d")!;
  nCtx.fillStyle = "#020710";
  nCtx.fillRect(0, 0, width, height);
  buildLandPath(nCtx);
  nCtx.fillStyle = "#07111f";
  nCtx.fill();

  const specCanvas = document.createElement("canvas");
  specCanvas.width = 512;
  specCanvas.height = 256;
  const sCtx = specCanvas.getContext("2d")!;
  sCtx.fillStyle = "#ffffff";
  sCtx.fillRect(0, 0, 512, 256);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 64;
  bumpCanvas.height = 32;
  const bCtx = bumpCanvas.getContext("2d")!;
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 64, 32);

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 64;
  cloudCanvas.height = 32;

  const coastLines: GeoRing[] =
    outerCoastlines.type === "MultiLineString" ? (outerCoastlines.coordinates as GeoRing[]) : [];
  const borderLines: GeoRing[] =
    countryBorders.type === "MultiLineString" ? (countryBorders.coordinates as GeoRing[]) : [];

  const coastlineGeometry = buildLineSegmentsFromMultiLine(coastLines, 1.0014);
  const borderGeometry = buildLineSegmentsFromMultiLine(borderLines, 1.0016);
  const graticuleGeometry = buildGraticuleGeometry(1.0009);

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  const specularMap = new THREE.CanvasTexture(specCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const cloudMap = new THREE.CanvasTexture(cloudCanvas);

  return {
    dayMap,
    nightMap,
    specularMap,
    bumpMap,
    cloudMap,
    coastlineGeometry,
    borderGeometry,
    graticuleGeometry,
    dispose: () => {
      dayMap.dispose();
      nightMap.dispose();
      specularMap.dispose();
      bumpMap.dispose();
      cloudMap.dispose();
      coastlineGeometry.dispose();
      borderGeometry.dispose();
      graticuleGeometry.dispose();
    },
  };
}

/**
 * Stage 2 ultra-detailed 50m Natural Earth vector + procedural satellite relief Earth assets:
 * - Day Albedo (bathymetry, shallow coastal shelves, biomes, mountain ridges, polar ice)
 * - Night Albedo (nocturnal landmasses + warm amber metropolitan light networks)
 * - Terrain Bump/Elevation Map (for GLSL sunlight relief shading)
 * - Ocean Specular Mask
 * - Procedural Global Cloud Layer Texture
 * - 3D Vector Coastlines, Country Borders & Graticule (razor-sharp at ANY zoom level!)
 */
export function createEarthAssets(isMobile: boolean): EarthAssets {
  const width = isMobile ? 2048 : 4096;
  const height = isMobile ? 1024 : 2048;

  const topo = countriesAtlas50m as unknown as Topology<{
    countries: GeometryCollection;
    land: GeometryCollection;
  }>;
  const landGeo = feature(topo, topo.objects.land);
  const countryBorders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const outerCoastlines = mesh(topo, topo.objects.land);

  const buildLandPath = (ctx: CanvasRenderingContext2D, scale = 1) => {
    const w = width * scale;
    const h = height * scale;
    ctx.beginPath();
    const features = "features" in landGeo ? landGeo.features : [landGeo];
    for (const feat of features) {
      const geom = feat.geometry;
      if (!geom) continue;
      if (geom.type === "Polygon") {
        drawPolygonCoords(ctx, geom.coordinates as GeoRing[], w, h);
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
          drawPolygonCoords(ctx, poly as GeoRing[], w, h);
        }
      }
    }
  };

  // ==================== 1. PROCEDURAL TERRAIN & BATHYMETRY NOISE CANVAS ====================
  // Computed at 1024x512 (~0.5M pixels -> ~35ms) and smoothly upscaled onto 4K/2K albedo + bump!
  const noiseW = isMobile ? 640 : 1024;
  const noiseH = isMobile ? 320 : 512;

  // Rasterize land mask at noise resolution for fast pixel-accurate biome & elevation synthesis
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = noiseW;
  maskCanvas.height = noiseH;
  const mCtx = maskCanvas.getContext("2d")!;
  mCtx.fillStyle = "#000000";
  mCtx.fillRect(0, 0, noiseW, noiseH);
  buildLandPath(mCtx, noiseW / width);
  mCtx.fillStyle = "#ffffff";
  mCtx.fill();
  const maskData = mCtx.getImageData(0, 0, noiseW, noiseH).data;

  const terrainCanvas = document.createElement("canvas");
  terrainCanvas.width = noiseW;
  terrainCanvas.height = noiseH;
  const tCtx = terrainCanvas.getContext("2d")!;
  const tImg = tCtx.createImageData(noiseW, noiseH);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = noiseW;
  bumpCanvas.height = noiseH;
  const bCtx = bumpCanvas.getContext("2d")!;
  const bImg = bCtx.createImageData(noiseW, noiseH);

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = noiseW;
  cloudCanvas.height = noiseH;
  const cCtx = cloudCanvas.getContext("2d")!;
  const cImg = cCtx.createImageData(noiseW, noiseH);

  for (let py = 0; py < noiseH; py++) {
    const v = py / noiseH;
    const lat = 90 - v * 180;
    const absLat = Math.abs(lat);

    for (let px = 0; px < noiseW; px++) {
      const u = px / noiseW;
      const lng = u * 360 - 180;
      const idx = (py * noiseW + px) * 4;
      const isLand = maskData[idx] > 120;

      const nMacro = fbmPeriodic(u, v, 10, 4);
      const nFine = fbmPeriodic(u + 0.31, v + 0.17, 28, 3);

      // Cloud field (smooth ITCZ + mid-latitude cyclone swirls)
      const warpU = u + (nMacro - 0.5) * 0.085;
      const warpV = v + (nFine - 0.5) * 0.055;
      const cloudN = fbmPeriodic(warpU + 0.13, warpV, 12, 4);
      const latBand =
        0.58 +
        0.24 * Math.exp(-Math.pow((absLat - 48) / 18, 2)) +
        0.22 * Math.exp(-Math.pow(absLat / 12, 2));
      const cloudAlpha = Math.max(0, Math.min(1, (cloudN * latBand - 0.39) * 3.4));
      cImg.data[idx] = 232;
      cImg.data[idx + 1] = 242;
      cImg.data[idx + 2] = 252;
      cImg.data[idx + 3] = Math.round(cloudAlpha * 165);

      if (!isLand) {
        // Bathymetric ocean floor shading (abyssal plains + mid-ocean ridges)
        const depthShade = 0.72 + nMacro * 0.34 + (nFine - 0.5) * 0.1;
        const polarCool = absLat > 65 ? (absLat - 65) / 25 : 0;
        const r = Math.round((8 + polarCool * 14) * depthShade);
        const g = Math.round((27 + (1 - absLat / 90) * 16) * depthShade);
        const b = Math.round((54 + (1 - absLat / 90) * 24) * depthShade);
        tImg.data[idx] = Math.min(255, r);
        tImg.data[idx + 1] = Math.min(255, g);
        tImg.data[idx + 2] = Math.min(255, b);
        tImg.data[idx + 3] = 255;

        // Flat ocean in bump map
        const bVal = Math.round(28 + nMacro * 14);
        bImg.data[idx] = bVal;
        bImg.data[idx + 1] = bVal;
        bImg.data[idx + 2] = bVal;
        bImg.data[idx + 3] = 255;
      } else {
        // Compute mountain elevation weight & arid biome weight
        let mtn = 0;
        for (let i = 0; i < MOUNTAIN_ZONES.length; i++) {
          const [mlat, mlng, mrad, mw] = MOUNTAIN_ZONES[i];
          const dLat = lat - mlat;
          const dLng = lng - mlng;
          const dist2 = dLat * dLat + dLng * dLng;
          if (dist2 < mrad * mrad) {
            const falloff = 1 - Math.sqrt(dist2) / mrad;
            mtn = Math.max(mtn, falloff * falloff * mw);
          }
        }

        let arid = 0;
        for (let i = 0; i < ARID_ZONES.length; i++) {
          const [alat, alng, arad, aw] = ARID_ZONES[i];
          const dLat = lat - alat;
          const dLng = lng - alng;
          const dist2 = dLat * dLat + dLng * dLng;
          if (dist2 < arad * arad) {
            const falloff = 1 - Math.sqrt(dist2) / arad;
            arid = Math.max(arid, falloff * aw);
          }
        }

        const ridge = Math.abs(nFine * 2 - 1);
        const elev = Math.min(1, 0.16 + nMacro * 0.36 + mtn * (0.48 + (1 - ridge) * 0.42));

        // Base biome color by latitude (lush equatorial -> temperate -> boreal -> polar ice)
        let r = 34;
        let g = 66;
        let b = 52;

        if (absLat < 16) {
          // Tropical rainforest
          r = 26 + nMacro * 14;
          g = 64 + nMacro * 18;
          b = 46 + nMacro * 12;
        } else if (absLat < 45) {
          // Temperate forest / plains
          r = 38 + nMacro * 22;
          g = 66 + nMacro * 18;
          b = 54 + nMacro * 12;
        } else if (absLat < 66) {
          // Boreal taiga & tundra
          r = 42 + nMacro * 20;
          g = 62 + nMacro * 18;
          b = 64 + nMacro * 18;
        } else {
          // Arctic / Antarctic snow & ice sheet
          r = 122 + nMacro * 38;
          g = 144 + nMacro * 36;
          b = 166 + nMacro * 34;
        }

        // Blend warm arid deserts
        if (arid > 0.01) {
          const aMix = Math.min(0.85, arid * (0.75 + nMacro * 0.35));
          r = r * (1 - aMix) + (108 + nFine * 24) * aMix;
          g = g * (1 - aMix) + (96 + nFine * 18) * aMix;
          b = b * (1 - aMix) + (74 + nFine * 14) * aMix;
        }

        // Blend alpine mountain rock & snowy peaks
        if (mtn > 0.05) {
          const rockMix = Math.min(0.85, mtn * 0.9);
          const snowBoost = elev > 0.68 ? (elev - 0.68) * 180 : 0;
          r = r * (1 - rockMix) + (82 + snowBoost) * rockMix;
          g = g * (1 - rockMix) + (88 + snowBoost) * rockMix;
          b = b * (1 - rockMix) + (96 + snowBoost * 1.05) * rockMix;
        }

        // Subtle topographic micro-relief contrast
        const reliefShade = 0.84 + nFine * 0.32;
        tImg.data[idx] = Math.min(255, Math.round(r * reliefShade));
        tImg.data[idx + 1] = Math.min(255, Math.round(g * reliefShade));
        tImg.data[idx + 2] = Math.min(255, Math.round(b * reliefShade));
        tImg.data[idx + 3] = 255;

        const bVal = Math.min(255, Math.round(75 + elev * 180));
        bImg.data[idx] = bVal;
        bImg.data[idx + 1] = bVal;
        bImg.data[idx + 2] = bVal;
        bImg.data[idx + 3] = 255;
      }
    }
  }

  tCtx.putImageData(tImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  cCtx.putImageData(cImg, 0, 0);

  // ==================== 2. HIGH-RES DAY ALBEDO CANVAS (4K Desktop / 2K Mobile) ====================
  const dayCanvas = document.createElement("canvas");
  dayCanvas.width = width;
  dayCanvas.height = height;
  const dCtx = dayCanvas.getContext("2d")!;

  // Smooth upscaled bathymetry + biome terrain base
  dCtx.imageSmoothingEnabled = true;
  dCtx.imageSmoothingQuality = "high";
  dCtx.drawImage(terrainCanvas, 0, 0, width, height);

  // Shallow continental shelf coastal glow (turquoise-azure bathymetric halo around 50m coastlines!)
  dCtx.save();
  buildLandPath(dCtx);
  dCtx.shadowColor = "rgba(34, 174, 218, 0.52)";
  dCtx.shadowBlur = width / 180;
  dCtx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  dCtx.lineWidth = Math.max(2, width / 950);
  dCtx.stroke();
  dCtx.restore();

  // Re-clip sharp 50m landmass edge over the shelf halo so land edges stay crisp
  dCtx.save();
  buildLandPath(dCtx);
  dCtx.clip();
  dCtx.drawImage(terrainCanvas, 0, 0, width, height);
  dCtx.restore();

  // Crisp 50m coastlines & country borders on raster map (augmented by 3D vector overlay!)
  dCtx.save();
  buildLandPath(dCtx);
  dCtx.strokeStyle = "rgba(154, 218, 246, 0.45)";
  dCtx.lineWidth = Math.max(1.0, width / 2200);
  dCtx.stroke();
  dCtx.restore();

  dCtx.save();
  dCtx.beginPath();
  if (countryBorders.type === "MultiLineString") {
    for (const line of countryBorders.coordinates) {
      traceRing(dCtx, line as GeoRing, width, height);
    }
  }
  dCtx.strokeStyle = "rgba(186, 214, 236, 0.24)";
  dCtx.lineWidth = Math.max(0.75, width / 2800);
  dCtx.stroke();
  dCtx.restore();

  // ==================== 3. HIGH-RES NIGHT MAP CANVAS ====================
  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = width;
  nightCanvas.height = height;
  const nCtx = nightCanvas.getContext("2d")!;

  nCtx.fillStyle = "#020710";
  nCtx.fillRect(0, 0, width, height);

  nCtx.save();
  buildLandPath(nCtx);
  nCtx.fillStyle = "#07111f";
  nCtx.fill();
  nCtx.strokeStyle = "rgba(56, 140, 200, 0.28)";
  nCtx.lineWidth = Math.max(0.9, width / 2400);
  nCtx.stroke();
  nCtx.restore();

  // Clipped multi-scale golden city lights
  nCtx.save();
  buildLandPath(nCtx);
  nCtx.clip();

  const allHubs: Array<[number, number, number]> = [
    ...NIGHT_LIGHT_HUBS,
    ...GLOBAL_WEATHER_ANCHORS.map((a): [number, number, number] => [a.lat, a.lng, 0.6]),
  ];

  for (const [lat, lng, intensity] of allHubs) {
    const cx = lngToX(lng, width);
    const cy = latToY(lat, height);
    const radius = (width / 145) * intensity;
    const g = nCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `rgba(255, 240, 195, ${Math.min(0.98, 0.8 * intensity)})`);
    g.addColorStop(0.24, `rgba(251, 191, 90, ${Math.min(0.72, 0.5 * intensity)})`);
    g.addColorStop(0.58, `rgba(217, 119, 36, ${Math.min(0.32, 0.22 * intensity)})`);
    g.addColorStop(1, "rgba(217, 119, 36, 0)");
    nCtx.fillStyle = g;
    nCtx.beginPath();
    nCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    nCtx.fill();
  }
  nCtx.restore();

  // ==================== 4. OCEAN SPECULAR MASK ====================
  const specCanvas = document.createElement("canvas");
  specCanvas.width = width / 2;
  specCanvas.height = height / 2;
  const sCtx = specCanvas.getContext("2d")!;
  sCtx.fillStyle = "#ffffff";
  sCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
  buildLandPath(sCtx, 0.5);
  sCtx.fillStyle = "#141414";
  sCtx.fill();

  // ==================== 5. 3D VECTOR OVERLAYS (RAZOR SHARP AT DEEP ZOOM!) ====================
  const coastLines: GeoRing[] =
    outerCoastlines.type === "MultiLineString"
      ? (outerCoastlines.coordinates as GeoRing[])
      : [];
  const borderLines: GeoRing[] =
    countryBorders.type === "MultiLineString"
      ? (countryBorders.coordinates as GeoRing[])
      : [];

  const coastlineGeometry = buildLineSegmentsFromMultiLine(coastLines, 1.0014);
  const borderGeometry = buildLineSegmentsFromMultiLine(borderLines, 1.0016);
  const graticuleGeometry = buildGraticuleGeometry(1.0009);

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = isMobile ? 4 : 12;
  dayMap.needsUpdate = true;

  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.anisotropy = isMobile ? 4 : 12;
  nightMap.needsUpdate = true;

  const specularMap = new THREE.CanvasTexture(specCanvas);
  specularMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.needsUpdate = true;

  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.needsUpdate = true;

  return {
    dayMap,
    nightMap,
    specularMap,
    bumpMap,
    cloudMap,
    coastlineGeometry,
    borderGeometry,
    graticuleGeometry,
    dispose: () => {
      dayMap.dispose();
      nightMap.dispose();
      specularMap.dispose();
      bumpMap.dispose();
      cloudMap.dispose();
      coastlineGeometry.dispose();
      borderGeometry.dispose();
      graticuleGeometry.dispose();
    },
  };
}
