import { Bot } from "grammy";

import { getWeatherForecast } from "./openMeteo.js";
import {
  formatNextWeekWeather,
  formatTomorrowWeather,
} from "./formatter.js";
import { WeatherLocation } from "./types.js";

export async function broadcastWeatherTomorrow(
  bot: Bot,
  location: WeatherLocation,
): Promise<void> {
  const forecast = await getWeatherForecast(location, 1);

  const message = formatTomorrowWeather(forecast);

  await sendToAllChats(bot, location, message);
}

export async function broadcastWeatherNextWeek(
  bot: Bot,
  location: WeatherLocation,
): Promise<void> {
  const forecast = await getWeatherForecast(location, 7);

  const message = formatNextWeekWeather(forecast);

  await sendToAllChats(bot, location, message);
}

async function sendToAllChats(
  bot: Bot,
  location: WeatherLocation,
  message: string,
): Promise<void> {
    // TODO : Set weather broadcast chat id through db
    try {
      await bot.api.sendMessage(0, message, {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error(
        `Failed to send weather to chat ${0}:`,
        error,
      );
    }
}