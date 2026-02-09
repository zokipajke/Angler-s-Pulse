
export interface SolarLunarEvent {
  type: 'sunrise' | 'sunset' | 'moonrise' | 'moonset' | 'major' | 'minor';
  time: string;
  label: string;
}

export interface WeatherInfo {
  tempHigh: number;
  tempLow: number;
  pressure: number; // in hPa/mb
  pressureTrend: 'rising' | 'falling' | 'steady';
  windSpeed: number; // in km/h
  windDirection: string;
  conditions: string;
}

export interface FishingDay {
  day: number;
  score: number;
  moonPhase: string;
  moonPhaseValue: number; // 0 to 1 representing the lunar cycle position
  bestTimes: string[];
  hourlyActivity: number[];
  events: SolarLunarEvent[];
  weather: WeatherInfo;
}

export interface MonthlyForecast {
  month: number;
  year: number;
  days: FishingDay[];
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}
