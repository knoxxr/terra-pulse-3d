import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "TerraPulse 3D",
      timestamp: new Date().toISOString(),
      feeds: {
        earthquakes: "USGS GeoJSON (60s CDN)",
        weatherOcean: "Open-Meteo NOAA GFS / ECMWF Marine (600s CDN)",
        airQuality: process.env.PURPLEAIR_API_KEY
          ? "Sensor.Community + PurpleAir (300s CDN)"
          : "Sensor.Community Global Network (300s CDN)",
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
