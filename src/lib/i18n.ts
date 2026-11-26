export type Lang = "ko" | "en";

export const UI_TEXT: Record<
  Lang,
  {
    subtitle: string;
    searchPlaceholder: string;
    liveAlerts: string;
    quakes: string;
    disasters: string;
    weather: string;
    ocean: string;
    air: string;
    maxQuake: string;
    maxWave: string;
    maxPm25: string;
    pointerIdle: string;
    savePin: string;
    savedPin: string;
    compareAdd: string;
    compareNow: string;
    compareTitle: string;
    timelineQuakes: string;
    timelineForecast: string;
    airModePillar: string;
    airModeBubble: string;
    badAirOnly: string;
    webglLostTitle: string;
    webglLostDesc: string;
    webglRestoreBtn: string;
  }
> = {
  ko: {
    subtitle: "실시간 지구 환경 · 재해 관측",
    searchPlaceholder: "도시 · 해역 · 위경도 검색 (예: 서울, 도쿄, 35.6, 139.7)",
    liveAlerts: "실시간 특보",
    quakes: "지진",
    disasters: "재해",
    weather: "기상",
    ocean: "해양",
    air: "대기질",
    maxQuake: "최대 지진",
    maxWave: "최고 파고",
    maxPm25: "최고 PM2.5",
    pointerIdle: "지구본 위 포인터 대기",
    savePin: "관심 저장",
    savedPin: "저장됨",
    compareAdd: "비교 담기",
    compareNow: "비교 보기",
    compareTitle: "두 지역 실시간 텔레메트리 비교",
    timelineQuakes: "지진 리플레이",
    timelineForecast: "+24h 기상 예보",
    airModePillar: "3D 기둥",
    airModeBubble: "미니 버블",
    badAirOnly: "나쁨 이상만 (36+)",
    webglLostTitle: "3D 그래픽 컨텍스트가 일시 중단되었습니다",
    webglLostDesc: "모바일 절전 또는 백그라운드 전환으로 WebGL이 해제되었습니다.",
    webglRestoreBtn: "3D 지구본 복구하기",
  },
  en: {
    subtitle: "Global Real-Time Earth Telemetry",
    searchPlaceholder: "Search city, ocean, or coords (e.g. Seoul, Tokyo, 35.6, 139.7)",
    liveAlerts: "Live Feed",
    quakes: "Quakes",
    disasters: "Hazards",
    weather: "Weather",
    ocean: "Ocean",
    air: "Air Quality",
    maxQuake: "Max Quake",
    maxWave: "Max Wave",
    maxPm25: "Peak PM2.5",
    pointerIdle: "Hover globe for coords",
    savePin: "Pin",
    savedPin: "Pinned",
    compareAdd: "Compare",
    compareNow: "View Diff",
    compareTitle: "Live Side-by-Side Location Comparison",
    timelineQuakes: "Quake Replay",
    timelineForecast: "+24h Forecast",
    airModePillar: "3D Pillars",
    airModeBubble: "Compact Bubbles",
    badAirOnly: "Unhealthy Only (36+)",
    webglLostTitle: "3D Graphics Context Paused",
    webglLostDesc: "WebGL was suspended while the tab was in the background.",
    webglRestoreBtn: "Restore 3D Globe",
  },
};
