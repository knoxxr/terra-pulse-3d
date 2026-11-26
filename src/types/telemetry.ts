export type DataSourceStatus = "live" | "cached" | "stale" | "fallback";

export interface ApiEnvelope<T> {
  data: T;
  meta: {
    source: string;
    status: DataSourceStatus;
    updatedAt: string;
    ttlSeconds: number;
    rawCount: number;
    returnedCount: number;
    latencyMs?: number;
  };
}

export type QuakeWindow = "hour" | "day" | "week";

export interface EarthquakeEvent {
  id: string;
  mag: number;
  place: string;
  time: number; // epoch ms
  lat: number;
  lng: number;
  depthKm: number;
  tsunami: boolean;
  alert: string | null;
  sig: number;
  felt: number | null;
  url: string;
}

export type DisasterCategory =
  | "wildfires"
  | "volcanoes"
  | "severeStorms"
  | "seaLakeIce"
  | "other";

export interface DisasterEvent {
  id: string;
  title: string;
  category: DisasterCategory;
  categoryKo: string;
  lat: number;
  lng: number;
  date: string;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  sourceUrl: string;
  provider: string;
  /** Optional multi-point path [lat, lng][] for moving storms/cyclones */
  track?: Array<[number, number]>;
}

export interface WeatherForecastStep {
  offsetHours: number;
  tempC: number;
  windSpeedKmh: number;
  windDirDeg: number;
  weatherCode: number;
}

export interface WeatherNode {
  id: string;
  name: string;
  nameKo: string;
  lat: number;
  lng: number;
  tempC: number;
  windSpeedKmh: number;
  windDirDeg: number;
  precipMm: number;
  weatherCode: number;
  humidityPct: number;
  pressureHpa: number;
  isDay: boolean;
  /** Compact 3-hour interval forecast for 24h timeline scrubber */
  forecastSteps?: WeatherForecastStep[];
}

export interface OceanNode {
  id: string;
  name: string;
  nameKo: string;
  lat: number;
  lng: number;
  waveHeightM: number;
  waveDirDeg: number;
  wavePeriodS: number;
  currentVelKmh: number;
  currentDirDeg: number;
}

export interface WeatherOceanPayload {
  weather: WeatherNode[];
  ocean: OceanNode[];
  modelInfo: string;
}

export type AirQualityProvider =
  | "AirKorea (data.go.kr)"
  | "Open-Meteo CAMS (KR)"
  | "Sensor.Community"
  | "PurpleAir";

export interface AirQualityCluster {
  id: string;
  lat: number;
  lng: number;
  pm25: number;
  pm10: number | null;
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  sensorCount: number;
  country: string;
  provider: AirQualityProvider;
  timestamp: string;
  stationName?: string;
  sidoName?: string;
  mangName?: string | null;
  khaiValue?: number | null;
  khaiGrade?: number | null;
  o3Ppm?: number | null;
  no2Ppm?: number | null;
  coPpm?: number | null;
  so2Ppm?: number | null;
}

export interface AirQualityPayload {
  clusters: AirQualityCluster[];
  totalRawSensors: number;
  dustSensorCount: number;
  climateSensorCount: number;
  globalAvgPm25: number;
  koreaStationCount: number;
  koreaSource: "data.go.kr" | "open-meteo-cams" | "none";
}

export interface PointInspectData {
  lat: number;
  lng: number;
  gridLat: number;
  gridLng: number;
  weather: {
    tempC: number;
    apparentTempC: number;
    windSpeedKmh: number;
    windDirDeg: number;
    windGustKmh: number;
    precipMm: number;
    humidityPct: number;
    pressureHpa: number;
    weatherCode: number;
    hourlyTempC: number[];
    hourlyWindKmh: number[];
    hourlyLabels: string[];
  } | null;
  marine: {
    waveHeightM: number;
    waveDirDeg: number;
    wavePeriodS: number;
    swellHeightM: number | null;
    currentVelKmh: number | null;
    currentDirDeg: number | null;
  } | null;
  nearestQuake: (EarthquakeEvent & { distanceKm: number }) | null;
  nearestSensor: (AirQualityCluster & { distanceKm: number }) | null;
}

export type SelectedItem =
  | { kind: "earthquake"; data: EarthquakeEvent }
  | { kind: "disaster"; data: DisasterEvent }
  | { kind: "weather"; data: WeatherNode }
  | { kind: "ocean"; data: OceanNode }
  | { kind: "air"; data: AirQualityCluster }
  | { kind: "point"; lat: number; lng: number; label?: string };

export interface LayerVisibility {
  earthquakes: boolean;
  disasters: boolean;
  weather: boolean;
  ocean: boolean;
  airQuality: boolean;
  tectonic: boolean;
  dayNight: boolean;
  clouds: boolean;
  labels: boolean;
  autoRotate: boolean;
}

export interface CameraTelemetry {
  altitudeKm: number;
  zoomPct: number;
  cameraLat: number;
  cameraLng: number;
  cameraDist: number;
  cursorLat: number | null;
  cursorLng: number | null;
}

export interface ZoomCommand {
  action: "in" | "out" | "reset";
  nonce: number;
}

export interface SavedPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
}
