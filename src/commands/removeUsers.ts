import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

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
