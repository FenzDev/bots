export interface WeatherDescription {
  emoji: string;
  description: string;
}

export function describeWeatherCode(
  code: number,
): WeatherDescription {
  switch (code) {
    case 0:
      return {
        emoji: "☀️",
        description: "Clear sky",
      };

    case 1:
      return {
        emoji: "🌤️",
        description: "Mainly clear",
      };

    case 2:
      return {
        emoji: "⛅",
        description: "Partly cloudy",
      };

    case 3:
      return {
        emoji: "☁️",
        description: "Overcast",
      };

    case 45:
    case 48:
      return {
        emoji: "🌫️",
        description: "Foggy",
      };

    case 51:
    case 53:
    case 55:
      return {
        emoji: "🌦️",
        description: "Drizzle",
      };

    case 56:
    case 57:
      return {
        emoji: "🌧️",
        description: "Freezing drizzle",
      };

    case 61:
    case 63:
    case 65:
      return {
        emoji: "🌧️",
        description: "Rain",
      };

    case 66:
    case 67:
      return {
        emoji: "🌧️",
        description: "Freezing rain",
      };

    case 71:
    case 73:
    case 75:
    case 77:
      return {
        emoji: "🌨️",
        description: "Snow",
      };

    case 80:
    case 81:
    case 82:
      return {
        emoji: "🌦️",
        description: "Rain showers",
      };

    case 85:
    case 86:
      return {
        emoji: "🌨️",
        description: "Snow showers",
      };

    case 95:
      return {
        emoji: "⛈️",
        description: "Thunderstorm",
      };

    case 96:
    case 99:
      return {
        emoji: "⛈️",
        description: "Thunderstorm with hail",
      };

    default:
      return {
        emoji: "🌡️",
        description: "Unknown conditions",
      };
  }
}