import { Bot } from "grammy";
import {
  Resource,
  resourceFiles,
  resources,
} from "../../../repositories/resource.repository.js";
import { WithId } from "mongodb";

export default async (bot: Bot) => {
  bot.command("res", async (ctx, next) => {
    const resFolderName = [
      "res",
      ...ctx.match.split(" ").map((part) => decodeURIComponent(part)),
    ].join("/");

    const res = await resources.findResourcesByNamePrefix(resFolderName);

    await displayResourcesList(res);
    return next();
  });

  async function displayResourcesList(res: WithId<Resource>[]) {
    
  }

};
