import { Bot} from 'grammy'
import { replyToMessage } from '../../../helpers/reply-to-message'

export default (async (bot:Bot)=>{
  bot.command("edt", async (ctx,next)=>{
    await replyToMessage(ctx, "Work in progress", {
      receiver_user_id: ctx.from?.id,
      reply_parameters : {
        ephemeral_message_id: ctx.message?.message_id,
      }
    })
  })
})
