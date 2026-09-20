import express from "express";
import {
  NODE_ENV,
  PORT,
  TELEGRAM_WEBHOOK_SECRET,
  WEB_URL,
} from "./config/env";
import logger from "./lib/logger";
import "./utils/error";
import { chillBot, handleBots, forEachBot } from "./lib/bots";
import { Bot, webhookCallback } from "grammy";
import { connectDatabase } from "./lib/mongodb";
import { handleSchedules } from "./lib/cron-schedules";
import { verifyWebhookSecret } from "./utils/server/verifyWebhookSecret";

const ALLOWED_UPDATES = [
  "message",
  "message_reaction",
  "poll",
  "poll_answer",
  "chat_member",
  "callback_query",
] as const;

async function runServer() {
  const app = express();

  // Healthcheck
  app.get("/", (_, res) => {
    res.send("Bot is alive!");
  });

  // Register webhook routes
  await forEachBot(async (bot, botName) => {
    const webhookPath = `/webhook/${botName}`;

    app.use(
      webhookPath,
      verifyWebhookSecret(),
      webhookCallback(bot, "express"),
    );
  });

  // Start HTTP server first
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });

  // Configure Telegram webhooks after server is listening
  try {
    await forEachBot(async (bot, botName) => {
      const webhookUrl = `${WEB_URL}/webhook/${botName}`;

      await bot.api.setWebhook(webhookUrl, {
        secret_token: TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ALLOWED_UPDATES,
      });

      logger.info(
        {
          botName,
          webhookUrl,
        },
        "Telegram webhook configured",
      );
    });
  } catch (err) {
    logger.error(err, "Failed to configure Telegram webhooks");
  }

  // Optional self-ping
  setInterval(
    async () => {
      try {
        await fetch(WEB_URL);
      } catch (err) {
        logger.error(err, "Self-Ping failed");
      }
    },
    10 * 60 * 1000,
  );

  return server;
}

async function runLongPolling() {
  logger.info("Starting development bot polling.");

  await chillBot.start({
    allowed_updates: ALLOWED_UPDATES,
  });
}

function handleError(bot: Bot, err: unknown) {
  logger.error({ err, bot }, "Bot error");
}

function handleConfig(bot: Bot) {
  bot.catch((err) => handleError(bot, err));

  bot.api.config.use(async (prev, method, payload, signal) => {
    logger.trace({ method, payload }, "Telegram request");

    const result = await prev(method, payload, signal);

    logger.trace({ method, result }, "Telegram response");

    return result;
  });
}

logger.info("----------------------------");
logger.info("  Fenz Study Helper Bots !  ");
logger.info("----------------------------");
logger.info(`> ${NODE_ENV.toUpperCase()}`);

await connectDatabase();
await handleBots(handleConfig);
await handleSchedules();

if (NODE_ENV === "production") {
  await runServer();
} else if (NODE_ENV === "development") {
  await runLongPolling();
} else if (NODE_ENV === "test") {
  process.exit(0);
}
