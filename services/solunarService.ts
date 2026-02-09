import { MonthlyForecast, Location, FishingDay, SolarLunarEvent, WeatherInfo } from "../types";

/**
 * Robust offline solunar calculation service.
 * Adds Solar–Lunar Alignment (sunrise/sunset stacking with major/minor peaks).
 *
 * NOTE: This uses phase-based peak approximation.
 * Solar–Lunar Alignment improves intensity scoring and the hourly curve,
 * without changing existing interfaces.
 */

const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_REF = new Date("2024-12-30T22:27:00Z").getTime();

// --- Solar–Lunar Alignment tuning knobs ---
const ALIGNMENT_WINDOW_MIN = 90;      // within 90 minutes counts as “aligned”
const ALIGNMENT_BONUS_MAJOR = 10;     // score bonus per aligned major
const ALIGNMENT_BONUS_MINOR = 5;      // score bonus per aligned minor
const ALIGNMENT_BONUS_CAP = 20;       // max added to daily score from alignment

const HOUR_ALIGN_BOOST_MAJOR = 30;    // hourly boost near aligned major
const HOUR_ALIGN_BOOST_MINOR = 15;    // hourly boost near aligned minor

function getMoonPhaseValue(date: Date): number {
  const diff = date.getTime() - NEW_MOON_REF;
  const phase = (diff / (1000 * 60 * 60 * 24 * SYNODIC_MONTH)) % 1;
  return phase < 0 ? phase + 1 : phase;
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

/**
 * Generates simulated weather data for the offline experience.
 * Uses consistent random seeds based on date and location.
 */
function generateWeather(date: Date, location: Location): WeatherInfo {
  const seed = date.getDate() + date.getMonth() * 31 + Math.abs(location.latitude) * 100;
  const seededRandom = () => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const isWinter = date.getMonth() < 3 || date.getMonth() > 9;
  const baseTemp = isWinter ? 5 : 22;

  return {
    tempHigh: Math.floor(baseTemp + seededRandom() * 10),
    tempLow: Math.floor(baseTemp - 5 + seededRandom() * 5),
    pressure: Math.floor(1005 + seededRandom() * 20),
    pressureTrend: seededRandom() > 0.6 ? "rising" : seededRandom() > 0.3 ? "falling" : "steady",
    windSpeed: Math.floor(seededRandom() * 25),
    windDirection: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(seededRandom() * 8)] as any,
    conditions: seededRandom() > 0.7 ? "Partly Cloudy" : seededRandom() > 0.4 ? "Clear" : "Overcast",
  };
}

/**
 * Improved Solar approximation incorporating Longitude and Timezone
 */
function getSolarTimes(date: Date, lat: number, lon: number): { sunrise: string; sunset: string; solarNoon: number } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

  const phi = (lat * Math.PI) / 180;
  const delta = 0.409 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const cosH = -Math.tan(phi) * Math.tan(delta);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosH))) * (12 / Math.PI);

  // Longitude correction (simplified)
  const timezoneOffset = Math.round(lon / 15);
  const lonCorrection = (timezoneOffset * 15 - lon) * (12 / 180);
  const solarNoon = 12 + lonCorrection;

  const sunriseHour = solarNoon - hourAngle;
  const sunsetHour = solarNoon + hourAngle;

  const format = (h: number) => {
    const hh = Math.floor((h + 24) % 24);
    const mm = Math.floor((((h + 24) % 24) - hh) * 60);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  };

  return { sunrise: format(sunriseHour), sunset: format(sunsetHour), solarNoon };
}

function getSolunarPeaks(
  phase: number,
  solarNoon: number
): { major: string[]; minor: string[]; rise: string; set: string } {
  // Transit drifts through the day across the synodic month
  const moonTransit = (solarNoon + phase * 24) % 24;

  const major1 = moonTransit;
  const major2 = (moonTransit + 12.42) % 24;
  const minor1 = (moonTransit - 6.21 + 24) % 24;
  const minor2 = (moonTransit + 6.21) % 24;

  const moonRise = minor1;
  const moonSet = minor2;

  const format = (h: number) => {
    const hh = Math.floor((h + 24) % 24);
    const mm = Math.floor((((h + 24) % 24) - hh) * 60);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  };

  return {
    major: [format(major1), format(major2)].sort(),
    minor: [format(minor1), format(minor2)].sort(),
    rise: format(moonRise),
    set: format(moonSet),
  };
}

// ---------------------- Solar–Lunar Alignment helpers ----------------------

function parseHHMMToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
  return hh * 60 + mm;
}

function circularDiffMinutes(aMin: number, bMin: number): number {
  const diff = Math.abs(aMin - bMin);
  return Math.min(diff, 1440 - diff);
}

/**
 * Computes a daily alignment bonus when solunar peaks stack near sunrise/sunset.
 */
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
    if (circularDiffMinutes(mMin, sunriseMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MAJOR;
    if (circularDiffMinutes(mMin, sunsetMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MAJOR;
  }

  for (const m of args.minors) {
    const mMin = parseHHMMToMinutes(m);
    if (circularDiffMinutes(mMin, sunriseMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MINOR;
    if (circularDiffMinutes(mMin, sunsetMin) <= ALIGNMENT_WINDOW_MIN) bonus += ALIGNMENT_BONUS_MINOR;
  }

  return Math.min(ALIGNMENT_BONUS_CAP, bonus);
}

/**
 * Returns whether a given peak time (HH:MM) is aligned with sunrise or sunset.
 * Used to boost the hourly curve on stacked days.
 */
function isAligned(peak: string, sunrise: string, sunset: string): boolean {
  const p = parseHHMMToMinutes(peak);
  const sr = parseHHMMToMinutes(sunrise);
  const ss = parseHHMMToMinutes(sunset);
  return (
    circularDiffMinutes(p, sr) <= ALIGNMENT_WINDOW_MIN ||
    circularDiffMinutes(p, ss) <= ALIGNMENT_WINDOW_MIN
  );
}

// ---------------------- main ----------------------

export async function calculateFishingForecast(
  month: number,
  year: number,
  location: Location
): Promise<MonthlyForecast> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: FishingDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);

    const phaseVal = getMoonPhaseValue(date);
    const solar = getSolarTimes(date, location.latitude, location.longitude);
    const peaks = getSolunarPeaks(phaseVal, solar.solarNoon);

    // Base: strong near New/Full, weaker near quarters
    const phaseImpact = (Math.cos(phaseVal * Math.PI * 4) + 1) / 2;
    let baseScore = 50 + phaseImpact * 40;

    // small bump right at New/Full
    if (phaseVal < 0.05 || phaseVal > 0.95 || (phaseVal > 0.45 && phaseVal < 0.55)) {
      baseScore += 5;
    }

    // Solar–Lunar Alignment bonus (stacking with sunrise/sunset)
    const alignmentBonus = computeAlignmentBonus({
      sunrise: solar.sunrise,
      sunset: solar.sunset,
      majors: peaks.major,
      minors: peaks.minor,
    });

    const finalScore = Math.min(100, Math.floor(baseScore + alignmentBonus));

    // Hourly curve: boosts aligned peaks stronger than non-aligned
    const hourlyActivity: number[] = [];

    const sunriseMin = parseHHMMToMinutes(solar.sunrise);
    const sunsetMin = parseHHMMToMinutes(solar.sunset);

    const majorsMin = peaks.major.map(parseHHMMToMinutes);
    const minorsMin = peaks.minor.map(parseHHMMToMinutes);

    for (let h = 0; h < 24; h++) {
      const hMin = h * 60;
      let hScore = 18;

      // Solar crepuscular bumps
      for (const anchor of [sunriseMin, sunsetMin]) {
        const diff = circularDiffMinutes(hMin, anchor);
        if (diff < 120) hScore += (120 - diff) * (20 / 120);
      }

      // Major peaks (strong)
      for (let i = 0; i < peaks.major.length; i++) {
        const t = peaks.major[i];
        const peakMin = majorsMin[i];
        const diff = circularDiffMinutes(hMin, peakMin);

        const aligned = isAligned(t, solar.sunrise, solar.sunset);
        const amp = aligned ? 40 + HOUR_ALIGN_BOOST_MAJOR : 40;

        if (diff < 90) hScore += (90 - diff) * (amp / 90);
      }

      // Minor peaks (moderate)
      for (let i = 0; i < peaks.minor.length; i++) {
        const t = peaks.minor[i];
        const peakMin = minorsMin[i];
        const diff = circularDiffMinutes(hMin, peakMin);

        const aligned = isAligned(t, solar.sunrise, solar.sunset);
        const amp = aligned ? 18 + HOUR_ALIGN_BOOST_MINOR : 18;

        if (diff < 60) hScore += (60 - diff) * (amp / 60);
      }

      hourlyActivity.push(Math.min(100, Math.max(10, Math.floor(hScore))));
    }

    days.push({
      day: d,
      score: finalScore,
      moonPhase: getMoonPhaseName(phaseVal),
      moonPhaseValue: phaseVal,
      bestTimes: peaks.major,
      hourlyActivity,
      events: [
        { type: "sunrise", time: solar.sunrise, label: "Sunrise" },
        { type: "sunset", time: solar.sunset, label: "Sunset" },
        { type: "moonrise", time: peaks.rise, label: "Moonrise" },
        { type: "moonset", time: peaks.set, label: "Moonset" },
        { type: "major", time: peaks.major[0], label: "Major" },
        { type: "major", time: peaks.major[1], label: "Major" },
        { type: "minor", time: peaks.minor[0], label: "Minor" },
        { type: "minor", time: peaks.minor[1], label: "Minor" },
      ],
      weather: generateWeather(date, location),
    });
  }

  return { month, year, days };
}
