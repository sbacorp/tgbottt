import cron from 'node-cron';
import { database } from '../database/index';
import { FireCrawlService, KonturOrganizationData } from './firecrawlService';
import { getNotificationService } from './notificationService';
import logger from '../utils/logger';
import { config } from '../utils/config';
import { Organization } from '../types';

export class MonitoringService {
  private firecrawlService: FireCrawlService;
  private isRunning = false;

  constructor() {
    this.firecrawlService = new FireCrawlService();
  }

  /**
   * Запускает мониторинг организаций
   */
  startMonitoring(): void {
    if (this.isRunning) {
      logger.warn('Мониторинг уже запущен');
      return;
    }

    logger.info('Запуск мониторинга организаций...');

    // Запускаем мониторинг каждый час в 6 минут
    cron.schedule('6 * * * *', async () => {
      await this.performMonitoring();
    }, {
      scheduled: true,
      timezone: 'Europe/Moscow'
    });

    this.isRunning = true;
    logger.info('Мониторинг запущен. Проверки будут выполняться каждые 4 часа.');
  }

  /**
   * Выполняет проверку всех отслеживаемых организаций
   */
  async performMonitoring(): Promise<void> {
    try {
      logger.info('Начинаем плановую проверку организаций...');

      // Получаем все отслеживаемые организации
      const organizations = await database.getAllOrganizations();
      
      if (organizations.length === 0) {
        logger.info('Нет организаций для мониторинга');
        return;
      }

      logger.info(`Проверяем ${organizations.length} организаций`);

      // Получаем ИНН всех организаций
      const inns = organizations.map((org: any) => org.inn);

      // Проверяем организации через FireCrawl
      const results = await this.firecrawlService.checkMultipleOrganizations(inns);

      // Обрабатываем результаты
      for (const [inn, newData] of results) {
        await this.processOrganizationCheck(inn, newData);
      }

      logger.info('Плановая проверка организаций завершена');

    } catch (error) {
      logger.error('Ошибка при выполнении мониторинга:', error);
    }
  }

  /**
   * Обрабатывает результат проверки одной организации
   */
  private async processOrganizationCheck(inn: string, newData: KonturOrganizationData): Promise<void> {
    try {
      // Получаем текущие данные организации из БД
      const currentOrg = await database.getOrganizationByInn(inn);
      
      if (!currentOrg) {
        logger.warn(`Организация с ИНН ${inn} не найдена в базе данных`);
        return;
      }

      // Сохраняем новую проверку
      await database.addOrganizationCheck({
        inn,
        status: newData.status,
        details: {
          name: newData.name,
          address: newData.address,
          isLiquidated: newData.isLiquidated,
          illegalitySigns: newData.illegalitySigns,
          region: newData.region,
          additionalInfo: newData.additionalInfo,
          comment: newData.comment,
          liquidationDate: newData.liquidationDate,
          registrationDate: newData.registrationDate,
          ogrn: newData.ogrn,
          kpp: newData.kpp,
          okpo: newData.okpo,
          founders: newData.founders,
          activities: newData.activities,
          capital: newData.capital,
          taxAuthority: newData.taxAuthority
        }
      });

      // Полное обновление данных организации в БД
      const updateData: Partial<Organization> = {};
      
      if (newData.name) updateData.name = newData.name;
      if (newData.status) updateData.status = newData.status;
      if (newData.address) updateData.address = newData.address;
      if (newData.websites) updateData.websites = newData.websites;
      if (newData.isLiquidated !== undefined) updateData.isLiquidated = newData.isLiquidated;
      if (newData.illegalitySigns) updateData.illegalitySigns = newData.illegalitySigns;
      if (newData.region) updateData.region = newData.region;
      if (newData.additionalInfo) updateData.additionalInfo = newData.additionalInfo;
      if (newData.comment) updateData.comment = newData.comment;
      
      await database.updateOrganizationData(inn, updateData);

      // Проверяем, изменился ли статус
      if (currentOrg.status !== newData.status) {
        logger.info(`Изменение статуса для ИНН ${inn}: ${currentOrg.status} → ${newData.status}`);
        
        // Проверяем, была ли уже отправлена уведомление об этой организации
        const lastCheck = await database.getLastOrganizationCheck(inn);
        const shouldNotify = !lastCheck || !lastCheck.notified || lastCheck.status !== newData.status;

        if (shouldNotify) {
          await this.sendStatusChangeNotification(inn, newData);
          
          // Отмечаем, что уведомление отправлено
          await database.markCheckAsNotified(inn, newData.status);
        }
      } else {
        logger.info(`Данные организации ${inn} обновлены (статус не изменился: ${newData.status})`);
      }

    } catch (error) {
      logger.error(`Ошибка при обработке проверки ИНН ${inn}:`, error);
    }
  }

  /**
   * Отправляет уведомление об изменении статуса
   */
  private async sendStatusChangeNotification(
    inn: string, 
    newData: KonturOrganizationData
  ): Promise<void> {
    try {
      const statusEmoji = config.STATUS_EMOJIS[newData.status as keyof typeof config.STATUS_EMOJIS];
      const statusMessage = config.STATUS_MESSAGE[newData.status as keyof typeof config.STATUS_MESSAGE];

      let message = `${statusEmoji} **Внимание! 🚦 ЗСК:**\n\n`;
      
      // Добавляем информацию только если поле не пустое
      if (newData.liquidationDate) {
        message += `📅 **Дата внесения в список:** ${newData.liquidationDate}\n`;
      }
      
      if (newData.name) {
        message += `🏢 **Актуальное название компании:** ${newData.name}\n`;
      }
      
      message += `🔢 **ИНН:** ${inn}\n`;
      
      if (newData.address) {
        message += `📍 **Адрес:** ${newData.address}\n`;
      }
      
      if (newData.websites && newData.websites.length > 0) {
        message += `🌐 **Список веб-сайтов компании:** ${newData.websites.join(', ')}\n`;
      }
      
      if (newData.isLiquidated !== undefined) {
        message += `⚠️ **Ликвидирована ли организация:** ${newData.isLiquidated ? 'Да' : 'Нет'}\n`;
      }
      
      if (newData.illegalitySigns && newData.illegalitySigns.length > 0) {
        message += `🚨 **Санкции:** ${newData.illegalitySigns.join(', ')}\n`;
      }
      
      if (newData.region) {
        message += `🗺 **Регион:** ${newData.region}\n`;
      }
      
      if (newData.additionalInfo) {
        message += `📋 **Доп информация:** ${newData.additionalInfo}\n`;
      }
      
      if (newData.comment) {
        message += `💬 **Комментарий:** ${newData.comment}\n`;
      }

      // Добавляем информацию о признаках нелегальной деятельности
      if (newData.hasIllegalActivity !== undefined) {
        message += `🚨 **Признаки нелегальной деятельности:** ${newData.hasIllegalActivity ? 'Да' : 'Нет'}\n`;
      }
      
      message += `\n${statusMessage}\n`;
      // Добавляем информацию о рисках для оранжевого статуса
      if (newData.status === 'orange' && newData.riskInfo) {
        message += `\n⚠️ **Риски:**\n${newData.riskInfo}\n`;
      }


      message += '➕ Обновлено в системе: ' + new Date().toLocaleDateString('ru-RU');

      // Отправляем уведомление всем пользователям
      await getNotificationService().sendNotificationToAllUsers(message);

      logger.info(`Уведомление об изменении статуса отправлено для ИНН ${inn}`);

    } catch (error) {
      logger.error(`Ошибка при отправке уведомления для ИНН ${inn}:`, error);
    }
  }

  /**
   * Выполняет ручную проверку организации
   */
  async checkOrganization(inn: string): Promise<KonturOrganizationData | null> {
    try {
      logger.info(`Ручная проверка организации с ИНН: ${inn}`);
      
      const data = await this.firecrawlService.getOrganizationData(inn);
      console.log(data, 'data')
      if (data) {
        
        
        logger.info(`Данные организации ${inn} обновлены в базе данных`);
      }

      return data;
    } catch (error) {
      logger.error(`Ошибка при ручной проверке ИНН ${inn}:`, error);
      return null;
    }
  }

  /**
   * Останавливает мониторинг
   */
  stopMonitoring(): void {
    if (!this.isRunning) {
      logger.warn('Мониторинг не запущен');
      return;
    }

    logger.info('Остановка мониторинга...');
    this.isRunning = false;
  }

  /**
   * Возвращает статус мониторинга
   */
  isMonitoringRunning(): boolean {
    return this.isRunning;
  }
}

export const monitoringService = new MonitoringService();
