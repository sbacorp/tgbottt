import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /help
 */
export async function handleHelp(ctx: MyContext): Promise<void> {
  try {

    const helpMessageAdmin = `🤖 <b>Справка по командам бота</b>\n\n` +
      `<b>Основные команды:</b>\n` +
      `/start - Запуск бота\n` +
      `/menu - Главное меню\n` +
      `/organizations - Список организаций\n` +
      `/add_inn ИНН1 ИНН2 - Добавить ИНН для отслеживания\n` +
      `/check - Проверить конкретную организацию\n` +
      `/check_cbr - Проверить организацию по зск ЦБР\n` +
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
      `/check\n` +
      `/check_cbr\n` +
      `/add_users 123456789 987654321\n` +
      `/add_admins 123456789 987654321`;

    const helpMessage = `🤖 <b>Справка по командам бота</b>\n\n` +
      `<b>Основные команды:</b>\n` +
      `/start - Запуск бота\n` +
      `/check - Проверить конкретную организацию\n` +
      `/check_cbr - Проверить организацию по зск ЦБР\n` +
      `/help - Эта справка\n\n`;
    
    if (ctx.session.isAdmin) {
      await ctx.reply(helpMessageAdmin, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(helpMessage, { parse_mode: 'HTML' });
    }

  } catch (error) {
    logger.error('Error in handleHelp:', error);
    await ctx.reply(MESSAGES.error);
  }
}
