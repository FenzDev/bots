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
import { userResHistory } from '../../../repositories/res_user_history.repository.js';

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
    const { menu, title } = await getMenu(
      receiver_user_id ?? chatId,
      pathChain,
    );
    await bot.api.sendMessage(chatId, title, {
      receiver_user_id,
      reply_markup: menu,
      message_thread_id: threadId,
    });
  }

  bot.callbackQuery(/^res:(.*)$/, async (ctx, next) => {
    // logger.debug(ctx.match[1].split(':'), 'got res callback query');
    await ctx.answerCallbackQuery();
    await updateMenu(
      ctx.match[1].split(':').filter((path) => path.trim() !== ''),
      ctx.callbackQuery.message!.ephemeral_message_id ??
        ctx.callbackQuery.message!.message_id,
      ctx.callbackQuery.message!.chat.id,
      ctx.callbackQuery.message!.receiver_user?.id,
    );
    return next();
  });
  bot.callbackQuery(/^res-view-all:(.*)$/, async (ctx, next) => {
    // logger.debug(ctx.match[1].split(':'), 'got res callback query');
    await ctx.answerCallbackQuery();

    const resPrefix = `res/${ctx.match[1].split(':').join('/')}`;

    const resArray = (
      await resources.findResourcesByNamePrefix(resPrefix)
    ).filter((resource) => {
      const endParts = resource.name
        .substring(resPrefix.length)
        .split('/')
        .filter((p) => p !== '');
      return endParts.length === 1;
    });

    if (resArray.length === 0) {
      return next();
    }

    try {
      if (ctx.callbackQuery.message!.ephemeral_message_id) {
        await ctx.deleteEphemeralMessage();
      } else {
        await ctx.deleteMessage();
      }
    } catch (_) {}

    resArray.forEach(async (resource) => {
      await displayResourceFiles(
        resource,
        ctx.callbackQuery.message!.chat.id,
        ctx.callbackQuery.message!.is_topic_message
          ? ctx.callbackQuery.message!.message_thread_id
          : undefined,
        ctx.callbackQuery.from!.id,
      );
    });

    await userResHistory.addUserHistory({
      telegramId: ctx.callbackQuery.from!.id,
      path: resPrefix.split('/').slice(1).join('/'),
    });

    return next();
  });
  bot.callbackQuery(/^delete-msg$/, async (ctx, next) => {
    await ctx.answerCallbackQuery();
    try {
      if (ctx.callbackQuery.message!.ephemeral_message_id) {
        await ctx.deleteEphemeralMessage();
      } else {
        await ctx.deleteMessage();
      }
    } catch (_) {}
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
      if (ctx.callbackQuery.message!.ephemeral_message_id) {
        await ctx.deleteEphemeralMessage();
      } else {
        await ctx.deleteMessage();
      }
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

    await userResHistory.addUserHistory({
      telegramId: ctx.callbackQuery.from!.id,
      path: resource.name.split('/').slice(1, -1).join('/'),
    });

    return next();
  });

  async function updateMenu(
    pathChain: string[],
    msgId: number,
    chatId: number,
    receiver_user_id?: number,
  ) {
    if (receiver_user_id) {
      const { menu, title } = await getMenu(receiver_user_id, pathChain);
      await bot.api.editEphemeralMessageText(
        chatId,
        receiver_user_id,
        msgId,
        title,
        {
          reply_markup: menu,
        },
      );
    } else {
      const { menu, title } = await getMenu(chatId, pathChain);
      await bot.api.editMessageText(chatId, msgId, title, {
        reply_markup: menu,
      });
    }
  }

  /**
   *
   * @param pathChain e.g. ["s5", "se", "td"]
   */
  async function getMenu(callerId: number, pathChain: string[]) {
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

      folders.forEach((folder, idx) => {
        const folderName =
          folder.length > 2
            ? folder[0].toUpperCase() + folder.slice(1)
            : folder.toUpperCase();
        menu.text(folderName, `res:${pathChain.join(':')}:${folder}`);
      });
      menu.toFlowed(2);
      files.forEach((resource) => {
        menu.row();
        menu.text(
          `${resource.isMediaGroup ? '🏞' : '📄'} ${resource.displayName}`,
          `res-view:${resource._id.toString()}`,
        );
      });
      menu.row();

      if (files.length > 1) {
        menu.text(`🗃️ View all files`, `res-view-all:${pathChain.join(':')}`);
      }
    }
    menu.row();
    if (pathChain.length > 0) {
      if (pathChain.length > 1) {
        menu.text('⬅ Back', `res:${pathChain.slice(0, -1).join(':')}`);
      }
      menu.text('🏠 Home', `res:`);
    } else {
      const history = await userResHistory.findUserHistoryById(callerId);

      history.forEach((historyItem) => {
        logger.error(historyItem, 'history item');

        const resFolder = historyItem.path.split('/');
        menu.text(`🕘 ${resFolder.join('»')}`, `res:${resFolder.join(':')}`);
        menu.row();
      });
    }

    menu.text('❌ Exit', `delete-msg`);

    return {
      menu,
      title: pathChain.length > 0 ? pathChain.join('»') : 'Resource Browser',
    };
  }
};
