import express from "express";
import { MONGODB_URI, NODE_ENV, PORT } from "./config/env";
import logger from "./lib/logger";
import "./utils/error";
import { chillBot, guardBot, handleBots, timetableBot } from "./lib/bots";
import { Bot } from "grammy";
import { connectDatabase } from "./lib/mongodb";

async function runServer() {
  const app = express();
  app.use();

  app.listen(PORT, (err) => {
    if (err) throw err;
    logger.info("Server is running at ");
  });
}

async function runLongPolling() {
  logger.info("Starting development bot polling.");

  await chillBot.start({
    allowed_updates: [
      "message",
      "message_reaction",
      "poll",
      "poll_answer",
      "chat_member",
      "callback_query",
    ],
  });
}

function handleError(bot: Bot, err: any) {
  logger.error({ err, bot });
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

logger.info(`----------------------------`);
logger.info(`  Fenz Study Helper Bots !  `);
logger.info(`----------------------------`);
logger.info(`> ${NODE_ENV.toUpperCase()}`);

await connectDatabase();
 
await handleBots(handleConfig);

if (NODE_ENV === "production") {
  await runServer();
} else if (NODE_ENV === "development") {
  await runLongPolling();
} else if (NODE_ENV === "test") {
  // tests not implemented
  process.exit(0);
}
