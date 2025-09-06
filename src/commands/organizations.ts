import { MyContext } from '../types';
import { database } from '../database';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /organizations
 */
export async function handleOrganizations(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isAdmin) {
      await ctx.reply('команда доступна только для администраторов');
      return;
    }

    const organizations = await database.getAllOrganizations();
    const { formatOrganizationList } = await import('../helpers/messages');
    
    const message = formatOrganizationList(organizations);
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error in handleOrganizations:', error);
    await ctx.reply(MESSAGES.error);
  }
}
