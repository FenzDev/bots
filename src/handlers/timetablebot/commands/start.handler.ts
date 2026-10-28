import { Bot } from "grammy";

export default async (bot: Bot) => {
  bot.command("start", async (ctx, next) => {
    const startMsg = `
Welcome to Timetable bot.
By @moncef_fnn
You can download current timetable as pdf through /edt .
`;
    await ctx.reply(startMsg);

    return next();
  });
};
