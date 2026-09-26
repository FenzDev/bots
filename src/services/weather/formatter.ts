import { ClothingAdvice, getClothingAdvice } from "./clothing.js";
import {
  describeWeatherCode,
} from "./weatherCodes.js";
import {
  DailyWeather,
  WeatherForecast,
} from "./types.js";

const DAY_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatTomorrowWeather(
  forecast: WeatherForecast,
): string {
  const weather = forecast.days[0];

  if (!weather) {
    throw new Error("Forecast does not contain tomorrow's weather.");
  }

  const description = describeWeatherCode(weather.weatherCode);

  const clothing = getClothingAdvice(weather);

  const warnings = clothing.warnings.length > 0
    ? `\n\n⚠️ ${clothing.warnings.join("\n⚠️ ")}`
    : "";

  return [
    `🌤️ <b>Tomorrow's Weather</b>`,
    ``,
    `📍 <b>${escapeHtml(forecast.location.name)}</b>`,
    ``,
    `${description.emoji} <b>${description.description}</b>`,
    ``,
    `🌡️ ${formatTemperature(weather.temperatureMin)} → ${formatTemperature(weather.temperatureMax)}`,
    `🥵 Feels like ${formatTemperature(weather.apparentTemperatureMin)} → ${formatTemperature(weather.apparentTemperatureMax)}`,
    `🌧️ Rain chance: ${Math.round(weather.precipitationProbability)}%`,
    `💧 Precipitation: ${formatNumber(weather.precipitation)} mm`,
    `💨 Wind: up to ${Math.round(weather.windSpeedMax)} km/h`,
    ``,
    `👕 <b>What to wear</b>`,
    clothing.text,
    warnings,
  ].join("\n");
}

export function formatNextWeekWeather(
  forecast: WeatherForecast,
): string {
  if (forecast.days.length === 0) {
    throw new Error("Forecast contains no days.");
  }

  const lines: string[] = [
    `📅 <b>Weather — Next 7 Days</b>`,
    ``,
    `📍 <b>${escapeHtml(forecast.location.name)}</b>`,
    ``,
  ];

  for (const weather of forecast.days) {
    lines.push(formatWeeklyDay(weather));
  }

  const overview = buildWeeklyOverview(forecast.days);

  lines.push("");
  lines.push(`📝 <b>Overall</b>`);
  lines.push(overview);

  return lines.join("\n");
}

function formatWeeklyDay(
  weather: DailyWeather,
): string {
  const description = describeWeatherCode(weather.weatherCode);

  const date = DAY_FORMATTER.format(
    new Date(`${weather.date}T12:00:00`),
  );

  const rain = Math.round(weather.precipitationProbability);

  return [
    `${description.emoji} <b>${date}</b>`,
    `${formatTemperature(weather.temperatureMin)} / ${formatTemperature(weather.temperatureMax)}`,
    `${description.description}`,
    `🌧️ ${rain}%`,
    `💨 ${Math.round(weather.windSpeedMax)} km/h`,
  ].join(" — ");
}

function buildWeeklyOverview(
  days: DailyWeather[],
): string {
  const minTemperature = Math.min(
    ...days.map((day) => day.temperatureMin),
  );

  const maxTemperature = Math.max(
    ...days.map((day) => day.temperatureMax),
  );

  const maxRainProbability = Math.max(
    ...days.map((day) => day.precipitationProbability),
  );

  const totalPrecipitation = days.reduce(
    (total, day) => total + day.precipitation,
    0,
  );

  const parts = [
    `Temperatures from ${Math.round(minTemperature)}°C to ${Math.round(maxTemperature)}°C.`,
  ];

  if (maxRainProbability >= 60) {
    parts.push(
      `Rain is likely on at least one day (up to ${Math.round(maxRainProbability)}%).`,
    );
  } else if (maxRainProbability >= 30) {
    parts.push(
      `There is some chance of rain during the week.`,
    );
  } else {
    parts.push(
      `Rain chances look generally low.`,
    );
  }

  if (totalPrecipitation > 20) {
    parts.push(
      `Around ${formatNumber(totalPrecipitation)} mm of precipitation is forecast overall.`,
    );
  }

  return parts.join(" ");
}

function formatTemperature(value: number): string {
  return `${Math.round(value)}°C`;
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}