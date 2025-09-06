import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /add_inn
 */
export async function handleAddInn(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply('команда доступна только для администраторов');
      return;
    }

    // Запускаем conversation для добавления ИНН
    await ctx.conversation.enter("add_inn");
  } catch (error) {
    logger.error('Error in handleAddInn:', error);
    await ctx.reply(MESSAGES.error);
  }
}
