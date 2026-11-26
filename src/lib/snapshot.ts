export interface SnapshotMeta {
  altitudeKm: number;
  cameraLat: number;
  cameraLng: number;
  quakeCount: number;
  disasterCount: number;
  sensorCount: number;
  highlightText?: string;
}

/**
 * Composites the raw WebGL canvas PNG with a sleek aerospace telemetry footer bar
 * and triggers native OS share sheet (mobile) or instant PNG download (desktop).
 */
export async function exportGlobeSnapshot(
  rawDataUrl: string,
  meta: SnapshotMeta
): Promise<"shared" | "downloaded"> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Canvas snapshot decode failed"));
    img.src = rawDataUrl;
  });

  const w = img.naturalWidth || 1280;
  const h = img.naturalHeight || 720;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  // Space backdrop + 3D globe render
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.max(w, h) * 0.65);
  bg.addColorStop(0, "#0a1628");
  bg.addColorStop(0.6, "#050a14");
  bg.addColorStop(1, "#02050b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Subtle top-left brand & bottom telemetry watermark ribbon
  const pad = Math.round(Math.min(w, h) * 0.028);
  const barH = Math.max(54, Math.round(h * 0.08));

  const grad = ctx.createLinearGradient(0, h - barH * 1.6, 0, h);
  grad.addColorStop(0, "rgba(4, 8, 16, 0)");
  grad.addColorStop(1, "rgba(4, 8, 16, 0.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - barH * 1.6, w, barH * 1.6);

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  const latStr = `${Math.abs(meta.cameraLat).toFixed(2)}°${meta.cameraLat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(meta.cameraLng).toFixed(2)}°${meta.cameraLng >= 0 ? "E" : "W"}`;

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f1f5f9";
  ctx.font = `700 ${Math.max(16, Math.round(h * 0.024))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText("TerraPulse 3D", pad, h - barH * 0.62);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `500 ${Math.max(12, Math.round(h * 0.016))}px ui-monospace, SFMono-Regular, monospace`;
  const rightLine = `${kst} KST  ·  ${latStr}, ${lngStr}  ·  ALT ${meta.altitudeKm.toLocaleString()} km`;
  ctx.fillText(rightLine, pad, h - barH * 0.28);

  const statsLine = meta.highlightText
    ? `${meta.highlightText}  |  지진 ${meta.quakeCount} · 재해 ${meta.disasterCount} · 센서 ${(meta.sensorCount / 1000).toFixed(1)}k`
    : `USGS 지진 ${meta.quakeCount}  ·  NASA 재해 ${meta.disasterCount}  ·  환경센서 ${(meta.sensorCount / 1000).toFixed(1)}k`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#bae6fd";
  ctx.fillText(statsLine, w - pad, h - barH * 0.45);

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png", 0.96));
  if (!blob) throw new Error("Failed to encode snapshot PNG");

  const fileName = `terrapulse-3d-${kst.replace(/[-: ]/g, "")}.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  // Prefer native OS Share Sheet on mobile devices when supported
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] }) &&
    window.innerWidth < 900
  ) {
    try {
      await navigator.share({
        title: "TerraPulse 3D 실시간 지구 관측",
        text: statsLine,
        files: [file],
      });
      return "shared";
    } catch {
      // Fall through to direct download if user dismissed share sheet or browser restricted it
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  return "downloaded";
}
