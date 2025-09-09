import { MyConversation } from '../types';
import { validateTelegramIdList, validateInn, ValidationError } from '../utils/validation';
import { database } from '../database';
import { monitoringService } from '../services/monitoringService';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';
import { Context } from "grammy";
import { PlatformZskService } from '../services/platform_zsk';
import { createCancelKeyboard, createMainMenuKeyboard, createCheckResultKeyboard } from '../helpers/keyboard';
import { cbrService } from '../services/cbrService';

/**
 * Conversation для команды /check
 * Запрашивает ИНН у пользователя и выполняет проверку с валидацией
 */
export async function checkConversation(
  conversation: MyConversation,
  ctx: Context
) {
  let inn: string;
  const startMessage = await ctx.reply('🔍 Введите ИНН организации для проверки:', {
    reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
  });
  // Валидация ИНН с помощью do while
  do {

    const context = await conversation.wait()

    if (context.callbackQuery?.data === 'menu') {
      await ctx.deleteMessage();
      await ctx.deleteMessages([startMessage.message_id]);
      await ctx.reply('Для разовой проверки воспользуйтесь кнопкой "разовая проверка" или командой /check  Для подписки организаций на постоянное отслеживание воспользуйтесь кнопкой "отслеживание". В структуре меню на отслеживание вы можете назначить группу организаций и указать пользователей-получателей отчетов, просматривать списки пользователей-получателей уведомлений и редактировать их.', {
        reply_markup: createMainMenuKeyboard()
      });
      await context.answerCallbackQuery();
      return;
    }
    // @ts-expect-error
    inn = context.message.text?.trim() || '';

    if (!inn) {
      await ctx.reply('❌ ИНН не может быть пустым. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
      });
      continue;
    } 
    
    const error: ValidationError = { code: 0, message: '' };
    if (!validateInn(inn, error)) {
      await ctx.reply(`❌ ${error.message}\nПопробуйте еще раз.`, {
        reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
      });
      continue;
    }

    break;
  } while (true);

  const msg = await ctx.reply('🔍 Выполняется проверка организации...');

  try {
    // Получаем данные из Контур.Фокус
    const konturResult = await monitoringService.checkOrganization(inn);
    
    if (!konturResult) {
      await ctx.reply(`❌ Организация с ИНН ${inn} не найдена или не существует`, {
        reply_markup: createCheckResultKeyboard()
      });
      return;
    }


    await ctx.api.editMessageText(
      msg.chat.id,
      msg.message_id,
      '🔍 Проверяю в списках ЦБР...'
    );
    // Проверяем в списках ЦБР (отказы по спискам 764/639/550)
    const cbrResult = await cbrService.searchOrganization(inn);

    // Получаем результат проверки ЗСК
    await ctx.api.editMessageText(
      msg.chat.id,
      msg.message_id,
      '🔍 Проверяю в системе ЗСК...'
    );
    let zskResult: any = null;
    try {
      const platformZskService = new PlatformZskService();
      await platformZskService.init();
      zskResult = await platformZskService.checkInn(inn);
      await platformZskService.close();
    } catch (error) {
      logger.error('Error checking ZSK:', error);
    }

    // Формируем сообщение в новом формате
    let message = `Запрос: /${inn}\n`;
    message += `Актуальное название компании: ${konturResult.name}\n`;
    
    // Определяем статус организации
    if (konturResult.isLiquidated) {
      message += `Ликвидированная организация\n`;
    } else {
      message += `Действующая организация\n`;
    }

    message += `\n🚦 ЗСК\n`;
    
    // Добавляем результат проверки ЗСК
    if (zskResult && zskResult.success && zskResult.result) {
      const cleanResult = zskResult.result.replace('Проверить ещё один ИНН', '').trim();
      message += `📋 Результат проверки: ${cleanResult}\n`;
    } else {
      message += `📋 Результат проверки: Данные временно недоступны\n`;
    }

    // Определяем статус на основе данных Контур.Фокус
    let statusIcon = '🟢';
    let statusText = 'ЗЕЛЁНОЙ зоне, низкий риск';
    let riskLevel = '0';
    
    if (konturResult.status === 'red') {
      statusIcon = '🔴';
      statusText = 'КРАСНОЙ зоне, очень большой риск для работы!';
      riskLevel = '2';
    } else if (konturResult.status === 'orange') {
      statusIcon = '🟡';
      statusText = 'ЖЁЛТОЙ зоне, средний риск для работы';
      riskLevel = '1';
    }
    
    message += `\nТекущий риск: Уровень риска: ${statusIcon} ${riskLevel} - компания находится в ${statusText}\n`;
    message += `\n==============\n`;

    message += `\n〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️\n`;
    message += `🙅🏼 Отказы по спискам 764/639/550\n\n`;
    
    if (cbrResult) {
      message += `По данному ИНН найдены записи в отказах по спискам 764/639/550.\n`;
    } else {
      message += `По данному ИНН записей в отказах по спискам 764/639/550 не найдено.\n`;
    }

    message += `〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️\n`;
    
    // Добавляем информацию об автоматической проверке
    if (konturResult.additionalInfo) {
      message += `📊 ${konturResult.additionalInfo}\n\n`;
    }

    message += `\n🧾 Сведения недостоверны:\n\n`;
    if (konturResult.unreliableInfo) {
      message += `${konturResult.unreliableInfo}${konturResult.unreliableDate ? ` (дата: ${konturResult.unreliableDate})` : ''}\n`;
    } else {
      message += `Признаков недостоверности не обнаружено\n`;
    }

    await ctx.reply(message, { 
      reply_markup: createCheckResultKeyboard()
    });

  } catch (error) {
    logger.error('Error in checkConversation:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Conversation для команды /add_admins
 */
export async function addAdminsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }

  let telegramIdsStr: string;
  let validIds: number[] = [];
  await ctx.reply('👑 Введите telegram_id пользователей для назначения администраторами (можно несколько через пробел):', {
    reply_markup: createCancelKeyboard()
  });

  do {
    const context = await conversation.wait()
    if (context.callbackQuery?.data === 'cancel_conversation') {
      await ctx.reply('❌ Операция отменена');
      return;
    }
    telegramIdsStr = context.message?.text || '';

    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);

    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`, {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    validIds = valid;
    break;
  } while (true);

  await ctx.reply(`🔄 Назначаю ${validIds.length} администратора(ов)...`);

  const addedAdmins = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (!existingUser) {
        await database.createUser(telegramId, undefined, true);
        logger.info(`Created new admin user with telegram_id: ${telegramId}`);
      } else {
        await database.updateUserAdminStatus(telegramId, true);
        logger.info(`Updated user ${telegramId} to admin`);
      }
      addedAdmins.push(telegramId.toString());
    } catch (error) {
      logger.error(`Error making ${telegramId} admin:`, error);
    }
  }

  if (addedAdmins.length > 0) {
    await ctx.reply(`✅ Администраторы успешно назначены: ${addedAdmins.join(', ')}`);
  } else {
    await ctx.reply('Не удалось назначить ни одного администратора.');
  }
}

/**
 * Conversation для команды /remove_admins
 * Запрашивает telegram_id у администратора и снимает права администратора
 */
export async function removeAdminsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }

  let telegramIdsStr: string;
  let validIds: number[] = [];

  do {
    await ctx.reply('➖ Введите telegram_id администраторов для снятия прав (можно несколько через пробел):', {
      reply_markup: createCancelKeyboard()
    });
    const { message } = await conversation.waitFor("message:text");
    telegramIdsStr = message.text || '';

    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);

    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`, {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard()
      });
      continue;
    }

    validIds = valid;
    break;
  } while (true);

  await ctx.reply(`🔄 Снимаю права администратора у ${validIds.length} пользователя(ей)...`);

  const removedAdmins = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (!existingUser) {
        logger.info(`User with telegram_id ${telegramId} does not exist`);
        continue;
      }

      if (!existingUser.is_admin) {
        logger.info(`User with telegram_id ${telegramId} is not an admin`);
        continue;
      }

      await database.updateUserAdminStatus(telegramId, false);
      removedAdmins.push(telegramId.toString());
      logger.info(`Removed admin rights from user ${telegramId}`);
    } catch (error) {
      logger.error(`Error removing admin rights from ${telegramId}:`, error);
    }
  }

  if (removedAdmins.length > 0) {
    await ctx.reply(`✅ Права администратора сняты у: ${removedAdmins.join(', ')}`);
  } else {
    await ctx.reply('Не удалось снять права ни у одного администратора.');
  }
}

/**
 * Conversation для команды /check_cbr
 * Запрашивает ИНН у пользователя и выполняет проверку ЦБР с валидацией
 */
export async function checkCbrConversation(
  conversation: MyConversation,
  ctx: Context
) {
  let inn: string;
  const startMessage = await ctx.reply('🔍 Введите ИНН организации для проверки ЦБР:', {
    reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
  });

  // Валидация ИНН с помощью do while
  do {
    const context = await conversation.wait()
    if (context.callbackQuery?.data === 'menu') {
      await ctx.deleteMessage();
      await ctx.deleteMessages([startMessage.message_id]);
      await ctx.reply('Для разовой проверки воспользуйтесь кнопкой "разовая проверка" или командой /check  Для подписки организаций на постоянное отслеживание воспользуйтесь кнопкой "отслеживание". В структуре меню на отслеживание вы можете назначить группу организаций и указать пользователей-получателей отчетов, просматривать списки пользователей-получателей уведомлений и редактировать их.', {
        reply_markup: createMainMenuKeyboard()
      });
      await context.answerCallbackQuery();
      return;
    }
    inn = context.message?.text || '';

    if (!inn) {
      await ctx.reply('❌ ИНН не может быть пустым. Попробуйте еще раз.', {
        reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
      });
      continue;
    }

    const error: ValidationError = { code: 0, message: '' };
    if (!validateInn(inn, error)) {
      await ctx.reply(`❌ ${error.message}\nПопробуйте еще раз.`, {
        reply_markup: createCancelKeyboard("menu", "🔙 Назад в главное меню")
      });
      continue;
    }

    break;
  } while (true);

  try {
    logger.info('Creating Platform ZSK service instance...');


    // Выполняем проверку с 3 попытками
    let result: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          await ctx.reply(`🔄 Попытка #${attempt} из ${maxAttempts}...`);
        }
        const platformZskService = new PlatformZskService();
        await platformZskService.init();

        await ctx.reply(`🔍 Проверяю ИНН: ${inn}`);
        result = await platformZskService.checkInn(inn);

        // Если получили результат без ошибки, выходим из цикла
        if (result && !result.error) {
          break;
        }
        await platformZskService.close();
        // Если есть ошибка и это не последняя попытка
        if (attempt < maxAttempts) {
          await ctx.reply(`⚠️ Ошибка на попытке #${attempt}. Повторяю через 3 секунды...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        logger.error(`Ошибка при проверке ИНН ${inn}, попытка ${attempt}:`, error);

        if (attempt < maxAttempts) {
          await ctx.reply(`❌ Ошибка на попытке #${attempt}. Повторяю через 3 секунды...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          result = { error: `Ошибка после ${maxAttempts} попыток: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` };
        }
      }
    }

    console.log(result, 'result');
    if (result.success) {
      // Проверяем наличие слова "имеются" в результате
      const hasIllegalActivity = result.result.toLowerCase().includes('имеются');
      const statusIcon = hasIllegalActivity ? '🔴' : '🟢';
      //удаляю Проверить ещё один ИНН из сообщения
      const resMessage = result.result.replace('Проверить ещё один ИНН', '');

      await ctx.reply(`${statusIcon} Проверка ЦБР завершена!\n\n📋 Результат:\n${resMessage}`, {
        reply_markup: createCheckResultKeyboard()
      });
    } else {
      await ctx.reply(`❌ Ошибка при проверке ЦБР: Попробуйте позже`, {
        reply_markup: createCheckResultKeyboard()
      });
    }
  } catch (error) {
    logger.error('Error in Platform ZSK service:', error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`❌ Произошла ошибка при проверке ЦБР: ${errorMessage}`, {
      reply_markup: createCheckResultKeyboard()
    });
  }
}
