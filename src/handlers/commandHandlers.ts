import { MyContext } from '../types';
import { validateTelegramIdList } from '../utils/validation';
import { database } from '../database';
import { monitoringService } from '../services/monitoringService';

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
    ctx.session.isAdmin = (user?.is_admin || isAdmin) ?? false;
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

    // Запускаем conversation для добавления ИНН
    await ctx.conversation.enter("add_inn");
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

    // Запускаем conversation для удаления ИНН
    await ctx.conversation.enter("remove_inn");
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

    // Запускаем conversation для добавления пользователей
    await ctx.conversation.enter("add_users");
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

    // Запускаем conversation для удаления пользователей
    await ctx.conversation.enter("remove_users");
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

    // Запускаем conversation для проверки
    await ctx.conversation.enter("check");
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

    // Запускаем conversation для добавления администраторов
    await ctx.conversation.enter("add_admins");
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
