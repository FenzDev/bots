import z from "zod";
import { AITool } from "../../types.js";
import { messages } from "../../../../repositories/message.repository.js";
import { defineTool } from "../../define-tool.js";
import { ChatbotAIContext } from "./index.js";
import { users } from "../../../../repositories/user.repository.js";

export const getMoreMessagesTool = defineTool({
  name: "getMoreMessages",
  description:
    "Retrieve more recent and earlier messages from the current chat or thread. Use this when the available conversation context is not enough to answer the user accurately, especially when the user asks to summarize messages or refers to earlier parts of the conversation.",
  schema: z.object({
    amount: z.number(),
  }),
  execute: async (context: ChatbotAIContext, args) => {
    const res = await messages.findRecent(
      { chatId: context.chatId, threadId: context.threadId },
      args.amount,
    );
    const senderIds = [...new Set(res.map((msg) => msg.senderId))];
    const existingUsers = (await Promise.all(
      senderIds.map((id) => users.findUserById(id)),
    )).filter(user=>user !== null);
    const usersObject = Object.fromEntries(
      existingUsers.map((user)=> [
        user.telegramId,
        user.lastName? `${user.firstName} ${user.lastName}`: user.firstName,
      ]),
    );
    
    return res.sort((a,b)=>a.messageId-b.messageId).map((msg) => {
        const content = 
        msg.type === 'text' ? msg.text
                 : msg.type === 'photo' ? `*photo captioned(${msg.caption})*`
                 : msg.type === 'file' ? `*file named(${msg.fileName}) captioned(${msg.caption})*`
                 : msg.type === 'voice' ? `*voice takes(${msg.duration}s)*`
                 : `*poll titled(${msg.question})*`;
        return `'${usersObject[msg.senderId]}': '${content.replaceAll("'", "")}'`;
      }).join(' \n ');
  },
});
