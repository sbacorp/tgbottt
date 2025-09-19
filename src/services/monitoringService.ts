import cron from 'node-cron';
import { database } from '../database/index';
import { KonturOrganizationData } from './playwrightScrapeService';
import { playwrightScrapeService } from './playwrightScrapeService';
import { PlatformZskService } from './platform_zsk';
import { getNotificationService } from './notificationService';
import logger from '../utils/logger';
import { Organization } from '../types';
import { NotificationFormatter } from '../helpers/notificationFormatter';

export class MonitoringService {
  private scraperService: any;
  private isRunning = false;

  constructor() {
    this.scraperService = playwrightScrapeService;
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

    // Запускаем мониторинг каждые 2 часа в 20 минут
    cron.schedule('20 */2 * * *', async () => {
      await this.performMonitoring();
    }, {
      scheduled: true,
      timezone: 'Europe/Moscow'
    });

    // Запускаем мониторинг ЗСК каждые 12 часов в 40 минут
    cron.schedule('40 */12 * * *', async () => {
      await this.performZskMonitoring();
    }, {
      scheduled: true,
      timezone: 'Europe/Moscow'
    });

    this.isRunning = true;
    logger.info('Мониторинг запущен. Проверки будут выполняться каждые 4 часа, ЗСК проверки - ежедневно в 2:00.');
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

      // Проверяем организации через Playwright
      const results = await this.scraperService.checkMultipleOrganizations(inns);

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
          organizationStatus: newData.organizationStatus,
          hasRejectionsByLists: newData.hasRejectionsByLists,
          region: newData.region,
          unreliableData: newData.unreliableData,
          riskInfo: newData.riskInfo
        }
      });

      // Полное обновление данных организации в БД
      const updateData: Partial<Organization> = {};
      
      if (newData.name) updateData.name = newData.name;
      if (newData.status) updateData.status = newData.status;
      if (newData.region) updateData.region = newData.region;
      // Новые поля для улучшенного формата (теперь поддерживаются в БД)
      if (newData.organizationStatus) updateData.organizationStatus = newData.organizationStatus;
      if (newData.hasRejectionsByLists !== undefined) updateData.hasRejectionsByLists = newData.hasRejectionsByLists;
      if (newData.unreliableData) {
        updateData.unreliableAddress = newData.unreliableData.address;
        updateData.unreliableDirector = newData.unreliableData.director;
        updateData.unreliableFounders = newData.unreliableData.founders;
        if (newData.unreliableData.updateDate) {
          updateData.unreliableDataUpdateDate = newData.unreliableData.updateDate;
        }
      }
      
      await database.updateOrganizationData(inn, updateData);

      // Проверяем, изменился ли статус
      if (currentOrg.status !== newData.status) {
        logger.info(`Изменение статуса для ИНН ${inn}: ${currentOrg.status} → ${newData.status}`);
        
        // Проверяем, была ли уже отправлена уведомление об этой организации
        const lastCheck = await database.getLastOrganizationCheck(inn);
        const shouldNotify = !lastCheck || !lastCheck.notified || lastCheck.status !== newData.status;

        if (shouldNotify) {
          await this.sendStatusChangeNotification(inn, newData);
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
      // Получаем старый статус для сравнения
      const currentOrg = await database.getOrganizationByInn(inn);
      const oldStatus = currentOrg?.status || 'green';

      // Формируем сообщение об изменении статуса
      const message = NotificationFormatter.formatStatusChange(inn, oldStatus, newData);

      // Отправляем уведомление пользователям, отслеживающим организацию
      await getNotificationService().sendOrganizationNotification(inn, message);

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
      
      const data = await this.scraperService.getOrganizationData(inn);
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

  /**
   * Выполняет проверку всех отслеживаемых организаций через ЗСК
   */
  async performZskMonitoring(): Promise<void> {
    try {
      logger.info('Начинаем плановую проверку организаций через ЗСК...');

      // Получаем все отслеживаемые организации
      const organizations = await database.getAllOrganizations();
      
      if (organizations.length === 0) {
        logger.info('Нет организаций для мониторинга ЗСК');
        return;
      }

      logger.info(`Проверяем ${organizations.length} организаций через ЗСК`);

      // Создаем экземпляр сервиса ЗСК
      const platformZskService = new PlatformZskService();
      await platformZskService.init();

      // Проверяем каждую организацию
      for (const organization of organizations) {
        await this.processZskOrganizationCheck(organization.inn, platformZskService);
      }

      // Закрываем сервис ЗСК
      await platformZskService.close();

      logger.info('Плановая проверка организаций через ЗСК завершена');

    } catch (error) {
      logger.error('Ошибка при выполнении мониторинга ЗСК:', error);
    }
  }

  /**
   * Обрабатывает результат проверки одной организации через ЗСК
   */
  private async processZskOrganizationCheck(inn: string, platformZskService: PlatformZskService): Promise<void> {
    try {
      // Получаем текущие данные организации из БД
      const currentOrg = await database.getOrganizationByInn(inn);
      
      if (!currentOrg) {
        logger.warn(`Организация с ИНН ${inn} не найдена в базе данных`);
        return;
      }

      logger.info(`Проверяем ИНН ${inn} через ЗСК`);

      // Выполняем проверку через ЗСК с retry логикой (до 3 попыток)
      let result: any = null;
      const maxAttempts = 3;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            logger.info(`Попытка #${attempt} из ${maxAttempts} для ИНН ${inn}`);
            // Небольшая пауза между попытками
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          result = await platformZskService.checkInn(inn);
          
          // Если получили успешный результат, выходим из цикла
          if (result && result.success) {
            break;
          }
          
          // Если есть ошибка и это не последняя попытка
          if (attempt < maxAttempts) {
            logger.warn(`Попытка #${attempt} для ИНН ${inn} не удалась: ${result.result}. Повторяю...`);
          }
          
        } catch (error) {
          logger.error(`Ошибка при попытке #${attempt} для ИНН ${inn}:`, error);
          
          if (attempt < maxAttempts) {
            logger.info(`Повторяю попытку #${attempt + 1} для ИНН ${inn}...`);
          } else {
            logger.error(`Все ${maxAttempts} попытки для ИНН ${inn} не удались`);
            return;
          }
        }
      }

      // Проверяем, получили ли мы успешный результат
      if (!result || !result.success) {
        logger.error(`Не удалось выполнить проверку ИНН ${inn} через ЗСК после ${maxAttempts} попыток`);
        return;
      }

      // Определяем статус на основе результата
      const hasIllegalActivity = result.result.toLowerCase().includes('имеются');
      const newZskStatus = hasIllegalActivity ? 'red' : 'green';

      // Сохраняем новую проверку ЗСК
      await database.addZskCheck({
        inn,
        status: newZskStatus,
        resultText: result.result
      });

      // Обновляем статус ЗСК в организации
      await database.updateOrganizationZskStatus(inn, newZskStatus);

      // Проверяем, изменился ли статус ЗСК
      if (currentOrg.zskStatus !== newZskStatus) {
        logger.info(`Изменение статуса ЗСК для ИНН ${inn}: ${currentOrg.zskStatus} → ${newZskStatus}`);
        
        // Проверяем, была ли уже отправлена уведомление об этой организации
        const lastZskCheck = await database.getLastZskCheck(inn);
        const shouldNotify = !lastZskCheck || !lastZskCheck.notified || lastZskCheck.status !== newZskStatus;

        if (shouldNotify) {
          await this.sendZskStatusChangeNotification(inn, newZskStatus, result.result);
          
          // Отмечаем, что уведомление отправлено
          // Проверка ЗСК отмечена как обработанная автоматически
        }
      } else {
        logger.info(`Данные организации ${inn} обновлены через ЗСК (статус не изменился: ${newZskStatus})`);
      }

    } catch (error) {
      logger.error(`Ошибка при обработке проверки ЗСК ИНН ${inn}:`, error);
    }
  }

  /**
   * Отправляет уведомление об изменении статуса ЗСК
   */
  private async sendZskStatusChangeNotification(
    inn: string, 
    newZskStatus: string,
    resultText: string
  ): Promise<void> {
    try {
      // Формируем сообщение о проверке ЗСК
      const message = NotificationFormatter.formatZskCheck(inn, newZskStatus, resultText);

      // Отправляем уведомление пользователям, отслеживающим организацию
      await getNotificationService().sendOrganizationNotification(inn, message);

      logger.info(`Уведомление об изменении статуса ЗСК отправлено для ИНН ${inn}`);

    } catch (error) {
      logger.error(`Ошибка при отправке уведомления ЗСК для ИНН ${inn}:`, error);
    }
  }
}

export const monitoringService = new MonitoringService();
