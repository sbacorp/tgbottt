import { Bot, session, GrammyError, HttpError } from 'grammy';
import { run } from '@grammyjs/runner';
import { conversations, createConversation } from '@grammyjs/conversations';
import { MyContext, SessionData } from './types';
import { config } from './utils/config';
import { database } from './database';
import { createSupabaseStorageAdapter } from './services/supabase-storage-adapter';
import { monitoringService } from './services/monitoringService';
import { initializeNotificationService } from './services/notificationService';
import logger from './utils/logger';

// Импорт обработчиков
import {
  handleAddAdmins,
  handleRemoveAdmins,
  handleCheck,
  handleCheckCbr,
  handleStatus,
  handleHelp,
  setCommandsHandler,
  handleDeleteGroup,
} from './commands';

import { handleCallback } from './handlers/callbackHandlers';
import { handleText } from './handlers/textHandlers';

// Импорт conversations
import {
  checkConversation,
  checkCbrConversation,
  addAdminsConversation,
  removeAdminsConversation
} from './conversations/commandConversations';
import { createGroupConversation } from './conversations/groupCreation.conversation';
import { addInnToGroupConversation } from './conversations/addInnToGroup.conversation';
import { removeInnFromGroupConversation } from './conversations/removeInnFromGroup.conversation';
import { addUserToGroupConversation } from './conversations/addUserToGroup.conversation';
import { removeUserFromGroupConversation } from './conversations/removeUserFromGroup.conversation';
import { handleStart } from './commands/start';

// Импорт features
import { tracking } from './features/tracking';

// Создание экземпляра бота
const bot = new Bot<MyContext>(config.BOT_TOKEN);

// Инициализация notificationService с тем же экземпляром бота
export const notificationService = initializeNotificationService(bot);

// Настройка сессий с Supabase storage (если доступен)
const sessionConfig = {
  initial: (): SessionData => ({
    isRegistered: false,
    isAdmin: false,
    language: 'ru',
    currentAction: null,
    tempData: {},
    // Состояния для feature tracking (больше не используются)
  }),
  // Используем Supabase storage
  storage: createSupabaseStorageAdapter("grammy_sessions")
};

bot.use(session(sessionConfig));

// Настройка conversations
bot.use(conversations());

// Регистрация conversations
bot.use(createConversation(checkConversation, "check"));
bot.use(createConversation(checkCbrConversation, "check_cbr"));
bot.use(createConversation(addAdminsConversation, "add_admins"));
bot.use(createConversation(removeAdminsConversation, "remove_admins"));
bot.use(createConversation(createGroupConversation, "create_group"));
bot.use(createConversation(addInnToGroupConversation, "add_inn_to_group"));
bot.use(createConversation(removeInnFromGroupConversation, "remove_inn_from_group"));
bot.use(createConversation(addUserToGroupConversation, "add_user_to_group"));
bot.use(createConversation(removeUserFromGroupConversation, "remove_user_from_group"));

// Регистрация features
bot.use(tracking);

// Middleware для обновления данных сессии из базы данных
bot.use(async (ctx, next) => {
  if (ctx.from?.id) {
    try {
      const user = await database.getUserByTelegramId(ctx.from.id);
      if (user) {
        // Обновляем данные сессии из базы данных
        ctx.session.isRegistered = true;
        ctx.session.isAdmin = user.is_admin;
      }
    } catch (error) {
      logger.error('Error updating session from database:', error);
    }
  }
  
  await next();
});

// Middleware для логирования
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const end = Date.now();
  
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const message = ctx.message?.text || ctx.callbackQuery?.data || 'unknown';
  
  logger.info(`User ${userId} (@${username}) - ${message} - ${end - start}ms`);
});

// Обработчики команд
bot.command('start', handleStart);

// Middleware для проверки регистрации (кроме команды /start)
bot.use(async (ctx, next) => {
  const isStartCommand = ctx.message?.text === '/start';
  
  if (!isStartCommand && !ctx.session.isRegistered) {
    await ctx.reply('❌ Вы не зарегистрированы в системе.\nОбратитесь к администратору для получения доступа.');
    return;
  }
  
  await next();
});

bot.command('add_admins', handleAddAdmins);
bot.command('remove_admins', handleRemoveAdmins);
bot.command('check', handleCheck);
bot.command('check_cbr', handleCheckCbr);
bot.command('status', handleStatus);
bot.command('help', handleHelp);
bot.command('setcommands', setCommandsHandler);
bot.command('delete_group', handleDeleteGroup);

// Обработчик callback запросов
bot.on('callback_query:data', handleCallback);

// Обработчик текстовых сообщений


bot.hears("➕ Разовая проверка по ИНН", async (ctx) => {
  // Запустить conversation для ввода ИНН
  await ctx.conversation.enter("check");
});


bot.on('message:text', handleText);


// Обработчик ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Error while handling update ${ctx.update.update_id}:`);
  
  const e = err.error;
  if (e instanceof GrammyError) {
    logger.error('Error in request:', e.description);
  } else if (e instanceof HttpError) {
    logger.error('Could not contact Telegram:', e);
  } else {
    logger.error('Unknown error:', e);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Основная функция запуска
async function startBot(): Promise<void> {
  try {
    logger.info('Starting CBR Monitoring Bot...');
    
    // Проверка подключения к Supabase
    logger.info('Connecting to Supabase...');
    if (database.isSupabaseEnabled()) {
      logger.info('Supabase connected successfully');
    } else {
      throw new Error('Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY');
    }
    
    // Проверка здоровья бота (пропускаем при запуске для ускорения)
    logger.info('Skipping bot health check for faster startup');
  
    
    // Запуск мониторинга
    await monitoringService.startMonitoring();
    logger.info('Monitoring service started');
    
    // Отправка уведомления о запуске
    await notificationService.sendRestartNotification();
    
    // Запуск бота
    logger.info('Starting bot...');
    await run(bot);
    
    logger.info('Bot started successfully');
  } catch (error) {
    logger.error('Error starting bot:', error);
    
    // Отправка уведомления об ошибке
    await notificationService.sendErrorNotification(
      'Ошибка при запуске бота',
      { error: error instanceof Error ? error.message : String(error) }
    );
    
    process.exit(1);
  }
}

// Обработка необработанных ошибок
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  
  try {
    await notificationService.sendErrorNotification(
      'Необработанная ошибка в системе',
      { error: error.message, stack: error.stack }
    );
  } catch (notifyError) {
    logger.error('Error sending error notification:', notifyError);
  }
  
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  try {
    await notificationService.sendErrorNotification(
      'Необработанное отклонение промиса',
      { reason: String(reason) }
    );
  } catch (notifyError) {
    logger.error('Error sending error notification:', notifyError);
  }
});

// Graceful shutdown для базы данных
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Остановка мониторинга
    await monitoringService.stopMonitoring();
    logger.info('Monitoring service stopped');
    
    
    // Supabase не требует явного отключения
    logger.info('Supabase disconnected');
    
    // Остановка бота
    await bot.stop();
    logger.info('Bot stopped');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await gracefulShutdown('SIGINT');
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown('SIGTERM');
});

// Запуск бота если файл запущен напрямую
if (require.main === module) {
  startBot().catch((error) => {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  });
}

export { bot };
