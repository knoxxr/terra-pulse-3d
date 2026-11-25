# TerraPulse 3D — 글로벌 실시간 지진 · 기상 · 해양 · 환경 센서 3D 지구본

USGS 실시간 지진, Open-Meteo(NOAA GFS · ECMWF) 글로벌 기상 및 해양 파고·해류 모델, Sensor.Community(15,000+ 분산 센서) 초미세먼지·환경 데이터를 **60fps Three.js WebGL 3D 지구본** 위에 실시간 시각화하는 Vercel 배포 최적화 웹 애플리케이션입니다.

## 주요 기능

- **지진 및 자연재해 (USGS GeoJSON)**: 1분 주기 갱신, 규모별 색상·크기 스케일링, 주요 지진 파동 링 애니메이션, 진원 깊이·쓰나미 여부·공식 리포트 연동.
- **기상 및 해양 모델 (Open-Meteo · NOAA GFS / ECMWF)**: 전 세계 72개 주요 도시 기온·풍향·풍속·강수량(실시간 이동 바람 파티클 벡터) 및 48개 주요 해역 유의 파고·파주기·표층 해류 모델 시각화.
- **글로벌 환경 센서 네트워크 (Sensor.Community + 선택적 PurpleAir)**: 전 세계 15,000개 이상 분산 센서의 PM2.5 / PM10 / 온습도 / 기압 데이터를 3D 방사형 기둥 클러스터로 렌더링.
- **직관적 탐색 & 모바일 최적화**:
  - 지구본 위 마커 또는 임의 좌표 클릭/탭 시 해당 지점의 실시간 기상(24시간 기온 스파크라인)·해양 파고·최근접 지진·최근접 환경 센서를 즉시 표시.
  - 도시·해역·위경도(`37.57, 126.98`) 검색 및 원탭 권역 이동(한반도, 환태평양 지진대, 유럽 센서망 등).
  - 모바일 `100dvh` 뷰포트, 44px 터치 타깃, 확장형 하단 바텀 시트, 자동 WebGL LOD 및 DPR 캡 적용.

## 대량 사용자 접속 · Vercel 배포 최적화 설계

1. **Vercel Edge CDN 캐싱 (`s-maxage` + `stale-while-revalidate`)**:
   - `/api/earthquakes`: 60초 CDN 캐시 (`stale-while-revalidate=180`)
   - `/api/air-quality`: 300초 CDN 캐시 (`stale-while-revalidate=600`)
   - `/api/weather-ocean`: 600초 CDN 캐시 (`stale-while-revalidate=1200`)
   - `/api/point-inspect`: 클릭 좌표를 `0.25°` 격자로 양자화 후 300초 CDN 캐시
2. **서버리스 인스턴스 내 Singleflight 요청 병합 (`src/lib/cache.ts`)**:
   - 캐시 만료 시 동시 요청 폭주를 단 1회의 업스트림 호출로 병합하며, 업스트림 장애 시 Stale/Fallback 데이터를 반환해 무중단 유지.
3. **서버 사이드 공간 격자 집계 (Payload 압축)**:
   - Sensor.Community 원본 JSON(~10MB, 17,000+ 레코드)을 서버에서 `0.85°` 격자로 집계해 ~55KB(gzip ~16KB)로 압축 전송.
   - Open-Meteo 다중 좌표 배치 쿼리로 전 지구 기상·해양 데이터를 단 2회의 업스트림 요청으로 수집.
4. **고정밀 50m 벡터 지형 · 3D 오버레이 + InstancedMesh**:
   - Natural Earth 50m 벡터(`countries-50m.json`) 기반 4K/2K 지형 릴리프·해저 지형·범프맵·구름층·야간 도시 불빛과 딥 줌에서도 선명한 3D 벡터 해안선·국경선 오버레이, 줌 적응형 지명/기온 라벨을 `THREE.InstancedMesh`와 함께 60fps로 렌더링.

## 로컬 실행 & Vercel 배포

```bash
npm install
npm run dev
```

### Vercel 원클릭 배포

- 별도 API 키 없이 **즉시 배포 및 실시간 동작**합니다.
- 선택적으로 Vercel Environment Variables에 `PURPLEAIR_API_KEY`를 추가하면 북미/글로벌 PurpleAir 센서 데이터가 자동 병합됩니다.
- `vercel.json`에 리전(`icn1`) 및 서버리스 함수 타임아웃이 Hobby·Pro 플랜 모두 호환되도록 사전 구성되어 있습니다.
