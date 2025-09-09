import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';
import { createTrackingMenuKeyboard } from '../features/tracking';

/**
 * Conversation для добавления пользователя в группу
 */
export async function addUserToGroupConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const telegramId = ctx.from?.id;
  
  if (!telegramId) {
    await ctx.reply(MESSAGES.error);
    return;
  }

  // Проверяем группу пользователя
  const userGroup = await database.getUserGroup(telegramId);
  if (!userGroup || userGroup.owner_id !== telegramId) {
    await ctx.editMessageText('❌ Только владелец группы может добавлять участников.');
    return;
  }

  let userTelegramId: number;
  
  await ctx.editMessageText(
    `➕ <b>Добавление участника в группу "${userGroup.name}"</b>\n\n` +
    `Введите Telegram ID пользователя для добавления в группу:\n\n` +
    `💡 <i>Пользователь может узнать свой ID у бота @user_stats_bot</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
    }
  );

  // Валидация Telegram ID
  do {
    const context = await conversation.wait();

    if (context.callbackQuery?.data === 'back_to_tracking') {
      const keyboard = createTrackingMenuKeyboard();
      await context.editMessageText(
        "Составьте список организаций на отслеживание и список пользователей для получения уведомлений об изменении статуса надежности. Если список пользователей не заполнен, то уведомления будете получать только Вы.",
        { reply_markup: keyboard }
      );
      await context.answerCallbackQuery();
      return;
    }

    const userInput = context.message?.text?.trim() || '';

    if (!userInput) {
      await context.reply('❌ Telegram ID не может быть пустым. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    // Проверяем, что это число
    const parsedId = parseInt(userInput);
    if (isNaN(parsedId) || parsedId <= 0) {
      await context.reply('❌ Telegram ID должен быть положительным числом. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    // Проверяем, что пользователь не добавляет сам себя
    if (parsedId === telegramId) {
      await context.reply('❌ Вы не можете добавить самого себя. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    userTelegramId = parsedId;
    break;
  } while (true);

  await ctx.editMessageText('🔄 Добавляю пользователя в группу...');

  try {
    // Проверяем, зарегистрирован ли пользователь
    let user = await database.getUserByTelegramId(userTelegramId);
    if (!user) {
      // Регистрируем пользователя автоматически
      await database.createUser(userTelegramId, undefined, false);
      user = await database.getUserByTelegramId(userTelegramId);
      logger.info(`Auto-registered user ${userTelegramId} for group invitation`);
    }

    // Проверяем, не состоит ли пользователь уже в группе
    const groupMembers = await database.getGroupMembers(userGroup.id);
    const isAlreadyMember = groupMembers.some(member => member.telegram_id === userTelegramId);
    
    if (isAlreadyMember) {
      await ctx.reply(
        `ℹ️ <b>Пользователь уже в группе</b>\n\n` +
        `Пользователь с ID ${userTelegramId} уже является участником группы "${userGroup.name}".`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text("🔙 Назад к управлению", "back_to_tracking")
        }
      );
      return;
    }

    // Добавляем пользователя в группу
    await database.addGroupMember(userGroup.id, userTelegramId);

    // Создаем клавиатуру для возврата к управлению
    const backKeyboard = new InlineKeyboard()
      .text("👥 Список участников", "tracking_users")
      .row()
      .text("🔙 Назад к управлению", "back_to_tracking");

    await ctx.reply(
      `✅ <b>Участник добавлен!</b>\n\n` +
      `👤 <b>Telegram ID:</b> ${userTelegramId}\n` +
      `👥 <b>Группа:</b> ${userGroup.name}\n\n` +
      `Пользователь успешно добавлен в группу и теперь будет получать уведомления.`,
      {
        parse_mode: 'HTML',
        reply_markup: backKeyboard
      }
    );

    logger.info(`User ${telegramId} added user ${userTelegramId} to group ${userGroup.id}`);

  } catch (error) {
    logger.error('Error adding user to group:', error);
    
    if (error instanceof Error && error.message.includes('duplicate')) {
      await ctx.editMessageText(
        `ℹ️ <b>Пользователь уже в группе</b>\n\n` +
        `Пользователь с ID ${userTelegramId} уже является участником группы "${userGroup.name}".`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text("🔙 Назад к управлению", "back_to_tracking")
        }
      );
    } else {
      await ctx.editMessageText('❌ Произошла ошибка при добавлении пользователя. Попробуйте позже.');
    }
  }
}
