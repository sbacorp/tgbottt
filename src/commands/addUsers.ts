import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

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
