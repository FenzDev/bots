import { Bot} from 'grammy'

export default (async (bot:Bot)=>{
  bot.callbackQuery(/^approve:(\w+)$/, (ctx, next)=>{
    return next();
  })  
})
