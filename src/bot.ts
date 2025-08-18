import { Bot, session, GrammyError, HttpError } from 'grammy';
import { run } from '@grammyjs/runner';
import { MyContext, SessionData } from './types';
import { config } from './utils/config';
import { database } from './database';
import { monitoringService } from './services/monitoringService';
import { initializeNotificationService } from './services/notificationService';
import logger from './utils/logger';

// Импорт обработчиков
import {
  handleStart,
  handleMenu,
  handleOrganizations,
  handleAddInn,
  handleRemoveInn,
  handleUsers,
  handleAddUsers,
  handleRemoveUsers,
  handleAddAdmins,
  handleRemoveAdmins,
  handleCheck,
  handleStatus,
  handleHelp,
  handleSetCommands
} from './handlers/commandHandlers';

import { handleCallback } from './handlers/callbackHandlers';
import { handleText } from './handlers/textHandlers';

// Создание экземпляра бота
const bot = new Bot<MyContext>(config.botToken);

// Инициализация notificationService с тем же экземпляром бота
export const notificationService = initializeNotificationService(bot);

// Настройка сессий
bot.use(session({
  initial: (): SessionData => ({
    isRegistered: false,
    isAdmin: false,
    language: 'ru'
  })
}));

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

// Middleware для проверки регистрации (кроме команды /start)
bot.use(async (ctx, next) => {
  const isStartCommand = ctx.message?.text === '/start';
  
  if (!isStartCommand && !ctx.session.isRegistered) {
    // Пропускаем только команду /start
    if (ctx.message?.text?.startsWith('/start')) {
      await next();
      return;
    }
    
    // Для всех остальных команд показываем сообщение о незарегистрированности
    await ctx.reply('❌ Вы не зарегистрированы в системе.\nОбратитесь к администратору для получения доступа.');
    return;
  }
  
  await next();
});

// Middleware для обновления данных сессии из базы данных
bot.use(async (ctx, next) => {
  if (ctx.session.isRegistered && ctx.from?.id) {
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

// Обработчики команд
bot.command('start', handleStart);
bot.command('menu', handleMenu);
bot.command('organizations', handleOrganizations);
bot.command('add_inn', handleAddInn);
bot.command('remove_inn', handleRemoveInn);
bot.command('users', handleUsers);
bot.command('add_users', handleAddUsers);
bot.command('remove_users', handleRemoveUsers);
bot.command('add_admins', handleAddAdmins);
bot.command('remove_admins', handleRemoveAdmins);
bot.command('check', handleCheck);
bot.command('status', handleStatus);
bot.command('help', handleHelp);
bot.command('setcommands', handleSetCommands);

// Обработчик callback запросов
bot.on('callback_query:data', handleCallback);

// Обработчик текстовых сообщений
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
    
    // Подключение к базе данных
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected successfully');
    
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
    
    
    // Отключение от базы данных
    await database.disconnect();
    logger.info('Database disconnected');
    
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
