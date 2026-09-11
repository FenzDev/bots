import { Bot, Context, InlineKeyboard, InputMediaBuilder } from "grammy";
import { InlineKeyboardMarkup, Message, Update } from "grammy/types";
import logger from "../../lib/logger";
import {
  ResourcesModule,
  resourcesModule,
} from "../../repositories/module.repository";
import {
  ResourceFileInput,
  resourceFiles,
  resources,
} from "../../repositories/resource.repository";
import { pendings } from "../../repositories/pending.repository";
import { generateTimestampId } from "../../utils/genid";
import { TELEGRAM_SUPERADMIN_ID } from "../../config/env";
import { ObjectId, WithId } from "mongodb";

export default async (bot: Bot) => {
  bot.on("message:document", async (ctx, next) => {
    await addFileAsRequest(bot, ctx, ctx.message);
    return next();
  });

  bot.on("message:video", async (ctx, next) => {
    await addFileAsRequest(bot, ctx, ctx.message);
    return next();
  });

  bot.on("message:photo", async (ctx, next) => {
    await addFileAsRequest(bot, ctx, ctx.message);
    return next();
  });
};

type SupportedMessage =
  | (Message & Update.NonChannel & Record<"document" | "from", {}>)
  | (Message & Update.NonChannel & Record<"video" | "from", {}>)
  | (Message & Update.NonChannel & Record<"photo" | "from", {}>);

const MEDIA_GROUP_DEBOUNCE_MS = 1_000;

const mediaGroupTimers = new Map<string, NodeJS.Timeout>();

function generateRequestInlineKeyboard(
  moduleInfo: ResourcesModule,
  requestMessageId: string,
  allCopyableCommand: boolean,
) {
  const commandBase = `/approve ${requestMessageId} res_${moduleInfo.semester}_${moduleInfo.name}_`;
  return allCopyableCommand
    ? new InlineKeyboard()
        .copyText("TD", `${commandBase}td`)
        .copyText("Lecture", `${commandBase}cours`)
        .copyText("TP", `${commandBase}tp`)
        .row()
        .copyText("Exercises & Exams", `${commandBase}exoexam`)
        .copyText("Resume", `${commandBase}resume`)
        .row()
        .copyText("Other", commandBase)
        .text("❌ Ignore", "ignore")
    : new InlineKeyboard()
        .text("TD", `td:${requestMessageId}`)
        .text("Lecture", `cours:${requestMessageId}`)
        .text("TP", `tp:${requestMessageId}`)
        .row()
        .text("Exercises & Exams", `exoexam:${requestMessageId}`)
        .row()
        .text("Resume", `resume:${requestMessageId}`)
        .row()
        .copyText("Other", commandBase)
        .text("Ignore", "ignore");
}

async function postRequest<TPreviewInput>(
  bot: Bot,
  moduleInfo: ResourcesModule,
  resourceId: ObjectId,
  hasImages: boolean,
  preview: () => Promise<void>,
) {
  const reviewerId = moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID;

  await preview();

  const sentRequestMsg = await bot.api.sendMessage(
    reviewerId,
    `
*Detected a shared resource !*
Module: *${moduleInfo.displayShort}*
    `.trim(),
    {
      parse_mode: "Markdown",
    },
  );

  await pendings.createPendingRequest({
    requestMessageId: sentRequestMsg.message_id,
    requestChatId: moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID,
    type: "SHARED_RESOURCE",
    resourceId: resourceId,
  });

  await bot.api.editMessageReplyMarkup(reviewerId, sentRequestMsg.message_id, {
    reply_markup: generateRequestInlineKeyboard(
      moduleInfo,
      `${sentRequestMsg.message_id}`,
      hasImages,
    ),
  });
}

async function onMediaGroupComplete(
  bot: Bot,
  moduleInfo: ResourcesModule,
  resourceId: ObjectId,
  mediaGroupId: string,
) {
  const images = await resourceFiles.findMediaGroupFiles(mediaGroupId);

  await postRequest(bot, moduleInfo, resourceId, true, async () => {
    await bot.api.forwardMessages(
      moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID,
      moduleInfo.resourcesInputChatId!,
      images.map((img) => img.telegramStoredMessageId!),
    );
  });
}

function scheduleMediaGroupProcessing(
  bot: Bot,
  moduleInfo: WithId<ResourcesModule>,
  objectId: ObjectId,
  mediaGroupId: string,
) {
  // A new message arrived for this album.
  // Cancel the previous timer.
  const existingTimer = mediaGroupTimers.get(mediaGroupId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    mediaGroupTimers.delete(mediaGroupId);

    try {
      await onMediaGroupComplete(bot, moduleInfo, objectId, mediaGroupId);
    } catch (error) {
      console.error(`Failed to process media group ${mediaGroupId}`, error);
    }
  }, MEDIA_GROUP_DEBOUNCE_MS);

  mediaGroupTimers.set(mediaGroupId, timer);
}

async function addFileAsRequest(bot: Bot, ctx: Context, msg: SupportedMessage) {
  const moduleInfo = await resourcesModule.findModuleFromInputChat(
    msg.chat.id,
    msg.message_thread_id ?? null,
  );

  // Ignore if this isn't one of our module resource chats.
  if (!moduleInfo) {
    return;
  }

  const tempPendingResourceName = `pending_${moduleInfo.semester}_${moduleInfo.name}_${generateTimestampId()}`;

  /*
   * ============================================================
   * MEDIA GROUP
   * ============================================================
   */

  if (msg.media_group_id && msg.photo) {
    const mediaGroupId = msg.media_group_id;

    const existingFiles = await resourceFiles.findMediaGroupFiles(mediaGroupId);

    let resourceId: ObjectId;

    if (existingFiles.length > 0) {
      /*
       * This is another message belonging to an album we've
       * already started collecting.
       */
      resourceId = existingFiles[0].resourceId;
    } else {
      /*
       * First message of this album.
       *
       * Create the Resource now, but DON'T create the review
       * request yet.
       */

      const resource = await resources.createResource({
        name: tempPendingResourceName,
        type: "STUDY",
        isApproved: false,
        isMediaGroup: true,
      });

      resourceId = resource._id;
    }

    const largestPhoto = msg.photo.at(-1)!;

    await resourceFiles.addResourceFile({
      resourceId,
      fileId: largestPhoto.file_id,
      fileName: `photo_${generateTimestampId()}.jpg`,
      mimeType: "image/jpeg",
      telegramStoredMessageId: msg.message_id,
      mediaGroupId,
    });

    /*
     * IMPORTANT:
     *
     * Every message in the album reaches this function.
     * Each one resets the timer.
     *
     * Only when no more messages arrive for the debounce period
     * will onMediaGroupComplete() execute.
     */
    scheduleMediaGroupProcessing(bot, moduleInfo, resourceId, mediaGroupId);

    return;
  }

  const resource = await resources.createResource({
    name:
      msg.document?.file_name ??
      msg.video?.file_name ??
      tempPendingResourceName,
    type: "STUDY",
    isApproved: false,
    isMediaGroup: false,
  });

  let file: ResourceFileInput | undefined;
  if (msg.photo) {
    const largestPhoto = msg.photo.at(-1)!;
    file = {
      resourceId: resource._id,
      fileId: largestPhoto.file_id,
      fileName: `photo_${generateTimestampId()}.jpg`,
      mimeType: "image/jpeg",
      telegramStoredMessageId: msg.message_id,
    };
  } else if (msg.video) {
    file = {
      resourceId: resource._id,
      fileId: msg.video.file_id,
      fileName: msg.video.file_name ?? `video_${generateTimestampId()}.mp4`,
      mimeType: msg.video.mime_type ?? "video/mp4",
      telegramStoredMessageId: msg.message_id,
    };
  } else if (msg.document) {
    file = {
      resourceId: resource._id,
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? `file_${generateTimestampId()}`,
      mimeType: msg.document.mime_type ?? "application/octet-stream",
      telegramStoredMessageId: msg.message_id,
    };
  }
  if (!file) return;

  await resourceFiles.addResourceFile(file);

  const reviewerId = moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID;

  await postRequest(
    bot,
    moduleInfo,
    resource._id,
    msg.photo !== undefined,
    async () => {
      await bot.api.copyMessages(reviewerId, moduleInfo.resourcesInputChatId!, [
        file.telegramStoredMessageId!,
      ]);
    },
  );
}
