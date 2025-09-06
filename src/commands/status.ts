import { MyContext } from '../types';
import { database } from '../database';
import { monitoringService } from '../services/monitoringService';
import { platformZskService } from '../services/platform_zsk';
import { MESSAGES, config } from '../utils/config';
import logger from '../utils/logger';

/**
 * Обработчик команды /status
 */
export async function handleStatus(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const isRunning = monitoringService.isMonitoringRunning();
    
    let message = '📊 Статус системы:\n\n';
    message += `🔄 Мониторинг: ${isRunning ? '✅ Запущен' : '❌ Остановлен'}\n`;

    // Статистика
    const organizations = await database.getAllOrganizations();
    const users = await database.getAllUsers();
    
    const redCount = organizations.filter(org => org.status === 'red').length;
    const orangeCount = organizations.filter(org => org.status === 'orange').length;
    const greenCount = organizations.filter(org => org.status === 'green').length;

    message += `\n📈 Статистика:\n`;
    message += `🏢 Организаций: ${organizations.length}\n`;
    message += `🔴 Красный список: ${redCount}\n`;
    message += `🟡 Желтый список: ${orangeCount}\n`;
    message += `🟢 Зелёный список: ${greenCount}\n`;
    message += `👥 Пользователей: ${users.length}`;

    // Проверка прокси
    if (config.proxy.enabled && config.proxy.server) {
      message += `\n\n🌐 Проверка прокси...\n`;
      await ctx.reply(message);
      
      try {
        // Инициализируем сервис если не инициализирован
        if (!platformZskService['browser']) {
          await platformZskService.init();
        }
        
        const proxyStatus = await platformZskService.checkProxyStatus();
        
        let proxyMessage = `🔗 Прокси: ${config.proxy.server}\n`;
        if (proxyStatus.success) {
          proxyMessage += `✅ ${proxyStatus.message}\n`;
          if (proxyStatus.ip) {
            proxyMessage += `📍 IP: ${proxyStatus.ip}\n`;
          }
          if (proxyStatus.country) {
            proxyMessage += `🌍 Страна: ${proxyStatus.country}`;
          }
        } else {
          proxyMessage += `❌ ${proxyStatus.message}`;
        }
        
        await ctx.reply(proxyMessage);
      } catch (error) {
        logger.error('Error checking proxy in status command:', error);
        await ctx.reply(`❌ Ошибка проверки прокси: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    } else {
      message += `\n\n🔗 Прокси: ❌ Отключен`;
      await ctx.reply(message);
    }
  } catch (error) {
    logger.error('Error in handleStatus:', error);
    await ctx.reply(MESSAGES.error);
  }
}
