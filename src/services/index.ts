import { PlaywrightScrapeService } from './playwrightScrapeService';

export type KonturScraper = PlaywrightScrapeService;

export function getKonturScraper(): KonturScraper {
  return new PlaywrightScrapeService();
}

// Этот файл будет экспортировать сервисы после их инициализации
// Пока что экспортируем только классы

export { NotificationService } from './notificationService';
export { MonitoringService } from './monitoringService';
export { PlaywrightScrapeService } from './playwrightScrapeService';
