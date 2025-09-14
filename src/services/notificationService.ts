import { Bot } from 'grammy';
import { config } from '../utils/config';
import logger from '../utils/logger';

class NotificationService {
  private bot: Bot<any>;

  constructor(bot: Bot<any>) {
    this.bot = bot;
  }

  /**
   * Отправка уведомления пользователю
   */
  async sendNotification(userId: number, message: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(userId, message, {
        parse_mode: 'HTML'
      });
      
      logger.info(`Notification sent to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отправка уведомления с inline клавиатурой
   */
  async sendNotificationWithKeyboard(
    userId: number, 
    message: string, 
    keyboard: any
  ): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(userId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
      
      logger.info(`Notification with keyboard sent to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending notification with keyboard to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отправка уведомления администраторам
   */
  async sendAdminNotification(message: string): Promise<void> {
    try {
      for (const adminId of config.adminUserIds) {
        await this.sendNotification(adminId, `🔔 *Админ уведомление:*\n\n${message}`);
      }
      
      logger.info(`Admin notification sent to ${config.adminUserIds.length} admins`);
    } catch (error) {
      logger.error('Error sending admin notification:', error);
    }
  }

  /**
   * Отправка уведомления об ошибке
   */
  async sendErrorNotification(error: string, context?: any): Promise<void> {
    const contextStr = context ? `\n\nКонтекст: ${JSON.stringify(context, null, 2)}` : '';
    const message = `❌ Ошибка в системе:\n\n${error}${contextStr}`;
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о статусе мониторинга
   */
  async sendMonitoringStatusNotification(status: string): Promise<void> {
    const message = `📊 Статус мониторинга: ${status}`;
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о новых организациях
   */
  async sendNewOrganizationsNotification(organizations: Array<{ inn: string; name: string }>): Promise<void> {
    if (organizations.length === 0) return;

    const message = `🆕 Добавлены новые организации для отслеживания:\n\n${
      organizations.map(org => `• ${org.inn} - ${org.name}`).join('\n')
    }`;
    
    await this.sendAdminNotification(message);
  }


  /**
   * Отправка уведомления пользователям групп, которые отслеживают организацию
   */
  async sendNotificationToGroupsByOrganization(inn: string, message: string): Promise<void> {
    try {
      const { database } = await import('../database/index');
      
      // Получаем группы, которые отслеживают эту организацию
      const groups = await database.getGroupsByOrganization(inn);
      
      if (groups.length === 0) {
        logger.info(`No groups found tracking organization ${inn}`);
        return;
      }

      const notifiedUsers = new Set<number>();
      
      for (const group of groups) {
        try {
          // Получаем участников группы
          const members = await database.getGroupMembers(group.id);
          
          for (const member of members) {
            // Проверяем, что не отправляли уже этому пользователю
            if (!notifiedUsers.has(member.telegram_id)) {
              try {
                await this.sendNotification(member.telegram_id, message);
                notifiedUsers.add(member.telegram_id);
              } catch (error) {
                logger.error(`Error sending notification to user ${member.telegram_id}:`, error);
              }
            }
          }
          
          logger.info(`Notification sent to ${members.length} members of group "${group.name}" for organization ${inn}`);
        } catch (error) {
          logger.error(`Error processing group ${group.id}:`, error);
        }
      }
      
      logger.info(`Organization notification for ${inn} sent to ${notifiedUsers.size} unique users across ${groups.length} groups`);
    } catch (error) {
      logger.error(`Error sending notification to groups for organization ${inn}:`, error);
    }
  }

  /**
   * Отправка уведомления пользователям групп, отслеживающих организацию
   * Только групповая логика - без индивидуального отслеживания
   */
  async sendOrganizationNotification(inn: string, message: string): Promise<void> {
    try {
      const { database } = await import('../database/index');
      
      // Ищем группы, которые отслеживают организацию
      const groups = await database.getGroupsByOrganization(inn);
      
      if (groups.length > 0) {
        // Если есть группы - отправляем через группы
        await this.sendNotificationToGroupsByOrganization(inn, message);
      } else {
        // Если групп нет - отправляем только админам
        logger.warn(`No groups tracking organization ${inn}, sending to admins only`);
        await this.sendAdminNotification(`Организация ${inn} изменила статус, но ни одна группа её не отслеживает:\n\n${message}`);
      }
    } catch (error) {
      logger.error(`Error in organization notification for ${inn}:`, error);
      // Fallback - отправляем админам
      await this.sendAdminNotification(`Ошибка уведомления для ${inn}:\n\n${message}`);
    }
  }

  /**
   * Отправка уведомления о удалении организаций
   */
  async sendRemovedOrganizationsNotification(organizations: Array<{ inn: string; name: string }>): Promise<void> {
    if (organizations.length === 0) return;

    const message = `🗑️ Удалены организации из отслеживания:\n\n${
      organizations.map(org => `• ${org.inn} - ${org.name}`).join('\n')
    }`;
    
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о новых пользователях
   */
  async sendNewUsersNotification(users: Array<{ telegramId: number; username?: string }>): Promise<void> {
    if (users.length === 0) return;

    const message = `👥 Добавлены новые пользователи:\n\n${
      users.map(user => `• ${user.username || `ID: ${user.telegramId}`}`).join('\n')
    }`;
    
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о удалении пользователей
   */
  async sendRemovedUsersNotification(users: Array<{ telegramId: number; username?: string }>): Promise<void> {
    if (users.length === 0) return;

    const message = `👤 Удалены пользователи:\n\n${
      users.map(user => `• ${user.username || `ID: ${user.telegramId}`}`).join('\n')
    }`;
    
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о проблемах с API
   */
  async sendApiErrorNotification(apiName: string, error: string): Promise<void> {
    const message = `🌐 Проблема с API ${apiName}:\n\n${error}`;
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о восстановлении API
   */
  async sendApiRecoveryNotification(apiName: string): Promise<void> {
    const message = `✅ API ${apiName} восстановлен`;
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка статистики
   */
  async sendStatisticsNotification(stats: {
    totalOrganizations: number;
    redOrganizations: number;
    orangeOrganizations: number;
    greenOrganizations: number;
    totalUsers: number;
    activeUsers: number;
  }): Promise<void> {
    const message = `📈 Статистика системы:\n\n` +
      `🏢 Организации:\n` +
      `• Всего: ${stats.totalOrganizations}\n` +
      `• 🔴 Красный список: ${stats.redOrganizations}\n` +
      `• 🟡 Желтый список: ${stats.orangeOrganizations}\n` +
      `• 🟢 Зелёный список: ${stats.greenOrganizations}\n\n` +
      `👥 Пользователи:\n` +
      `• Всего: ${stats.totalUsers}\n` +
      `• Активных: ${stats.activeUsers}`;
    
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о перезапуске системы
   */
  async sendRestartNotification(): Promise<void> {
    const message = `🔄 Система перезапущена`;
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о техническом обслуживании
   */
  async sendMaintenanceNotification(duration: string, reason: string): Promise<void> {
    const message = `🔧 Техническое обслуживание:\n\n` +
      `⏱️ Длительность: ${duration}\n` +
      `📝 Причина: ${reason}`;
    
    await this.sendAdminNotification(message);
  }

  /**
   * Отправка уведомления о завершении технического обслуживания
   */
  async sendMaintenanceCompleteNotification(): Promise<void> {
    const message = `✅ Техническое обслуживание завершено`;
    await this.sendAdminNotification(message);
  }

  /**
   * Проверка доступности бота
   */
  async checkBotHealth(): Promise<boolean> {
    try {
      const me = await this.bot.api.getMe();
      logger.info(`Bot health check passed: ${me.first_name} (@${me.username})`);
      return true;
    } catch (error) {
      logger.error('Bot health check failed:', error);
      return false;
    }
  }

  /**
   * Получение информации о боте
   */
  async getBotInfo(): Promise<any> {
    try {
      return await this.bot.api.getMe();
    } catch (error) {
      logger.error('Error getting bot info:', error);
      return null;
    }
  }
}

// Экспорт класса для создания экземпляра
export { NotificationService };

// Глобальная переменная для хранения экземпляра
let notificationServiceInstance: NotificationService | null = null;

// Функция для инициализации сервиса
export function initializeNotificationService(bot: Bot<any>): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService(bot);
  }
  return notificationServiceInstance;
}

// Функция для получения экземпляра
export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    throw new Error('NotificationService not initialized. Call initializeNotificationService first.');
  }
  return notificationServiceInstance;
}
