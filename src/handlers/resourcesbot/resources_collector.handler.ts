import { Bot, Context, InlineKeyboard, InputMediaBuilder } from "grammy";
import { InlineKeyboardMarkup, Message, Update } from "grammy/types";
import logger from "../../lib/logger.js";
import {
  ResourcesModule,
  resourcesModules,
} from "../../repositories/module.repository.js";
import {
  ResourceFileInput,
  resourceFiles,
  resources,
} from "../../repositories/resource.repository.js";
import { pendings } from "../../repositories/pending.repository.js";
import { generateTimestampId } from "../../utils/genid.js";
import { TELEGRAM_SUPERADMIN_ID } from "../../config/env.js";
import { ObjectId, WithId } from "mongodb";

type PendingAdminBatch = {
  messages: SupportedMessage[];
  moduleName?: string;
  customName?: string;
  timer?: NodeJS.Timeout;
};

const ADMIN_BATCH_TIMEOUT_MS = 60_000;

const pendingAdminBatches = new Map<string, PendingAdminBatch>();

export default async (bot: Bot) => {
  bot.on("message:document", async (ctx, next) => {
    if (ctx.chat?.id === TELEGRAM_SUPERADMIN_ID) {
      await addAdminFileToBatch(bot, ctx.message);
    } else {
      await addFileAsRequest(bot, ctx.message);
    }

    return next();
  });

  bot.on("message:video", async (ctx, next) => {
    if (ctx.chat?.id === TELEGRAM_SUPERADMIN_ID) {
      await addAdminFileToBatch(bot, ctx.message);
    } else {
      await addFileAsRequest(bot, ctx.message);
    }

    return next();
  });

  bot.on("message:photo", async (ctx, next) => {
    if (ctx.chat?.id === TELEGRAM_SUPERADMIN_ID) {
      await addAdminFileToBatch(bot, ctx.message);
    } else {
      await addFileAsRequest(bot, ctx.message);
    }

    return next();
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.chat?.id === TELEGRAM_SUPERADMIN_ID) {
      await handleAdminText(bot, ctx.message);
    }

    return next();
  });
};

function parseAdminResourceText(text: string) {
  const trimmed = text.trim();

  if (trimmed.toLowerCase() === "cancel") {
    return { type: "cancel" as const };
  }

  const match = trimmed.match(/^([^\s:]+)(?:\s*:\s*(.*))?$/);

  if (!match) {
    return null;
  }

  return {
    type: "resource" as const,
    moduleName: match[1],
    customName: match[2]?.trim() || undefined,
  };
}

function getAdminBatchKey(msg: Message) {
  return `${msg.chat.id}:${msg.message_thread_id ?? "main"}`;
}

function resetAdminBatchTimer(bot: Bot, key: string) {
  const batch = pendingAdminBatches.get(key);

  if (!batch) {
    return;
  }

  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  batch.timer = setTimeout(async () => {
    pendingAdminBatches.delete(key);

    if (batch.messages.length === 0) {
      return;
    }

    if (!batch.moduleName) {
      console.warn(`Admin batch ${key} expired without module name`);
      return;
    }

    try {
      await processAdminBatch(bot, batch);
    } catch (error) {
      logger.error(error, `Failed to process admin batch ${key}`);
    }
  }, ADMIN_BATCH_TIMEOUT_MS);
}

async function addAdminFileToBatch(bot: Bot, msg: SupportedMessage) {
  const key = getAdminBatchKey(msg);

  let batch = pendingAdminBatches.get(key);

  if (!batch) {
    batch = {
      messages: [],
    };

    pendingAdminBatches.set(key, batch);
  }

  batch.messages.push(msg);

  resetAdminBatchTimer(bot, key);
}

function getAdminMetadataKey(msg: Message) {
  return `${msg.chat.id}:${msg.message_thread_id ?? "main"}`;
}

async function handleAdminText(bot: Bot, msg: Message) {
  if (!msg.text) {
    return;
  }

  const parsed = parseAdminResourceText(msg.text);

  if (!parsed) {
    return;
  }

  const key = getAdminBatchKey(msg);

  if (parsed.type === "cancel") {
    const existingBatch = pendingAdminBatches.get(key);

    if (existingBatch?.timer) {
      clearTimeout(existingBatch.timer);
    }

    pendingAdminBatches.delete(key);

    return;
  }

  let batch = pendingAdminBatches.get(key);

  if (!batch) {
    batch = {
      messages: [],
    };

    pendingAdminBatches.set(key, batch);
  }

  const moduleInfo = await resourcesModules.findModuleFromName(
    parsed.moduleName,
  );

  if (!moduleInfo) {
    logger.warn(`Admin specified unknown module: ${parsed.moduleName}`);

    return;
  }

  batch.moduleName = parsed.moduleName;
  batch.customName = parsed.customName;

  /*
   * If files are already waiting, the metadata completes
   * the batch immediately.
   */
  if (batch.messages.length > 0) {
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    pendingAdminBatches.delete(key);

    await processAdminBatch(bot, batch);

    return;
  }

  /*
   * Text came first.
   *
   * Wait up to one minute for files.
   */
  resetAdminBatchTimer(bot, key);
}

async function processAdminBatch(bot: Bot, batch: PendingAdminBatch) {
  if (!batch.moduleName) {
    return;
  }

  const moduleInfo = await resourcesModules.findModuleFromName(
    batch.moduleName,
  );

  if (!moduleInfo) {
    return;
  }

  /*
   * Group photos by media_group_id.
   *
   * Documents/videos are intentionally NOT grouped.
   */
  const photoGroups = new Map<string, SupportedMessage[]>();
  const individualMessages: SupportedMessage[] = [];

  for (const msg of batch.messages) {
    if (msg.photo && msg.media_group_id) {
      const existing = photoGroups.get(msg.media_group_id);

      if (existing) {
        existing.push(msg);
      } else {
        photoGroups.set(msg.media_group_id, [msg]);
      }
    } else {
      individualMessages.push(msg);
    }
  }

  /*
   * Process photo albums.
   */
  for (const messages of photoGroups.values()) {
    await processAdminPhotoGroup(bot, moduleInfo, messages, batch.customName);
  }

  /*
   * Process documents, videos, and standalone photos
   * individually.
   */
  for (const msg of individualMessages) {
    await processAdminSingleMessage(bot, moduleInfo, msg, batch.customName);
  }
}

async function processAdminPhotoGroup(
  bot: Bot,
  moduleInfo: ResourcesModule,
  messages: SupportedMessage[],
  customName?: string,
) {
  const resource = await resources.createResource({
    name:
      customName ??
      `pending_${moduleInfo.semester}_${moduleInfo.name}_${generateTimestampId()}`,
    type: "STUDY",
    isApproved: false,
    isMediaGroup: true,
  });

  let i=0;
  for (const msg of messages) {
    if (!msg.photo) {
      continue;
    }

    const largestPhoto = msg.photo.at(-1)!;

    await resourceFiles.addResourceFile({
      resourceId: resource._id,
      fileId: largestPhoto.file_id,
      fileName: `photo_${++i}_${generateTimestampId()}.jpg`,
      mimeType: "image/jpeg",
      telegramStoredMessageId: msg.message_id,
      mediaGroupId: msg.media_group_id,
    });
  }

  const reviewerId = moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID;

  await postRequest(bot, moduleInfo, resource._id, true, async () => {
    await bot.api.forwardMessages(
      reviewerId,
      TELEGRAM_SUPERADMIN_ID,
      messages.map((msg) => msg.message_id),
    );
  });
}

async function processAdminSingleMessage(
  bot: Bot,
  moduleInfo: ResourcesModule,
  msg: SupportedMessage,
  customName?: string,
) {
  const resource = await resources.createResource({
    name:
      customName ??
      msg.document?.file_name ??
      msg.video?.file_name ??
      `pending_${moduleInfo.semester}_${moduleInfo.name}_${generateTimestampId()}`,
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

  if (!file) {
    return;
  }

  await resourceFiles.addResourceFile(file);

  const reviewerId = moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID;

  await postRequest(
    bot,
    moduleInfo,
    resource._id,
    msg.photo !== undefined,
    async () => {
      await bot.api.copyMessages(reviewerId, TELEGRAM_SUPERADMIN_ID, [
        msg.message_id,
      ]);
    },
  );
}

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
  const resNameBase = `${moduleInfo.semester}/${moduleInfo.name}`;
  const commandBase = `/approve ${requestMessageId} ${resNameBase}`;
  return allCopyableCommand
    ? new InlineKeyboard()
        .copyText("TD", `${commandBase}/td `)
        .copyText("Solutions", `${commandBase}/td/sol `)
        .text("List TDs", `list:${resNameBase}/td`)
        .row()
        .copyText("TP", `${commandBase}/tp `)
        .copyText("Solutions", `${commandBase}/tp/sol `)
        .text("List TPs", `list:${resNameBase}/tp`)
        .row()
        .copyText("Lecture", `${commandBase}/cours `)
        .text("List Lectures", `list:${resNameBase}/cours`)
        .row()
        .copyText("Exercises & Exams", `${commandBase}/exoexam `)
        .text("List Exercises...", `list:${resNameBase}/exoexam`)
        .row()
        .copyText("Resume", `${commandBase}/resume `)
        .text("List Resumes", `list:${resNameBase}/resume`)
        .row()
        .copyText("Other", `${commandBase}/`)
        .text("❌ Ignore", `ignore:${resNameBase}`)
    : new InlineKeyboard()
        .text("TD", `approve:${resNameBase}/td`)
        .text("Solutions", `approve:${resNameBase}/td/sol`)
        .text("List TDs", `list:${resNameBase}/td`)
        .row()
        .text("TP", `approve:${resNameBase}/tp`)
        .text("Solutions", `approve:${resNameBase}/tp/sol`)
        .text("List TPs", `list:${resNameBase}/tp`)
        .row()
        .text("Lecture", `approve:${resNameBase}/cours`)
        .text("List Lectures", `list:${resNameBase}/cours`)
        .row()
        .text("Exercises & Exams", `approve:${resNameBase}/exoexam`)
        .text("List Exercises...", `list:${resNameBase}/exoexam`)
        .row()
        .text("Resume", `approve:${resNameBase}/resume`)
        .text("List Resumes", `list:${resNameBase}/resume`)
        .row()
        .copyText("Other", `approve:${commandBase}/`)
        .text("❌ Ignore", `ignore:${resNameBase}`);
}

async function postRequest(
  bot: Bot,
  moduleInfo: ResourcesModule,
  resourceId: ObjectId,
  hasImages: boolean,
  preview: () => Promise<void>,
) {
  logger.debug("Posting resource request");

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

async function addFileAsRequest(bot: Bot, msg: SupportedMessage) {
  logger.debug("About to add file as request");

  let moduleInfo = await resourcesModules.findModuleFromInputChat(
    msg.chat.id,
    msg.message_thread_id ?? null,
  );

  if (!moduleInfo) {
    logger.debug("Not part of module");
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
