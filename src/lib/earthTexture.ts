import * as THREE from "three";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countriesAtlas from "world-atlas/countries-110m.json";
import { GLOBAL_WEATHER_ANCHORS } from "./locations";

type GeoRing = Array<[number, number]>;

interface EarthTextures {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
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
    // Avoid drawing horizontal streaks across the antimeridian (±180°)
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

// Major metropolitan population clusters for realistic Night Lights rendering
const NIGHT_LIGHT_HUBS: Array<[number, number, number]> = [
  // [lat, lng, intensity 0.4..1.4]
  // East Asia
  [37.56, 126.98, 1.35], [35.18, 129.07, 0.9], [35.68, 139.69, 1.45],
  [34.69, 135.5, 1.2], [35.18, 136.9, 0.95], [39.9, 116.4, 1.35],
  [31.23, 121.47, 1.4], [23.13, 113.26, 1.3], [22.32, 114.17, 1.15],
  [25.03, 121.56, 1.05], [30.67, 104.06, 0.9], [34.26, 108.94, 0.85],
  [14.6, 120.98, 0.95], [13.75, 100.5, 1.0], [1.35, 103.82, 1.0],
  [-6.2, 106.84, 0.95], [21.03, 105.85, 0.8], [10.82, 106.63, 0.85],
  // South Asia & Middle East
  [28.61, 77.21, 1.3], [19.08, 72.88, 1.2], [12.97, 77.59, 0.95],
  [22.57, 88.36, 1.0], [31.52, 74.36, 0.95], [24.86, 67.0, 0.9],
  [25.2, 55.27, 1.05], [24.71, 46.68, 0.95], [30.04, 31.24, 1.25],
  [32.08, 34.78, 0.95], [41.01, 28.98, 1.15], [35.69, 51.39, 1.0],
  // Europe
  [51.5, -0.12, 1.4], [48.85, 2.35, 1.35], [50.85, 4.35, 1.2],
  [52.37, 4.9, 1.25], [51.23, 6.77, 1.25], [52.52, 13.4, 1.2],
  [48.14, 11.58, 1.0], [45.46, 9.19, 1.25], [41.9, 12.5, 1.05],
  [40.42, -3.7, 1.15], [41.39, 2.17, 1.0], [52.23, 21.01, 1.05],
  [50.08, 14.44, 0.95], [48.21, 16.37, 0.95], [55.76, 37.62, 1.35],
  [59.93, 30.33, 1.0], [59.33, 18.07, 0.9], [55.68, 12.57, 0.85],
  [37.98, 23.73, 0.85], [50.45, 30.52, 0.95],
  // North America
  [40.71, -74.01, 1.45], [42.36, -71.06, 1.15], [38.9, -77.04, 1.15],
  [41.88, -87.63, 1.25], [43.65, -79.38, 1.15], [45.5, -73.57, 1.0],
  [33.75, -84.39, 1.05], [25.76, -80.19, 1.05], [29.76, -95.37, 1.15],
  [32.78, -96.8, 1.15], [39.74, -104.99, 0.95], [33.45, -112.07, 0.95],
  [34.05, -118.24, 1.35], [37.77, -122.42, 1.2], [47.61, -122.33, 1.0],
  [49.28, -123.12, 0.9], [19.43, -99.13, 1.25], [25.69, -100.32, 0.9],
  // South America
  [-23.55, -46.63, 1.25], [-22.91, -43.17, 1.05], [-34.6, -58.38, 1.15],
  [-33.45, -70.67, 0.95], [-12.05, -77.04, 0.85], [4.71, -74.07, 0.9],
  [10.48, -66.9, 0.8],
  // Africa & Oceania
  [6.52, 3.38, 0.9], [-26.2, 28.05, 1.0], [-33.92, 18.42, 0.85],
  [33.57, -7.59, 0.8], [-1.29, 36.82, 0.7], [-33.87, 151.21, 1.05],
  [-37.81, 144.96, 1.0], [-27.47, 153.03, 0.85], [-36.85, 174.76, 0.8],
];

/**
 * Generates crisp, zero-network-dependency Day, Night, and Ocean Specular textures
 * directly from Natural Earth 110m vector topology bundled inside the app.
 */
export function createEarthTextures(isMobile: boolean): EarthTextures {
  const width = isMobile ? 2048 : 4096;
  const height = isMobile ? 1024 : 2048;

  const topo = countriesAtlas as unknown as Topology<{
    countries: GeometryCollection;
    land: GeometryCollection;
  }>;
  const landGeo = feature(topo, topo.objects.land);
  const countryBorders = mesh(topo, topo.objects.countries, (a, b) => a !== b);

  // 1. DAY MAP CANVAS
  const dayCanvas = document.createElement("canvas");
  dayCanvas.width = width;
  dayCanvas.height = height;
  const dCtx = dayCanvas.getContext("2d")!;

  // Deep bathymetric ocean gradient
  const oceanGrad = dCtx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0.0, "#0b1a2e");
  oceanGrad.addColorStop(0.18, "#0a223d");
  oceanGrad.addColorStop(0.5, "#092a4a");
  oceanGrad.addColorStop(0.82, "#0a213b");
  oceanGrad.addColorStop(1.0, "#0b192c");
  dCtx.fillStyle = oceanGrad;
  dCtx.fillRect(0, 0, width, height);

  // Subtle lat/lng graticule on ocean
  dCtx.strokeStyle = "rgba(125, 195, 255, 0.065)";
  dCtx.lineWidth = Math.max(1, width / 2048);
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = latToY(lat, height);
    dCtx.beginPath();
    dCtx.moveTo(0, y);
    dCtx.lineTo(width, y);
    dCtx.stroke();
  }
  for (let lng = -165; lng <= 180; lng += 15) {
    const x = lngToX(lng, width);
    dCtx.beginPath();
    dCtx.moveTo(x, 0);
    dCtx.lineTo(x, height);
    dCtx.stroke();
  }
  // Subtle equator highlight
  dCtx.strokeStyle = "rgba(125, 211, 252, 0.14)";
  dCtx.beginPath();
  dCtx.moveTo(0, height / 2);
  dCtx.lineTo(width, height / 2);
  dCtx.stroke();

  // Helper to build land path on any canvas context
  const buildLandPath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    const features =
      "features" in landGeo ? landGeo.features : [landGeo];
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

  // Coastal bathymetric shelf halo
  dCtx.save();
  buildLandPath(dCtx);
  dCtx.shadowColor = "rgba(38, 148, 204, 0.42)";
  dCtx.shadowBlur = width / 160;
  dCtx.fillStyle = "#162c3d";
  dCtx.fill();
  dCtx.restore();

  // Natural latitude-graded continental biome fill
  const landGrad = dCtx.createLinearGradient(0, 0, 0, height);
  landGrad.addColorStop(0.0, "#4c6278"); // High Arctic ice/tundra
  landGrad.addColorStop(0.14, "#273f47"); // Boreal
  landGrad.addColorStop(0.28, "#223b3b"); // Temperate north
  landGrad.addColorStop(0.41, "#33423b"); // Subtropical / arid belt
  landGrad.addColorStop(0.5, "#1f3d36"); // Equatorial forest
  landGrad.addColorStop(0.65, "#2f3f3a"); // Southern subtropical
  landGrad.addColorStop(0.84, "#253944"); // Southern temperate
  landGrad.addColorStop(0.94, "#53697e"); // Antarctic ice shelf
  landGrad.addColorStop(1.0, "#688097");

  dCtx.save();
  buildLandPath(dCtx);
  dCtx.fillStyle = landGrad;
  dCtx.fill();

  // Crisp continental coastlines
  dCtx.strokeStyle = "rgba(148, 212, 240, 0.48)";
  dCtx.lineWidth = Math.max(1.2, width / 1600);
  dCtx.stroke();
  dCtx.restore();

  // Country borders
  dCtx.save();
  dCtx.beginPath();
  if (countryBorders.type === "MultiLineString") {
    for (const line of countryBorders.coordinates) {
      traceRing(dCtx, line as GeoRing, width, height);
    }
  }
  dCtx.strokeStyle = "rgba(148, 185, 212, 0.22)";
  dCtx.lineWidth = Math.max(0.8, width / 2400);
  dCtx.stroke();
  dCtx.restore();

  // 2. NIGHT MAP CANVAS (deep nocturnal continents + warm golden urban clusters)
  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = width;
  nightCanvas.height = height;
  const nCtx = nightCanvas.getContext("2d")!;

  nCtx.fillStyle = "#030812";
  nCtx.fillRect(0, 0, width, height);

  nCtx.save();
  buildLandPath(nCtx);
  nCtx.fillStyle = "#081221";
  nCtx.fill();
  nCtx.strokeStyle = "rgba(56, 128, 184, 0.25)";
  nCtx.lineWidth = Math.max(1, width / 2000);
  nCtx.stroke();
  nCtx.restore();

  // Render subtle city-light glows clipped inside landmasses
  nCtx.save();
  buildLandPath(nCtx);
  nCtx.clip();

  const allHubs: Array<[number, number, number]> = [
    ...NIGHT_LIGHT_HUBS,
    ...GLOBAL_WEATHER_ANCHORS.map((a): [number, number, number] => [a.lat, a.lng, 0.55]),
  ];

  for (const [lat, lng, intensity] of allHubs) {
    const cx = lngToX(lng, width);
    const cy = latToY(lat, height);
    const radius = (width / 130) * intensity;
    const g = nCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `rgba(255, 224, 150, ${Math.min(0.95, 0.65 * intensity)})`);
    g.addColorStop(0.35, `rgba(245, 168, 72, ${Math.min(0.55, 0.35 * intensity)})`);
    g.addColorStop(1, "rgba(245, 158, 11, 0)");
    nCtx.fillStyle = g;
    nCtx.beginPath();
    nCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    nCtx.fill();
  }
  nCtx.restore();

  // 3. SPECULAR MASK CANVAS (ocean reflects subtle sunlight, land is matte)
  const specCanvas = document.createElement("canvas");
  specCanvas.width = width / 2;
  specCanvas.height = height / 2;
  const sCtx = specCanvas.getContext("2d")!;
  sCtx.fillStyle = "#ffffff";
  sCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
  sCtx.save();
  sCtx.scale(0.5, 0.5);
  buildLandPath(sCtx);
  sCtx.fillStyle = "#181818";
  sCtx.fill();
  sCtx.restore();

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = isMobile ? 4 : 8;
  dayMap.needsUpdate = true;

  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.anisotropy = isMobile ? 4 : 8;
  nightMap.needsUpdate = true;

  const specularMap = new THREE.CanvasTexture(specCanvas);
  specularMap.needsUpdate = true;

  return {
    dayMap,
    nightMap,
    specularMap,
    dispose: () => {
      dayMap.dispose();
      nightMap.dispose();
      specularMap.dispose();
    },
  };
}
