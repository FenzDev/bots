export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface OpenMeteoDailyResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;

  daily: {
    time: string[];

    weather_code: number[];

    temperature_2m_max: number[];
    temperature_2m_min: number[];

    apparent_temperature_max: number[];
    apparent_temperature_min: number[];

    precipitation_probability_max: number[];
    precipitation_sum: number[];

    wind_speed_10m_max: number[];

    sunrise: string[];
    sunset: string[];
  };
}

export interface DailyWeather {
  date: string;

  weatherCode: number;

  temperatureMax: number;
  temperatureMin: number;

  apparentTemperatureMax: number;
  apparentTemperatureMin: number;

  precipitationProbability: number;
  precipitation: number;

  windSpeedMax: number;

  sunrise: string;
  sunset: string;
}

export interface WeatherForecast {
  location: WeatherLocation;
  days: DailyWeather[];
}