import { MyContext } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /users
 */
export async function handleUsers(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply('команда доступна только для администраторов');
      return;
    }

    const users = await database.getAllUsers();
    
    if (users.length === 0) {
      await ctx.reply(MESSAGES.noUsers);
      return;
    }

    let message = '👥 Список получателей (актуальный):\n\n';
    
    for (const user of users) {
      const adminBadge = user.is_admin ? ' Администратор' : '';
      const username = user.username ? `@${user.username}` : `ID: ${user.telegram_id}`;
      
      message += `${username}${adminBadge}\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    logger.error('Error in handleUsers:', error);
    await ctx.reply(MESSAGES.error);
  }
}
