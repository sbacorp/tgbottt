import { MyContext } from '../types';
import { validateInnList, validateTelegramIdList } from '../utils/validation';
import { database } from '../database';
import { monitoringService } from '../services/monitoringService';
import { getNotificationService } from '../services/notificationService';

import { MESSAGES, config } from '../utils/config';
import { isBotAdmin } from '../guards/admin';
import logger from '../utils/logger';

/**
 * Обработчик команды /start
 */
export async function handleStart(ctx: MyContext): Promise<void> {
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    
    if (!telegramId) {
      await ctx.reply(MESSAGES.error);
      return;
    }

    // Проверка регистрации пользователя
    let user = await database.getUserByTelegramId(telegramId);
    const isAdmin = isBotAdmin(ctx);
    
    if (!user) {
      // Пользователь не зарегистрирован
      if (isAdmin) {
        // Автоматическая регистрация админа
        try {
          await createAdminUser(telegramId, username);
          user = await database.getUserByTelegramId(telegramId);
          await ctx.reply('✅ Вы зарегистрированы как администратор!');
        } catch (error) {
          logger.error('Error auto-registering admin:', error);
          await ctx.reply(MESSAGES.error);
          return;
        }
      } else {
        // Обычный пользователь не зарегистрирован
        await ctx.reply(MESSAGES.notRegistered);
        return;
      }
    } else if (isAdmin && !user.is_admin) {
      // Пользователь существует, но не является админом, а должен быть
      try {
        await database.updateUserAdminStatus(telegramId, true);
        user = await database.getUserByTelegramId(telegramId);
        await ctx.reply('✅ Ваши права администратора обновлены!');
      } catch (error) {
        logger.error('Error updating user to admin:', error);
      }
    }

    // Обновление сессии с правильными данными из базы
    ctx.session.isRegistered = true;
    ctx.session.isAdmin = user?.is_admin || isAdmin;
    ctx.session.language = 'ru';

    // Создание клавиатуры с кнопками согласно ТЗ
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Меню', callback_data: 'menu' },
          { text: '➕ Добавить ИНН', callback_data: 'add_inn' }
        ]
      ]
    };

    // Добавление административных кнопок
    if (ctx.session.isAdmin) {
      keyboard.inline_keyboard.push([
        { text: '👥 Список получателей', callback_data: 'users_list' },
        { text: '⚙️ Управление получателями', callback_data: 'manage_users' }
      ]);
      keyboard.inline_keyboard.push([
        { text: '🔧 Управление администраторами', callback_data: 'manage_admins' }
      ]);
    }

    // Отправка приветственного сообщения с кнопками
    await ctx.reply(MESSAGES.welcome, { reply_markup: keyboard });
    
    logger.info(`User ${telegramId} (@${username}) started the bot (isAdmin: ${ctx.session.isAdmin})`);
  } catch (error) {
    logger.error('Error in handleStart:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /menu
 */
export async function handleMenu(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 Список организаций', callback_data: 'organizations_list' },
          { text: '➕ Добавить ИНН', callback_data: 'add_inn' }
        ]
      ]
    };

    // Добавление административных кнопок
    if (ctx.session.isAdmin) {
      keyboard.inline_keyboard.push([
        { text: '👥 Список получателей', callback_data: 'users_list' },
        { text: '⚙️ Управление получателями', callback_data: 'manage_users' }
      ]);
      keyboard.inline_keyboard.push([
        { text: '🔧 Управление администраторами', callback_data: 'manage_admins' }
      ]);
    }

    await ctx.reply('Выберите действие:', { reply_markup: keyboard });
  } catch (error) {
    logger.error('Error in handleMenu:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /organizations
 */
export async function handleOrganizations(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const organizations = await database.getAllOrganizations();
    const { formatOrganizationList } = await import('../helpers/messages');
    
    const message = formatOrganizationList(organizations);
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error in handleOrganizations:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /add_inn
 */
export async function handleAddInn(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите ИНН для добавления. Например: /add_inn 1234567890 1234567891');
      return;
    }

    // Извлечение ИНН из команды
    const inns = text.replace('/add_inn', '').trim();
    if (!inns) {
      await ctx.reply('Пожалуйста, укажите ИНН для добавления. Например: /add_inn 1234567890 1234567891');
      return;
    }

    const { valid, invalid } = validateInnList(inns);
    
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
        await getNotificationService().sendNewOrganizationsNotification(
          addedOrganizations.map(inn => ({ inn, name: `Организация ${inn}` }))
        );
      }
    } else {
      await ctx.reply('Не удалось добавить ни одной организации.');
    }
  } catch (error) {
    logger.error('Error in handleAddInn:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /remove_inn
 */
export async function handleRemoveInn(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите ИНН для удаления. Например: /remove_inn 1234567890 1234567891');
      return;
    }

    const inns = text.replace('/remove_inn', '').trim();
    if (!inns) {
      await ctx.reply('Пожалуйста, укажите ИНН для удаления. Например: /remove_inn 1234567890 1234567891');
      return;
    }

    const { valid, invalid } = validateInnList(inns);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат ИНН: ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      await ctx.reply('Не найдено валидных ИНН для удаления.');
      return;
    }

    // Удаление организаций
    const removedOrganizations = [];
    for (const inn of valid) {
      try {
        const org = await database.getOrganizationByInn(inn);
        if (org) {
          await database.deleteOrganization(inn);
          removedOrganizations.push({ inn, name: org.name });
        }
      } catch (error) {
        logger.error(`Error removing organization ${inn}:`, error);
      }
    }

    if (removedOrganizations.length > 0) {
      await ctx.reply(MESSAGES.innRemoved(removedOrganizations.map(org => org.inn)));
      
      // Уведомление администраторов
      await getNotificationService().sendRemovedOrganizationsNotification(removedOrganizations);
    } else {
      await ctx.reply('Не удалось удалить ни одной организации.');
    }
  } catch (error) {
    logger.error('Error in handleRemoveInn:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /users
 */
export async function handleUsers(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const users = await database.getAllUsers();
    
    if (users.length === 0) {
      await ctx.reply(MESSAGES.noUsers);
      return;
    }

    let message = '👥 Список получателей (актуальный):\n\n';
    
    for (const user of users) {
      const adminBadge = user.is_admin ? ' Администратор' : '';
      const username = user.username ? `@${user.username}` : `ID: ${user.telegram_id}`;
      
      message += `${username}${adminBadge}\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    logger.error('Error in handleUsers:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /add_users
 */
export async function handleAddUsers(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите telegram_id для добавления. Например: /add_users 123456789 987654321');
      return;
    }

    const telegramIds = text.replace('/add_users', '').trim();
    if (!telegramIds) {
      await ctx.reply('Пожалуйста, укажите telegram_id для добавления. Например: /add_users 123456789 987654321');
      return;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIds);
    
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
  } catch (error) {
    logger.error('Error in handleAddUsers:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /remove_users
 */
export async function handleRemoveUsers(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите telegram_id для удаления. Например: /remove_users 123456789 987654321');
      return;
    }

    const telegramIds = text.replace('/remove_users', '').trim();
    if (!telegramIds) {
      await ctx.reply('Пожалуйста, укажите telegram_id для удаления. Например: /remove_users 123456789 987654321');
      return;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIds);
    
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
  } catch (error) {
    logger.error('Error in handleRemoveUsers:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /check
 */
export async function handleCheck(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите ИНН для проверки. Например: /check 1234567890');
      return;
    }

    const inn = text.replace('/check', '').trim();
    if (!inn) {
      await ctx.reply('Пожалуйста, укажите ИНН для проверки. Например: /check 1234567890');
      return;
    }

    // Валидация ИНН
    const { validateInn } = await import('../utils/validation');
    if (!validateInn(inn)) {
      await ctx.reply(MESSAGES.invalidInn);
      return;
    }

    await ctx.reply('🔍 Выполняется проверка организации через Контур.Фокус...');

    // Выполнение проверки через monitoringService (обновляет данные в БД)
    const result = await monitoringService.checkOrganization(inn);
    console.log(result, 'result')
    
    if (result) {
      const statusMessage = config.STATUS_MESSAGE[result.status]
      
      let message = `📊 <b>Результат проверки ИНН ${inn}</b>\n\n`;
      message += `🏢 <b>Актуальное название компании:</b> ${result.name}\n`;
      
      if (result.address) {
        message += `📍 <b>Адрес:</b> ${result.address}\n`;
      }
      
      if (result.registrationDate) {
        message += `📅 <b>Дата регистрации:</b> ${result.registrationDate}\n`;
      }
      
      if (result.isLiquidated && result.liquidationDate) {
        message += `⚠️ <b>Ликвидация:</b> ${result.liquidationDate}\n`;
      }
      
      if (result.illegalitySigns && result.illegalitySigns.length > 0) {
        message += `🚨 <b>Признаки нелегальности:</b> ${result.illegalitySigns.join(', ')}\n`;
      }
      
      if (result.activities && result.activities.length > 0) {
        message += `🏢 <b>Деятельность:</b> ${result.activities[0]}\n`;
      }
      message += `🚦 ЗСК:\n`
      message += `${statusMessage}\n`;
      
      await ctx.reply(message, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ Организация с ИНН ${inn} не найдена`);
    }
  } catch (error) {
    logger.error('Error in handleCheck:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /status
 */
export async function handleStatus(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const isRunning = monitoringService.isMonitoringRunning();
    
    let message = '📊 Статус системы:\n\n';
    message += `🔄 Мониторинг: ${isRunning ? '✅ Запущен' : '❌ Остановлен'}\n`;

    // Статистика
    const organizations = await database.getAllOrganizations();
    const users = await database.getAllUsers();
    
    const redCount = organizations.filter(org => org.status === 'red').length;
    const orangeCount = organizations.filter(org => org.status === 'orange').length;
    const greenCount = organizations.filter(org => org.status === 'green').length;

    message += `\n📈 Статистика:\n`;
    message += `🏢 Организаций: ${organizations.length}\n`;
    message += `🔴 Красный список: ${redCount}\n`;
    message += `🟡 Желтый список: ${orangeCount}\n`;
    message += `🟢 Зелёный список: ${greenCount}\n`;
    message += `👥 Пользователей: ${users.length}`;

    await ctx.reply(message);
  } catch (error) {
    logger.error('Error in handleStatus:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /help
 */
export async function handleHelp(ctx: MyContext): Promise<void> {
  try {
    const helpMessage = `🤖 <b>Справка по командам бота</b>\n\n` +
      `<b>Основные команды:</b>\n` +
      `/start - Запуск бота\n` +
      `/menu - Главное меню\n` +
      `/organizations - Список организаций\n` +
      `/add_inn ИНН1 ИНН2 - Добавить ИНН для отслеживания\n` +
      `/check ИНН - Проверить конкретную организацию\n` +
      `/status - Статус системы\n` +
      `/help - Эта справка\n\n` +
      
      `<b>Административные команды:</b>\n` +
      `/users - Список пользователей\n` +
      `/add_users 123456789 987654321 - Добавить пользователей по telegram_id\n` +
      `/remove_users 123456789 987654321 - Удалить пользователей по telegram_id\n` +
      `/add_admins 123456789 987654321 - Добавить администраторов по telegram_id\n` +
      `/remove_admins 123456789 987654321 - Удалить администраторов по telegram_id\n` +
      `/remove_inn ИНН1 ИНН2 - Удалить ИНН из отслеживания\n\n` +
      
      `<b>Примеры:</b>\n` +
      `/add_inn 1234567890 1234567891\n` +
      `/check 1234567890\n` +
      `/add_users 123456789 987654321\n` +
      `/add_admins 123456789 987654321`;

    await ctx.reply(helpMessage, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error in handleHelp:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /add_admins
 */
export async function handleAddAdmins(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите telegram_id для назначения администратором. Например: /add_admins 123456789 987654321');
      return;
    }

    const telegramIds = text.replace('/add_admins', '').trim();
    if (!telegramIds) {
      await ctx.reply('Пожалуйста, укажите telegram_id для назначения администратором. Например: /add_admins 123456789 987654321');
      return;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIds);
    
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
  } catch (error) {
    logger.error('Error in handleAddAdmins:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /remove_admins
 */
export async function handleRemoveAdmins(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await ctx.reply('Пожалуйста, укажите telegram_id для снятия прав администратора. Например: /remove_admins 123456789 987654321');
      return;
    }

    const telegramIds = text.replace('/remove_admins', '').trim();
    if (!telegramIds) {
      await ctx.reply('Пожалуйста, укажите telegram_id для снятия прав администратора. Например: /remove_admins 123456789 987654321');
      return;
    }

    const { valid, invalid } = validateTelegramIdList(telegramIds);
    
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
  } catch (error) {
    logger.error('Error in handleRemoveAdmins:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик команды /setcommands
 */
export async function handleSetCommands(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !isBotAdmin(ctx)) {
      await ctx.reply(MESSAGES.adminOnly);
      return;
    }

    // Установка команд для обычных пользователей
    await ctx.api.setMyCommands([
      { command: "start", description: "Запуск бота" },
      { command: "menu", description: "Главное меню" },
      { command: "organizations", description: "Список организаций" },
      { command: "add_inn", description: "Добавить ИНН для отслеживания" },
      { command: "check", description: "Проверить организацию" },
      { command: "status", description: "Статус системы" },
      { command: "help", description: "Справка по командам" },
    ], {
      scope: {
        type: "all_private_chats",
      },
    });

    // Установка команд для администраторов
    const adminCommands = [
      { command: "start", description: "Запуск бота" },
      { command: "menu", description: "Главное меню" },
      { command: "organizations", description: "Список организаций" },
      { command: "add_inn", description: "Добавить ИНН для отслеживания" },
      { command: "check", description: "Проверить организацию" },
      { command: "status", description: "Статус системы" },
      { command: "help", description: "Справка по командам" },
      { command: "users", description: "Список получателей" },
      { command: "add_users", description: "Добавить получателей по telegram_id" },
      { command: "remove_users", description: "Удалить получателей по telegram_id" },
      { command: "add_admins", description: "Добавить администраторов по telegram_id" },
      { command: "remove_admins", description: "Удалить администраторов по telegram_id" },
      { command: "remove_inn", description: "Удалить ИНН из отслеживания" },
      { command: "setcommands", description: "Обновить команды" },
    ];

    for (const adminId of config.adminUserIds) {
      await ctx.api.setMyCommands(adminCommands, {
        scope: {
          type: "chat",
          chat_id: adminId,
        },
      });
    }

    await ctx.reply("✅ Команды обновлены");
  } catch (error) {
    logger.error('Error in handleSetCommands:', error);
    await ctx.reply("❌ Ошибка при обновлении команд");
  }
}

/**
 * Функция для создания пользователя-администратора
 */
export async function createAdminUser(telegramId: number, username?: string): Promise<void> {
  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await database.getUserByTelegramId(telegramId);
    
    if (existingUser) {
      // Если пользователь существует, обновляем его права на администратора
      await database.updateUserAdminStatus(telegramId, true);
      logger.info(`User ${telegramId} (@${username}) promoted to admin`);
    } else {
      // Создаем нового пользователя-администратора
      await database.createUser(telegramId, username, true);
      logger.info(`Created new admin user ${telegramId} (@${username})`);
    }
  } catch (error) {
    logger.error(`Error creating admin user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Функция для создания обычного пользователя
 */
export async function createRegularUser(telegramId: number, username?: string): Promise<void> {
  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await database.getUserByTelegramId(telegramId);
    
    if (!existingUser) {
      // Создаем нового обычного пользователя
      await database.createUser(telegramId, username, false);
      logger.info(`Created new regular user ${telegramId} (@${username})`);
    }
  } catch (error) {
    logger.error(`Error creating regular user ${telegramId}:`, error);
    throw error;
  }
}
