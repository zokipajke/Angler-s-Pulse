
import { Location, WeatherInfo } from "../types";

/**
 * Real weather integration using Open-Meteo:
 * - Short-term precise: api.open-meteo.com/v1/forecast (<= 16 days)
 * - Long-range: seasonal-api.open-meteo.com/v1/seasonal (ECMWF EC46/SEAS5)
 *
 * Notes:
 * - No API key required for non-commercial use.
 * - We aggregate hourly data into WeatherInfo daily fields.
 * - Use timezone=auto so returned times align with location local time.
 */

// ------------ Types for Open-Meteo responses ------------
type OpenMeteoHourly = {
  time: string[];
  temperature_2m?: number[];
  pressure_msl?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
  weather_code?: number[];
};

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourly?: OpenMeteoHourly;
  hourly_units?: Record<string, string>;
};

// ------------ Config ------------
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const SEASONAL_BASE = "https://seasonal-api.open-meteo.com/v1/seasonal";

// Short-term capability (Open-Meteo forecast supports up to 16 days)
const SHORT_TERM_DAYS = 16;

// Pressure trend threshold (hPa)
const PRESSURE_TREND_EPS = 1.0;

// ------------ Public API ------------
/**
 * Fetch daily weather for an entire month.
 * Returns a map keyed by yyyy-mm-dd for easy lookup.
 */
export async function fetchMonthlyWeather(
  month: number,
  year: number,
  location: Location
): Promise<Record<string, WeatherInfo>> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const out: Record<string, WeatherInfo> = {};

  // Split into short-term vs long-range based on "today"
  const today = stripTime(new Date());
  const shortTermEnd = addDays(today, SHORT_TERM_DAYS - 1); // inclusive

  // 1) Short-term (precise): Forecast API
  // Open-Meteo Forecast API allows start_date to be in the past, but we clamp to current month logic
  if (start <= shortTermEnd) {
    // We clamp the start of the weather request to either the month start or today, 
    // because the forecast API primarily serves upcoming data. 
    // Historical data usually requires a different endpoint, so we focus on the actionable forecast window.
    const shortStart = maxDate(start, today); 
    const shortEnd = minDate(end, shortTermEnd);
    
    if (shortStart <= shortEnd) {
      try {
        const shortMap = await fetchAndAggregateDaily(
          "forecast",
          shortStart,
          shortEnd,
          location
        );
        Object.assign(out, shortMap);
      } catch (e) {
        console.warn("Forecast API failed, likely out of bounds or network issue.", e);
      }
    }
  }

  // 2) Long-range (up to 2 months in your UX): Seasonal API
  const longStart = maxDate(start, addDays(shortTermEnd, 1));
  if (longStart <= end) {
    try {
      const longMap = await fetchAndAggregateDaily(
        "seasonal",
        longStart,
        end,
        location
      );
      Object.assign(out, longMap);
    } catch (e) {
      console.warn("Seasonal API failed or unsupported for these dates.", e);
    }
  }

  // Ensure every date in month has something (fallback for gaps or past dates)
  const cursor = new Date(start);
  let last: WeatherInfo | null = null;
  while (cursor <= end) {
    const k = toDateStr(cursor);
    if (out[k]) {
      last = out[k];
    } else if (last) {
      // If we have a previous value (e.g. from earlier in the month), 
      // we persist it as a placeholder for the rest of the missing days
      out[k] = { ...last };
    } else {
      // Default baseline if absolutely no data available (e.g. looking at a past month)
      out[k] = {
        tempHigh: 20,
        tempLow: 12,
        pressure: 1013,
        pressureTrend: "steady",
        windSpeed: 5,
        windDirection: "NW",
        conditions: "Clear",
      };
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

// ------------ Core fetch + aggregation ------------
type SourceKind = "forecast" | "seasonal";

async function fetchAndAggregateDaily(
  source: SourceKind,
  start: Date,
  end: Date,
  location: Location
): Promise<Record<string, WeatherInfo>> {
  const url = buildOpenMeteoUrl(source, start, end, location);
  const res = await fetch(url);
  if (!res.ok) {
    // If we get a 400, it's usually because dates are out of range for the specific endpoint
    throw new Error(`Weather API error (${source}) ${res.status}`);
  }
  const json = (await res.json()) as OpenMeteoResponse;

  if (!json.hourly?.time?.length) {
    throw new Error(`Weather API (${source}) returned no hourly data.`);
  }

  const hourly = json.hourly;
  const times = hourly.time;
  const t2m = hourly.temperature_2m ?? [];
  const pmsl = hourly.pressure_msl ?? [];
  const wspd = hourly.wind_speed_10m ?? [];
  const wdir = hourly.wind_direction_10m ?? [];
  const wcode = hourly.weather_code ?? [];

  const buckets: Record<string, number[]> = {};
  for (let i = 0; i < times.length; i++) {
    const dayKey = times[i].slice(0, 10); // "YYYY-MM-DD"
    if (!buckets[dayKey]) buckets[dayKey] = [];
    buckets[dayKey].push(i);
  }

  const out: Record<string, WeatherInfo> = {};
  const dayCursor = new Date(start);
  let prevPressure: number | null = null;

  while (dayCursor <= end) {
    const k = toDateStr(dayCursor);
    const idxs = buckets[k] ?? [];

    if (idxs.length === 0) {
      dayCursor.setDate(dayCursor.getDate() + 1);
      continue;
    }

    const temps = idxs.map(i => t2m[i]).filter(isFiniteNum);
    const tempHigh = temps.length ? Math.round(max(temps)) : 0;
    const tempLow = temps.length ? Math.round(min(temps)) : 0;

    const pressures = idxs.map(i => pmsl[i]).filter(isFiniteNum);
    const pressure = pressures.length ? Math.round(mean(pressures)) : (prevPressure ?? 1013);

    let pressureTrend: WeatherInfo["pressureTrend"] = "steady";
    if (prevPressure != null) {
      const delta = pressure - prevPressure;
      if (delta > PRESSURE_TREND_EPS) pressureTrend = "rising";
      else if (delta < -PRESSURE_TREND_EPS) pressureTrend = "falling";
      else pressureTrend = "steady";
    }

    const winds = idxs.map(i => wspd[i]).filter(isFiniteNum);
    const windSpeed = winds.length ? Math.round(mean(winds)) : 0;

    const dirs = idxs.map(i => wdir[i]).filter(isFiniteNum);
    const windDirection = dirs.length ? degreesToCardinal(vectorMeanDegrees(dirs)) : "N";

    const codes = idxs.map(i => wcode[i]).filter(isFiniteNum);
    const conditions = codes.length ? codesToCondition(codes) : "Clear";

    out[k] = {
      tempHigh,
      tempLow,
      pressure,
      pressureTrend,
      windSpeed,
      windDirection: windDirection as any,
      conditions,
    };

    prevPressure = pressure;
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return out;
}

function buildOpenMeteoUrl(source: SourceKind, start: Date, end: Date, location: Location): string {
  const base = source === "forecast" ? FORECAST_BASE : SEASONAL_BASE;
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: "auto",
    start_date: toDateStr(start),
    end_date: toDateStr(end),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timeformat: "iso8601",
    hourly: [
      "temperature_2m",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(","),
  });

  // CRITICAL FIX: Do not set forecast_days when start_date and end_date are provided.
  // The Open-Meteo API returns a 400 Bad Request if both are present in some versions/scenarios.
  
  return `${base}?${params.toString()}`;
}

function codesToCondition(codes: number[]): WeatherInfo["conditions"] {
  let hasStorm = false, hasSnow = false, hasRain = false, hasFog = false, hasCloud = false;
  for (const c of codes) {
    if (c === 0) continue;
    if ([95, 96, 99].includes(c)) hasStorm = true;
    else if ([71, 73, 75, 77, 85, 86].includes(c)) hasSnow = true;
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) hasRain = true;
    else if ([45, 48].includes(c)) hasFog = true;
    else if ([1, 2, 3].includes(c)) hasCloud = true;
  }
  if (hasStorm) return "Stormy";
  if (hasSnow) return "Snowy";
  if (hasRain) return "Rainy";
  if (hasFog) return "Foggy";
  if (hasCloud) return "Cloudy";
  return "Clear";
}

function vectorMeanDegrees(degs: number[]): number {
  let x = 0, y = 0;
  for (const d of degs) {
    const rad = (d * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  const ang = Math.atan2(y, x) * (180 / Math.PI);
  return (ang + 360) % 360;
}

function degreesToCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function isFiniteNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function max(arr: number[]): number {
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  return m;
}

function min(arr: number[]): number {
  let m = Infinity;
  for (const v of arr) if (v < m) m = v;
  return m;
}
