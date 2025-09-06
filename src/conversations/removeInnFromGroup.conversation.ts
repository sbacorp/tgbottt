import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';
import { validateInn } from '../utils/validation';

/**
 * Conversation для удаления ИНН организации из группы
 */
export async function removeInnFromGroupConversation(
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
  if (!userGroup) {
    await ctx.editMessageText('❌ У вас нет группы для удаления организаций.');
    return;
  }

  // Получаем список организаций группы
  const organizations = await database.getGroupOrganizations(userGroup.id);
  
  if (organizations.length === 0) {
    await ctx.editMessageText(
      `📋 <b>Список организаций пуст</b>\n\n` +
      `В группе "${userGroup.name}" нет организаций для удаления.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text("🔙 Назад к управлению", "back_to_tracking")
      }
    );
    return;
  }

  let inn: string;
  
  // Формируем список организаций для отображения
  const orgList = organizations.map((org, index) => 
    `${index + 1}. ${org.name} (${org.inn})`
  ).join('\n');

  await ctx.editMessageText(
    `➖ <b>Удаление организации из группы "${userGroup.name}"</b>\n\n` +
    `<b>Текущие организации:</b>\n${orgList}\n\n` +
    `Введите ИНН организации для удаления:`,
    {
      parse_mode: 'HTML',
      reply_markup: createCancelKeyboard()
    }
  );

  // Валидация ИНН
  do {
    const context = await conversation.wait();

    if (context.callbackQuery?.data === 'cancel_conversation') {
      await context.editMessageText('❌ Удаление организации отменено');
      return;
    }

    inn = context.message?.text?.trim() || '';

    if (!inn) {
      await context.reply('❌ ИНН не может быть пустым. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    if (!validateInn(inn)) {
      await context.reply('❌ Неверный формат ИНН. ИНН должен содержать 10 или 12 цифр. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    // Проверяем, есть ли такая организация в группе
    const orgExists = organizations.some(org => org.inn === inn);
    if (!orgExists) {
      await context.reply('❌ Организация с таким ИНН не найдена в группе. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    break;
  } while (true);

  await ctx.editMessageText('🔄 Удаляю организацию из группы...');

  try {
    // Находим организацию для получения названия
    const organization = organizations.find(org => org.inn === inn);
    
    // Удаляем организацию из группы
    await database.removeGroupOrganization(userGroup.id, inn);

    // Создаем клавиатуру для возврата к управлению
    const backKeyboard = new InlineKeyboard()
      .text("📋 Список организаций", "tracking_organizations")
      .row()
      .text("🔙 Назад к управлению", "back_to_tracking");

    await ctx.reply(
      `✅ <b>Организация удалена!</b>\n\n` +
      `🏢 <b>Название:</b> ${organization?.name || 'Неизвестно'}\n` +
      `🆔 <b>ИНН:</b> ${inn}\n\n` +
      `Организация успешно удалена из группы "${userGroup.name}".`,
      {
        parse_mode: 'HTML',
        reply_markup: backKeyboard
      }
    );

    logger.info(`User ${telegramId} removed organization ${inn} from group ${userGroup.id}`);

  } catch (error) {
    logger.error('Error removing organization from group:', error);
    await ctx.editMessageText('❌ Произошла ошибка при удалении организации. Попробуйте позже.');
  }
}
