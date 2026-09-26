import { DailyWeather } from "./types.js";

export interface ClothingAdvice {
  text: string;
  warnings: string[];
}

export function getClothingAdvice(
  weather: DailyWeather,
): ClothingAdvice {
  const {
    apparentTemperatureMin: min,
    apparentTemperatureMax: max,
    precipitationProbability: rainProbability,
    windSpeedMax: wind,
    weatherCode,
  } = weather;

  const suggestions: string[] = [];
  const warnings: string[] = [];

  // Temperature
  if (max < 5) {
    suggestions.push("a heavy coat");
    suggestions.push("warm layers");

    if (min < 0) {
      suggestions.push("gloves");
      suggestions.push("a hat");
    }
  } else if (max < 12) {
    suggestions.push("a warm jacket");
    suggestions.push("long trousers");
  } else if (max < 18) {
    suggestions.push("a light jacket or sweater");
    suggestions.push("long trousers");
  } else if (max < 24) {
    suggestions.push("light layers");
  } else if (max < 30) {
    suggestions.push("light, breathable clothes");
  } else {
    suggestions.push("very light, breathable clothes");

    if (max >= 35) {
      warnings.push("Very hot conditions — stay hydrated and limit prolonged sun exposure.");
    }
  }

  // Rain
  if (rainProbability >= 60) {
    suggestions.push("an umbrella or rain jacket");
    warnings.push(
      `High chance of precipitation (${Math.round(rainProbability)}%).`,
    );
  } else if (rainProbability >= 30) {
    suggestions.push("an umbrella just in case");
  }

  // Wind
  if (wind >= 35) {
    warnings.push(`Strong winds possible (up to ${Math.round(wind)} km/h).`);
  } else if (wind >= 25) {
    suggestions.push("a wind-resistant outer layer");
  }

  // Thunderstorm codes
  if (weatherCode >= 95) {
    warnings.push("Thunderstorms are possible.");
  }

  // Remove duplicate suggestions.
  const uniqueSuggestions = [...new Set(suggestions)];

  return {
    text: buildClothingText(uniqueSuggestions),
    warnings,
  };
}

function buildClothingText(
  suggestions: string[],
): string {
  if (suggestions.length === 0) {
    return "Dress comfortably for the conditions.";
  }

  if (suggestions.length === 1) {
    return `Wear ${suggestions[0]}.`;
  }

  const last = suggestions[suggestions.length - 1];

  return `Wear ${suggestions.slice(0, -1).join(", ")}, and ${last}.`;
}