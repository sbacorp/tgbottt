import FireCrawlApp from '@mendable/firecrawl-js';
import { config } from '../utils/config';
import logger from '../utils/logger';

export interface KonturOrganizationData {
  inn: string;
  name: string;
  status: 'red' | 'orange' | 'green';
  address?: string;
  websites?: string[];
  isLiquidated?: boolean;
  illegalitySigns?: string[];
  region?: string;
  additionalInfo?: string;
  comment?: string;
  liquidationDate?: string;
  registrationDate?: string;
  ogrn?: string;
  kpp?: string;
  okpo?: string;
  founders?: string[];
  activities?: string[];
  capital?: string;
  taxAuthority?: string;
}

export class FireCrawlService {
  private app: FireCrawlApp;

  constructor() {
    this.app = new FireCrawlApp({ apiKey: config.firecrawlApiKey });
  }

  /**
   * Получает данные организации с Контур.Фокус
   */
  async getOrganizationData(inn: string): Promise<KonturOrganizationData | null> {
    try {
      logger.info(`Получение данных для ИНН: ${inn}`);
      
      const url = `https://focus.kontur.ru/search?country=RU&query=${inn}&p=1210%2C1210&from=widget-search`;
      
      const scrapeResult = await this.app.scrapeUrl(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        parsePDF: true,
        maxAge: 14400000
      });
      console.log(scrapeResult, 'scrapeResult')
      // @ts-ignore 
      if (!scrapeResult.markdown) {
        logger.warn(`Не удалось получить данные для ИНН ${inn}: пустой ответ`);
        return null;
      }
  // @ts-ignore 
      return this.parseKonturData(scrapeResult.markdown, inn);
    } catch (error) {
      logger.error(`Ошибка при получении данных для ИНН ${inn}:`, error);
      return null;
    }
  }

  /**
   * Парсит markdown данные с Контур.Фокус
   */
  private parseKonturData(markdown: string, inn: string): KonturOrganizationData {
    const data: KonturOrganizationData = {
      inn,
      name: '',
      status: 'green'
    };

    try {
      // Извлекаем название организации
      const nameMatch = markdown.match(/# (.+?)\n/);
      if (nameMatch && nameMatch[1]) {
        data.name = nameMatch[1].replace(/"/g, '');
      }

      // Проверяем статус ликвидации
      const liquidationMatch = markdown.match(/Находится в стадии ликвидации — (.+?)\n/);
      if (liquidationMatch && liquidationMatch[1]) {
        data.isLiquidated = true;
        data.liquidationDate = liquidationMatch[1];
        data.status = 'red';
      }

      // Извлекаем адрес
      const addressMatch = markdown.match(/\n\n(.+?г .+?)\n\n/);
      if (addressMatch && addressMatch[1]) {
        data.address = addressMatch[1].trim();
      }

      // Извлекаем ОГРН
      const ogrnMatch = markdown.match(/\| ОГРН \| (.+?) \|/);
      if (ogrnMatch && ogrnMatch[1]) {
        data.ogrn = ogrnMatch[1];
      }

      // Извлекаем КПП
      const kppMatch = markdown.match(/\| КПП \| (.+?) \|/);
      if (kppMatch && kppMatch[1]) {
        data.kpp = kppMatch[1];
      }

      // Извлекаем ОКПО
      const okpoMatch = markdown.match(/\| ОКПО \| (.+?) \|/);
      if (okpoMatch && okpoMatch[1]) {
        data.okpo = okpoMatch[1];
      }

      // Извлекаем дату регистрации
      const regDateMatch = markdown.match(/Дата образования: (.+?)\n/);
      if (regDateMatch && regDateMatch[1]) {
        data.registrationDate = regDateMatch[1];
      }

      // Извлекаем налоговый орган
      const taxMatch = markdown.match(/Налоговый орган: (.+?)\n/);
      if (taxMatch && taxMatch[1]) {
        data.taxAuthority = taxMatch[1];
      }

      // Извлекаем уставный капитал
      const capitalMatch = markdown.match(/Уставный капитал: (.+?)\n/);
      if (capitalMatch && capitalMatch[1]) {
        data.capital = capitalMatch[1];
      }

      // Извлекаем основной вид деятельности
      const activityMatch = markdown.match(/Основной вид деятельности:\n\n(.+?) — (.+?)\n/);
      if (activityMatch) {
        data.activities = [`${activityMatch[1]} — ${activityMatch[2]}`];
      }

      // Извлекаем учредителей
      const founders: string[] = [];
      const founderMatches = markdown.matchAll(/\[(.+?) \d+\]/g);
      for (const match of founderMatches) {
        if (match[1] && !match[1].includes('Кинтеро')) { // Исключаем ликвидатора
          founders.push(match[1]);
        }
      }
      if (founders.length > 0) {
        data.founders = founders;
      }

      // Определяем регион из адреса
      if (data.address) {
        const regionMatch = data.address.match(/г (.+?)(?:,|$)/);
        if (regionMatch && regionMatch[1]) {
          data.region = regionMatch[1];
        }
      }

      // Проверяем на признаки проблемной организации
      const problemIndicators = [
        'ликвидация',
        'банкротство',
        'нелегальная',
        'мошенничество',
        'санкции',
        'черный список',
        'предупреждение'
      ];

      const hasProblems = problemIndicators.some(indicator => 
        markdown.toLowerCase().includes(indicator.toLowerCase())
      );

      if (hasProblems && data.status !== 'red') {
        data.status = 'orange';
      }

      // Извлекаем дополнительные признаки нелегальности
      const illegalitySigns: string[] = [];
      if (markdown.includes('нелегальная деятельность')) {
        illegalitySigns.push('Нелегальная деятельность');
      }
      if (markdown.includes('мошенничество')) {
        illegalitySigns.push('Мошенничество');
      }
      if (markdown.includes('санкции')) {
        illegalitySigns.push('Санкции');
      }

      if (illegalitySigns.length > 0) {
        data.illegalitySigns = illegalitySigns;
      }

      // Если название не найдено, используем ИНН
      if (!data.name) {
        data.name = `Организация ${inn}`;
      }

      logger.info(`Успешно обработаны данные для ${data.name} (ИНН: ${inn}, статус: ${data.status})`);
      return data;

    } catch (error) {
      logger.error(`Ошибка при парсинге данных для ИНН ${inn}:`, error);
      return {
        inn,
        name: `Организация ${inn}`,
        status: 'green'
      };
    }
  }

  /**
   * Проверяет несколько организаций одновременно
   */
  async checkMultipleOrganizations(inns: string[]): Promise<Map<string, KonturOrganizationData>> {
    const results = new Map<string, KonturOrganizationData>();
    
    logger.info(`Начинаем проверку ${inns.length} организаций`);
    
    for (const inn of inns) {
      try {
        const data = await this.getOrganizationData(inn);
        if (data) {
          results.set(inn, data);
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Ошибка при проверке ИНН ${inn}:`, error);
      }
    }
    
    logger.info(`Завершена проверка ${results.size} из ${inns.length} организаций`);
    return results;
  }

  /**
   * Получает краткую информацию об организации
   */
  async getOrganizationSummary(inn: string): Promise<string> {
    const data = await this.getOrganizationData(inn);
    if (!data) {
      return `❌ Организация с ИНН ${inn} не найдена`;
    }

    const statusEmoji = config.STATUS_EMOJIS[data.status];
    const statusName = config.STATUS_NAMES[data.status];
    
    let summary = `${statusEmoji} **${data.name}** (ИНН: ${inn})\n`;
    summary += `📊 Статус: ${statusName}\n`;
    
    if (data.address) {
      summary += `📍 Адрес: ${data.address}\n`;
    }
    
    if (data.registrationDate) {
      summary += `📅 Дата регистрации: ${data.registrationDate}\n`;
    }
    
    if (data.isLiquidated && data.liquidationDate) {
      summary += `⚠️ Ликвидация: ${data.liquidationDate}\n`;
    }
    
    if (data.illegalitySigns && data.illegalitySigns.length > 0) {
      summary += `🚨 Признаки: ${data.illegalitySigns.join(', ')}\n`;
    }
    
    if (data.activities && data.activities.length > 0) {
      summary += `🏢 Деятельность: ${data.activities[0]}\n`;
    }

    return summary;
  }
}
