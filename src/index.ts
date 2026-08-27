import express from "express";
import { NODE_ENV, PORT } from "./config/env";
import logger from "./lib/logger";
import "./utils/error";
import { handleBots } from "./lib/bots";

async function runServer() {
  const app = express();
  app.use();

  app.listen(PORT, (err) => {
    if (err) throw err;
    logger.info('Server is running at ');
  });
}

async function runLongPooling() {
  await handleBots();
}

logger.info(`----------------------------`)
logger.info(`  Fenz Study Helper Bots !  `)
logger.info(`----------------------------`)
logger.info(`> ${NODE_ENV.toUpperCase()}`);
if (NODE_ENV === 'production'){
  await runServer();
} else if (NODE_ENV === 'development') {
  await runLongPooling();
} else if (NODE_ENV === 'test') {
  // tests not implemented
  process.exit(0);
}

