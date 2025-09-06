import { MyContext } from '../types';
import { validateTelegramIdList } from '../utils/validation';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

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
