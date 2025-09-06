import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /check_cbr
 */
export async function handleCheckCbr(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    // Запускаем conversation для проверки ЦБР
    await ctx.conversation.enter("check_cbr");
  } catch (error) {
    logger.error('Error in handleCheckCbr:', error);
    await ctx.reply(MESSAGES.error);
  }
}
