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
import logger from '../../../lib/logger.js';

export default async (bot: Bot) => {
  bot.command('res', async (ctx, next) => {
    if (!ctx.match?.trim()) {
    }

    const resFolderName = [
      'res',
      ...ctx.match.split(' ').map((part) => decodeURIComponent(part)),
    ].join('/');

    const resArray = await resources.findResourcesByNamePrefix(resFolderName);

    if (ctx.match.trim() === '' || resArray.length === 0) {
      await displayMenu(
        [],
        ctx.chat.id,
        ctx.message?.is_topic_message
          ? ctx.message.message_thread_id
          : undefined,
        ctx.chat.id !== ctx.from?.id ? ctx.from?.id : undefined,
      );

      return next();
    }

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
    resource: Resource,
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
    if (requesterId !== undefined && requesterId !== chatId) {
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
    pathChain: string[],
    chatId: number,
    threadId?: number,
    receiver_user_id?: number,
  ) {
    await bot.api.sendMessage(chatId, 'Resource Browser', {
      receiver_user_id,
      reply_markup: await getMenu(pathChain),
      message_thread_id: threadId,
    });
  }

  bot.callbackQuery(/^res:(.+)$/, async (ctx, next) => {
    // logger.debug(ctx.match[1].split(':'), 'got res callback query');
    await ctx.answerCallbackQuery();
    await updateMenu(
      ctx.match[1].split(':'),
      ctx.callbackQuery.message!.message_id,
      ctx.callbackQuery.message!.chat.id,
      ctx.callbackQuery.message!.receiver_user?.id,
    );
    return next();
  });
  bot.callbackQuery(/^res-view:(.+)$/, async (ctx, next) => {
    // logger.debug(ctx.match[1].split(':'), 'got res callback query');
    await ctx.answerCallbackQuery();
    // await updateMenu(
    //   ctx.match[1].split(':'),
    //   ctx.callbackQuery.message!.message_id,
    //   ctx.callbackQuery.message!.chat.id,
    //   ctx.callbackQuery.message!.receiver_user?.id,
    // );

    const resId = new ObjectId(ctx.match[1]);
    const resource = await resources.findResourceById(resId);
    if (!resource) {
      return next();
    }
    try {
      await ctx.deleteMessage();
    } catch (_) {}

    logger.debug([
      resource,
      ctx.callbackQuery.message!.chat.id,
      ctx.callbackQuery.message!.is_topic_message
        ? ctx.callbackQuery.message!.message_thread_id
        : undefined,
      ctx.callbackQuery.from!.id,
    ]);
    await displayResourceFiles(
      resource,
      ctx.callbackQuery.message!.chat.id,
      ctx.callbackQuery.message!.is_topic_message
        ? ctx.callbackQuery.message!.message_thread_id
        : undefined,
      ctx.callbackQuery.from!.id,
    );
    return next();
  });

  async function updateMenu(
    pathChain: string[],
    msgId: number,
    chatId: number,
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
    // logger.debug(pathChain, 'Get Menu is being called');

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
        ['res', ...pathChain.map((p) => p.toLowerCase())].join('/'),
      );

      const folders = new Set<string>();
      const files = [] as Resource[];
      resourcesContained.forEach((resource, idx) => {
        const endParts = resource.name
          .substring(resPrefix.length)
          .split('/')
          .filter((p) => p !== '');

        const targetLevelPart = endParts[0];

        if (endParts.length > 1) {
          folders.add(targetLevelPart);
        } else {
          files.push(resource);
        }
      });

      // logger.debug(
      //   { resPrefix, resourcesContained, files },
      //   'getMenu for case of 2+ parts long path',
      // );

      folders.forEach((folder) => {
        menu.text(
          folder[0].toUpperCase() + folder.slice(1),
          `res:${pathChain.join(':')}:${folder}`,
        );
      });
      files.forEach((resource) => {
        menu.row();
        menu.text(
          `${resource.isMediaGroup ? '🏞' : '📄'} ${resource.displayName}`,
          `res-view:${resource._id.toString()}`,
        );
      });
      menu.row();
    }
    if (pathChain.length > 0) {
      menu.row();
      menu.text('⬅ Back', `res:${pathChain.slice(0, -1).join(':')}`);
    }

    return menu;
  }
};
