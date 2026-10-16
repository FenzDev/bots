import { Bot} from 'grammy'

export default (async (bot:Bot)=>{
  bot.callbackQuery(/^ignore$/, (ctx, next)=>{
    
  })  
})
