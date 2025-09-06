
import { MyContext } from '../types';
import { database } from '../database';

import { MESSAGES } from '../utils/config';
import { isBotAdmin } from '../guards/admin';
import logger from '../utils/logger';
import { createMainMenuKeyboard } from '../helpers/keyboard';
import { createAdminUser } from '../utils/user';

/**
 * Обработчик команды /start
 */
export async function handleStart(ctx: MyContext): Promise<void> {
    try {
      console.log('handleStart');
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username;
      
      if (!telegramId) {
        await ctx.reply(MESSAGES.error);
        return;
      }

      // Обработка приглашений в группы
      const startPayload = typeof ctx.match === 'string' ? ctx.match : ''; // Получаем параметр после /start
      if (startPayload && startPayload.startsWith('joinGroup_')) {
        const inviteCode = startPayload.replace('joinGroup_', '');
        
        try {
          const group = await database.getGroupByInviteCode(inviteCode);
          if (!group) {
            await ctx.reply('❌ Недействительная ссылка приглашения или группа не найдена.');
            return;
          }
          
          // Проверяем, зарегистрирован ли пользователь
          let user = await database.getUserByTelegramId(telegramId);
          if (!user) {
            // Регистрируем пользователя
            await database.createUser(telegramId, username, false);
            user = await database.getUserByTelegramId(telegramId);
          }
          
          // Добавляем пользователя в группу
          await database.addGroupMember(group.id, telegramId);
          
          await ctx.reply(
            `✅ <b>Добро пожаловать в группу "${group.name}"!</b>\n\nВы успешно присоединились к группе отслеживания и теперь будете получать уведомления об изменениях статуса организаций.`,
            { parse_mode: 'HTML' }
          );
          
          // Обновляем сессию
          ctx.session.isRegistered = true;
          ctx.session.isAdmin = user?.is_admin || false;
          ctx.session.language = 'ru';
          
          logger.info(`User ${telegramId} (@${username}) joined group ${group.name} via invite`);
          return;
        } catch (error) {
          logger.error('Error processing group invitation:', error);
          await ctx.reply('❌ Ошибка при обработке приглашения.');
          return;
        }
      }
  
      // Проверка регистрации пользователя
      let user = await database.getUserByTelegramId(telegramId);
      const isAdmin = isBotAdmin(ctx);
      console.log(isAdmin);
      
      if (!user) {
        // Пользователь не зарегистрирован
        if (isAdmin) {
          // Автоматическая регистрация админа
          try {
            await createAdminUser(telegramId, username);
            user = await database.getUserByTelegramId(telegramId);
            await ctx.reply('✅ Вы зарегистрированы как администратор!');
          } catch (error) {
            logger.error('Error auto-registering admin:', error);
            await ctx.reply(MESSAGES.error);
            return;
          }
        } else {
          // Обычный пользователь не зарегистрирован
          await ctx.reply(MESSAGES.notRegistered);
          return;
        }
      } else if (isAdmin && !user.is_admin) {
        // Пользователь существует, но не является админом, а должен быть
        try {
          await database.updateUserAdminStatus(telegramId, true);
          user = await database.getUserByTelegramId(telegramId);
          await ctx.reply('✅ Ваши права администратора обновлены!');
        } catch (error) {
          logger.error('Error updating user to admin:', error);
        }
      }
  
      // Обновление сессии с правильными данными из базы
      ctx.session.isRegistered = true;
      ctx.session.isAdmin = (user?.is_admin || isAdmin) ?? false;
      ctx.session.language = 'ru';
  
      const keyboard = createMainMenuKeyboard();
  
      // Отправка приветственного сообщения с кнопками
      await ctx.reply(MESSAGES.welcome, { reply_markup: keyboard });
  
      logger.info(`User ${telegramId} (@${username}) started the bot (isAdmin: ${ctx.session.isAdmin})`);
    } catch (error) {
      logger.error('Error in handleStart:', error);
      await ctx.reply(MESSAGES.error);
    }
  }
  