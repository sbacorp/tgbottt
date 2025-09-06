import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

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
