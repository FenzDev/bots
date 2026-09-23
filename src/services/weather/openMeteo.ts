import {
  DailyWeather,
  OpenMeteoDailyResponse,
  WeatherForecast,
  WeatherLocation,
} from "./types.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "wind_speed_10m_max",
  "sunrise",
  "sunset",
].join(",");

export async function getWeatherForecast(
  location: WeatherLocation,
  forecastDays = 7,
): Promise<WeatherForecast> {
  const url = new URL(OPEN_METEO_URL);

  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));

  url.searchParams.set("daily", DAILY_VARIABLES);

  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");

  // Open-Meteo will return dates/times in this timezone.
  url.searchParams.set("timezone", location.timezone);

  url.searchParams.set("forecast_days", String(forecastDays));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Open-Meteo request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenMeteoDailyResponse;

  return {
    location,
    days: normalizeDailyWeather(data),
  };
}

function normalizeDailyWeather(
  data: OpenMeteoDailyResponse,
): DailyWeather[] {
  const { daily } = data;

  return daily.time.map((date, index) => ({
    date,

    weatherCode: daily.weather_code[index],

    temperatureMax: daily.temperature_2m_max[index],
    temperatureMin: daily.temperature_2m_min[index],

    apparentTemperatureMax:
      daily.apparent_temperature_max[index],

    apparentTemperatureMin:
      daily.apparent_temperature_min[index],

    precipitationProbability:
      daily.precipitation_probability_max[index],

    precipitation:
      daily.precipitation_sum[index],

    windSpeedMax:
      daily.wind_speed_10m_max[index],

    sunrise: daily.sunrise[index],
    sunset: daily.sunset[index],
  }));
}