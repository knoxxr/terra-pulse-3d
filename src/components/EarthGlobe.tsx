"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createEarthAssets } from "@/lib/earthTexture";
import {
  DEG2RAD,
  getMagnitudeColor,
  getPm25Level,
  getSubsolarPoint,
  latLngToVector3,
  vector3ToLatLng,
} from "@/lib/geo";
import type {
  AirQualityCluster,
  CameraTelemetry,
  EarthquakeEvent,
  LayerVisibility,
  OceanNode,
  SelectedItem,
  WeatherNode,
  ZoomCommand,
} from "@/types/telemetry";

interface EarthGlobeProps {
  earthquakes: EarthquakeEvent[];
  weather: WeatherNode[];
  ocean: OceanNode[];
  airQuality: AirQualityCluster[];
  layers: LayerVisibility;
  selected: SelectedItem | null;
  flyToTarget: { lat: number; lng: number; altitude?: number; nonce: number } | null;
  zoomCommand: ZoomCommand | null;
  onSelect: (item: SelectedItem) => void;
  onTelemetry: (telemetry: CameraTelemetry) => void;
}

interface HoverTooltip {
  x: number;
  y: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
}

interface ProjectedLabelDef {
  id: string;
  text: string;
  sub?: string;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  kind: "ocean" | "city-major" | "city-detail" | "quake";
  minDist: number;
  maxDist: number;
  accent?: string;
}

const EARTH_RADIUS = 1.0;
const EARTH_RADIUS_KM = 6371;
const MIN_CAM_DIST = 1.13;
const MAX_CAM_DIST = 4.8;

const MAJOR_CITY_IDS = new Set([
  "seoul",
  "tokyo",
  "beijing",
  "singapore",
  "sydney",
  "delhi",
  "dubai",
  "london",
  "paris",
  "moscow",
  "cairo",
  "capetown",
  "newyork",
  "sanfrancisco",
  "saopaulo",
  "honolulu",
  "anchorage",
]);

const OCEAN_LABELS: Array<{ id: string; name: string; lat: number; lng: number }> = [
  { id: "lbl-pac-n", name: "북태평양", lat: 28, lng: -162 },
  { id: "lbl-pac-s", name: "남태평양", lat: -26, lng: -132 },
  { id: "lbl-atl-n", name: "북대서양", lat: 32, lng: -42 },
  { id: "lbl-atl-s", name: "남대서양", lat: -26, lng: -18 },
  { id: "lbl-ind", name: "인도양", lat: -18, lng: 78 },
  { id: "lbl-east-sea", name: "동해", lat: 39.2, lng: 133.5 },
  { id: "lbl-med", name: "지중해", lat: 36.2, lng: 16.5 },
  { id: "lbl-arctic", name: "북극해", lat: 81, lng: 15 },
];

const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uBumpMap;
  uniform vec3 uSunDir;
  uniform float uDayNightMix;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec3 dayCol = texture2D(uDayMap, vUv).rgb;
    vec3 nightCol = texture2D(uNightMap, vUv).rgb;
    float oceanMask = texture2D(uSpecularMap, vUv).r;

    // Finite-difference topographic bump relief from uBumpMap
    vec2 texel = vec2(1.0 / 1024.0, 1.0 / 512.0);
    float hL = texture2D(uBumpMap, vUv - vec2(texel.x, 0.0)).r;
    float hR = texture2D(uBumpMap, vUv + vec2(texel.x, 0.0)).r;
    float hD = texture2D(uBumpMap, vUv - vec2(0.0, texel.y)).r;
    float hU = texture2D(uBumpMap, vUv + vec2(0.0, texel.y)).r;

    // Build local tangent frame on sphere
    vec3 upAxis = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 T = normalize(cross(upAxis, N));
    vec3 B = cross(N, T);
    float bumpStrength = mix(2.2, 0.2, oceanMask);
    vec3 bumpedN = normalize(N + T * (hL - hR) * bumpStrength + B * (hD - hU) * bumpStrength);

    float ndotl = dot(N, L);
    float bumpedNdotL = dot(bumpedN, L);
    float dayFactor = smoothstep(-0.14, 0.24, ndotl);

    // Warm atmospheric sunset/sunrise scatter along the terminator
    float twilight = exp(-pow((ndotl - 0.025) * 8.2, 2.0));
    vec3 twilightTint = vec3(0.58, 0.28, 0.14) * twilight * 0.48;

    // Crisp ocean solar glint
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * oceanMask * max(ndotl, 0.0) * 0.34;
    float broadSpec = pow(max(dot(N, H), 0.0), 10.0) * oceanMask * max(ndotl, 0.0) * 0.09;

    // Terrain relief diffuse lighting
    float reliefDiffuse = 0.68 + 0.44 * max(bumpedNdotL, 0.0);
    vec3 litDay = dayCol * reliefDiffuse + vec3(0.65, 0.84, 1.0) * (spec + broadSpec);
    vec3 shaded = mix(nightCol * 1.24, litDay, dayFactor) + twilightTint;

    // Uniform daylight cartographic mode (still keeps subtle terrain relief!)
    vec3 fakeSun = normalize(vec3(0.45, 0.55, 0.7));
    float uniRelief = 0.92 + 0.26 * dot(bumpedN, fakeSun);
    vec3 uniformDay = dayCol * uniRelief + vec3(0.02, 0.05, 0.08);

    vec3 finalCol = mix(uniformDay, shaded, uDayNightMix);

    // Rayleigh atmospheric horizon scattering rim
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.1);
    vec3 atmoColor = mix(vec3(0.12, 0.42, 0.76), vec3(0.28, 0.72, 0.98), dayFactor * uDayNightMix + (1.0 - uDayNightMix) * 0.7);
    finalCol += atmoColor * fresnel * 0.42;

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = max(0.0, 0.64 - dot(vNormal, vViewDir));
    float intensity = pow(rim, 3.6) * 1.65;
    gl_FragColor = vec4(0.20, 0.64, 0.98, intensity * 0.76);
  }
`;

function createStarSpriteTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(235,245,255,0.85)");
  g.addColorStop(0.6, "rgba(180,220,255,0.18)");
  g.addColorStop(1, "rgba(180,220,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function tempToColor(tempC: number): THREE.Color {
  if (tempC <= -10) return new THREE.Color("#60a5fa");
  if (tempC <= 5) return new THREE.Color("#38bdf8");
  if (tempC <= 18) return new THREE.Color("#2dd4bf");
  if (tempC <= 28) return new THREE.Color("#fbbf24");
  return new THREE.Color("#f97316");
}

function waveToColor(waveM: number): THREE.Color {
  if (waveM >= 4.0) return new THREE.Color("#f59e0b");
  if (waveM >= 2.5) return new THREE.Color("#22d3ee");
  return new THREE.Color("#14b8a6");
}

function offsetLatLng(lat: number, lng: number, bearingDeg: number, distDeg: number): [number, number] {
  const rad = bearingDeg * DEG2RAD;
  const dLat = Math.cos(rad) * distDeg;
  const cosLat = Math.max(0.25, Math.cos(lat * DEG2RAD));
  const dLng = (Math.sin(rad) * distDeg) / cosLat;
  return [Math.max(-85, Math.min(85, lat + dLat)), lng + dLng];
}

export default function EarthGlobe({
  earthquakes,
  weather,
  ocean,
  airQuality,
  layers,
  selected,
  flyToTarget,
  zoomCommand,
  onSelect,
  onTelemetry,
}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<HoverTooltip | null>(null);

  const dataRef = useRef({ earthquakes, weather, ocean, airQuality, layers });
  useEffect(() => {
    dataRef.current = { earthquakes, weather, ocean, airQuality, layers };
  }, [earthquakes, weather, ocean, airQuality, layers]);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const onTelemetryRef = useRef(onTelemetry);
  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
  }, [onTelemetry]);

  const labelsDataRef = useRef<ProjectedLabelDef[]>([]);
  const cursorCoordRef = useRef<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  const sceneHandlesRef = useRef<{
    earthMat?: THREE.ShaderMaterial;
    cloudMesh?: THREE.Mesh;
    coastMat?: THREE.LineBasicMaterial;
    borderMat?: THREE.LineBasicMaterial;
    graticuleMat?: THREE.LineBasicMaterial;
    controls?: OrbitControls;
    camera?: THREE.PerspectiveCamera;
    quakeGroup?: THREE.Group;
    quakeMesh?: THREE.InstancedMesh;
    quakeBaseTransforms?: Array<{ pos: THREE.Vector3; radius: number }>;
    pulseRings?: Array<{ mesh: THREE.Mesh; phase: number; maxScale: number }>;
    weatherGroup?: THREE.Group;
    weatherMesh?: THREE.InstancedMesh;
    weatherBaseTransforms?: Array<{ pos: THREE.Vector3; radius: number }>;
    windStreamGroup?: THREE.Group;
    oceanGroup?: THREE.Group;
    oceanMesh?: THREE.InstancedMesh;
    oceanBaseTransforms?: Array<{ pos: THREE.Vector3; radius: number }>;
    oceanStreamGroup?: THREE.Group;
    airGroup?: THREE.Group;
    airMesh?: THREE.InstancedMesh;
    reticleGroup?: THREE.Group;
    flyAnim?: {
      active: boolean;
      targetDir: THREE.Vector3;
      targetDist: number;
    };
    zoomAnim?: {
      active: boolean;
      targetDist: number;
    };
    windParticles?: {
      geo: THREE.BufferGeometry;
      starts: THREE.Vector3[];
      ends: THREE.Vector3[];
      speeds: number[];
      phases: Float32Array;
    };
  }>({});

  // Build dynamic projected label definitions whenever weather / earthquakes / layers change
  useEffect(() => {
    const defs: ProjectedLabelDef[] = [];

    for (const o of OCEAN_LABELS) {
      const [x, y, z] = latLngToVector3(o.lat, o.lng, EARTH_RADIUS + 0.005);
      const pos = new THREE.Vector3(x, y, z);
      defs.push({
        id: o.id,
        text: o.name,
        pos,
        normal: pos.clone().normalize(),
        kind: "ocean",
        minDist: 1.45,
        maxDist: 5.0,
      });
    }

    for (const w of weather) {
      const [x, y, z] = latLngToVector3(w.lat, w.lng, EARTH_RADIUS + 0.014);
      const pos = new THREE.Vector3(x, y, z);
      const isMajor = MAJOR_CITY_IDS.has(w.id);
      defs.push({
        id: `lbl-w-${w.id}`,
        text: w.nameKo,
        sub: `${Math.round(w.tempC)}°`,
        pos,
        normal: pos.clone().normalize(),
        kind: isMajor ? "city-major" : "city-detail",
        minDist: 1.0,
        maxDist: isMajor ? 4.4 : 2.35,
      });
    }

    if (layers.earthquakes) {
      const topQ = [...earthquakes]
        .filter((q) => q.mag >= 4.8)
        .sort((a, b) => b.mag - a.mag)
        .slice(0, 5);
      for (const q of topQ) {
        const [x, y, z] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + 0.02);
        const pos = new THREE.Vector3(x, y, z);
        defs.push({
          id: `lbl-q-${q.id}`,
          text: `M${q.mag.toFixed(1)}`,
          pos,
          normal: pos.clone().normalize(),
          kind: "quake",
          minDist: 1.0,
          maxDist: 4.5,
          accent: getMagnitudeColor(q.mag),
        });
      }
    }

    labelsDataRef.current = defs;
  }, [weather, earthquakes, layers.earthquakes]);

  // 1. Initialize Three.js WebGL scene ONCE
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.02, 60);
    const [initX, initY, initZ] = latLngToVector3(33, 128, isMobile ? 3.15 : 2.65);
    camera.position.set(initX, initY, initZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = MIN_CAM_DIST;
    controls.maxDistance = MAX_CAM_DIST;
    controls.rotateSpeed = isMobile ? 0.58 : 0.5;
    controls.zoomSpeed = 0.95;
    controls.autoRotate = dataRef.current.layers.autoRotate;
    controls.autoRotateSpeed = 0.32;

    // Multi-temperature soft-sprite starfield
    const starCount = isMobile ? 1200 : 2400;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [
      new THREE.Color("#dbeafe"),
      new THREE.Color("#ffffff"),
      new THREE.Color("#fef3c7"),
      new THREE.Color("#bae6fd"),
    ];
    for (let i = 0; i < starCount; i++) {
      const r = 14 + Math.random() * 18;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[i % palette.length];
      const bright = 0.5 + Math.random() * 0.5;
      starColors[i * 3] = c.r * bright;
      starColors[i * 3 + 1] = c.g * bright;
      starColors[i * 3 + 2] = c.b * bright;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starSprite = createStarSpriteTexture();
    const starMat = new THREE.PointsMaterial({
      map: starSprite,
      vertexColors: true,
      size: 0.14,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Ultra-detailed 50m Earth assets
    const assets = createEarthAssets(isMobile);
    const sunPt = getSubsolarPoint();
    const [sx, sy, sz] = latLngToVector3(sunPt.lat, sunPt.lng, 1);

    const earthGeo = new THREE.SphereGeometry(
      EARTH_RADIUS,
      isMobile ? 64 : 96,
      isMobile ? 64 : 96
    );
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      uniforms: {
        uDayMap: { value: assets.dayMap },
        uNightMap: { value: assets.nightMap },
        uSpecularMap: { value: assets.specularMap },
        uBumpMap: { value: assets.bumpMap },
        uSunDir: { value: new THREE.Vector3(sx, sy, sz).normalize() },
        uDayNightMix: { value: dataRef.current.layers.dayNight ? 1.0 : 0.0 },
      },
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Crisp 3D vector coastlines, country borders & subtle graticule (razor sharp at deep zoom!)
    const graticuleMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const graticuleLines = new THREE.LineSegments(assets.graticuleGeometry, graticuleMat);
    scene.add(graticuleLines);

    const coastMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const coastLines = new THREE.LineSegments(assets.coastlineGeometry, coastMat);
    scene.add(coastLines);

    const borderMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const borderLines = new THREE.LineSegments(assets.borderGeometry, borderMat);
    scene.add(borderLines);

    // Dynamic translucent 3D Cloud Sphere
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.0072, isMobile ? 48 : 64, isMobile ? 48 : 64);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: assets.cloudMap,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.visible = dataRef.current.layers.clouds;
    scene.add(cloudMesh);

    // Atmospheric Rayleigh glow corona
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.125, 56, 56);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX_SHADER,
      fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Data layer groups
    const quakeGroup = new THREE.Group();
    const weatherGroup = new THREE.Group();
    const windStreamGroup = new THREE.Group();
    const oceanGroup = new THREE.Group();
    const oceanStreamGroup = new THREE.Group();
    const airGroup = new THREE.Group();
    scene.add(quakeGroup, weatherGroup, windStreamGroup, oceanGroup, oceanStreamGroup, airGroup);

    // Target Reticle (crisp aerospace crosshair ring)
    const reticleGroup = new THREE.Group();
    reticleGroup.visible = false;
    const outerRingGeo = new THREE.RingGeometry(0.017, 0.021, 40);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    const innerRingGeo = new THREE.RingGeometry(0.008, 0.01, 24);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    reticleGroup.add(outerRing, innerRing);
    scene.add(reticleGroup);

    sceneHandlesRef.current = {
      earthMat,
      cloudMesh,
      coastMat,
      borderMat,
      graticuleMat,
      controls,
      camera,
      quakeGroup,
      weatherGroup,
      windStreamGroup,
      oceanGroup,
      oceanStreamGroup,
      airGroup,
      reticleGroup,
      pulseRings: [],
      flyAnim: { active: false, targetDir: new THREE.Vector3(), targetDist: 2.35 },
      zoomAnim: { active: false, targetDist: 2.65 },
    };

    // Raycaster & pointer interaction
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let hoverThrottle = 0;

    const getPointerNdc = (e: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const pickHit = () => {
      const h = sceneHandlesRef.current;
      const d = dataRef.current;
      raycaster.setFromCamera(pointerNdc, camera);

      const candidates: THREE.Object3D[] = [];
      if (d.layers.earthquakes && h.quakeMesh) candidates.push(h.quakeMesh);
      if (d.layers.ocean && h.oceanMesh) candidates.push(h.oceanMesh);
      if (d.layers.weather && h.weatherMesh) candidates.push(h.weatherMesh);
      if (d.layers.airQuality && h.airMesh) candidates.push(h.airMesh);

      const hits = raycaster.intersectObjects(candidates, false);
      if (hits.length > 0) {
        const hit = hits[0];
        const idx = hit.instanceId;
        if (typeof idx === "number") {
          if (hit.object === h.quakeMesh && d.earthquakes[idx]) {
            return { kind: "earthquake" as const, data: d.earthquakes[idx] };
          }
          if (hit.object === h.oceanMesh && d.ocean[idx]) {
            return { kind: "ocean" as const, data: d.ocean[idx] };
          }
          if (hit.object === h.weatherMesh && d.weather[idx]) {
            return { kind: "weather" as const, data: d.weather[idx] };
          }
          if (hit.object === h.airMesh && d.airQuality[idx]) {
            return { kind: "air" as const, data: d.airQuality[idx] };
          }
        }
      }

      const earthHits = raycaster.intersectObject(earthMesh, false);
      if (earthHits.length > 0) {
        const p = earthHits[0].point;
        const { lat, lng } = vector3ToLatLng(p.x, p.y, p.z);
        return { kind: "point" as const, lat, lng };
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      if (sceneHandlesRef.current.flyAnim) sceneHandlesRef.current.flyAnim.active = false;
      if (sceneHandlesRef.current.zoomAnim) sceneHandlesRef.current.zoomAnim.active = false;
    };

    const handleWheel = () => {
      if (sceneHandlesRef.current.flyAnim) sceneHandlesRef.current.flyAnim.active = false;
      if (sceneHandlesRef.current.zoomAnim) sceneHandlesRef.current.zoomAnim.active = false;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6) return;
      getPointerNdc(e);
      const picked = pickHit();
      if (picked) {
        onSelectRef.current(picked);
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      getPointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const earthHits = raycaster.intersectObject(earthMesh, false);
      if (earthHits.length > 0 && sceneHandlesRef.current.flyAnim) {
        const dir = earthHits[0].point.clone().normalize();
        const nextDist = Math.max(MIN_CAM_DIST, camera.position.length() * 0.68);
        sceneHandlesRef.current.flyAnim.targetDir.copy(dir);
        sceneHandlesRef.current.flyAnim.targetDist = nextDist;
        sceneHandlesRef.current.flyAnim.active = true;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const now = performance.now();
      if (now - hoverThrottle < 36) return;
      hoverThrottle = now;

      const pos = getPointerNdc(e);
      const picked = pickHit();

      if (!picked) {
        cursorCoordRef.current = { lat: null, lng: null };
        renderer.domElement.style.cursor = "grab";
        setTooltip(null);
        return;
      }

      if (picked.kind === "point") {
        cursorCoordRef.current = { lat: picked.lat, lng: picked.lng };
        renderer.domElement.style.cursor = "grab";
        setTooltip(null);
        return;
      }

      cursorCoordRef.current = { lat: picked.data.lat, lng: picked.data.lng };
      renderer.domElement.style.cursor = "pointer";
      const maxLeft = Math.max(16, (renderer.domElement.clientWidth || 1000) - 260);
      const tx = Math.min(pos.x + 14, maxLeft);
      const ty = Math.max(16, pos.y - 16);

      if (picked.kind === "earthquake") {
        const q = picked.data;
        setTooltip({
          x: tx,
          y: ty,
          badge: `M ${q.mag.toFixed(1)}`,
          badgeColor: getMagnitudeColor(q.mag),
          title: q.place,
          subtitle: `진원 깊이 ${q.depthKm.toFixed(1)} km · USGS`,
        });
      } else if (picked.kind === "weather") {
        const w = picked.data;
        setTooltip({
          x: tx,
          y: ty,
          badge: `${w.tempC > 0 ? "+" : ""}${w.tempC.toFixed(1)}°C`,
          badgeColor: "#38bdf8",
          title: `${w.nameKo} (${w.name})`,
          subtitle: `풍속 ${w.windSpeedKmh} km/h · 습도 ${w.humidityPct}%`,
        });
      } else if (picked.kind === "ocean") {
        const o = picked.data;
        setTooltip({
          x: tx,
          y: ty,
          badge: `파고 ${o.waveHeightM.toFixed(1)}m`,
          badgeColor: "#2dd4bf",
          title: o.nameKo,
          subtitle: `해류 ${o.currentVelKmh} km/h · 주기 ${o.wavePeriodS}s`,
        });
      } else if (picked.kind === "air") {
        const a = picked.data;
        const lvl = getPm25Level(a.pm25);
        const isKorea = a.country === "KR" && Boolean(a.stationName);
        setTooltip({
          x: tx,
          y: ty,
          badge: `PM2.5 ${a.pm25.toFixed(1)}`,
          badgeColor: lvl.color,
          title: isKorea
            ? `${a.stationName} (${a.provider})`
            : `${a.country} 센서 클러스터 (${a.sensorCount}개)`,
          subtitle: isKorea
            ? `대기질 ${lvl.label}${a.khaiValue ? ` · KHAI ${a.khaiValue}` : ""}${a.pm10 !== null ? ` · PM10 ${a.pm10}` : ""}`
            : `대기질 ${lvl.label}${a.pm10 !== null ? ` · PM10 ${a.pm10}` : ""}`,
        });
      }
    };

    const handlePointerLeave = () => {
      cursorCoordRef.current = { lat: null, lng: null };
      setTooltip(null);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Pre-allocated helpers for zero-GC 60fps loop
    let rafId = 0;
    const clock = new THREE.Clock();
    const dummy = new THREE.Object3D();
    const projVec = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let lastMarkerScale = -1;
    let lastTelemetryTime = 0;
    let lastLabelTime = 0;

    // Direct DOM pool for projected 3D map labels (zero React re-renders!)
    const labelElPool: HTMLDivElement[] = [];

    const updateProjectedLabels = (camDist: number) => {
      const layerEl = labelsLayerRef.current;
      if (!layerEl) return;

      if (!dataRef.current.layers.labels) {
        layerEl.style.display = "none";
        return;
      }
      layerEl.style.display = "block";

      const viewW = container.clientWidth || window.innerWidth;
      const viewH = container.clientHeight || window.innerHeight;
      camDir.copy(camera.position).normalize();

      const defs = labelsDataRef.current;
      const placedBoxes: Array<[number, number, number, number]> = [];
      let used = 0;

      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        if (camDist < d.minDist || camDist > d.maxDist) continue;
        // Back-face hemisphere occlusion (with slight horizon margin)
        const facing = d.normal.dot(camDir);
        if (facing < 0.22) continue;

        projVec.copy(d.pos).project(camera);
        if (projVec.z > 1) continue;

        const sx = (projVec.x * 0.5 + 0.5) * viewW;
        const sy = (-projVec.y * 0.5 + 0.5) * viewH;
        if (sx < 36 || sx > viewW - 36 || sy < 64 || sy > viewH - 86) continue;

        const boxW = d.kind === "ocean" ? 68 : d.sub ? 78 : 54;
        const boxH = 22;
        const x1 = sx - boxW * 0.5;
        const y1 = sy - boxH * 0.5;
        const x2 = x1 + boxW;
        const y2 = y1 + boxH;

        let overlaps = false;
        for (let j = 0; j < placedBoxes.length; j++) {
          const b = placedBoxes[j];
          if (!(x2 < b[0] || x1 > b[2] || y2 < b[1] || y1 > b[3])) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        placedBoxes.push([x1, y1, x2, y2]);

        let el = labelElPool[used];
        if (!el) {
          el = document.createElement("div");
          layerEl.appendChild(el);
          labelElPool.push(el);
        }

        el.className = `globe-label globe-label-${d.kind}`;
        el.style.display = "inline-flex";
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        const edgeFade = Math.min(1, (facing - 0.22) * 3.0);
        el.style.opacity = edgeFade.toFixed(2);

        if (d.kind === "quake") {
          el.innerHTML = `<span class="lbl-dot" style="background:${d.accent ?? "#f97316"}"></span><span>${d.text}</span>`;
        } else if (d.sub) {
          el.innerHTML = `<span>${d.text}</span><span class="lbl-temp">${d.sub}</span>`;
        } else {
          el.textContent = d.text;
        }
        used++;
        if (used >= (isMobile ? 22 : 42)) break;
      }

      for (let i = used; i < labelElPool.length; i++) {
        labelElPool[i].style.display = "none";
      }
    };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (document.visibilityState === "hidden") return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const nowMs = performance.now();
      const h = sceneHandlesRef.current;

      // Smooth camera fly-to
      if (h.flyAnim?.active) {
        const curDir = camera.position.clone().normalize();
        const curDist = camera.position.length();
        curDir.lerp(h.flyAnim.targetDir, 1 - Math.exp(-5.4 * dt)).normalize();
        const nextDist = THREE.MathUtils.lerp(
          curDist,
          h.flyAnim.targetDist,
          1 - Math.exp(-4.8 * dt)
        );
        camera.position.copy(curDir.multiplyScalar(nextDist));
        if (
          curDir.distanceTo(h.flyAnim.targetDir) < 0.006 &&
          Math.abs(nextDist - h.flyAnim.targetDist) < 0.015
        ) {
          h.flyAnim.active = false;
        }
      }

      // Smooth zoom button animation
      if (h.zoomAnim?.active) {
        const curDist = camera.position.length();
        const nextDist = THREE.MathUtils.lerp(
          curDist,
          h.zoomAnim.targetDist,
          1 - Math.exp(-7.5 * dt)
        );
        camera.position.setLength(nextDist);
        if (Math.abs(nextDist - h.zoomAnim.targetDist) < 0.008) {
          camera.position.setLength(h.zoomAnim.targetDist);
          h.zoomAnim.active = false;
        }
      }

      const camDist = camera.position.length();
      const zoomNorm = Math.max(0, Math.min(1, 1 - (camDist - MIN_CAM_DIST) / (MAX_CAM_DIST - MIN_CAM_DIST)));

      // Altitude-adaptive OrbitControls precision (buttery micro-panning when zoomed in close!)
      controls.rotateSpeed = THREE.MathUtils.lerp(isMobile ? 0.62 : 0.56, 0.11, zoomNorm * zoomNorm);
      controls.zoomSpeed = THREE.MathUtils.lerp(1.05, 0.55, zoomNorm);

      // Zoom-adaptive 3D vector coastline & border sharpness (sharper when zoomed in!)
      coastMat.opacity = THREE.MathUtils.lerp(0.24, 0.62, zoomNorm);
      borderMat.opacity = THREE.MathUtils.lerp(0.16, 0.48, zoomNorm);
      graticuleMat.opacity = THREE.MathUtils.lerp(0.06, 0.14, zoomNorm);

      // Subtle cloud layer drift
      if (cloudMesh.visible) {
        cloudMesh.rotation.y += dt * 0.007;
      }

      // Altitude-adaptive marker scaling so dense regions separate cleanly on zoom-in!
      const markerScale = Math.max(0.32, Math.min(1.08, (camDist - 0.92) / 1.72));
      if (Math.abs(markerScale - lastMarkerScale) > 0.015) {
        lastMarkerScale = markerScale;

        if (h.quakeMesh && h.quakeBaseTransforms) {
          for (let i = 0; i < h.quakeBaseTransforms.length; i++) {
            const item = h.quakeBaseTransforms[i];
            dummy.position.copy(item.pos);
            dummy.scale.setScalar(item.radius * markerScale);
            dummy.updateMatrix();
            h.quakeMesh.setMatrixAt(i, dummy.matrix);
          }
          h.quakeMesh.instanceMatrix.needsUpdate = true;
        }
        if (h.weatherMesh && h.weatherBaseTransforms) {
          for (let i = 0; i < h.weatherBaseTransforms.length; i++) {
            const item = h.weatherBaseTransforms[i];
            dummy.position.copy(item.pos);
            dummy.scale.setScalar(item.radius * markerScale);
            dummy.updateMatrix();
            h.weatherMesh.setMatrixAt(i, dummy.matrix);
          }
          h.weatherMesh.instanceMatrix.needsUpdate = true;
        }
        if (h.oceanMesh && h.oceanBaseTransforms) {
          for (let i = 0; i < h.oceanBaseTransforms.length; i++) {
            const item = h.oceanBaseTransforms[i];
            dummy.position.copy(item.pos);
            dummy.scale.setScalar(item.radius * markerScale);
            dummy.updateMatrix();
            h.oceanMesh.setMatrixAt(i, dummy.matrix);
          }
          h.oceanMesh.instanceMatrix.needsUpdate = true;
        }
      }

      // Pulse seismic shockwave rings
      if (h.pulseRings && h.quakeGroup?.visible) {
        for (const ring of h.pulseRings) {
          const t = (elapsed * 0.55 + ring.phase) % 1;
          const scale = (0.3 + t * ring.maxScale) * markerScale;
          ring.mesh.scale.set(scale, scale, 1);
          const mat = ring.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - t) * 0.82;
        }
      }

      // Animate flowing wind particles along synoptic vectors
      if (h.windParticles && h.windStreamGroup?.visible) {
        const { geo, starts, ends, speeds, phases } = h.windParticles;
        const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const tmp = new THREE.Vector3();
        for (let i = 0; i < starts.length; i++) {
          phases[i] = (phases[i] + dt * speeds[i]) % 1;
          tmp.copy(starts[i]).lerp(ends[i], phases[i]).normalize().multiplyScalar(EARTH_RADIUS + 0.015);
          arr[i * 3] = tmp.x;
          arr[i * 3 + 1] = tmp.y;
          arr[i * 3 + 2] = tmp.z;
        }
        posAttr.needsUpdate = true;
      }

      // Reticle breathing & zoom-adaptive size
      if (reticleGroup.visible) {
        const s = (1 + Math.sin(elapsed * 4.2) * 0.14) * markerScale;
        outerRing.scale.set(s, s, 1);
        innerRing.scale.setScalar(markerScale);
      }

      controls.update();
      renderer.render(scene, camera);

      // Update projected 3D labels at ~24fps (crisp & zero React overhead)
      if (nowMs - lastLabelTime > 42) {
        lastLabelTime = nowMs;
        updateProjectedLabels(camDist);
      }

      // Emit camera telemetry at ~10Hz for HUD altitude & cursor coords
      if (nowMs - lastTelemetryTime > 100) {
        lastTelemetryTime = nowMs;
        onTelemetryRef.current({
          altitudeKm: Math.round((camDist - EARTH_RADIUS) * EARTH_RADIUS_KM),
          zoomPct: Math.round(zoomNorm * 100),
          cursorLat: cursorCoordRef.current.lat,
          cursorLng: cursorCoordRef.current.lng,
        });
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      controls.dispose();
      assets.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      graticuleMat.dispose();
      coastMat.dispose();
      borderMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      starSprite.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Sync layer visibility, day/night shader, clouds, auto-rotate
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (h.earthMat) h.earthMat.uniforms.uDayNightMix.value = layers.dayNight ? 1.0 : 0.0;
    if (h.cloudMesh) h.cloudMesh.visible = layers.clouds;
    if (h.controls) h.controls.autoRotate = layers.autoRotate;
    if (h.quakeGroup) h.quakeGroup.visible = layers.earthquakes;
    if (h.weatherGroup) h.weatherGroup.visible = layers.weather;
    if (h.windStreamGroup) h.windStreamGroup.visible = layers.weather;
    if (h.oceanGroup) h.oceanGroup.visible = layers.ocean;
    if (h.oceanStreamGroup) h.oceanStreamGroup.visible = layers.ocean;
    if (h.airGroup) h.airGroup.visible = layers.airQuality;
  }, [layers]);

  // 3. Rebuild Earthquake InstancedMesh + Depth Stems + Shockwave Pulse Rings
  useEffect(() => {
    const h = sceneHandlesRef.current;
    const group = h.quakeGroup;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }
    h.pulseRings = [];
    h.quakeMesh = undefined;
    h.quakeBaseTransforms = [];

    if (earthquakes.length === 0) return;

    const sphereGeo = new THREE.SphereGeometry(1, 14, 14);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(sphereGeo, sphereMat, earthquakes.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const stemPos: number[] = [];
    const stemCol: number[] = [];

    earthquakes.forEach((q, idx) => {
      const pinElev = Math.min(0.055, 0.008 + Math.max(0, q.mag - 2) * 0.007);
      const [bx, by, bz] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + 0.002);
      const [x, y, z] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + pinElev);
      const radius = Math.min(0.03, Math.max(0.0065, 0.0042 * Math.pow(1.4, q.mag)));
      const pos = new THREE.Vector3(x, y, z);

      dummy.position.copy(pos);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      color.set(getMagnitudeColor(q.mag));
      inst.setColorAt(idx, color);
      h.quakeBaseTransforms!.push({ pos, radius });

      // Crisp radial epicenter stem connecting surface to glowing sphere
      stemPos.push(bx, by, bz, x, y, z);
      stemCol.push(color.r, color.g, color.b, color.r, color.g, color.b);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.quakeMesh = inst;

    const stemGeo = new THREE.BufferGeometry();
    stemGeo.setAttribute("position", new THREE.Float32BufferAttribute(stemPos, 3));
    stemGeo.setAttribute("color", new THREE.Float32BufferAttribute(stemCol, 3));
    group.add(
      new THREE.LineSegments(
        stemGeo,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 })
      )
    );

    const topQuakes = [...earthquakes].sort((a, b) => b.mag - a.mag).slice(0, 20);
    const ringGeo = new THREE.RingGeometry(0.013, 0.018, 36);
    const up = new THREE.Vector3(0, 0, 1);

    topQuakes.forEach((q, idx) => {
      const mat = new THREE.MeshBasicMaterial({
        color: getMagnitudeColor(q.mag),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo.clone(), mat);
      const [x, y, z] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + 0.006);
      const normal = new THREE.Vector3(x, y, z).normalize();
      ring.position.set(x, y, z);
      ring.quaternion.setFromUnitVectors(up, normal);
      group.add(ring);
      h.pulseRings!.push({
        mesh: ring,
        phase: (idx * 0.19) % 1,
        maxScale: Math.min(4.8, 1.5 + Math.max(0, q.mag - 3) * 0.85),
      });
    });
    ringGeo.dispose();
  }, [earthquakes]);

  // 4. Rebuild Weather Nodes + Curved Wind Streamlines
  useEffect(() => {
    const h = sceneHandlesRef.current;
    const group = h.weatherGroup;
    const streamGroup = h.windStreamGroup;
    if (!group || !streamGroup) return;

    const clearGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const c = g.children[0];
        g.remove(c);
        if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments || c instanceof THREE.Points) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      }
    };
    clearGroup(group);
    clearGroup(streamGroup);
    h.weatherMesh = undefined;
    h.weatherBaseTransforms = [];
    h.windParticles = undefined;

    if (weather.length === 0) return;

    const dotGeo = new THREE.SphereGeometry(1, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(dotGeo, dotMat, weather.length);
    const dummy = new THREE.Object3D();

    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const starts: THREE.Vector3[] = [];
    const ends: THREE.Vector3[] = [];
    const speeds: number[] = [];

    weather.forEach((w, idx) => {
      const [x, y, z] = latLngToVector3(w.lat, w.lng, EARTH_RADIUS + 0.01);
      const pos = new THREE.Vector3(x, y, z);
      const radius = w.precipMm > 0.5 ? 0.0135 : 0.0095;
      dummy.position.copy(pos);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, tempToColor(w.tempC));
      h.weatherBaseTransforms!.push({ pos, radius });

      const flowBearing = (w.windDirDeg + 180) % 360;
      const lenDeg = Math.min(7.5, Math.max(2.2, w.windSpeedKmh * 0.14));
      const [lat2, lng2] = offsetLatLng(w.lat, w.lng, flowBearing, lenDeg);
      const [x2, y2, z2] = latLngToVector3(lat2, lng2, EARTH_RADIUS + 0.014);

      const p1 = new THREE.Vector3(x, y, z);
      const p2 = new THREE.Vector3(x2, y2, z2);
      const mid = p1.clone().lerp(p2, 0.5).normalize().multiplyScalar(EARTH_RADIUS + 0.016);

      linePositions.push(p1.x, p1.y, p1.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, p2.x, p2.y, p2.z);
      const cStart = new THREE.Color(w.windSpeedKmh > 35 ? "#fbbf24" : "#38bdf8");
      const cEnd = new THREE.Color("#e0f2fe");
      lineColors.push(
        cStart.r, cStart.g, cStart.b, cEnd.r, cEnd.g, cEnd.b,
        cEnd.r, cEnd.g, cEnd.b, cEnd.r, cEnd.g, cEnd.b
      );

      for (let k = 0; k < 2; k++) {
        starts.push(p1);
        ends.push(p2);
        speeds.push(0.28 + Math.min(1.1, w.windSpeedKmh * 0.022));
      }
    });

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.weatherMesh = inst;

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
    streamGroup.add(
      new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 })
      )
    );

    const partPositions = new Float32Array(starts.length * 3);
    const phases = new Float32Array(starts.length);
    for (let i = 0; i < starts.length; i++) {
      phases[i] = (i * 0.37) % 1;
    }
    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute("position", new THREE.BufferAttribute(partPositions, 3));
    streamGroup.add(
      new THREE.Points(
        partGeo,
        new THREE.PointsMaterial({
          color: 0xe0f2fe,
          size: 0.02,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        })
      )
    );
    h.windParticles = { geo: partGeo, starts, ends, speeds, phases };
  }, [weather]);

  // 5. Rebuild Ocean Marine Buoys
  useEffect(() => {
    const h = sceneHandlesRef.current;
    const group = h.oceanGroup;
    const streamGroup = h.oceanStreamGroup;
    if (!group || !streamGroup) return;

    const clearGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const c = g.children[0];
        g.remove(c);
        if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      }
    };
    clearGroup(group);
    clearGroup(streamGroup);
    h.oceanMesh = undefined;
    h.oceanBaseTransforms = [];

    if (ocean.length === 0) return;

    const buoyGeo = new THREE.OctahedronGeometry(1, 0);
    const buoyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(buoyGeo, buoyMat, ocean.length);
    const dummy = new THREE.Object3D();
    const linePos: number[] = [];

    ocean.forEach((o, idx) => {
      const [x, y, z] = latLngToVector3(o.lat, o.lng, EARTH_RADIUS + 0.011);
      const pos = new THREE.Vector3(x, y, z);
      const radius = Math.min(0.02, Math.max(0.009, 0.008 + o.waveHeightM * 0.0025));
      dummy.position.copy(pos);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, waveToColor(o.waveHeightM));
      h.oceanBaseTransforms!.push({ pos, radius });

      const bearing = o.currentVelKmh > 0.2 ? o.currentDirDeg : o.waveDirDeg;
      const lenDeg = Math.min(5.8, Math.max(2.3, o.waveHeightM * 1.1));
      const [lat2, lng2] = offsetLatLng(o.lat, o.lng, bearing, lenDeg);
      const [x2, y2, z2] = latLngToVector3(lat2, lng2, EARTH_RADIUS + 0.013);
      linePos.push(x, y, z, x2, y2, z2);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.oceanMesh = inst;

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    streamGroup.add(
      new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.52 })
      )
    );
  }, [ocean]);

  // 6. Rebuild Environmental Air Quality 3D Hexagonal Pillars
  useEffect(() => {
    const h = sceneHandlesRef.current;
    const group = h.airGroup;
    if (!group) return;

    while (group.children.length > 0) {
      const c = group.children[0];
      group.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    }
    h.airMesh = undefined;

    if (airQuality.length === 0) return;

    const barGeo = new THREE.CylinderGeometry(0.0038, 0.005, 1, 6);
    barGeo.translate(0, 0.5, 0);
    const barMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
    });
    const inst = new THREE.InstancedMesh(barGeo, barMat, airQuality.length);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    airQuality.forEach((cluster, idx) => {
      const [x, y, z] = latLngToVector3(cluster.lat, cluster.lng, EARTH_RADIUS + 0.002);
      const normal = new THREE.Vector3(x, y, z).normalize();
      const barHeight = Math.min(0.16, Math.max(0.013, 0.012 + Math.sqrt(cluster.pm25) * 0.0115));
      const widthBoost = Math.min(1.5, 0.92 + Math.log10(Math.max(1, cluster.sensorCount)) * 0.24);

      dummy.position.set(x, y, z);
      dummy.quaternion.setFromUnitVectors(up, normal);
      dummy.scale.set(widthBoost, barHeight, widthBoost);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);

      color.set(getPm25Level(cluster.pm25).color);
      inst.setColorAt(idx, color);
    });

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.airMesh = inst;
  }, [airQuality]);

  // 7. Update selection reticle
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (!h.reticleGroup) return;

    if (!selected) {
      h.reticleGroup.visible = false;
      return;
    }

    const lat = selected.kind === "point" ? selected.lat : selected.data.lat;
    const lng = selected.kind === "point" ? selected.lng : selected.data.lng;
    const [x, y, z] = latLngToVector3(lat, lng, EARTH_RADIUS + 0.012);
    const normal = new THREE.Vector3(x, y, z).normalize();

    h.reticleGroup.position.set(x, y, z);
    h.reticleGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    h.reticleGroup.visible = true;
  }, [selected]);

  // 8. Smooth Fly-To animation
  useEffect(() => {
    if (!flyToTarget) return;
    const h = sceneHandlesRef.current;
    if (!h.flyAnim || !h.camera) return;
    const [tx, ty, tz] = latLngToVector3(flyToTarget.lat, flyToTarget.lng, 1);
    h.flyAnim.targetDir.set(tx, ty, tz).normalize();
    h.flyAnim.targetDist = Math.max(
      MIN_CAM_DIST,
      Math.min(MAX_CAM_DIST, flyToTarget.altitude ?? Math.min(h.camera.position.length(), 1.95))
    );
    h.flyAnim.active = true;
    if (h.zoomAnim) h.zoomAnim.active = false;
  }, [flyToTarget]);

  // 9. Imperative Zoom In / Zoom Out / Reset camera command
  useEffect(() => {
    if (!zoomCommand) return;
    const h = sceneHandlesRef.current;
    if (!h.camera || !h.zoomAnim || !h.flyAnim) return;

    const curDist = h.camera.position.length();
    if (zoomCommand.action === "in") {
      // Exponential-feeling zoom step toward Earth surface
      const alt = curDist - EARTH_RADIUS;
      h.zoomAnim.targetDist = Math.max(MIN_CAM_DIST, EARTH_RADIUS + alt * 0.62);
      h.zoomAnim.active = true;
      h.flyAnim.active = false;
    } else if (zoomCommand.action === "out") {
      const alt = curDist - EARTH_RADIUS;
      h.zoomAnim.targetDist = Math.min(MAX_CAM_DIST, EARTH_RADIUS + Math.max(0.18, alt * 1.55));
      h.zoomAnim.active = true;
      h.flyAnim.active = false;
    } else if (zoomCommand.action === "reset") {
      const [rx, ry, rz] = latLngToVector3(33, 128, 1);
      h.flyAnim.targetDir.set(rx, ry, rz).normalize();
      h.flyAnim.targetDist = window.innerWidth < 768 ? 3.15 : 2.65;
      h.flyAnim.active = true;
      h.zoomAnim.active = false;
    }
  }, [zoomCommand]);

  return (
    <div className="globe-stage" ref={containerRef} aria-label="실시간 3D 지구본 모니터링 캔버스">
      <div className="globe-labels-layer" ref={labelsLayerRef} aria-hidden="true" />
      {tooltip && (
        <div
          className="globe-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <div className="globe-tooltip-header">
            <span
              className="globe-tooltip-badge"
              style={{
                backgroundColor: `${tooltip.badgeColor}24`,
                color: tooltip.badgeColor,
              }}
            >
              {tooltip.badge}
            </span>
          </div>
          <div className="globe-tooltip-title">{tooltip.title}</div>
          <div className="globe-tooltip-sub">{tooltip.subtitle}</div>
        </div>
      )}
    </div>
  );
}
