import { Bot, Context, InputMediaBuilder } from "grammy";
import { Message, Update } from "grammy/types";
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

  bot.on("message:photo", async (ctx, next) => {
    await addFileAsRequest(bot, ctx, ctx.message);
    return next();
  });
};

type SupportedMessage =
  | (Message & Update.NonChannel & Record<"document" | "from", {}>)
  | (Message & Update.NonChannel & Record<"photo" | "from", {}>);

const MEDIA_GROUP_DEBOUNCE_MS = 1_000;

/**
 * Timers are keyed by Telegram's media_group_id.
 *
 * Every new message belonging to the same album clears and recreates
 * its timer. Once no new message arrives for MEDIA_GROUP_DEBOUNCE_MS,
 * the album is considered complete.
 */
const mediaGroupTimers = new Map<string, NodeJS.Timeout>();

/**
 * Called when we believe a media group is complete.
 *
 * Put your forwarding/reviewer code here.
 */
async function onMediaGroupComplete(
  bot: Bot,
  moduleInfo: WithId<ResourcesModule>,
  mediaGroupId: string,
) {
  const images = await resourceFiles.findMediaGroupFiles(mediaGroupId);

  await bot.api.sendMediaGroup(
    moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID,
    images.map((img) => InputMediaBuilder.photo(img.fileId)),
  );
}

function scheduleMediaGroupProcessing(
  bot: Bot,
  moduleInfo: WithId<ResourcesModule>,
  mediaGroupId: string,
) {
  // A new message arrived for this album.
  // Cancel the previous timer.
  const existingTimer = mediaGroupTimers.get(mediaGroupId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Start a fresh timer.
  const timer = setTimeout(async () => {
    // Remove the timer before processing.
    mediaGroupTimers.delete(mediaGroupId);

    try {
      await onMediaGroupComplete(bot, moduleInfo, mediaGroupId);
    } catch (error) {
      console.error(`Failed to process media group ${mediaGroupId}`, error);
    }
  }, MEDIA_GROUP_DEBOUNCE_MS);

  mediaGroupTimers.set(mediaGroupId, timer);
}

async function addFileAsRequest(bot: Bot, ctx: Context, msg: SupportedMessage) {
  // Ignore if this isn't one of our module resource chats.
  const moduleInfo = await resourcesModule.findModuleFromInputChat(
    msg.chat.id,
    msg.message_thread_id ?? null,
  );

  if (!moduleInfo) {
    return;
  }

  /*
   * ============================================================
   * MEDIA GROUP
   * ============================================================
   */

  if (msg.media_group_id) {
    const mediaGroupId = msg.media_group_id;

    /*
     * See whether we've already created a Resource for this album.
     */
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
        name: `Resource ${generateTimestampId()}`,
        type: "STUDY",
        isMediaGroup: true,
      });

      resourceId = resource._id;
    }

    /*
     * Store the actual media item.
     */
    if (msg.photo) {
      const largestPhoto = msg.photo.at(-1)!;

      await resourceFiles.addResourceFile({
        resourceId,
        fileId: largestPhoto.file_id,
        fileName: `photo_${generateTimestampId()}.jpg`,
        mimeType: "image/jpeg",
        telegramStoredMessageId: msg.message_id,
        mediaGroupId,
      });
    } else if (msg.document) {
      await resourceFiles.addResourceFile({
        resourceId,
        fileId: msg.document.file_id,
        fileName: msg.document.file_name ?? `file_${generateTimestampId()}`,
        mimeType: msg.document.mime_type ?? "application/octet-stream",
        telegramStoredMessageId: msg.message_id,
        mediaGroupId,
      });
    }

    /*
     * IMPORTANT:
     *
     * Every message in the album reaches this function.
     * Each one resets the timer.
     *
     * Only when no more messages arrive for the debounce period
     * will onMediaGroupComplete() execute.
     */
    scheduleMediaGroupProcessing(bot, moduleInfo, mediaGroupId);

    return;
  }

  /*
   * ============================================================
   * SINGLE PHOTO / DOCUMENT
   * ============================================================
   */

  const resource = await resources.createResource({
    name: msg.document?.file_name ?? `Resource ${generateTimestampId()}`,
    type: "STUDY",
    isMediaGroup: false,
  });

  let file:ResourceFileInput|undefined;
  if (msg.photo) {
    const largestPhoto = msg.photo.at(-1)!;
    file = {
      resourceId: resource._id,
      fileId: largestPhoto.file_id,
      fileName: `photo_${generateTimestampId()}.jpg`,
      mimeType: "image/jpeg",
      telegramStoredMessageId: msg.message_id,
    }
  } else if (msg.document) {
    file = {
      resourceId: resource._id,
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? `file_${generateTimestampId()}`,
      mimeType: msg.document.mime_type ?? "application/octet-stream",
      telegramStoredMessageId: msg.message_id,
    }
  }
  if (!file) return;

  await resourceFiles.addResourceFile(file);
  /*
   * Single messages don't need the media-group debounce.
   *
   * Your forwarding code can go here.
   */

  const reviewerId = moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID;
  const sentRequestMsg = await bot.api.copyMessages(reviewerId, moduleInfo.resourcesInputChatId!, [file.telegramStoredMessageId!])

  if (sentRequestMsg.length <= 0) return;

  await pendings.createPendingRequest({
    requestMessageId: sentRequestMsg[0].message_id,
    requestChatId: moduleInfo.reviewerId ?? TELEGRAM_SUPERADMIN_ID,
    type: "SHARED_RESOURCE",
    resourceId: resource._id,
  });
}
