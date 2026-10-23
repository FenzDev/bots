import { Bot} from 'grammy'

export default (async (bot:Bot)=>{
  bot.command("res",(ctx,next)=>{
    
    return next();
  }) 
})
