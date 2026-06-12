const { Bot, Context } = require("grammy");
const { getStorage, modifyStorage } = require("../services/storage");
const { post } = require("axios");
const throwError = require("../services/throwError");
const { recordChatMessage } = require("./chathistory");

let modelId = 0;
/**@type {Date|null} */
let lastTimeAiWasRequested = null;

function aiKeys() {
  return [
    process.env.GEMINI_PROJ1_API_KEY,
    process.env.GEMINI_PROJ2_API_KEY,
    process.env.GEMINI_PROJ3_API_KEY,
  ].filter(Boolean);
}

/**
 * @param {Context} ctx
 * @return {{replies:[{appendToLTM, text : String}]}}
 */
async function aiReply(ctx) {
  const isPrvGroup = ctx.chat.id === Number(getStorage().constants.groups.boys);
  const isL2Group = ctx.chat.id === Number(getStorage().constants.groups.l2.id);
  if (!isPrvGroup && !isL2Group) return;

  let userStrId = "" + ctx.from.id;
  userStrId = userStrId.substring(userStrId.length - 5);
  const chatContext = {
    LTMemory: getStorage().ltc?.ai?.ltm ?? "",
    otherMsgs:
      ctx.chat?.id === getStorage().constants.groups.l2.id
        ? getStorage().ltc.chatHistory["l2"]
        : isPrvGroup
          ? getStorage().ltc.chatHistory["boys"]
          : [],
    mention: {
      userDispName: ctx.from.first_name ?? "" + " " + ctx.from.last_name ?? "",
      userId: userStrId,
      text: ctx.msg.text,
      datetime: new Date(ctx.msg.date).toLocaleString("en-GB", {
        timeZone: "Africa/Algiers",
        dateStyle: "full",
        timeStyle: "medium",
      }),
      isVoice: ctx.msg.voice == true ? true : undefined,
      hasAttch: ctx.msg.document ?? undefined,
      hasPhoto: ctx.msg.photo ?? undefined,
      msgId: ctx.msg.message_id,
      replyToMsg: ctx.msg.reply_to_message?.message_id ?? undefined,
    },
  };

  const keys = aiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKeyIndex = (modelId + attempt) % keys.length;
    try {
      const result = await post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
        {
          contents: [
            {
              parts: [
                {
                  text:
                    getStorage().constants.promptTexts[
                      isPrvGroup ? "boysHeader" : "l2Header"
                    ] + JSON.stringify(chatContext, null, null),
                },
              ],
            },
          ],
        },
        { headers: { "X-goog-api-key": keys[currentKeyIndex] } },
      );

      modelId = currentKeyIndex;
      try {
        return JSON.parse(result.data.candidates[0].content.parts[0].text);
      } catch {
        return;
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429 || status === 503) {
        modelId = (currentKeyIndex + 1) % keys.length;
        continue;
      }
      throw err;
    }
  }
  return;
}

let timeAiWillBeOffCooldown = Date.now();
const waitDurationForAi = 60;
let aiRequestInFlight = false;
let aiPendingCtx = null;
let aiRetryTimeout = null;
const pendingAiMsgKeys = new Set();
const processedAiMsgKeys = new Map();
const processedAiTtlMs = 10 * 60 * 1000;

function cleanupProcessedAiKeys() {
  const now = Date.now();
  for (const [msgKey, seenAt] of processedAiMsgKeys.entries()) {
    if (now - seenAt > processedAiTtlMs) processedAiMsgKeys.delete(msgKey);
  }
}

function scheduleAiRetry(ctx, delayMs) {
  const msgKey = `${ctx.chat.id}:${ctx.msg?.message_id ?? "unknown"}`;
  if (pendingAiMsgKeys.has(msgKey) || processedAiMsgKeys.has(msgKey)) return;
  pendingAiMsgKeys.add(msgKey);
  aiPendingCtx = ctx;
  if (aiRetryTimeout) return;

  aiRetryTimeout = setTimeout(async () => {
    const pendingCtx = aiPendingCtx;
    aiPendingCtx = null;
    aiRetryTimeout = null;
    if (!pendingCtx) return;

    try {
      await processAiRequest(pendingCtx);
    } catch (err) {
      await throwError(err);
    }
  }, delayMs);
}

/**
 *
 * @param {Context} ctx
 * @param {import("grammy").NextFunction} next
 * @returns
 */
async function processAiRequest(ctx) {
  if (
    ctx.chat.id !== getStorage().constants.groups.boys &&
    ctx.chat.id !== getStorage().constants.groups.l2.id
  ) {
    return;
  }
  cleanupProcessedAiKeys();

  const currentMsgKey = `${ctx.chat.id}:${ctx.msg?.message_id ?? "unknown"}`;
  if (processedAiMsgKeys.has(currentMsgKey)) {
    return;
  }

  pendingAiMsgKeys.delete(currentMsgKey);

  let distance;

  if ((distance = timeAiWillBeOffCooldown - Date.now()) > 0) {
    scheduleAiRetry(ctx, distance);
    return;
  }

  if (aiRequestInFlight) {
    scheduleAiRetry(ctx, 500);
    return;
  }

  aiRequestInFlight = true;
  try {
    processedAiMsgKeys.set(currentMsgKey, Date.now());
    await ctx.api.sendChatAction(ctx.chat.id, "typing");

    const resAiReply = await aiReply(ctx);
    if (!resAiReply) return;

    timeAiWillBeOffCooldown = Date.now() + waitDurationForAi * 1000;

    const sentTexts = new Set();
    await Promise.all(
      resAiReply.replies.map(async (reply) => {
        try {
          if (!reply?.text || sentTexts.has(reply.text.trim())) return;
          sentTexts.add(reply.text.trim());

          await modifyStorage(async (storage) => {
            storage.ltc.ai = storage.ltc.ai ?? {};
            storage.ltc.ai.ltm = storage.ltc.ai.ltm ?? "";
            if (reply.appendToLTM && reply.appendToLTM != "") {
              storage.ltc.ai.ltm += ". " + reply.appendToLTM;
              await ctx.api.sendMessage(
                storage.constants.ownerId,
                "New LT-Memory: " + reply.appendToLTM,
              );
            }
          });
          let msg;
          try {
            msg = await ctx.api.sendMessage(ctx.chatId, reply.text, {
              parse_mode: "Markdown",
              reply_parameters: {
                chat_id: ctx.chatId,
                message_id: reply.replyTo,
              },
            });
          } catch (err) {
            msg = await ctx.api.sendMessage(ctx.chatId, reply.text, {
              reply_parameters: {
                chat_id: ctx.chatId,
                message_id: reply.replyTo,
              },
            });
          }
          await recordChatMessage(
            ctx.chat?.id === getStorage().constants.groups.boys
              ? "boys"
              : ctx.chat?.id === getStorage().constants.groups.l2.id
                ? "l2"
                : null,
            {
              userDispName: "ChillBot",
              ai: true,
              text: msg.text,
              msgId: msg.message_id,
              datetime: new Date(ctx.msg.date * 1000).toLocaleString("en-GB", {
                timeZone: "Africa/Algiers",
                dateStyle: "full",
                timeStyle: "medium",
              }),
              replyToMsg: ctx.msg.reply_to_message?.message_id ?? undefined,
            },
          );
        } catch (err) {
          await throwError(err);
        }
      }),
    );
  } finally {
    aiRequestInFlight = false;
  }
}

/**
 * @param {Bot} bot
 */
async function init(bot) {
  bot.on("msg::mention", async (ctx, next) => {
    try {
      if (!(new RegExp(/@cs_chill_bot/).exec(ctx.msg.text)?.length > 0)) {
        return next();
      }
      await processAiRequest(ctx);
    } catch (err) {
      await throwError(err);
    }
    try {
      await next();
    } catch (err) {
      throwError();
    }
  });

  // bot.on("msg", async (ctx, next) => {
  //   try {
  //     if (
  //       ctx.message.reply_to_message &&
  //       ctx.message.reply_to_message.from.id === bot.botInfo?.id
  //     )
  //       await processAiRequest(ctx);
  //   } catch (err) {
  //     await throwError();
  //   }
  //   try {
  //     await next();
  //   } catch (err) {throwError();}
  // });
}

module.exports = { init };
