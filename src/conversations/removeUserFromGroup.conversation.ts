import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';

/**
 * Conversation для удаления пользователя из группы
 */
export async function removeUserFromGroupConversation(
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
    await ctx.editMessageText('❌ Только владелец группы может удалять участников.');
    return;
  }

  // Получаем список участников группы
  const members = await database.getGroupMembers(userGroup.id);
  const otherMembers = members.filter(member => member.telegram_id !== telegramId);
  
  if (otherMembers.length === 0) {
    await ctx.editMessageText(
      `👥 <b>Нет участников для удаления</b>\n\n` +
      `В группе "${userGroup.name}" нет других участников кроме вас.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text("🔙 Назад к управлению", "back_to_tracking")
      }
    );
    return;
  }

  let userTelegramId: number;
  
  // Формируем список участников для отображения
  const membersList = otherMembers.map((member, index) => 
    `${index + 1}. ID: ${member.telegram_id}${member.username ? ` (@${member.username})` : ''}`
  ).join('\n');

  await ctx.editMessageText(
    `➖ <b>Удаление участника из группы "${userGroup.name}"</b>\n\n` +
    `<b>Текущие участники:</b>\n${membersList}\n\n` +
    `Введите Telegram ID участника для удаления:`,
    {
      parse_mode: 'HTML',
      reply_markup: createCancelKeyboard()
    }
  );

  // Валидация Telegram ID
  do {
    const context = await conversation.wait();

    if (context.callbackQuery?.data === 'cancel_conversation') {
      await context.editMessageText('❌ Удаление участника отменено');
      return;
    }

    const userInput = context.message?.text?.trim() || '';

    if (!userInput) {
      await context.reply('❌ Telegram ID не может быть пустым. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    // Проверяем, что это число
    const parsedId = parseInt(userInput);
    if (isNaN(parsedId) || parsedId <= 0) {
      await context.reply('❌ Telegram ID должен быть положительным числом. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    // Проверяем, что это не владелец группы
    if (parsedId === telegramId) {
      await context.reply('❌ Вы не можете удалить себя из собственной группы. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    // Проверяем, что пользователь есть в группе
    const memberExists = otherMembers.some(member => member.telegram_id === parsedId);
    if (!memberExists) {
      await context.reply('❌ Участник с таким ID не найден в группе. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    userTelegramId = parsedId;
    break;
  } while (true);

  await ctx.editMessageText('🔄 Удаляю участника из группы...');

  try {
    // Находим участника для получения информации
    const member = otherMembers.find(m => m.telegram_id === userTelegramId);
    
    // Удаляем пользователя из группы
    await database.removeGroupMember(userGroup.id, userTelegramId);

    // Создаем клавиатуру для возврата к управлению
    const backKeyboard = new InlineKeyboard()
      .text("👥 Список участников", "tracking_users")
      .row()
      .text("🔙 Назад к управлению", "back_to_tracking");

    await ctx.reply(
      `✅ <b>Участник удален!</b>\n\n` +
      `👤 <b>Telegram ID:</b> ${userTelegramId}\n` +
      `👤 <b>Username:</b> ${member?.username ? `@${member.username}` : 'Не указан'}\n` +
      `👥 <b>Группа:</b> ${userGroup.name}\n\n` +
      `Пользователь успешно удален из группы.`,
      {
        parse_mode: 'HTML',
        reply_markup: backKeyboard
      }
    );

    logger.info(`User ${telegramId} removed user ${userTelegramId} from group ${userGroup.id}`);

  } catch (error) {
    logger.error('Error removing user from group:', error);
    await ctx.editMessageText('❌ Произошла ошибка при удалении участника. Попробуйте позже.');
  }
}
