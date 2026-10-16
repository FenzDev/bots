import { Bot } from "grammy";
import { pendings } from "../../repositories/pending.repository.js";
import { resources } from "../../repositories/resource.repository.js";

export default async (bot: Bot) => {
  bot.callbackQuery(/^list:(\w+)$/, async (ctx, next) => {
    ctx.answerCallbackQuery();
    const resFolderName = ctx.match[1];
    if (!resFolderName) return next();
    const list = await resources.findResourcesByNamePrefix(resFolderName);

    const resBreadcrumbs = resFolderName.replaceAll("_", "»");
    ctx.reply(
      list.length > 0
        ? `
Resources in ${resBreadcrumbs}:
${list.map(res=>res.displayName ?? res.name).join("\n")}
        `
        : `No resource found in ${resBreadcrumbs}.`,
    );

    return next();
  });
};
