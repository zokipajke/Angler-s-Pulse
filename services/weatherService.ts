import { Location, WeatherInfo } from "../types";

/**
 * Daily weather cache (fetch once per day on app startup).
 * Stores a rolling window: (today - PAST_DAYS) .. (today + FUTURE_DAYS).
 *
 * Sources (Open-Meteo):
 * - Past days: archive-api.open-meteo.com/v1/archive
 * - Short-term: api.open-meteo.com/v1/forecast (<= 16 days)
 * - Longer-term: seasonal-api.open-meteo.com/v1/seasonal
 */

type OpenMeteoHourly = {
  time: string[];
  temperature_2m?: number[];
  pressure_msl?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
  weather_code?: number[];
};

type OpenMeteoResponse = { hourly?: OpenMeteoHourly };

type SourceKind = "forecast" | "seasonal" | "archive";

interface WeatherCacheEntry {
  fetchedAt: number; // ms
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string;   // YYYY-MM-DD
  data: Record<string, WeatherInfo>;
}

// ------------ Config ------------
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const SEASONAL_BASE = "https://seasonal-api.open-meteo.com/v1/seasonal";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";

const SHORT_TERM_DAYS = 16;

const PAST_DAYS = 7;    // keep last week real (set 0 if you don’t need)
const FUTURE_DAYS = 60; // your “two months” target

const PRESSURE_TREND_EPS = 1.0;

const CACHE_PREFIX = "angler_weather_daily_v1_";

// ------------ Cache helpers ------------
function getDailyCacheKey(location: Location): string {
  const lat = location.latitude.toFixed(2);
  const lon = location.longitude.toFixed(2);
  return `${CACHE_PREFIX}${lat}_${lon}`;
}

function isCacheValidForToday(fetchedAt: number): boolean {
  const now = new Date();
  const d = new Date(fetchedAt);
  return now.getFullYear() === d.getFullYear() && now.getMonth() === d.getMonth() && now.getDate() === d.getDate();
}

function cleanupOldCacheKeepOnly(keyToKeep: string) {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX) && k !== keyToKeep) remove.push(k);
    }
    remove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn("Weather cache cleanup failed", e);
  }
}

// ------------ Public API ------------

/**
 * Fetch once per day (on startup) and cache.
 * Returns rolling daily weather map keyed by YYYY-MM-DD.
 */
export async function fetchDailyWeatherCache(location: Location): Promise<Record<string, WeatherInfo>> {
  const cacheKey = getDailyCacheKey(location);

  // Read cache
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as WeatherCacheEntry;
      if (isCacheValidForToday(parsed.fetchedAt)) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.warn("Failed to read daily weather cache", e);
  }

  // Housekeeping (remove other location caches)
  cleanupOldCacheKeepOnly(cacheKey);

  // Build rolling window
  const today = stripTime(new Date());
  const start = addDays(today, -PAST_DAYS);
  const end = addDays(today, FUTURE_DAYS);

  const out: Record<string, WeatherInfo> = {};

  // Segment A: past (archive) [start .. yesterday]
  const yesterday = addDays(today, -1);
  if (start <= yesterday) {
    try {
      const pastMap = await fetchAndAggregateDaily("archive", start, yesterday, location);
      Object.assign(out, pastMap);
    } catch (e) {
      console.warn("Archive API failed (past segment)", e);
    }
  }

  // Segment B: short-term forecast [today .. min(today+15, end)]
  const shortEnd = minDate(end, addDays(today, SHORT_TERM_DAYS - 1));
  if (today <= shortEnd) {
    try {
      const shortMap = await fetchAndAggregateDaily("forecast", today, shortEnd, location);
      Object.assign(out, shortMap);
    } catch (e) {
      console.warn("Forecast API failed (short segment)", e);
    }
  }

  // Segment C: seasonal [shortEnd+1 .. end]
  const longStart = addDays(shortEnd, 1);
  if (longStart <= end) {
    try {
      const longMap = await fetchAndAggregateDaily("seasonal", longStart, end, location);
      Object.assign(out, longMap);
    } catch (e) {
      console.warn("Seasonal API failed (long segment)", e);
    }
  }

  // Fill gaps defensively
  fillMissingDays(out, start, end);

  // Save cache (overwrite old)
  try {
    const entry: WeatherCacheEntry = {
      fetchedAt: Date.now(),
      rangeStart: toDateStr(start),
      rangeEnd: toDateStr(end),
      data: out,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to save daily weather cache", e);
  }

  return out;
}

/**
 * Compatibility helper if your solunar UI expects "monthly weather":
 * it slices the already cached rolling window.
 */
export async function fetchMonthlyWeather(
  month: number,
  year: number,
  location: Location
): Promise<Record<string, WeatherInfo>> {
  const cache = await fetchDailyWeatherCache(location);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const out: Record<string, WeatherInfo> = {};
  const cur = new Date(start);
  while (cur <= end) {
    const k = toDateStr(cur);
    if (cache[k]) out[k] = cache[k];
    cur.setDate(cur.getDate() + 1);
  }

  // If month extends beyond cached range, still fill something
  fillMissingDays(out, start, end);
  return out;
}

// ------------ Core fetch + aggregation ------------

async function fetchAndAggregateDaily(
  source: SourceKind,
  start: Date,
  end: Date,
  location: Location
): Promise<Record<string, WeatherInfo>> {
  const url = buildOpenMeteoUrl(source, start, end, location);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`Weather API error (${source}) ${res.status}: ${body}`);
  }
  const json = (await res.json()) as OpenMeteoResponse;

  if (!json.hourly?.time?.length) {
    throw new Error(`Weather API (${source}) returned no hourly data.`);
  }

  const { time, temperature_2m, pressure_msl, wind_speed_10m, wind_direction_10m, weather_code } = json.hourly;

  const t2m = temperature_2m ?? [];
  const pmsl = pressure_msl ?? [];
  const wspd = wind_speed_10m ?? [];
  const wdir = wind_direction_10m ?? [];
  const wcode = weather_code ?? [];

  // bucket by YYYY-MM-DD (timezone=auto)
  const buckets: Record<string, number[]> = {};
  for (let i = 0; i < time.length; i++) {
    const k = time[i].slice(0, 10);
    (buckets[k] ??= []).push(i);
  }

  const out: Record<string, WeatherInfo> = {};
  const dayCursor = new Date(start);

  // IMPORTANT: pressure trend should compare day-to-day in chronological order,
  // so we compute with a running prevPressure over this segment.
  let prevPressure: number | null = null;

  while (dayCursor <= end) {
    const k = toDateStr(dayCursor);
    const idxs = buckets[k];
    if (!idxs?.length) {
      dayCursor.setDate(dayCursor.getDate() + 1);
      continue;
    }

    const temps = idxs.map(i => t2m[i]).filter(isFiniteNum);
    const pressures = idxs.map(i => pmsl[i]).filter(isFiniteNum);
    const winds = idxs.map(i => wspd[i]).filter(isFiniteNum);
    const dirs = idxs.map(i => wdir[i]).filter(isFiniteNum);
    const codes = idxs.map(i => wcode[i]).filter(isFiniteNum);

    const tempHigh = temps.length ? Math.round(max(temps)) : 0;
    const tempLow = temps.length ? Math.round(min(temps)) : 0;

    const pressure = pressures.length ? Math.round(mean(pressures)) : (prevPressure ?? 1013);

    let pressureTrend: WeatherInfo["pressureTrend"] = "steady";
    if (prevPressure != null) {
      const delta = pressure - prevPressure;
      if (delta > PRESSURE_TREND_EPS) pressureTrend = "rising";
      else if (delta < -PRESSURE_TREND_EPS) pressureTrend = "falling";
    }

    const windSpeed = winds.length ? Math.round(mean(winds)) : 0;
    const windDirection = dirs.length ? degreesToCardinal(vectorMeanDegrees(dirs)) : "N";

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
  const base =
    source === "forecast" ? FORECAST_BASE :
    source === "seasonal" ? SEASONAL_BASE :
    ARCHIVE_BASE;

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

  return `${base}?${params.toString()}`;
}

// ------------ conditions & wind helpers (same as yours) ------------

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
  return dirs[Math.round(deg / 45) % 8];
}

// ------------ date & math utils (same style as yours) ------------

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

function fillMissingDays(map: Record<string, WeatherInfo>, start: Date, end: Date) {
  const cur = new Date(start);
  let last: WeatherInfo | null = null;

  while (cur <= end) {
    const k = toDateStr(cur);
    if (map[k]) last = map[k];
    else if (last) map[k] = { ...last };
    else map[k] = {
      tempHigh: 20,
      tempLow: 12,
      pressure: 1013,
      pressureTrend: "steady",
      windSpeed: 5,
      windDirection: "NW",
      conditions: "Clear",
    };
    cur.setDate(cur.getDate() + 1);
  }
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

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ""; }
}
