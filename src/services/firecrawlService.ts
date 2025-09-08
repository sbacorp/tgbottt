import FireCrawlApp from '@mendable/firecrawl-js';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { cbrService } from './cbrService';
import { isOrganizationNotFound } from '../utils/validation';

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
  riskInfo?: string;
  hasIllegalActivity?: boolean;
}

export class FireCrawlService {
  private app: FireCrawlApp;

  constructor() {
    this.app = new FireCrawlApp({ apiKey: config.FIRECRAWL_API_KEY });
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
        parsePDF: false,
        waitFor: 6000,
        maxAge: 14400000
      });
      // @ts-ignore 
      if (!scrapeResult.markdown) {
        logger.warn(`Не удалось получить данные для ИНН ${inn}: пустой ответ`);
        return null;
      }
      // @ts-ignore 
      // Проверяем, найдена ли организация
      if (isOrganizationNotFound(scrapeResult.markdown, inn)) {
        logger.warn(`Организация с ИНН ${inn} не найдена на Контур.Фокус`);
        return null;
      }
      
  // @ts-ignore 
      const konturData = this.parseKonturData(scrapeResult.markdown, inn);
      
      // Проверяем в списке ЦБ РФ
      const hasIllegalActivity = await cbrService.searchOrganization(inn);
      konturData.hasIllegalActivity = hasIllegalActivity;
      
      return konturData;
    } catch (error) {
      logger.error(`Ошибка при получении данных для ИНН ${inn}:`, error);
      return null;
    }
  }

  /**
   * Очищает адрес от лишних сокращений
   */
  private cleanAddress(address: string): string {
    return address
      .replace(/\s*вн\.тер\.г\s*/g, ' ') // удаляем 'вн.тер.г'
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
        data.address = this.cleanAddress(addressMatch[1]);
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

      // Определяем статус на основе фактов из автоматической проверки
      // Новый формат Контур.Фокус
      const liquidationFactMatch = markdown.match(/(\d+)\s*—\s*факт(?:ы|ов)?,?\s*связанн(?:ый|ые|ых)\s*с\s*ликвидацией\s*или\s*банкротством/i);
      const attentionFactMatch = markdown.match(/(\d+)\s*—\s*факт(?:ы|ов)?,?\s*на\s*котор(?:ый|ые|ых)\s*следует\s*обратить\s*внимание/i);
      const goodFactsMatch = markdown.match(/(\d+)\s*—\s*благоприятн(?:ый|ые|ых)\s*факт(?:ы|ов)?/i);

      // Отладочное логирование
      logger.info(`Parsing facts for ${inn}:`);
      logger.info(`Liquidation match: ${liquidationFactMatch ? liquidationFactMatch[0] + ' -> ' + liquidationFactMatch[1] : 'none'}`);
      logger.info(`Attention match: ${attentionFactMatch ? attentionFactMatch[0] + ' -> ' + attentionFactMatch[1] : 'none'}`);
      logger.info(`Good facts match: ${goodFactsMatch ? goodFactsMatch[0] + ' -> ' + goodFactsMatch[1] : 'none'}`);

      // Старый формат (для совместимости)
      const oldLiquidationMatch = markdown.match(/ с ликвидацией или банкротством/);
      const oldAttentionMatch = markdown.match(/на который следует обратить внимание/);

      // Приоритет: красный > оранжевый > зеленый
      if (liquidationFactMatch && liquidationFactMatch[1] && parseInt(liquidationFactMatch[1]) > 0) {
        data.status = 'red';
        data.riskInfo = `Обнаружено ${liquidationFactMatch[1]} фактов ликвидации/банкротства`;
      } else if (oldLiquidationMatch) {
        data.status = 'red';
      } else if (attentionFactMatch && attentionFactMatch[1] && parseInt(attentionFactMatch[1]) > 0) {
        data.status = 'orange';
        data.riskInfo = `Обнаружено ${attentionFactMatch[1]} фактов требующих внимания`;
      } else if (oldAttentionMatch) {
        data.status = 'orange';
        
        // Извлекаем информацию о рисках для оранжевого статуса
        const riskPatterns = [
          /Сведения недостоверны \(по результатам проверки ФНС – (.+?)\)/,
          /Сведения недостоверны \(по результатам проверки ФНС – (.+?)\)\d{2}\.\d{2}\.\d{4}/,
          /Сведения недостоверны \(по результатам проверки ФНС – (.+?)\)\n/,
          /Сведения недостоверны \(по результатам проверки ФНС – (.+?)\)\s*\d{2}\.\d{2}\.\d{4}/
        ];

        for (const pattern of riskPatterns) {
          const riskMatch = markdown.match(pattern);
          if (riskMatch && riskMatch[1]) {
            data.riskInfo = `Сведения недостоверны (по результатам проверки ФНС – ${riskMatch[1]})`;
            break;
          }
        }

        // Если не нашли по паттерну, ищем просто текст "Сведения недостоверны"
        if (!data.riskInfo && markdown.includes('Сведения недостоверны')) {
          const lines = markdown.split('\n');
          for (const line of lines) {
            if (line.includes('Сведения недостоверны')) {
              // Очищаем строку от лишних символов и дат в конце
              let cleanLine = line.trim();
              // Убираем дату в конце строки (формат DD.MM.YYYY)
              cleanLine = cleanLine.replace(/\d{2}\.\d{2}\.\d{4}$/, '').trim();
              data.riskInfo = cleanLine;
              break;
            }
          }
        }
      } else {
        data.status = 'green';
        if (goodFactsMatch) {
          data.riskInfo = `Обнаружено ${goodFactsMatch[1]} благоприятных фактов`;
        }
      }

      // Дополнительная информация о проверке
      if (liquidationFactMatch || attentionFactMatch || goodFactsMatch) {
        const facts = [];
        if (liquidationFactMatch) facts.push(`🔴 ${liquidationFactMatch[1]} - ликвидация/банкротство`);
        if (attentionFactMatch) facts.push(`🟡 ${attentionFactMatch[1]} - требует внимания`);
        if (goodFactsMatch) facts.push(`🟢 ${goodFactsMatch[1]} - благоприятные`);
        
        if (facts.length > 0) {
          data.additionalInfo = `Факты о организации: ${facts.join(', ')}`;
        }
      }

      // Логируем итоговый статус
      logger.info(`Final status for ${inn}: ${data.status} (liquidation: ${liquidationFactMatch?.[1] || 0}, attention: ${attentionFactMatch?.[1] || 0}, good: ${goodFactsMatch?.[1] || 0})`);

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

}
