import { MyContext } from '../types';
import { MESSAGES } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик текстовых сообщений
 * Теперь большая часть логики обрабатывается в conversations
 */
export async function handleText(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      return;
    }

    // Обработка дефолтного текста (если не в conversation)
    await handleDefaultText(ctx, text);
  } catch (error) {
    logger.error('Error in handleText:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик обычного текста (не команды)
 */
async function handleDefaultText(ctx: MyContext, text: string): Promise<void> {
  // Проверка на ИНН в тексте
  const innRegex = /\b\d{10,12}\b/g;
  const possibleInns = text.match(innRegex);

  if (possibleInns && possibleInns.length > 0) {
    const { validateInn } = await import('../utils/validation');
    const validInns = possibleInns.filter(inn => validateInn(inn));

    if (validInns.length > 0) {
      const inn = validInns[0];
      await ctx.reply(
        `🔍 Обнаружен ИНН: ${inn}\n\n` +
        `Для добавления в отслеживание используйте команду:\n` +
        `/add_inn ${inn}\n\n` +
        `Для проверки статуса используйте команду:\n` +
        `/check ${inn}`
      );
      return;
    }
  }

  // Если текст не содержит ИНН, показываем помощь
  await ctx.reply(
    '💡 Я могу помочь вам:\n\n' +
    '🔍 Для проверки организации используйте: /check\n' +
    '➕ Для добавления ИНН в отслеживание: /add_inn\n' +
    '📋 Для просмотра меню: /menu\n' +
    '❓ Для справки по командам: /help'
  );
}