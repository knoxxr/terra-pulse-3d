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
  alert: string | null; // green | yellow | orange | red
  sig: number;
  felt: number | null;
  url: string;
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

export interface AirQualityCluster {
  id: string;
  lat: number;
  lng: number;
  pm25: number; // µg/m³
  pm10: number | null; // µg/m³
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  sensorCount: number;
  country: string;
  provider: "Sensor.Community" | "PurpleAir";
  timestamp: string;
}

export interface AirQualityPayload {
  clusters: AirQualityCluster[];
  totalRawSensors: number;
  dustSensorCount: number;
  climateSensorCount: number;
  globalAvgPm25: number;
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
  | { kind: "weather"; data: WeatherNode }
  | { kind: "ocean"; data: OceanNode }
  | { kind: "air"; data: AirQualityCluster }
  | { kind: "point"; lat: number; lng: number; label?: string };

export interface LayerVisibility {
  earthquakes: boolean;
  weather: boolean;
  ocean: boolean;
  airQuality: boolean;
  dayNight: boolean;
  autoRotate: boolean;
}
