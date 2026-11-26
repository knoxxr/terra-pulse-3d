# TerraPulse 3D — 글로벌 실시간 지진 · 재해 · 기상 · 해양 · 대기질 3D 지구본

USGS 실시간 지진, **NASA EONET 자연재해(산불·화산·태풍·해빙)**, Open-Meteo(NOAA GFS · ECMWF +24h 예보) 글로벌 기상·해양 모델, **한국환경공단 에어코리아(data.go.kr)** 및 Sensor.Community(17,000+ 분산 센서)를 **60fps Three.js WebGL 3D 지구본** 위에 실시간 시각화하는 Vercel 배포·PWA 최적화 웹 애플리케이션입니다.

## 주요 기능

- **지진 · 지각판 경계선 (USGS GeoJSON + 3D Tectonic Plates)**: 1분 주기 갱신, 진앙지 과녁·지진파 경보 아이콘, 수직 핀 스템, 파동 링 애니메이션 및 전 지구 지각판 경계선 3D 벡터 오버레이.
- **실시간 자연재해 (NASA EONET v3)**: API 키 없이 전 세계 산불(🔥)·화산 분화(🌋)·태풍/열대저기압(🌀 3D 이동 경로 포함)·해빙 이벤트를 실시간 표시.
- **기상 및 해양 모델 (Open-Meteo · NOAA GFS / ECMWF)**: 전 세계 72개 주요 도시 날씨 상태 아이콘(맑음·구름·비·눈·뇌우·안개)·바람 파티클 벡터·**+24시간 예보 타임라인** 및 48개 해역 유의 파고·표층 해류 모델 시각화.
- **한국 대기질 (data.go.kr 에어코리아) + 글로벌 환경 센서 (Sensor.Community)**: 6대 대기오염물질(PM2.5·PM10·O₃·NO₂·CO·SO₂) 및 통합대기환경지수(KHAI), 4단계 대기질 표정/마스크 아이콘 표시.
- **타임라인 재생**: 지난 지진 발생 순서 리플레이(`1x / 3x`) 및 향후 24시간 전 지구 기상·바람 예보 스크러빙.
- **3D 스크린샷 저장 & 시점 공유 링크**: 텔레메트리 워터마크가 합성된 고화질 PNG 스냅샷 저장(모바일 네이티브 공유 시트 지원) 및 현재 카메라 각도·레이어 딥링크 복사.
- **내 위치 GPS 브리핑 & 관심 지역 즐겨찾기**: GPS 원탭 이동 + `localStorage` 기반 즐겨찾기 저장 및 인근 강진(`M4.0+`)·고농도 미세먼지(`PM2.5 ≥ 36`) 자동 알림 토스트.
- **모바일 퍼스트 & PWA 설치**: `100dvh` 풀스크린, 딥 줌 컨트롤 레일, 확장형 하단 바텀 시트, Web App Manifest(`standalone`) 지원.

## 대량 사용자 접속 · Vercel 배포 최적화 설계

1. **3단계 캐싱 & 요청 병합 (`src/lib/cache.ts`)**:
   - **L1**: 서버리스 인스턴스 내 Singleflight 요청 병합 + Stale-While-Revalidate.
   - **L2 (선택)**: Upstash Redis REST 분산 캐시 (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 설정 시 자동 활성화, 추가 npm 패키지 불필요).
   - **L3**: Vercel Edge CDN (`s-maxage` + `stale-while-revalidate`) — 지진 60초, 재해/대기질 300초, 기상·해양 600초, 에어코리아 900초.
2. **Vercel Cron 프리워밍 (`/api/cron/warmup`)**: `vercel.json`에 Hobby·Pro 플랜 모두 호환되는 Cron 워밍업 라우트 포함.
3. **고정밀 50m 벡터 지형 + InstancedMesh**: Natural Earth 50m 벡터(`countries-50m.json`) 기반 4K/2K 릴리프·범프맵·구름층·야간 도시 불빛과 딥 줌에서도 선명한 3D 벡터 해안선·국경선 오버레이.

## 환경 변수 설정 (모두 선택 사항 — 미설정 시에도 즉시 동작)

Vercel 프로젝트 → **Settings → Environment Variables**:

- `DATA_GO_KR_API_KEY`: 공공데이터포털 **한국환경공단_에어코리아_대기오염정보** 일반 인증키 (**Encoding / Decoding 키 모두 자동 인식**, 15분 캐시로 일일 무료 한도 500회 완벽 보호)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: 다중 인스턴스 분산 캐시 활성화 (선택)
- `PURPLEAIR_API_KEY`: 북미/글로벌 PurpleAir 센서 병합 (선택)
