import express from "express";
import { NODE_ENV, PORT } from "./config/env";
import logger from "./lib/logger";
import "./utils/error";

function runWebhookServer() {
  const app = express();
  app.use();

  app.listen(PORT, (err) => {
    if (err) throw err;
    logger.info('Server is running at ');
  });
}

function runLongPooling() {
  
}

logger.info(`----------------------------`)
logger.info(`  Fenz Study Helper Bots !  `)
logger.info(`----------------------------`)
logger.info(`> ${NODE_ENV.toUpperCase()}`);
if (NODE_ENV === 'production'){
  runWebhookServer();
} else if (NODE_ENV === 'development') {
  runLongPooling();
} else if (NODE_ENV === 'test') {
  // tests not implemented
  process.exit(0);
}

