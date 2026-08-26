import { z } from "zod";

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

export type TelegramTarget = z.infer<typeof telegramTargetSchema>;