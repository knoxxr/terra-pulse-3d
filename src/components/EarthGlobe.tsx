"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createEarthTextures } from "@/lib/earthTexture";
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
  EarthquakeEvent,
  LayerVisibility,
  OceanNode,
  SelectedItem,
  WeatherNode,
} from "@/types/telemetry";

interface EarthGlobeProps {
  earthquakes: EarthquakeEvent[];
  weather: WeatherNode[];
  ocean: OceanNode[];
  airQuality: AirQualityCluster[];
  layers: LayerVisibility;
  selected: SelectedItem | null;
  flyToTarget: { lat: number; lng: number; altitude?: number; nonce: number } | null;
  onSelect: (item: SelectedItem) => void;
}

interface HoverTooltip {
  x: number;
  y: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
}

const EARTH_RADIUS = 1.0;

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

    float ndotl = dot(N, L);
    float dayFactor = smoothstep(-0.16, 0.24, ndotl);

    // Subtle twilight atmospheric warmth along the terminator
    float twilight = exp(-pow((ndotl - 0.02) * 7.5, 2.0));
    vec3 twilightTint = vec3(0.45, 0.24, 0.14) * twilight * 0.42;

    // Gentle ocean specular reflection on sunlit side
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 36.0) * oceanMask * max(ndotl, 0.0) * 0.28;

    // Diffuse lighting
    float diffuse = 0.72 + 0.36 * max(ndotl, 0.0);
    vec3 litDay = dayCol * diffuse + vec3(0.55, 0.78, 0.96) * spec;
    vec3 shaded = mix(nightCol * 1.15, litDay, dayFactor) + twilightTint;

    // Uniform daylight cartographic mode when Day/Night toggle is disabled
    vec3 uniformDay = dayCol * 1.12 + vec3(0.03, 0.06, 0.10);
    vec3 finalCol = mix(uniformDay, shaded, uDayNightMix);

    // Subtle atmospheric Fresnel limb tint
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    finalCol += vec3(0.14, 0.48, 0.78) * fresnel * 0.32;

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
    float rim = max(0.0, 0.62 - dot(vNormal, vViewDir));
    float intensity = pow(rim, 3.4) * 1.45;
    gl_FragColor = vec4(0.18, 0.62, 0.96, intensity * 0.72);
  }
`;

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

/**
 * Compute destination (lat, lng) offset along a compass bearing (deg) by angular distance (deg).
 */
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
  onSelect,
}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<HoverTooltip | null>(null);

  // Refs holding latest data for raycasting & animation without recreating WebGL context
  const dataRef = useRef({ earthquakes, weather, ocean, airQuality, layers });
  useEffect(() => {
    dataRef.current = { earthquakes, weather, ocean, airQuality, layers };
  }, [earthquakes, weather, ocean, airQuality, layers]);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Mutable handles to Three.js scene objects
  const sceneHandlesRef = useRef<{
    earthMat?: THREE.ShaderMaterial;
    controls?: OrbitControls;
    camera?: THREE.PerspectiveCamera;
    quakeGroup?: THREE.Group;
    quakeMesh?: THREE.InstancedMesh;
    pulseRings?: Array<{ mesh: THREE.Mesh; phase: number; maxScale: number }>;
    weatherGroup?: THREE.Group;
    weatherMesh?: THREE.InstancedMesh;
    windStreamGroup?: THREE.Group;
    oceanGroup?: THREE.Group;
    oceanMesh?: THREE.InstancedMesh;
    oceanStreamGroup?: THREE.Group;
    airGroup?: THREE.Group;
    airMesh?: THREE.InstancedMesh;
    reticleGroup?: THREE.Group;
    flyAnim?: {
      active: boolean;
      targetDir: THREE.Vector3;
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

  // 1. Initialize Three.js WebGL scene ONCE
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 50);
    // Start facing East Asia & Pacific Rim (Korea / Japan centered nicely)
    const [initX, initY, initZ] = latLngToVector3(31, 128, isMobile ? 3.25 : 2.75);
    camera.position.set(initX, initY, initZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 1.32;
    controls.maxDistance = 4.6;
    controls.rotateSpeed = isMobile ? 0.65 : 0.55;
    controls.zoomSpeed = 0.85;
    controls.autoRotate = dataRef.current.layers.autoRotate;
    controls.autoRotateSpeed = 0.35;

    // Deep subtle starfield (1 draw call)
    const starCount = isMobile ? 900 : 1800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 12 + Math.random() * 14;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Earth procedural vector textures
    const textures = createEarthTextures(isMobile);
    const sunPt = getSubsolarPoint();
    const [sx, sy, sz] = latLngToVector3(sunPt.lat, sunPt.lng, 1);

    const earthGeo = new THREE.SphereGeometry(
      EARTH_RADIUS,
      isMobile ? 48 : 72,
      isMobile ? 48 : 72
    );
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      uniforms: {
        uDayMap: { value: textures.dayMap },
        uNightMap: { value: textures.nightMap },
        uSpecularMap: { value: textures.specularMap },
        uSunDir: { value: new THREE.Vector3(sx, sy, sz).normalize() },
        uDayNightMix: { value: dataRef.current.layers.dayNight ? 1.0 : 0.0 },
      },
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Atmospheric Rayleigh glow halo
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.115, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX_SHADER,
      fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Data layer groups
    const quakeGroup = new THREE.Group();
    const weatherGroup = new THREE.Group();
    const windStreamGroup = new THREE.Group();
    const oceanGroup = new THREE.Group();
    const oceanStreamGroup = new THREE.Group();
    const airGroup = new THREE.Group();
    scene.add(quakeGroup, weatherGroup, windStreamGroup, oceanGroup, oceanStreamGroup, airGroup);

    // Selection target reticle (double crisp ring tangent to globe)
    const reticleGroup = new THREE.Group();
    reticleGroup.visible = false;
    const outerRingGeo = new THREE.RingGeometry(0.022, 0.028, 36);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    const innerDotGeo = new THREE.CircleGeometry(0.008, 24);
    const innerDotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const innerDot = new THREE.Mesh(innerDotGeo, innerDotMat);
    reticleGroup.add(outerRing, innerDot);
    scene.add(reticleGroup);

    sceneHandlesRef.current = {
      earthMat,
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
      flyAnim: { active: false, targetDir: new THREE.Vector3(), targetDist: 2.5 },
    };

    // Raycaster & pointer interaction (click vs drag detection)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let hoverThrottle = 0;

    const getPointerNdc = (e: PointerEvent) => {
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

      // Otherwise check click directly on Earth surface
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
      // Stop any ongoing camera fly-to when user grabs the globe
      if (sceneHandlesRef.current.flyAnim) {
        sceneHandlesRef.current.flyAnim.active = false;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6) return; // User dragged to rotate
      getPointerNdc(e);
      const picked = pickHit();
      if (picked) {
        onSelectRef.current(picked);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const now = performance.now();
      if (now - hoverThrottle < 36) return;
      hoverThrottle = now;

      const pos = getPointerNdc(e);
      const picked = pickHit();
      if (!picked || picked.kind === "point") {
        renderer.domElement.style.cursor = "grab";
        setTooltip(null);
        return;
      }

      renderer.domElement.style.cursor = "pointer";
      const maxLeft = Math.max(16, (renderer.domElement.clientWidth || 1000) - 256);
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
        setTooltip({
          x: tx,
          y: ty,
          badge: `PM2.5 ${a.pm25.toFixed(1)}`,
          badgeColor: lvl.color,
          title: `${a.country} 센서 클러스터 (${a.sensorCount}개)`,
          subtitle: `대기질 ${lvl.label}${a.pm10 !== null ? ` · PM10 ${a.pm10}` : ""}`,
        });
      }
    };

    const handlePointerLeave = () => setTooltip(null);

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    // ResizeObserver for crisp layout across desktop & mobile orientation changes
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Main 60fps animation loop (pauses cleanly when tab is hidden)
    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (document.visibilityState === "hidden") return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const h = sceneHandlesRef.current;

      // Smooth damped camera fly-to
      if (h.flyAnim?.active) {
        const curDir = camera.position.clone().normalize();
        const curDist = camera.position.length();
        curDir.lerp(h.flyAnim.targetDir, 1 - Math.exp(-5.2 * dt)).normalize();
        const nextDist = THREE.MathUtils.lerp(
          curDist,
          h.flyAnim.targetDist,
          1 - Math.exp(-4.5 * dt)
        );
        camera.position.copy(curDir.multiplyScalar(nextDist));
        if (
          curDir.distanceTo(h.flyAnim.targetDir) < 0.008 &&
          Math.abs(nextDist - h.flyAnim.targetDist) < 0.02
        ) {
          h.flyAnim.active = false;
        }
      }

      // Pulse seismic shockwave rings
      if (h.pulseRings && h.quakeGroup?.visible) {
        for (const ring of h.pulseRings) {
          const t = (elapsed * 0.55 + ring.phase) % 1;
          const scale = 0.35 + t * ring.maxScale;
          ring.mesh.scale.set(scale, scale, 1);
          const mat = ring.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - t) * 0.78;
        }
      }

      // Animate flowing wind particles along real synoptic vectors
      if (h.windParticles && h.windStreamGroup?.visible) {
        const { geo, starts, ends, speeds, phases } = h.windParticles;
        const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const tmp = new THREE.Vector3();
        for (let i = 0; i < starts.length; i++) {
          phases[i] = (phases[i] + dt * speeds[i]) % 1;
          tmp.copy(starts[i]).lerp(ends[i], phases[i]).normalize().multiplyScalar(EARTH_RADIUS + 0.016);
          arr[i * 3] = tmp.x;
          arr[i * 3 + 1] = tmp.y;
          arr[i * 3 + 2] = tmp.z;
        }
        posAttr.needsUpdate = true;
      }

      // Subtle reticle breathing pulse
      if (reticleGroup.visible) {
        const s = 1 + Math.sin(elapsed * 4.2) * 0.14;
        outerRing.scale.set(s, s, 1);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      controls.dispose();
      textures.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      innerDotGeo.dispose();
      innerDotMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Sync layer visibility, day/night shader toggle, auto-rotate
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (h.earthMat) {
      h.earthMat.uniforms.uDayNightMix.value = layers.dayNight ? 1.0 : 0.0;
    }
    if (h.controls) {
      h.controls.autoRotate = layers.autoRotate;
    }
    if (h.quakeGroup) h.quakeGroup.visible = layers.earthquakes;
    if (h.weatherGroup) h.weatherGroup.visible = layers.weather;
    if (h.windStreamGroup) h.windStreamGroup.visible = layers.weather;
    if (h.oceanGroup) h.oceanGroup.visible = layers.ocean;
    if (h.oceanStreamGroup) h.oceanStreamGroup.visible = layers.ocean;
    if (h.airGroup) h.airGroup.visible = layers.airQuality;
  }, [layers]);

  // 3. Rebuild Earthquake InstancedMesh + Shockwave Pulse Rings when USGS data updates
  useEffect(() => {
    const h = sceneHandlesRef.current;
    const group = h.quakeGroup;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }
    h.pulseRings = [];
    h.quakeMesh = undefined;

    if (earthquakes.length === 0) return;

    const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(sphereGeo, sphereMat, earthquakes.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    earthquakes.forEach((q, idx) => {
      const [x, y, z] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + 0.01);
      const radius = Math.min(0.032, Math.max(0.0065, 0.0042 * Math.pow(1.42, q.mag)));
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      color.set(getMagnitudeColor(q.mag));
      inst.setColorAt(idx, color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.quakeMesh = inst;

    // Animated seismic shockwave rings on top 18 strongest earthquakes
    const topQuakes = [...earthquakes].sort((a, b) => b.mag - a.mag).slice(0, 18);
    const ringGeo = new THREE.RingGeometry(0.014, 0.019, 32);
    const up = new THREE.Vector3(0, 0, 1);

    topQuakes.forEach((q, idx) => {
      const mat = new THREE.MeshBasicMaterial({
        color: getMagnitudeColor(q.mag),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo.clone(), mat);
      const [x, y, z] = latLngToVector3(q.lat, q.lng, EARTH_RADIUS + 0.009);
      const normal = new THREE.Vector3(x, y, z).normalize();
      ring.position.set(x, y, z);
      ring.quaternion.setFromUnitVectors(up, normal);
      group.add(ring);
      h.pulseRings!.push({
        mesh: ring,
        phase: (idx * 0.19) % 1,
        maxScale: Math.min(4.6, 1.4 + Math.max(0, q.mag - 3) * 0.85),
      });
    });
    ringGeo.dispose();
  }, [earthquakes]);

  // 4. Rebuild Weather Nodes + Flowing Wind Streamlines
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
    h.windParticles = undefined;

    if (weather.length === 0) return;

    const dotGeo = new THREE.SphereGeometry(1, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(dotGeo, dotMat, weather.length);
    const dummy = new THREE.Object3D();

    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const starts: THREE.Vector3[] = [];
    const ends: THREE.Vector3[] = [];
    const speeds: number[] = [];

    weather.forEach((w, idx) => {
      const [x, y, z] = latLngToVector3(w.lat, w.lng, EARTH_RADIUS + 0.011);
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(w.precipMm > 0.5 ? 0.014 : 0.0105);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, tempToColor(w.tempC));

      // Wind flows TOWARD windDirDeg + 180 (meteorological wind_direction is "from")
      const flowBearing = (w.windDirDeg + 180) % 360;
      const lenDeg = Math.min(7.5, Math.max(2.2, w.windSpeedKmh * 0.14));
      const [lat2, lng2] = offsetLatLng(w.lat, w.lng, flowBearing, lenDeg);
      const [x2, y2, z2] = latLngToVector3(lat2, lng2, EARTH_RADIUS + 0.015);

      const p1 = new THREE.Vector3(x, y, z);
      const p2 = new THREE.Vector3(x2, y2, z2);
      const mid = p1.clone().lerp(p2, 0.5).normalize().multiplyScalar(EARTH_RADIUS + 0.017);

      linePositions.push(p1.x, p1.y, p1.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, p2.x, p2.y, p2.z);
      const cStart = new THREE.Color(w.windSpeedKmh > 35 ? "#fbbf24" : "#38bdf8");
      const cEnd = new THREE.Color("#e0f2fe");
      lineColors.push(
        cStart.r, cStart.g, cStart.b, cEnd.r, cEnd.g, cEnd.b,
        cEnd.r, cEnd.g, cEnd.b, cEnd.r, cEnd.g, cEnd.b
      );

      // 2 flowing particles per wind vector
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

    // Subtle wind vector arcs
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
    });
    streamGroup.add(new THREE.LineSegments(lineGeo, lineMat));

    // Animated moving wind pulses
    const partPositions = new Float32Array(starts.length * 3);
    const phases = new Float32Array(starts.length);
    for (let i = 0; i < starts.length; i++) {
      phases[i] = (i * 0.37) % 1;
    }
    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute("position", new THREE.BufferAttribute(partPositions, 3));
    const partMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.022,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    streamGroup.add(new THREE.Points(partGeo, partMat));
    h.windParticles = { geo: partGeo, starts, ends, speeds, phases };
  }, [weather]);

  // 5. Rebuild Ocean Marine Buoys (Wave Height + Ocean Current Vectors)
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

    if (ocean.length === 0) return;

    const buoyGeo = new THREE.OctahedronGeometry(1, 0);
    const buoyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(buoyGeo, buoyMat, ocean.length);
    const dummy = new THREE.Object3D();
    const linePos: number[] = [];

    ocean.forEach((o, idx) => {
      const [x, y, z] = latLngToVector3(o.lat, o.lng, EARTH_RADIUS + 0.012);
      const scale = Math.min(0.022, Math.max(0.01, 0.0085 + o.waveHeightM * 0.0028));
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, waveToColor(o.waveHeightM));

      // Current / wave vector bar
      const bearing = o.currentVelKmh > 0.2 ? o.currentDirDeg : o.waveDirDeg;
      const lenDeg = Math.min(6.0, Math.max(2.4, o.waveHeightM * 1.15));
      const [lat2, lng2] = offsetLatLng(o.lat, o.lng, bearing, lenDeg);
      const [x2, y2, z2] = latLngToVector3(lat2, lng2, EARTH_RADIUS + 0.014);
      linePos.push(x, y, z, x2, y2, z2);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    h.oceanMesh = inst;

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.55,
    });
    streamGroup.add(new THREE.LineSegments(lineGeo, lineMat));
  }, [ocean]);

  // 6. Rebuild Environmental Air Quality 3D Radial Pillars (1 GPU Draw Call for 900+ clusters!)
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

    // Cylinder extending along +Y from 0 to 1 so scaling Y extrudes cleanly outward from Earth surface
    const barGeo = new THREE.CylinderGeometry(0.0046, 0.0058, 1, 6);
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
      const barHeight = Math.min(0.18, Math.max(0.016, 0.014 + Math.sqrt(cluster.pm25) * 0.013));
      const widthBoost = Math.min(1.65, 1 + Math.log10(Math.max(1, cluster.sensorCount)) * 0.28);

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

  // 7. Update selection reticle on globe surface
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (!h.reticleGroup) return;

    if (!selected) {
      h.reticleGroup.visible = false;
      return;
    }

    const lat = selected.kind === "point" ? selected.lat : selected.data.lat;
    const lng = selected.kind === "point" ? selected.lng : selected.data.lng;
    const [x, y, z] = latLngToVector3(lat, lng, EARTH_RADIUS + 0.014);
    const normal = new THREE.Vector3(x, y, z).normalize();

    h.reticleGroup.position.set(x, y, z);
    h.reticleGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    h.reticleGroup.visible = true;
  }, [selected]);

  // 8. Smooth Fly-To camera animation when search / quick jump / feed item is clicked
  useEffect(() => {
    if (!flyToTarget) return;
    const h = sceneHandlesRef.current;
    if (!h.flyAnim || !h.camera) return;
    const [tx, ty, tz] = latLngToVector3(flyToTarget.lat, flyToTarget.lng, 1);
    h.flyAnim.targetDir.set(tx, ty, tz).normalize();
    h.flyAnim.targetDist = flyToTarget.altitude ?? Math.min(h.camera.position.length(), 2.35);
    h.flyAnim.active = true;
  }, [flyToTarget]);

  return (
    <div className="globe-stage" ref={containerRef} aria-label="실시간 3D 지구본 모니터링 캔버스">
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
