import express from "express";
import { NODE_ENV, PORT } from "./config/env";
import logger from "./lib/logger";
import "./utils/error";
import { chillBot, guardBot, handleBots, timetableBot } from "./lib/bots";

async function runServer() {
  const app = express();
  app.use();

  app.listen(PORT, (err) => {
    if (err) throw err;
    logger.info("Server is running at ");
  });
}

async function runLongPolling() {
  await handleBots();

  logger.info("Starting development bot polling..");
  
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

logger.info(`----------------------------`);
logger.info(`  Fenz Study Helper Bots !  `);
logger.info(`----------------------------`);
logger.info(`> ${NODE_ENV.toUpperCase()}`);
if (NODE_ENV === "production") {
  await runServer();
} else if (NODE_ENV === "development") {
  await runLongPolling();
} else if (NODE_ENV === "test") {
  // tests not implemented
  process.exit(0);
}
