import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TerraPulse 3D — 글로벌 실시간 지구 모니터링",
    short_name: "TerraPulse 3D",
    description:
      "실시간 지진(USGS), 자연재해(NASA EONET), 기상·해양(Open-Meteo), 한국 에어코리아(data.go.kr) 및 글로벌 환경 센서 3D 지구본",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050a14",
    theme_color: "#050a14",
    lang: "ko",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
