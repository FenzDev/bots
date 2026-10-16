import { Bot} from 'grammy'

export default (async (bot:Bot)=>{
  bot.callbackQuery(/^list:(\w+)$/, (ctx, next)=>{
    
  })  
})
