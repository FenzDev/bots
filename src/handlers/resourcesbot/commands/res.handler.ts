import { Bot, InlineKeyboard, InputFile, InputMediaBuilder } from 'grammy';
import {
  Resource,
  ResourceFile,
  resourceFiles,
  resources,
} from '../../../repositories/resource.repository.js';
import { ObjectId, WithId } from 'mongodb';
import { TELEGRAM_SUPERADMIN_ID } from '../../../config/env.js';
import { resourcesModules } from '../../../repositories/module.repository.js';

export default async (bot: Bot) => {
  bot.command('res', async (ctx, next) => {
    if (!ctx.match?.trim()) {
    }

    const resFolderName = [
      'res',
      ...ctx.match.split(' ').map((part) => decodeURIComponent(part)),
    ].join('/');

    const resArray = await resources.findResourcesByNamePrefix(resFolderName);

    await displayResourcesList(
      resArray,
      ctx.chatId,
      ctx.message?.is_topic_message ? ctx.message.message_thread_id : undefined,
      ctx.chat.id !== ctx.from?.id ? ctx.from?.id : undefined,
    );
    return next();
  });

  async function displayResourcesList(
    resArray: WithId<Resource>[],
    chatId: number,
    threadId?: number,
    requesterId?: number,
  ) {
    for (const resource of resArray) {
      await displayResourceFiles(resource, chatId, threadId, requesterId);
    }
  }

  async function displayResourceFiles(
    resource: WithId<Resource>,
    chatId: number,
    threadId?: number,
    requesterId?: number,
  ) {
    const files = await resourceFiles.findResourceFiles(resource._id);

    if (files.length === 0) return;

    const extra = {
      ...(threadId !== undefined && {
        message_thread_id: threadId,
      }),
    };

    const getMediaType = (file: ResourceFile) => {
      if (file.mimeType.startsWith('image/')) return 'photo' as const;
      if (file.mimeType.startsWith('video/')) return 'video' as const;
      return 'document' as const;
    };

    // EPHEMERAL MODE: never send a media group.
    if (requesterId !== undefined) {
      const ephemeralExtra = {
        ...extra,
        receiver_user_id: requesterId,
        ephemeral_message_parameters: {
          receiver_user_id: requesterId,
        },
      };

      for (const file of files) {
        const type = getMediaType(file);

        if (type === 'photo') {
          await bot.api.sendPhoto(chatId, file.fileId, ephemeralExtra);
        } else if (type === 'video') {
          await bot.api.sendVideo(chatId, file.fileId, ephemeralExtra);
        } else {
          await bot.api.sendDocument(chatId, file.fileId, ephemeralExtra);
        }
      }

      return;
    }

    // NORMAL MODE: individual files when not a media group.
    if (!resource.isMediaGroup || files.length === 1) {
      for (const file of files) {
        const type = getMediaType(file);

        if (type === 'photo') {
          await bot.api.sendPhoto(chatId, file.fileId, extra);
        } else if (type === 'video') {
          await bot.api.sendVideo(chatId, file.fileId, extra);
        } else {
          await bot.api.sendDocument(chatId, file.fileId, extra);
        }
      }

      return;
    }

    // NORMAL MODE: split photos/videos and documents into compatible groups.
    const visualFiles = files.filter(
      (file) => getMediaType(file) !== 'document',
    );
    const documentFiles = files.filter(
      (file) => getMediaType(file) === 'document',
    );

    const caption = resource.displayName || undefined;

    // Photos and videos can share a media group.
    for (let i = 0; i < visualFiles.length; i += 10) {
      const batch = visualFiles.slice(i, i + 10);

      if (batch.length === 1) {
        const file = batch[0];
        const type = getMediaType(file);

        if (type === 'photo') {
          await bot.api.sendPhoto(chatId, file.fileId, {
            ...extra,
            caption,
          });
        } else {
          await bot.api.sendVideo(chatId, file.fileId, {
            ...extra,
            caption,
          });
        }

        continue;
      }

      await bot.api.sendMediaGroup(
        chatId,
        batch.map((file, index) => {
          const media =
            getMediaType(file) === 'photo'
              ? InputMediaBuilder.photo(file.fileId)
              : InputMediaBuilder.video(file.fileId);

          if (i === 0 && index === 0 && caption) {
            media.caption = caption;
          }

          return media;
        }),
        extra,
      );
    }

    // Documents must be grouped separately.
    for (let i = 0; i < documentFiles.length; i += 10) {
      const batch = documentFiles.slice(i, i + 10);

      if (batch.length === 1) {
        await bot.api.sendDocument(chatId, batch[0].fileId, {
          ...extra,
          caption,
        });
        continue;
      }

      await bot.api.sendMediaGroup(
        chatId,
        batch.map((file, index) => {
          const media = InputMediaBuilder.document(file.fileId);

          if (i === 0 && index === 0 && caption) {
            media.caption = caption;
          }

          return media;
        }),
        extra,
      );
    }
  }

  async function displayMenu(
    chatId: number,
    pathChain: string[],
    receiver_user_id?: number,
  ) {
    await bot.api.sendMessage(chatId, 'Resource Browser', {
      receiver_user_id,
      reply_markup: await getMenu(pathChain),
    });
  }

  async function updateMenu(
    chatId: number,
    msgId: number,
    pathChain: string[],
    receiver_user_id?: number,
  ) {
    if (receiver_user_id) {
      await bot.api.editEphemeralMessageReplyMarkup(
        chatId,
        receiver_user_id,
        msgId,
        {
          reply_markup: await getMenu(pathChain),
        },
      );
    } else {
      await bot.api.editMessageReplyMarkup(chatId, msgId, {
        reply_markup: await getMenu(pathChain),
      });
    }
  }

  /**
   *
   * @param pathChain e.g. ["s5", "se", "td"]
   */
  async function getMenu(pathChain: string[]) {
    const menu = new InlineKeyboard();
    if (pathChain.length === 0) {
      const semesters = await resourcesModules.getExistingSemesters();

      semesters.forEach((semester, idx) => {
        // if (idx % 2 == 0) menu.row();
        menu.text(semester.toUpperCase(), `res:${semester}`);
      });
    } else if (pathChain.length === 1) {
      const modules = await resourcesModules.findModulesFromSemester(
        pathChain[0],
      );
      modules.forEach((module, idx) => {
        if (idx % 2 == 0) menu.row();
        menu.text(
          module.displayShort ?? module.name.toUpperCase(),
          `res:${pathChain[0]}:${module.name}`,
        );
      });
    } else {
      const resPrefix = `res/${pathChain.map((p) => p.toLowerCase()).join('/')}`;
      const resourcesContained = await resources.findResourcesByNamePrefix(
        pathChain.map((p) => p.toLowerCase()).join('/'),
      );

      resourcesContained.forEach((resource, idx) => {
        const endParts = resource.name
          .substring(resPrefix.length)
          .split('/')
          .filter((p) => p !== '');

        const targetLevelPart = endParts[0];

        if (endParts.length > 1) {
          menu.text(
            targetLevelPart,
            `res:${pathChain.join(':')}:${targetLevelPart}`,
          );
        } else {
          menu.text(
            `${resource.isMediaGroup ? '🏞' : '📄'} ${targetLevelPart}`,
            `res-view:${resource._id.toString()}`,
          );
        }
      });
    }

    return menu;
  }
};
