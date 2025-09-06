import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

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
