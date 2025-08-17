import { MyContext } from '../types';
import { database } from '../database';
import { MESSAGES, STATUS_EMOJIS, STATUS_NAMES } from '../utils/config';
// import { isBotAdmin } from '../guards/admin';
import logger from '../utils/logger';

/**
 * Обработчик callback запросов
 */
export async function handleCallback(ctx: MyContext): Promise<void> {
  try {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) {
      await ctx.answerCallbackQuery('Ошибка: нет данных');
      return;
    }

    // Обработка различных типов callback
    switch (callbackData) {
      case 'menu':
        await handleMenuCallback(ctx);
        break;
      case 'add_inn':
        await handleAddInnCallback(ctx);
        break;
      case 'users_list':
        await handleUsersListCallback(ctx);
        break;
      case 'manage_users':
        await handleManageUsersCallback(ctx);
        break;
      case 'manage_admins':
        await handleManageAdminsCallback(ctx);
        break;
      case 'organizations_list':
        await handleOrganizationsListCallback(ctx);
        break;
      case 'add_users':
        await handleAddUsersCallback(ctx);
        break;
      case 'remove_users':
        await handleRemoveUsersCallback(ctx);
        break;
      case 'add_admin':
        await handleAddAdminCallback(ctx);
        break;
      case 'remove_admin':
        await handleRemoveAdminCallback(ctx);
        break;
      default:
        await ctx.answerCallbackQuery('Неизвестная команда');
    }
  } catch (error) {
    logger.error('Error in handleCallback:', error);
    await ctx.answerCallbackQuery('Произошла ошибка');
  }
}

/**
 * Обработчик callback для меню
 */
async function handleMenuCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.answerCallbackQuery('Вы не зарегистрированы');
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

    await ctx.editMessageText('Выберите действие:', { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleMenuCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при отображении меню');
  }
}

/**
 * Обработчик callback для добавления ИНН
 */
async function handleAddInnCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.answerCallbackQuery('Вы не зарегистрированы');
      return;
    }

    // Установка состояния ожидания ввода ИНН
    ctx.session.currentAction = 'add_inn';
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'menu' }]
      ]
    };

    await ctx.editMessageText(
      'Введите ИНН для добавления (несколько ИНН через пробел):\n\n' +
      'Пример: 1234567890 1234567891',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleAddInnCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при добавлении ИНН');
  }
}

/**
 * Обработчик callback для списка пользователей
 */
async function handleUsersListCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    const users = await database.getAllUsers();
    
    if (users.length === 0) {
      await ctx.editMessageText(MESSAGES.noUsers);
      await ctx.answerCallbackQuery();
      return;
    }

    let message = '👥 Список получателей (актуальный):\n\n';
    
    for (const user of users) {
      const adminBadge = user.is_admin ? ' Администратор' : '';
      const username = user.username ? `@${user.username}` : `ID: ${user.telegram_id}`;
      
      message += `${username}${adminBadge}\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'menu' }]
      ]
    };

    await ctx.editMessageText(message, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleUsersListCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при получении списка пользователей');
  }
}

/**
 * Обработчик callback для управления пользователями
 */
async function handleManageUsersCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить пользователей', callback_data: 'add_users' },
          { text: '➖ Удалить пользователей', callback_data: 'remove_users' }
        ],
        [{ text: '🔙 Назад', callback_data: 'menu' }]
      ]
    };

    await ctx.editMessageText(
      'Управление пользователями:\n\n' +
      'Выберите действие для управления списком получателей уведомлений.',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleManageUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при управлении пользователями');
  }
}

/**
 * Обработчик callback для управления администраторами
 */
async function handleManageAdminsCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить администратора', callback_data: 'add_admin' },
          { text: '➖ Удалить администратора', callback_data: 'remove_admin' }
        ],
        [{ text: '🔙 Назад', callback_data: 'menu' }]
      ]
    };

    await ctx.editMessageText(
      'Управление администраторами:\n\n' +
      'Выберите действие для управления правами администраторов.',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleManageAdminsCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при управлении администраторами');
  }
}

/**
 * Обработчик callback для списка организаций
 */
async function handleOrganizationsListCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.answerCallbackQuery('Вы не зарегистрированы');
      return;
    }

    const organizations = await database.getAllOrganizations();
    
    if (organizations.length === 0) {
      await ctx.editMessageText(MESSAGES.noOrganizations);
      await ctx.answerCallbackQuery();
      return;
    }

    let message = '📋 Список отслеживаемых организаций:\n\n';
    
    for (const org of organizations) {
      const emoji = STATUS_EMOJIS[org.status as keyof typeof STATUS_EMOJIS];
      const statusName = STATUS_NAMES[org.status as keyof typeof STATUS_NAMES];
      
      message += `${emoji} <b>${org.inn}</b>\n`;
      message += `   Название: ${org.name || 'Не указано'}\n`;
      message += `   Статус: ${statusName}\n`;
      message += `   Обновлено: ${org.updatedDate ? org.updatedDate.toLocaleDateString('ru-RU') : 'Не указано'}\n\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'menu' }]
      ]
    };

    await ctx.editMessageText(message, { 
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleOrganizationsListCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при получении списка организаций');
  }
}

/**
 * Обработчик callback для добавления пользователей
 */
async function handleAddUsersCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    // Установка состояния ожидания ввода username
    ctx.session.currentAction = 'add_users';
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'manage_users' }]
      ]
    };

    await ctx.editMessageText(
      'Введите telegram_id для добавления (несколько ID через пробел):\n\n' +
      'Пример: 123456789 987654321\n\n' +
      'Примечание: пользователи должны предварительно начать диалог с ботом.',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleAddUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при добавлении пользователей');
  }
}

/**
 * Обработчик callback для удаления пользователей
 */
async function handleRemoveUsersCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    // Установка состояния ожидания ввода username
    ctx.session.currentAction = 'remove_users';
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'manage_users' }]
      ]
    };

    await ctx.editMessageText(
      'Введите telegram_id для удаления (несколько ID через пробел):\n\n' +
      'Пример: 123456789 987654321',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleRemoveUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при удалении пользователей');
  }
}

/**
 * Обработчик callback для добавления администраторов
 */
async function handleAddAdminCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    // Установка состояния ожидания ввода username
    ctx.session.currentAction = 'add_admins';
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'manage_admins' }]
      ]
    };

    await ctx.editMessageText(
      'Введите telegram_id для назначения администраторами (несколько ID через пробел):\n\n' +
      'Пример: 123456789 987654321\n\n' +
      'Примечание: пользователи должны предварительно начать диалог с ботом.',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleAddAdminCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при добавлении администраторов');
  }
}

/**
 * Обработчик callback для удаления администраторов
 */
async function handleRemoveAdminCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Доступ запрещен');
      return;
    }

    // Установка состояния ожидания ввода username
    ctx.session.currentAction = 'remove_admins';
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 Назад', callback_data: 'manage_admins' }]
      ]
    };

    await ctx.editMessageText(
      'Введите telegram_id для снятия прав администраторов (несколько ID через пробел):\n\n' +
      'Пример: 123456789 987654321',
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleRemoveAdminCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при удалении администраторов');
  }
}
