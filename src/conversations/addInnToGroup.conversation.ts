import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';
import { createTrackingMenuKeyboard } from '../features/tracking';
import { validateInn, ValidationError } from '../utils/validation';
import { monitoringService } from '../services/monitoringService';

/**
 * Conversation для добавления ИНН организации в группу
 */
export async function addInnToGroupConversation(
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
    await ctx.editMessageText('❌ У вас нет группы для добавления организаций. Создайте группу сначала.');
    return;
  }

  let inn: string;
  
  await ctx.editMessageText(
    `➕ <b>Добавление организации в группу "${userGroup.name}"</b>\n\n` +
    `Введите ИНН организации для добавления в отслеживание:`,
    {
      parse_mode: 'HTML',
      reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
    }
  );

  // Валидация ИНН
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

    inn = context.message?.text?.trim() || '';

    if (!inn) {
      await context.reply('❌ ИНН не может быть пустым. Попробуйте еще раз:', {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    const error: ValidationError = { code: 0, message: '' };
    if (!validateInn(inn, error)) {
      await context.reply(`❌ ${error.message}. Попробуйте еще раз:`, {
        reply_markup: createCancelKeyboard("back_to_tracking", "🔙 Назад к управлению")
      });
      continue;
    }

    break;
  } while (true);

  await ctx.editMessageText('🔄 Проверяю и добавляю организацию...');

  try {
    // Проверяем, есть ли организация в базе, если нет - добавляем
    let organization = await database.getOrganizationByInn(inn);
    
    if (!organization) {
      // Получаем данные об организации
      const orgData = await monitoringService.checkOrganization(inn);
      
      const addedOrg = await database.addOrganizationIfNotExists({
        inn,
        name: orgData?.name || `Организация ${inn}`,
        status: orgData?.status || 'green',
        address: orgData?.address || '',
        region: orgData?.region || ''


      });

      if (addedOrg) {
        organization = addedOrg;
        logger.info(`Added new organization ${inn} to database`);
      } else {
        organization = await database.getOrganizationByInn(inn);
      }
    }

    if (!organization) {
      await ctx.editMessageText(`❌ Организация с ИНН ${inn} не найдена или не существует. Проверьте правильность ИНН.`);
      return;
    }

    // Добавляем организацию в группу
    await database.addGroupOrganization(userGroup.id, inn, telegramId);

    // Создаем клавиатуру для возврата к управлению
    const backKeyboard = new InlineKeyboard()
      .text("📋 Список организаций", "tracking_organizations")
      .row()
      .text("🔙 Назад к управлению", "back_to_tracking");

    await ctx.reply(
      `✅ <b>Организация добавлена!</b>\n\n` +
      `🏢 <b>Название:</b> ${organization.name}\n` +
      `🆔 <b>ИНН:</b> ${inn}\n` +
      `📊 <b>Статус:</b> ${statusColorMap[organization.status]}\n\n` +
      `Организация успешно добавлена в группу "${userGroup.name}" для отслеживания.`,
      {
        parse_mode: 'HTML',
        reply_markup: backKeyboard
      }
    );

    logger.info(`User ${telegramId} added organization ${inn} to group ${userGroup.id}`);

  } catch (error) {
    logger.error('Error adding organization to group:', error);
    
    if (error instanceof Error && error.message.includes('duplicate')) {
      await ctx.editMessageText(
        `ℹ️ <b>Организация уже отслеживается</b>\n\n` +
        `ИНН ${inn} уже добавлен в группу "${userGroup.name}".`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text("🔙 Назад к управлению", "back_to_tracking")
        }
      );
    } else {
      await ctx.editMessageText('❌ Произошла ошибка при добавлении организации. Попробуйте позже.');
    }
  }
}


export const statusColorMap = {
  'red': 'Красный',
  'orange': 'Желтый',
  'green': 'Зеленый'
}