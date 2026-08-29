import z from "zod";
import { AITool } from "../../types";
import { messages } from "../../../../repositories/message.repository";
import { defineTool } from "../../define-tool";

export const getMoreMessagesTool = defineTool({
  name: "getMoreMessages",
  description:
    "Get a specific amount from the last message of this thread of chat.",
  schema: z.object({
    chatId: z.number(),
    threadId: z.nullable(z.number()),
    amount: z.number(),
  }),
  execute: async (args) => {
    const res = await messages.findRecent(
      { chatId: args.chatId, threadId: args.threadId },
      args.amount,
    );
    return JSON.stringify(res);
  },
});
