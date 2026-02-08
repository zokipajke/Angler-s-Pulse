
import { GoogleGenAI, Type } from "@google/genai";
import { MonthlyForecast, Location } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function fetchMonthlyForecast(
  month: number,
  year: number,
  location: Location
): Promise<MonthlyForecast> {
  const prompt = `
    Provide a concise fishing forecast for ${month}/${year} at ${location.latitude}, ${location.longitude}.
    
    Use Google Search for actual meteorological data.
    
    For EACH day:
    1. Score (0-100), Moon Phase.
    2. 24-hour activity (0-100).
    3. Solar/Lunar events (HH:mm).
    4. Weather: Temp H/L, Pressure + Trend, Wind Speed/Dir, Conditions.
    
    CRITICAL: Keep all strings (conditions, moonPhase, event labels) under 15 characters to avoid token overflow. Return strictly compact JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.NUMBER },
          year: { type: Type.NUMBER },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.NUMBER },
                score: { type: Type.NUMBER },
                moonPhase: { type: Type.STRING },
                bestTimes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                hourlyActivity: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                },
                events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      time: { type: Type.STRING },
                      label: { type: Type.STRING }
                    }
                  }
                },
                weather: {
                  type: Type.OBJECT,
                  properties: {
                    tempHigh: { type: Type.NUMBER },
                    tempLow: { type: Type.NUMBER },
                    pressure: { type: Type.NUMBER },
                    pressureTrend: { type: Type.STRING, enum: ['rising', 'falling', 'steady'] },
                    windSpeed: { type: Type.NUMBER },
                    windDirection: { type: Type.STRING },
                    conditions: { type: Type.STRING }
                  },
                  required: ["tempHigh", "tempLow", "pressure", "pressureTrend", "windSpeed", "windDirection", "conditions"]
                }
              },
              required: ["day", "score", "moonPhase", "weather", "bestTimes", "hourlyActivity", "events"]
            }
          }
        },
        required: ["month", "year", "days"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to get forecast data from Gemini.");
  }

  return JSON.parse(response.text.trim()) as MonthlyForecast;
}
