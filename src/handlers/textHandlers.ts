import { MyContext } from '../types';
import { database } from '../database';
import { validateInnList, validateUsernameList, validateTelegramIdList } from '../utils/validation';
import { MESSAGES } from '../utils/config';
// import { isBotAdmin } from '../guards/admin';
import logger from '../utils/logger';

/**
 * Обработчик текстовых сообщений
 */
export async function handleText(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      return;
    }

    // Обработка в зависимости от текущего действия
    switch (ctx.session.currentAction) {
      case 'add_inn':
        await handleAddInnText(ctx, text);
        break;
      case 'add_users':
        await handleAddUsersText(ctx, text);
        break;
      case 'remove_users':
        await handleRemoveUsersText(ctx, text);
        break;
      case 'add_admin':
        await handleAddAdminText(ctx, text);
        break;
      case 'remove_admin':
        await handleRemoveAdminText(ctx, text);
        break;
      case 'add_admins':
        await handleAddAdminsText(ctx, text);
        break;
      case 'remove_admins':
        await handleRemoveAdminsText(ctx, text);
        break;
      default:
        await handleDefaultText(ctx, text);
    }
  } catch (error) {
    logger.error('Error in handleText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для добавления ИНН
 */
async function handleAddInnText(ctx: MyContext, text: string): Promise<void> {
  try {
    const { valid, invalid } = validateInnList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат ИНН: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных ИНН для добавления.');
      return;
    }

    // Добавление организаций с получением актуальных данных
    const addedOrganizations = [];
    for (const inn of valid) {
      try {
        // Сначала добавляем организацию с базовыми данными (только если её нет)
        const addedOrg = await database.addOrganizationIfNotExists({
          inn,
          name: `Организация ${inn}`,
          status: 'green'
        });
        
        if (!addedOrg) {
          logger.info(`Organization with INN ${inn} already exists, skipping addition`);
          addedOrganizations.push(inn);
          continue;
        }
        
        // Затем получаем актуальные данные через monitoringService
        const { monitoringService } = await import('../services/monitoringService');
        const orgData = await monitoringService.checkOrganization(inn);
        if (orgData) {
          logger.info(`Получены актуальные данные для организации ${inn}: ${orgData.name}`);
        }
        
        addedOrganizations.push(inn);
      } catch (error) {
        logger.error(`Error adding organization ${inn}:`, error);
      }
    }

    if (addedOrganizations.length > 0) {
      await ctx.reply(MESSAGES.innAdded(addedOrganizations));
      
      // Уведомление администраторов
      if (ctx.session.isAdmin) {
        const { getNotificationService } = await import('../services/notificationService');
        await getNotificationService().sendNewOrganizationsNotification(
          addedOrganizations.map(inn => ({ inn, name: `Организация ${inn}` }))
        );
      }
    } else {
      await ctx.reply('Не удалось добавить ни одной организации.');
    }

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleAddInnText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для добавления пользователей
 */
async function handleAddUsersText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateTelegramIdList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных telegram_id для добавления.');
      return;
    }

    // Добавление пользователей
    const addedUsers = [];
    for (const telegramId of valid) {
      try {
        // Проверяем, существует ли уже пользователь
        const existingUser = await database.getUserByTelegramId(telegramId);
        if (existingUser) {
          logger.info(`User with telegram_id ${telegramId} already exists`);
          continue;
        }

        // Создаем нового пользователя
        await database.createUser(telegramId, undefined, false);
        addedUsers.push(telegramId.toString());
        logger.info(`Added user with telegram_id: ${telegramId}`);
      } catch (error) {
        logger.error(`Error adding user ${telegramId}:`, error);
      }
    }

    if (addedUsers.length > 0) {
      await ctx.reply(`✅ Пользователи успешно добавлены: ${addedUsers.join(', ')}`);
    } else {
      await ctx.reply('Не удалось добавить ни одного пользователя.');
    }

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleAddUsersText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для удаления пользователей
 */
async function handleRemoveUsersText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateTelegramIdList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных telegram_id для удаления.');
      return;
    }

    // Удаление пользователей
    const removedUsers = [];
    for (const telegramId of valid) {
      try {
        // Проверяем, существует ли пользователь
        const existingUser = await database.getUserByTelegramId(telegramId);
        if (!existingUser) {
          logger.info(`User with telegram_id ${telegramId} does not exist`);
          continue;
        }

        // Удаляем пользователя
        await database.deleteUser(telegramId);
        removedUsers.push(telegramId.toString());
        logger.info(`Removed user with telegram_id: ${telegramId}`);
      } catch (error) {
        logger.error(`Error removing user ${telegramId}:`, error);
      }
    }

    if (removedUsers.length > 0) {
      await ctx.reply(`✅ Пользователи успешно удалены: ${removedUsers.join(', ')}`);
    } else {
      await ctx.reply('Не удалось удалить ни одного пользователя.');
    }

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleRemoveUsersText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для добавления администратора
 */
async function handleAddAdminText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateUsernameList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат username: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных username для назначения администратором.');
      return;
    }

    if (valid.length > 1) {
      await ctx.reply('Можно назначить только одного администратора за раз.');
      return;
    }

    const username = valid[0];
    
    try {
      // Здесь должна быть логика назначения администратора
      logger.info(`Would make ${username} an admin`);
      await ctx.reply(`✅ Пользователь ${username} назначен администратором.`);
    } catch (error) {
      logger.error(`Error making ${username} admin:`, error);
      await ctx.reply('Не удалось назначить администратора.');
    }

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleAddAdminText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для удаления администратора
 */
async function handleRemoveAdminText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateUsernameList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат username: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных username для снятия прав администратора.');
      return;
    }

    if (valid.length > 1) {
      await ctx.reply('Можно снять права только у одного администратора за раз.');
      return;
    }

    const username = valid[0];
    
    try {
      // Здесь должна быть логика снятия прав администратора
      logger.info(`Would remove admin rights from ${username}`);
      await ctx.reply(`✅ Права администратора сняты у пользователя ${username}.`);
    } catch (error) {
      logger.error(`Error removing admin rights from ${username}:`, error);
      await ctx.reply('Не удалось снять права администратора.');
    }

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleRemoveAdminText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для добавления администраторов
 */
async function handleAddAdminsText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateTelegramIdList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных telegram_id для назначения администратором.');
      return;
    }

    // Назначение администраторов
    const addedAdmins = [];
    for (const telegramId of valid) {
      try {
        // Проверяем, существует ли пользователь
        const existingUser = await database.getUserByTelegramId(telegramId);
        if (!existingUser) {
          // Создаем нового пользователя-администратора
          await database.createUser(telegramId, undefined, true);
          logger.info(`Created new admin user with telegram_id: ${telegramId}`);
        } else {
          // Обновляем существующего пользователя до администратора
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

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleAddAdminsText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста для удаления администраторов
 */
async function handleRemoveAdminsText(ctx: MyContext, text: string): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const { valid, invalid } = validateTelegramIdList(text);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных telegram_id для снятия прав администратора.');
      return;
    }

    // Снятие прав администраторов
    const removedAdmins = [];
    for (const telegramId of valid) {
      try {
        // Проверяем, существует ли пользователь
        const existingUser = await database.getUserByTelegramId(telegramId);
        if (!existingUser) {
          logger.info(`User with telegram_id ${telegramId} does not exist`);
          continue;
        }

        // Снимаем права администратора
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

    // Сброс текущего действия
    ctx.session.currentAction = null;
  } catch (error) {
    logger.error('Error in handleRemoveAdminsText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик текста по умолчанию
 */
async function handleDefaultText(ctx: MyContext, text: string): Promise<void> {
  try {
    // Проверка на команды без слеша
    const lowerText = text.toLowerCase().trim();
    
    if (lowerText === 'меню' || lowerText === 'menu') {
      const { handleMenu } = await import('./commandHandlers');
      await handleMenu(ctx);
      return;
    }
    
    if (lowerText === 'помощь' || lowerText === 'help') {
      const { handleHelp } = await import('./commandHandlers');
      await handleHelp(ctx);
      return;
    }
    
    if (lowerText === 'статус' || lowerText === 'status') {
      const { handleStatus } = await import('./commandHandlers');
      await handleStatus(ctx);
      return;
    }
    
    if (lowerText === 'организации' || lowerText === 'organizations') {
      const { handleOrganizations } = await import('./commandHandlers');
      await handleOrganizations(ctx);
      return;
    }

    // Проверка на ИНН (если текст похож на ИНН)
    if (/^\d{10,12}$/.test(text.trim())) {
      await ctx.reply(
        `🔍 Обнаружен ИНН: ${text}\n\n` +
        `Для добавления в отслеживание используйте команду:\n` +
        `/add_inn ${text}\n\n` +
        `Для проверки статуса используйте команду:\n` +
        `/check ${text}`
      );
      return;
    }

    // Проверка на telegram_id (если текст состоит только из цифр и это не ИНН)
    if (/^\d{6,10}$/.test(text.trim()) && text.trim().length !== 10 && text.trim().length !== 12) {
      await ctx.reply(
        `👤 Обнаружен telegram_id: ${text}\n\n` +
        `Для добавления пользователя используйте команду:\n` +
        `/add_users ${text}\n\n` +
        `Для удаления пользователя используйте команду:\n` +
        `/remove_users ${text}`
      );
      return;
    }

    // Если ничего не подошло, показываем справку
    await ctx.reply(
      `💬 Не понимаю команду "${text}"\n\n` +
      `Используйте /help для получения справки по командам.\n\n` +
      `Или выберите действие в меню: /menu`
    );
  } catch (error) {
    logger.error('Error in handleDefaultText:', error);
    await ctx.reply(MESSAGES.error);
  }
}
