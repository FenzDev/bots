import { Api, Context } from "grammy";

export async function replyToMessage(
  ctx: Context,
  text: string,
  options?: Parameters<Api["sendMessage"]>[2],
) {
  return await ctx.api.sendMessage(ctx.chat?.id!, text, {
    reply_parameters: { message_id: ctx.message?.message_id },
    ...options,
  });
}
