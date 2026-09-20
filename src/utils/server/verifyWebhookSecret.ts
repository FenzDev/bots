import express from 'express';
import { TELEGRAM_WEBHOOK_SECRET } from '../../config/env.js';

export function verifyWebhookSecret() {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const receivedSecret = req.header(
      "X-Telegram-Bot-Api-Secret-Token",
    );

    if (receivedSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return res.sendStatus(403);
    }

    next();
  };
}