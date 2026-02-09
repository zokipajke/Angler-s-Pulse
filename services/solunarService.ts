
import SunCalc from "suncalc";
import { MonthlyForecast, Location, FishingDay, SolarLunarEvent, WeatherInfo } from "../types";

/**
 * Offline Solunar service (SunCalc-based) + Solar–Lunar Alignment
 * + "Peak Activity Window" feature.
 */

// -------------------- knobs --------------------
const TRANSIT_SCAN_STEP_MIN = 5;

const ALIGNMENT_WINDOW_MIN = 90;
const ALIGNMENT_BONUS_MAJOR = 10;
const ALIGNMENT_BONUS_MINOR = 5;
const ALIGNMENT_BONUS_CAP = 20;

const HOUR_ALIGN_BOOST_MAJOR = 35; // Increased boost
const HOUR_ALIGN_BOOST_MINOR = 20;

// Peak Window widths
const MAJOR_HALF_MIN = 60; // 2h total
const MINOR_HALF_MIN = 30; // 1h total

const PEAK_EVENT_TYPE = "peak";

// -------------------- helpers --------------------
const pad2 = (n: number) => n.toString().padStart(2, "0");

function fmtHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmt12h(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${pad2(m)} ${ampm}`;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function parseHHMMToMinutes(t: string): number {
  if (!t || t === "—") return -1;
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
  return hh * 60 + mm;
}

function circularDiffMinutes(aMin: number, bMin: number): number {
  const diff = Math.abs(aMin - bMin);
  return Math.min(diff, 1440 - diff);
}

function isAligned(peak: string, sunrise: string, sunset: string): boolean {
  const p = parseHHMMToMinutes(peak);
  const sr = parseHHMMToMinutes(sunrise);
  const ss = parseHHMMToMinutes(sunset);
  if (p === -1) return false;
  return (
    circularDiffMinutes(p, sr) <= ALIGNMENT_WINDOW_MIN ||
    circularDiffMinutes(p, ss) <= ALIGNMENT_WINDOW_MIN
  );
}

function computeAlignmentBonus(args: {
  sunrise: string;
  sunset: string;
  majors: string[];
  minors: string[];
}): number {
  const sunriseMin = parseHHMMToMinutes(args.sunrise);
  const sunsetMin = parseHHMMToMinutes(args.sunset);

  let bonus = 0;

  for (const m of args.majors) {
    const mMin = parseHHMMToMinutes(m);
    if (mMin !== -1) {
      if (circularDiffMinutes(mMin, sunriseMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MAJOR;
      if (circularDiffMinutes(mMin, sunsetMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MAJOR;
    }
  }

  for (const m of args.minors) {
    const mMin = parseHHMMToMinutes(m);
    if (mMin !== -1) {
      if (circularDiffMinutes(mMin, sunriseMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MINOR;
      if (circularDiffMinutes(mMin, sunsetMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MINOR;
    }
  }

  return Math.min(ALIGNMENT_BONUS_CAP, bonus);
}

function windowStringFromCenter(center: Date, halfMin: number): string {
  const start = addMinutes(center, -halfMin);
  const end = addMinutes(center, +halfMin);
  return `${fmt12h(start)} \u2013 ${fmt12h(end)}`;
}

type PeakCandidate = {
  kind: "major" | "minor";
  center: Date;
  centerHHMM: string;
  aligned: boolean;
  distToTwilightMin: number;
};

function pickPeakActivityWindow(args: {
  sunrise: string;
  sunset: string;
  majors: Date[];
  minors: Date[];
}): { window: string; kindLabel: "Major" | "Minor" } {
  const sunriseMin = parseHHMMToMinutes(args.sunrise);
  const sunsetMin = parseHHMMToMinutes(args.sunset);

  const candidates: PeakCandidate[] = [];

  for (const m of args.majors) {
    const hhmm = fmtHHMM(m);
    const mMin = parseHHMMToMinutes(hhmm);
    const d = Math.min(circularDiffMinutes(mMin, sunriseMin), circularDiffMinutes(mMin, sunsetMin));
    candidates.push({
      kind: "major",
      center: m,
      centerHHMM: hhmm,
      aligned: d <= ALIGNMENT_WINDOW_MIN,
      distToTwilightMin: d,
    });
  }

  for (const m of args.minors) {
    const hhmm = fmtHHMM(m);
    const mMin = parseHHMMToMinutes(hhmm);
    const d = Math.min(circularDiffMinutes(mMin, sunriseMin), circularDiffMinutes(mMin, sunsetMin));
    candidates.push({
      kind: "minor",
      center: m,
      centerHHMM: hhmm,
      aligned: d <= ALIGNMENT_WINDOW_MIN,
      distToTwilightMin: d,
    });
  }

  candidates.sort((a, b) => {
    if (a.aligned !== b.aligned) return a.aligned ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === "major" ? -1 : 1;
    if (a.distToTwilightMin !== b.distToTwilightMin) return a.distToTwilightMin - b.distToTwilightMin;
    return parseHHMMToMinutes(a.centerHHMM) - parseHHMMToMinutes(b.centerHHMM);
  });

  const best = candidates[0];
  const half = best.kind === "major" ? MAJOR_HALF_MIN : MINOR_HALF_MIN;
  const label = best.kind === "major" ? "Major" : "Minor";
  return { window: `${windowStringFromCenter(best.center, half)} (${label})`, kindLabel: label };
}

function getMoonPhaseValue(date: Date): number {
  return SunCalc.getMoonIllumination(date).phase;
}

function getMoonPhaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function generateWeather(date: Date, location: Location): WeatherInfo {
  const seed = (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) ^
    Math.floor((location.latitude + 90) * 1000) ^
    Math.floor((location.longitude + 180) * 1000);
  const rnd = makeLCG(seed);
  const isWinter = date.getMonth() < 3 || date.getMonth() > 9;
  const baseTemp = isWinter ? 5 : 22;
  const t = rnd();
  const pressureTrend = t > 0.66 ? "rising" : t > 0.33 ? "falling" : "steady";
  return {
    tempHigh: Math.floor(baseTemp + rnd() * 10),
    tempLow: Math.floor(baseTemp - 5 + rnd() * 5),
    pressure: Math.floor(1005 + rnd() * 20),
    pressureTrend,
    windSpeed: Math.floor(rnd() * 25),
    windDirection: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(rnd() * 8)] as any,
    conditions: rnd() > 0.7 ? "Partly Cloudy" : rnd() > 0.4 ? "Clear" : "Overcast",
  };
}

function getSolarTimes(date: Date, lat: number, lon: number): { sunrise: string; sunset: string } {
  const t = SunCalc.getTimes(date, lat, lon);
  return { sunrise: fmtHHMM(t.sunrise), sunset: fmtHHMM(t.sunset) };
}

function getMoonTransits(date: Date, lat: number, lon: number): { overhead: Date; underfoot: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const stepMs = TRANSIT_SCAN_STEP_MIN * 60_000;
  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let tMax = start;
  let tMin = start;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const dt = new Date(t);
    const pos = SunCalc.getMoonPosition(dt, lat, lon);
    const alt = pos.altitude;
    if (alt > maxAlt) { maxAlt = alt; tMax = dt; }
    if (alt < minAlt) { minAlt = alt; tMin = dt; }
  }
  return { overhead: tMax, underfoot: tMin };
}

function getSolunarPeaks(date: Date, lat: number, lon: number): {
  major: string[];
  minor: string[];
  rise: string;
  set: string;
  majorCenters: Date[];
  minorCenters: Date[];
} {
  const mt = SunCalc.getMoonTimes(date, lat, lon, true) as any;
  const moonrise: Date | undefined = mt.rise;
  const moonset: Date | undefined = mt.set;
  const { overhead, underfoot } = getMoonTransits(date, lat, lon);
  const majorCenters = [overhead, underfoot].sort((a, b) => a.getTime() - b.getTime());
  const major = majorCenters.map(fmtHHMM).sort();
  const minorCenters: Date[] = [];
  if (moonrise) minorCenters.push(moonrise);
  if (moonset) minorCenters.push(moonset);
  minorCenters.sort((a, b) => a.getTime() - b.getTime());
  const minorTimes = minorCenters.map(fmtHHMM).sort();
  return {
    major,
    minor: minorTimes.length === 2 ? minorTimes : minorTimes.length === 1 ? [minorTimes[0], "—"] : ["—", "—"],
    rise: moonrise ? fmtHHMM(moonrise) : "—",
    set: moonset ? fmtHHMM(moonset) : "—",
    majorCenters,
    minorCenters,
  };
}

function computeBasePhaseScore(phaseVal: number): number {
  const phaseImpact = (Math.cos(phaseVal * Math.PI * 4) + 1) / 2;
  let baseScore = 50 + phaseImpact * 40;
  if (phaseVal < 0.03 || phaseVal > 0.97 || (phaseVal > 0.47 && phaseVal < 0.53)) baseScore += 5;
  return baseScore;
}

export async function calculateFishingForecast(
  month: number,
  year: number,
  location: Location
): Promise<MonthlyForecast> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: FishingDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const solar = getSolarTimes(date, location.latitude, location.longitude);
    const peaks = getSolunarPeaks(date, location.latitude, location.longitude);
    const phaseVal = getMoonPhaseValue(date);
    const baseScore = computeBasePhaseScore(phaseVal);
    const alignmentBonus = computeAlignmentBonus({
      sunrise: solar.sunrise,
      sunset: solar.sunset,
      majors: peaks.major,
      minors: peaks.minor.filter((t) => t !== "—"),
    });
    const finalScore = Math.min(100, Math.floor(baseScore + alignmentBonus));
    const peakWindow = pickPeakActivityWindow({
      sunrise: solar.sunrise,
      sunset: solar.sunset,
      majors: peaks.majorCenters,
      minors: peaks.minorCenters,
    }).window;

    const hourlyActivity: number[] = [];
    const sunriseMin = parseHHMMToMinutes(solar.sunrise);
    const sunsetMin = parseHHMMToMinutes(solar.sunset);
    const majorsMin = peaks.major.map(parseHHMMToMinutes);
    const minorTimes = peaks.minor.filter((t) => t !== "—");
    const minorsMin = minorTimes.map(parseHHMMToMinutes);

    for (let h = 0; h < 24; h++) {
      const hMin = h * 60;
      let hScore = 20; // Slightly higher base

      // Solar crepuscular bumps
      for (const anchor of [sunriseMin, sunsetMin]) {
        const diff = circularDiffMinutes(hMin, anchor);
        if (diff < 90) {
          const effect = Math.cos((diff / 90) * (Math.PI / 2));
          hScore += effect * 25;
        }
      }

      // Major peaks
      for (let i = 0; i < peaks.major.length; i++) {
        const t = peaks.major[i];
        const peakMin = majorsMin[i];
        if (peakMin === -1) continue;
        const diff = circularDiffMinutes(hMin, peakMin);
        const aligned = isAligned(t, solar.sunrise, solar.sunset);
        const amp = aligned ? 50 + HOUR_ALIGN_BOOST_MAJOR : 50;
        if (diff < 120) {
          const effect = Math.pow(Math.cos((diff / 120) * (Math.PI / 2)), 2);
          hScore += effect * amp;
        }
      }

      // Minor peaks
      for (let i = 0; i < minorTimes.length; i++) {
        const t = minorTimes[i];
        const peakMin = minorsMin[i];
        if (peakMin === -1) continue;
        const diff = circularDiffMinutes(hMin, peakMin);
        const aligned = isAligned(t, solar.sunrise, solar.sunset);
        const amp = aligned ? 25 + HOUR_ALIGN_BOOST_MINOR : 25;
        if (diff < 75) {
          const effect = Math.pow(Math.cos((diff / 75) * (Math.PI / 2)), 2);
          hScore += effect * amp;
        }
      }

      hourlyActivity.push(Math.min(100, Math.max(10, Math.floor(hScore))));
    }

    // NORMALIZATION STEP: Ensure high success-rate days reach peak intensity on the chart
    const maxHourVal = Math.max(...hourlyActivity);
    if (finalScore >= 85 && maxHourVal < 95) {
      const ratio = 100 / maxHourVal;
      for (let i = 0; i < 24; i++) {
        hourlyActivity[i] = Math.min(100, Math.floor(hourlyActivity[i] * ratio));
      }
    } else if (finalScore >= 70 && maxHourVal < 80) {
      const ratio = 85 / maxHourVal;
      for (let i = 0; i < 24; i++) {
        hourlyActivity[i] = Math.floor(hourlyActivity[i] * ratio);
      }
    }

    const events: SolarLunarEvent[] = [
      { type: "sunrise", time: solar.sunrise, label: "Sunrise" },
      { type: "sunset", time: solar.sunset, label: "Sunset" },
      { type: "moonrise", time: peaks.rise, label: "Moonrise" },
      { type: "moonset", time: peaks.set, label: "Moonset" },
      { type: "major", time: peaks.major[0], label: "Major" },
      { type: "major", time: peaks.major[1], label: "Major" },
      { type: "minor", time: peaks.minor[0], label: "Minor" },
      { type: "minor", time: peaks.minor[1], label: "Minor" },
      { type: PEAK_EVENT_TYPE as any, time: peakWindow, label: "Peak Window" },
    ];

    days.push({
      day: d,
      score: finalScore,
      moonPhase: getMoonPhaseName(phaseVal),
      moonPhaseValue: phaseVal,
      bestTimes: peaks.major,
      hourlyActivity,
      events,
      weather: generateWeather(date, location),
    });
  }
  return { month, year, days };
}
