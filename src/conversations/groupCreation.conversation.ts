import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';

/**
 * Conversation для создания группы отслеживания
 * Запрашивает название группы у пользователя и создает новую группу
 */
export async function createGroupConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const telegramId = ctx.from?.id;
  
  if (!telegramId) {
    await ctx.reply(MESSAGES.error);
    return;
  }

  // Проверяем, что пользователь зарегистрирован
  const user = await database.getUserByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('❌ Вы должны быть зарегистрированы для создания группы. Используйте /start');
    return;
  }

  let groupName: string;
  
  await ctx.editMessageText('👥 Введите название для новой группы отслеживания:', {
    reply_markup: createCancelKeyboard()
  });

  // Валидация названия группы
  do {
    const context = await conversation.wait();

    if (context.callbackQuery?.data === 'cancel_conversation') {
      await context.editMessageText('❌ Создание группы отменено');
      return;
    }

    groupName = context.message?.text?.trim() || '';

    if (!groupName) {
      await context.reply('❌ Название группы не может быть пустым. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    if (groupName.length < 3) {
      await context.reply('❌ Название группы должно содержать минимум 3 символа. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    if (groupName.length > 100) {
      await context.reply('❌ Название группы не может быть длиннее 100 символов. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    // Проверяем, что название не содержит недопустимые символы (поддержка кириллицы и латиницы)
    if (!/^[а-яёА-ЯЁa-zA-Z0-9\s\-_.,!?()]+$/u.test(groupName)) {
      await context.reply('❌ Название группы содержит недопустимые символы. Используйте только буквы, цифры, пробелы и знаки препинания. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    break;
  } while (true);

  await ctx.editMessageText('🔄 Создаю группу...');

  try {
    // Создаем группу
    const group = await database.createUserGroup(groupName, telegramId);
    
    // Формируем ссылку для приглашения
    const botUsername = ctx.me.username || 'your_bot';
    const inviteLink = `https://t.me/${botUsername}?start=joinGroup_${group.invite_code}`;

    // Создаем клавиатуру для управления группой
    const groupManagementKeyboard = new InlineKeyboard()
      .text("📋 Список организаций", "tracking_organizations")
      .text("👥 Список участников", "tracking_users")
      .row()
      .text("🔗 Получить ссылку приглашения", "get_invite_link")
      .row()
      .text("🔙 Назад в меню", "back_to_main_menu");

    await ctx.reply(
      `✅ <b>Группа "${groupName}" успешно создана!</b>\n\n` +
      `👥 <b>Управление группой:</b>\n` +
      `• Добавляйте организации для отслеживания\n` +
      `• Приглашайте участников\n` +
      `• Получайте уведомления об изменениях\n\n` +
      `🔗 <b>Ссылка для приглашения:</b>\n` +
      `<code>${inviteLink}</code>`,
      { 
        parse_mode: 'HTML',
        reply_markup: groupManagementKeyboard
      }
    );

    logger.info(`User ${telegramId} (@${ctx.from?.username}) created group "${groupName}" with invite code ${group.invite_code}`);

  } catch (error) {
    logger.error('Error creating group:', error);
    
    if (error instanceof Error && error.message.includes('duplicate')) {
      await ctx.editMessageText('❌ Группа с таким названием уже существует. Выберите другое название.');
    } else {
      await ctx.editMessageText('❌ Произошла ошибка при создании группы. Попробуйте позже.');
    }
  }
}
