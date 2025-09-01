import { MyContext } from '../types';
import { database } from '../database';
import { MESSAGES, STATUS_EMOJIS } from '../utils/config';
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
      case 'add_admins':
        await handleAddAdminsCallback(ctx);
        break;
      case 'remove_admins':
        await handleRemoveAdminsCallback(ctx);
        break;
      case 'cancel_conversation':
        await handleCancelConversationCallback(ctx);
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
 * Обработчик callback для добавления ИНН - запускает conversation
 */
async function handleAddInnCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.answerCallbackQuery('Вы не зарегистрированы');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add_inn");
  } catch (error) {
    logger.error('Error in handleAddInnCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при запуске добавления ИНН');
  }
}

/**
 * Обработчик callback для списка пользователей
 */
async function handleUsersListCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
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
      const adminBadge = user.is_admin ? ' 👑' : '';
      const username = user.username ? `@${user.username}` : `ID: ${user.telegram_id}`;
      
      message += `${username}${adminBadge}\n`;
    }

    await ctx.editMessageText(message);
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
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Добавить пользователей', callback_data: 'add_users' },
          { text: '➖ Удалить пользователей', callback_data: 'remove_users' }
        ],
        [
          { text: '🔙 Назад в меню', callback_data: 'menu' }
        ]
      ]
    };

    await ctx.editMessageText('Управление получателями:', { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleManageUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при отображении управления пользователями');
  }
}

/**
 * Обработчик callback для управления администраторами
 */
async function handleManageAdminsCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👑 Назначить администраторов', callback_data: 'add_admins' },
          { text: '➖ Снять права админа', callback_data: 'remove_admins' }
        ],
        [
          { text: '🔙 Назад в меню', callback_data: 'menu' }
        ]
      ]
    };

    await ctx.editMessageText('Управление администраторами:', { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleManageAdminsCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при отображении управления администраторами');
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
      await ctx.editMessageText('📋 <b>Список организаций пуст</b>\n\nДобавьте организации для мониторинга с помощью команды /add_inn', 
        { parse_mode: 'HTML' });
      await ctx.answerCallbackQuery();
      return;
    }

    let message = '📋 <b>Отслеживаемые организации:</b>\n\n';
    
    // Группировка по статусам
    const redOrgs = organizations.filter(org => org.status === 'red');
    const orangeOrgs = organizations.filter(org => org.status === 'orange');
    const greenOrgs = organizations.filter(org => org.status === 'green');

    if (redOrgs.length > 0) {
      message += `🔴 <b>Красный список (${redOrgs.length}):</b>\n`;
      redOrgs.forEach(org => {
        message += `${STATUS_EMOJIS.red} ${org.name} (${org.inn})\n`;
      });
      message += '\n';
    }

    if (orangeOrgs.length > 0) {
      message += `🟡 <b>Желтый список (${orangeOrgs.length}):</b>\n`;
      orangeOrgs.forEach(org => {
        message += `${STATUS_EMOJIS.orange} ${org.name} (${org.inn})\n`;
      });
      message += '\n';
    }

    if (greenOrgs.length > 0) {
      message += `🟢 <b>Зелёный список (${greenOrgs.length}):</b>\n`;
      greenOrgs.slice(0, 10).forEach(org => { // Показываем только первые 10
        message += `${STATUS_EMOJIS.green} ${org.name} (${org.inn})\n`;
      });
      if (greenOrgs.length > 10) {
        message += `... и ещё ${greenOrgs.length - 10} организаций\n`;
      }
    }

    // Ограничиваем длину сообщения
    if (message.length > 4096) {
      message = message.substring(0, 4090) + '...';
    }

    await ctx.editMessageText(message, { parse_mode: 'HTML' });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error in handleOrganizationsListCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при получении списка организаций');
  }
}

/**
 * Обработчик callback для добавления пользователей - запускает conversation
 */
async function handleAddUsersCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add_users");
  } catch (error) {
    logger.error('Error in handleAddUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при запуске добавления пользователей');
  }
}

/**
 * Обработчик callback для удаления пользователей - запускает conversation
 */
async function handleRemoveUsersCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("remove_users");
  } catch (error) {
    logger.error('Error in handleRemoveUsersCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при запуске удаления пользователей');
  }
}

/**
 * Обработчик callback для добавления администраторов - запускает conversation
 */
async function handleAddAdminsCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add_admins");
  } catch (error) {
    logger.error('Error in handleAddAdminsCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при запуске добавления администраторов');
  }
}

/**
 * Обработчик callback для снятия прав администраторов - запускает conversation
 */
async function handleRemoveAdminsCallback(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered || !ctx.session.isAdmin) {
      await ctx.answerCallbackQuery('Недостаточно прав');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("remove_admins");
  } catch (error) {
    logger.error('Error in handleRemoveAdminsCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при запуске снятия прав администраторов');
  }
}

/**
 * Обработчик callback для отмены conversation
 */
async function handleCancelConversationCallback(ctx: MyContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery('❌ Операция отменена');
    await ctx.conversation.exit('cancel');
  } catch (error) {
    logger.error('Error in handleCancelConversationCallback:', error);
    await ctx.answerCallbackQuery('Ошибка при отмене операции');
  }
}