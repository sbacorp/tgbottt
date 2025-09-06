import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /remove_inn
 */
export async function handleRemoveInn(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply('команда доступна только для администраторов');
      return;
    }

    // Запускаем conversation для удаления ИНН
    await ctx.conversation.enter("remove_inn");
  } catch (error) {
    logger.error('Error in handleRemoveInn:', error);
    await ctx.reply(MESSAGES.error);
  }
}
