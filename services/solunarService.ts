import { MonthlyForecast, Location, FishingDay, SolarLunarEvent, WeatherInfo } from "../types";

/**
 * Robust offline solunar calculation service.
 * Corrected for Longitude and Lunar Day drift.
 */

const SYNODIC_MONTH = 29.530588853;
// Updated reference to a New Moon closer to 2026 to minimize drift
const NEW_MOON_REF = new Date('2024-12-30T22:27:00Z').getTime();

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
    pressureTrend: seededRandom() > 0.6 ? 'rising' : (seededRandom() > 0.3 ? 'falling' : 'steady'),
    windSpeed: Math.floor(seededRandom() * 25),
    windDirection: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(seededRandom() * 8)],
    conditions: seededRandom() > 0.7 ? "Partly Cloudy" : (seededRandom() > 0.4 ? "Clear" : "Overcast")
  };
}

/**
 * Improved Solar approximation incorporating Longitude and Timezone
 */
function getSolarTimes(date: Date, lat: number, lon: number): { sunrise: string, sunset: string, solarNoon: number } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  
  // Standard solar declination math
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
    const mm = Math.floor(((h + 24) % 1) * 60);
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  return { sunrise: format(sunriseHour), sunset: format(sunsetHour), solarNoon };
}

function getSolunarPeaks(phase: number, solarNoon: number): { major: string[], minor: string[], rise: string, set: string } {
  const moonTransit = (solarNoon + (phase * 24)) % 24;
  
  const major1 = moonTransit;
  const major2 = (moonTransit + 12.42) % 24; 
  const minor1 = (moonTransit - 6.21 + 24) % 24;
  const minor2 = (moonTransit + 6.21) % 24;
  
  // Approximate moonrise/set based on transit
  const moonRise = (moonTransit - 6.21 + 24) % 24;
  const moonSet = (moonTransit + 6.21) % 24;

  const format = (h: number) => {
    const hh = Math.floor((h + 24) % 24);
    const mm = Math.floor(((h + 24) % 1) * 60);
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  return {
    major: [format(major1), format(major2)].sort(),
    minor: [format(minor1), format(minor2)].sort(),
    rise: format(moonRise),
    set: format(moonSet)
  };
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
    const phaseVal = getMoonPhaseValue(date);
    const solar = getSolarTimes(date, location.latitude, location.longitude);
    const peaks = getSolunarPeaks(phaseVal, solar.solarNoon);
    
    const phaseImpact = (Math.cos(phaseVal * Math.PI * 4) + 1) / 2; 
    let baseScore = 50 + (phaseImpact * 45);

    if (phaseVal < 0.05 || phaseVal > 0.95 || (phaseVal > 0.45 && phaseVal < 0.55)) {
        baseScore += 5;
    }

    const finalScore = Math.min(100, Math.floor(baseScore));

    const hourlyActivity: number[] = [];
    const sunHours = [parseFloat(solar.sunrise.split(':')[0]), parseFloat(solar.sunset.split(':')[0])];
    const majorHours = peaks.major.map(t => parseFloat(t.split(':')[0]));

    for (let h = 0; h < 24; h++) {
      let hScore = 20; 
      sunHours.forEach(sh => {
        const diff = Math.min(Math.abs(h - sh), 24 - Math.abs(h - sh));
        if (diff < 2) hScore += (2 - diff) * 20;
      });
      majorHours.forEach(mh => {
        const diff = Math.min(Math.abs(h - mh), 24 - Math.abs(h - mh));
        if (diff < 1.5) hScore += (1.5 - diff) * 40;
      });
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
        { type: 'sunrise', time: solar.sunrise, label: 'Sunrise' },
        { type: 'sunset', time: solar.sunset, label: 'Sunset' },
        { type: 'moonrise', time: peaks.rise, label: 'Moonrise' },
        { type: 'moonset', time: peaks.set, label: 'Moonset' },
        { type: 'major', time: peaks.major[0], label: 'Major' },
        { type: 'major', time: peaks.major[1], label: 'Major' },
        { type: 'minor', time: peaks.minor[0], label: 'Minor' },
        { type: 'minor', time: peaks.minor[1], label: 'Minor' },
      ],
      weather: generateWeather(date, location)
    });
  }

  return { month, year, days };
}