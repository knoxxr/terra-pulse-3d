import type {
  AirQualityPayload,
  EarthquakeEvent,
  WeatherOceanPayload,
} from "@/types/telemetry";
import { GLOBAL_OCEAN_ANCHORS, GLOBAL_WEATHER_ANCHORS } from "./locations";

export function getFallbackEarthquakes(): EarthquakeEvent[] {
  const now = Date.now();
  return [
    {
      id: "fb-jp-1",
      mag: 5.4,
      place: "62 km ESE of Ishinomaki, Japan",
      time: now - 18 * 60_000,
      lat: 38.12,
      lng: 142.05,
      depthKm: 34.2,
      tsunami: false,
      alert: "green",
      sig: 449,
      felt: 42,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
    {
      id: "fb-vu-2",
      mag: 4.9,
      place: "24 km NW of Port-Vila, Vanuatu",
      time: now - 74 * 60_000,
      lat: -17.56,
      lng: 168.15,
      depthKm: 41.8,
      tsunami: false,
      alert: null,
      sig: 370,
      felt: 6,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
    {
      id: "fb-cl-3",
      mag: 5.1,
      place: "48 km W of Coquimbo, Chile",
      time: now - 140 * 60_000,
      lat: -29.95,
      lng: -71.82,
      depthKm: 28.4,
      tsunami: false,
      alert: "green",
      sig: 400,
      felt: 18,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
    {
      id: "fb-ak-4",
      mag: 4.3,
      place: "88 km S of Sand Point, Alaska",
      time: now - 210 * 60_000,
      lat: 54.56,
      lng: -160.41,
      depthKm: 19.6,
      tsunami: false,
      alert: null,
      sig: 284,
      felt: 2,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
    {
      id: "fb-id-5",
      mag: 5.7,
      place: "110 km SW of Padang, Indonesia",
      time: now - 310 * 60_000,
      lat: -1.62,
      lng: 99.68,
      depthKm: 22.1,
      tsunami: false,
      alert: "green",
      sig: 500,
      felt: 25,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
    {
      id: "fb-ca-6",
      mag: 3.6,
      place: "12 km E of Ridgecrest, CA",
      time: now - 420 * 60_000,
      lat: 35.63,
      lng: -117.54,
      depthKm: 9.2,
      tsunami: false,
      alert: null,
      sig: 199,
      felt: 35,
      url: "https://earthquake.usgs.gov/earthquakes/map/",
    },
  ];
}

export function getFallbackWeatherOcean(): WeatherOceanPayload {
  return {
    modelInfo: "Open-Meteo (NOAA GFS / ECMWF Fallback Snapshot)",
    weather: GLOBAL_WEATHER_ANCHORS.map((a, idx) => {
      const latFactor = Math.cos((a.lat * Math.PI) / 180);
      const tempC = Math.round((latFactor * 28 - 4 + ((idx % 7) - 3) * 1.4) * 10) / 10;
      return {
        id: a.id,
        name: a.name,
        nameKo: a.nameKo,
        lat: a.lat,
        lng: a.lng,
        tempC,
        windSpeedKmh: 10 + (idx % 24),
        windDirDeg: (idx * 47) % 360,
        precipMm: idx % 6 === 0 ? 1.8 : 0,
        weatherCode: idx % 6 === 0 ? 61 : idx % 3 === 0 ? 2 : 0,
        humidityPct: 55 + (idx % 30),
        pressureHpa: 1012 + ((idx % 9) - 4),
        isDay: true,
      };
    }),
    ocean: GLOBAL_OCEAN_ANCHORS.map((a, idx) => ({
      id: a.id,
      name: a.name,
      nameKo: a.nameKo,
      lat: a.lat,
      lng: a.lng,
      waveHeightM: Math.round((1.1 + (Math.abs(a.lat) / 60) * 2.8 + (idx % 5) * 0.25) * 100) / 100,
      waveDirDeg: (idx * 53 + 220) % 360,
      wavePeriodS: 8 + (idx % 6),
      currentVelKmh: Math.round((0.8 + (idx % 4) * 0.45) * 10) / 10,
      currentDirDeg: (idx * 41 + 90) % 360,
    })),
  };
}

export function getFallbackAirQuality(): AirQualityPayload {
  const now = new Date().toISOString();
  const sample: Array<[number, number, number, string, number]> = [
    [52.52, 13.4, 14.2, "DE", 142],
    [48.85, 2.35, 18.6, "FR", 96],
    [51.5, -0.12, 11.4, "GB", 74],
    [50.08, 19.94, 38.4, "PL", 88],
    [45.46, 9.19, 31.2, "IT", 65],
    [40.42, -3.7, 13.5, "ES", 42],
    [52.37, 4.9, 12.8, "NL", 112],
    [47.37, 8.54, 9.6, "CH", 51],
    [37.57, 126.98, 24.5, "KR", 28],
    [35.68, 139.65, 13.1, "JP", 24],
    [25.03, 121.57, 21.8, "TW", 31],
    [28.61, 77.21, 96.4, "IN", 19],
    [37.77, -122.42, 10.2, "US", 34],
    [40.71, -74.01, 15.8, "US", 29],
    [-33.87, 151.21, 7.9, "AU", 22],
  ];
  return {
    clusters: sample.map(([lat, lng, pm25, country, count], i) => ({
      id: `fb-aq-${i}`,
      lat,
      lng,
      pm25,
      pm10: Math.round(pm25 * 1.65 * 10) / 10,
      tempC: 14.5,
      humidityPct: 62,
      pressureHpa: 1014,
      sensorCount: count,
      country,
      provider: "Sensor.Community",
      timestamp: now,
    })),
    totalRawSensors: 15240,
    dustSensorCount: 9120,
    climateSensorCount: 6120,
    globalAvgPm25: 19.4,
  };
}
