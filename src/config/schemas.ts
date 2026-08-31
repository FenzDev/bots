import { z } from "zod";
import { CronExpressionParser } from "cron-parser";


export const telegramTargetSchema = z
  .string()
  .trim()
  .regex(
    /^-?\d+(?:\/\d+)?$/,
    "Expected a 'chat ID' or 'chat ID/message thread ID'"
  )
  .transform((value) => {
    const [chatId, messageThreadId] = value.split("/");

    return {
      chatId,
      messageThreadId: messageThreadId
        ? Number(messageThreadId)
        : undefined,
    };
  });

export const cronSchema = z.string().trim().refine(
  (value) => {
    try {
      CronExpressionParser.parse(value);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: "Invalid cron expression",
  }
);

export type TelegramTarget = z.infer<typeof telegramTargetSchema>;