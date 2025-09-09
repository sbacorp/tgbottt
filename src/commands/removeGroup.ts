import { MyContext } from '../types';
import { database } from '../database';
import logger from '../utils/logger';

export async function handleDeleteGroup(ctx: MyContext): Promise<void> {
    try {
        const userId = ctx.from?.id;
        if (!userId) return;

        const group = await database.getUserGroup(userId);
        if (!group) {
            await ctx.reply('❌ У вас нет созданной группы.');
            return;
        }

        await database.deleteUserGroup(group.id, userId);
        await ctx.reply('✅ Группа удалена.');
    } catch (error) {
        logger.error('Error deleting group:', error);
        await ctx.reply('❌ Не удалось удалить группу.');
    }
}


