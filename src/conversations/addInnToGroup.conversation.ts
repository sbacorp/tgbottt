import { MyConversation } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context, InlineKeyboard } from "grammy";
import { createCancelKeyboard } from '../helpers/keyboard';
import { createTrackingMenuKeyboard } from '../features/tracking';
import { validateInn, ValidationError } from '../utils/validation';
import { monitoringService } from '../services/monitoringService';
import { PlatformZskService } from '../services/platform_zsk';
import { NotificationFormatter } from '../helpers/notificationFormatter';

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
    // 1. Всегда получаем свежие данные об организации из Контура
    const konturResult = await monitoringService.checkOrganization(inn);
    
    if (!konturResult) {
      await ctx.editMessageText(`❌ Организация с ИНН ${inn} не найдена в Контур.Фокус. Проверьте правильность ИНН.`);
      return;
    }
    
    // 2. Всегда получаем свежие данные из ЗСК
    await ctx.editMessageText('🔄 Проверяю в системе ЗСК...');
    let zskResult: { success: boolean; result: string } | null = null;
    try {
      const platformZskService = new PlatformZskService();
      await platformZskService.init();
      zskResult = await platformZskService.checkInn(inn);
      await platformZskService.close();
    } catch (error) {
      logger.error("Error checking ZSK in addInnToGroup:", error);
    }

    // 3. Сохраняем или обновляем организацию в базе данных
    const zskStatus = zskResult?.success ? (zskResult.result.toLowerCase().includes('имеются') ? 'red' : 'green') : 'green';
    await database.addOrganization({
      inn,
      name: konturResult.name || `Организация ${inn}`,
      status: konturResult.status || 'green',
      region: konturResult.region || '',
      riskInfo: konturResult.riskInfo || '',
      zskStatus: zskStatus,
      organizationStatus: konturResult.organizationStatus,
      hasRejectionsByLists: konturResult.hasRejectionsByLists,
      unreliableAddress: !!konturResult.unreliableData?.address,
      unreliableDirector: !!konturResult.unreliableData?.director,
      unreliableFounders: !!konturResult.unreliableData?.founders,
      ...(konturResult.unreliableData?.updateDate && { unreliableDataUpdateDate: konturResult.unreliableData.updateDate })
    });

    // 4. Добавляем организацию в группу
    await database.addGroupOrganization(userGroup.id, inn, telegramId);

    // 5. Формируем и отправляем сообщение с актуальными данными
    const backKeyboard = new InlineKeyboard()
      .text("📋 Список организаций", "tracking_organizations")
      .row()
      .text("🔙 Назад к управлению", "back_to_tracking");
      
    const message = NotificationFormatter.formatOrganizationCheck(
      inn,
      konturResult,
      zskResult || undefined,
      {
        customMessage: `<b>✅ Организация добавлена в группу "${userGroup.name}" для отслеживания.</b>`
      }
    );

    await ctx.reply(
      message,
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
        `<b>Организация уже отслеживается</b>\n\n` +
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