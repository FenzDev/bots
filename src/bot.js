const { Bot, webhookCallback, Context } = require("grammy");
const { t } = require("./services/i18n");
const express = require("express");
const { loadStorage, getStorage, saveStorage } = require("./services/storage");
const { checkEdt } = require("./handlers/routines/edt_watcher");
const throwError = require("./services/throwError");

// replace with your token
const isTest = process.env.IS_TEST === "true";
const token = isTest ? process.env.TEST_API_TOKEN : process.env.API_TOKEN;
const bot = new Bot(token);
// load the storage
loadStorage().then(() => {
  if (!isTest) {
    const app = express();

    // Parse Telegram updates as JSON
    app.use(express.json());

    // Tell grammY to handle updates on this route
    app.use(`/bot${token}`, webhookCallback(bot, "express"));

    // --- self-ping every 10 minutes ---
    setInterval(async () => {
      try {
        const res = await fetch(process.env.WEB_URL);
        // console.log("Ping success:", res.status);
      } catch (err) {
        console.error("Self-Ping failed:", err.message);
      }
    }, 10 * 60 * 1000); // every 10 min

    // Healthcheck
    app.get("/", (req, res) => res.send("Bot is alive!"));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Bot listening on port ${PORT}`);
    });
  }

  const handlers = [
    require("./handlers/commands"),
    // require("./handlers/deleteback"),
    require("./handlers/ui"),
    require("./handlers/contibution_collector"),
    require("./handlers/routines/edt_watcher"),
    require("./handlers/chathistory"),
    require("./handlers/aichat"),
  ];

  for (let i = 0; i < handlers.length; i++) handlers[i].init(bot);

  bot.command("fedtcheck", async (ctx) => {
    checkEdt(bot);
  });

  bot.catch(async (err) => {
    await throwError(err);
  });

  if (isTest)
    bot.start({
      allowed_updates: [
        "message",
        "message_reaction",
        "message_reaction_count",
        "callback_query",
        "message_reaction",
        "message_reaction_count",
        "chat_member",
        "channel_post",
        "edited_message",
      ],
    });
});

module.exports = { bot };
