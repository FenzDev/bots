import { Bot} from 'grammy'

export default (async (bot:Bot)=>{
  bot.on('message:document', (ctx,next)=>{
    return next();
  });

  bot.on('message:photo', (ctx,next)=>{
    return next();
  }) 
})
