import { chromium, Browser, Page } from "playwright";
import logger from "../utils/logger";
import { cbrService } from "./cbrService";
import { isOrganizationNotFound } from "../utils/validation";
import Anthropic from '@anthropic-ai/sdk';
import { config } from "../utils/config";

export interface KonturOrganizationData {
  inn: string;
  name: string;
  status: "red" | "orange" | "green";
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
  unreliableInfo?: string;
  unreliableDate?: string;
  /** Короткое текстовое описание основного риска/факта (например, "Находится в стадии ликвидации" или "Сведения недостоверны") */
  primaryRisk?: string;
  /** Дата, релевантная основному риску (ДД.ММ.ГГГГ) */
  primaryRiskDate?: string;
}

export class PlaywrightScrapeService {
  private browser: Browser | null = null;
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.CLAUDE_API_KEY || '',
    });
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await chromium.launch({ headless: false, slowMo: 100 });
    return this.browser;
  }

  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const browser = await this.ensureBrowser();
    const context = await browser.newContext({
      storageState: "playwright/.auth/kontur.json",
    });
    const page = await context.newPage();
    try {
      return await fn(page);
    } finally {
      await context.close();
    }
  }


  private getMainText(): string {
    const mainEl = document.querySelector('main');
    return mainEl?.innerText || '';
  }

  private async parseWithAI(text: string, inn: string): Promise<KonturOrganizationData | null> {
    try {

      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 2000, 
        system: `Ты эксперт по анализу данных организаций с сайта Контур.Фокус. 
Твоя задача - извлекать структурированные данные из текста страницы организации.

ВАЖНО: Внимательно ищи все даты в тексте, особенно:
- Даты ликвидации: "Прекратило деятельность", "Ликвидировано", "Реорганизовано"
- Даты банкротства: "Признано банкротом", "Процедура банкротства"
- Даты недостоверных сведений: "Сведения недостоверны"
- Даты регистрации: "Дата образования", "Зарегистрировано"
Извлекай следующие поля и возвращай в формате JSON:
{
  "name": "название организации", =>
  "status": "red|orange|green (красный - ликвидация/банкротство, оранжевый - внимание, зеленый - норма)",
  "address": "полный адрес",
  "region": "регион/город",
  "ogrn": "ОГРН",
  "kpp": "КПП", 
  "okpo": "ОКПО",
  "registrationDate": "дата регистрации в формате ДД.ММ.ГГГГ",
  "liquidationDate": "дата ликвидации в формате ДД.ММ.ГГГГ (если есть)",
  "isLiquidated": true/false,
  "taxAuthority": "налоговый орган",
  "capital": "уставный капитал",
  "activities": ["основной вид деятельности"],
  "unreliableInfo": "информация о недостоверных сведениях (если есть)",
  "unreliableDate": "дата недостоверных сведений в формате ДД.ММ.ГГГГ (если есть)",
  "riskInfo": "подробная информация о рисках с датами событий",
  "primaryRisk": "краткое описание главного риска (например: 'Находится в стадии ликвидации' или 'Сведения недостоверны')",
  "primaryRiskDate": "дата этого главного риска (ДД.ММ.ГГГГ)"
}

Правила определения статуса:
- "red": ликвидация, банкротство, прекращение деятельности
- "orange": факты требующие внимания, недостоверные сведения
- "green": нормальная деятельность

Если поле не найдено, используй null. Все даты извлекай в формате ДД.ММ.ГГГГ. Если организация в красном статусе, главным риском обычно является ликвидация/реорганизация с датой. Если в оранжевом — часто 'Сведения недостоверны' с датой.`,
        messages: [
          {
            role: "user",
            content: `Проанализируй текст страницы организации с Контур.Фокус и извлеки структурированные данные.

Текст страницы:
${text}

ИНН организации: ${inn}`
          }
        ]
      });

      const content = response.content[0];

      if (content && content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            inn,
            name: parsed.name || `Организация ${inn}`,
            status: parsed.status || 'green',
            address: parsed.address,
            region: parsed.region,
            ogrn: parsed.ogrn,
            kpp: parsed.kpp,
            okpo: parsed.okpo,
            registrationDate: parsed.registrationDate,
            liquidationDate: parsed.liquidationDate,
            isLiquidated: parsed.isLiquidated || false,
            taxAuthority: parsed.taxAuthority,
            capital: parsed.capital,
            activities: parsed.activities,
            founders: parsed.founders,
            unreliableInfo: parsed.unreliableInfo,
            unreliableDate: parsed.unreliableDate,
            riskInfo: parsed.riskInfo,
            primaryRisk: parsed.primaryRisk,
            primaryRiskDate: parsed.primaryRiskDate
          };
        }
      }
      return  null
    } catch (error) {
      logger.error('Ошибка AI парсинга:', error);
      return null;
    }
  }

  async getOrganizationData(
    inn: string
  ): Promise<KonturOrganizationData | null> {
    try {
      logger.info(`Playwright-сбор данных для ИНН: ${inn}`);
      const text = await this.withPage(async (page) => {
        // 1) Заходим на главную
        await page.goto("https://focus.kontur.ru/", {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });

        // закрыть баннеры/куки, если есть
        try {
          const cookieBtn = page.locator(
            'button:has-text("Согласен"), button:has-text("Принять"), button:has-text("Хорошо")'
          );
          if (await cookieBtn.count()) {
            await cookieBtn.first().click({ timeout: 3000 });
          }
        } catch {}

        // Ждем загрузки input поля и вводим ИНН
        await page.waitForSelector("input", { timeout: 10000 });
        await page.waitForTimeout(1000)
        const genericInput = page.locator("input").first();
        await genericInput.fill(inn);
        await genericInput.press("Enter");
        
        // Дополнительное ожидание для стабильности

        // Проверяем, есть ли пагинация (второй сценарий)
        const hasPagination = await page.locator('[data-tid="textPagination"]').count() > 0;
        
        if (hasPagination) {
          console.log('Найдена пагинация - это список результатов, ищем нужную организацию...');
          
          // Получаем историю поиска через API
          const searchHistory = await page.evaluate(async () => {
            try {
              const response = await fetch('https://focus.kontur.ru/v2/api/search/history?take=6');
              const data = await response.json();
              return data;
            } catch (e) {
              return null;
            }
          }, inn);
          
          if (searchHistory && searchHistory.data) {
            // Находим индекс точного совпадения с нашим ИНН
            const exactMatchIndex = searchHistory.data.findIndex((item: any) => item.text === inn);
            
            if (exactMatchIndex >= 0) {
              console.log(`Найдено точное совпадение на позиции ${exactMatchIndex}, кликаем...`);
              
              // Кликаем на нужную ссылку по индексу (на тег a внутри entityLink)
              const entityLinks = page.locator('[data-tid="entityLink"] a');
              const linkCount = await entityLinks.count();
              
              if (exactMatchIndex < linkCount) {
                // Ждем, пока ссылка станет кликабельной
                await entityLinks.nth(exactMatchIndex).waitFor({ state: 'visible', timeout: 5000 });
                await entityLinks.nth(exactMatchIndex).click();
                console.log('Переходим на страницу организации...');
                
                // Ждём загрузки страницы организации
                await page.waitForLoadState("networkidle", { timeout: 15000 });
                await page.waitForTimeout(3000);
              } else {
                console.log('Индекс превышает количество найденных ссылок');
              }
            } else {
              console.log('Точное совпадение ИНН не найдено в результатах');
            }
          } else {
            console.log('Не удалось получить историю поиска');
          }
        } else {
          console.log('Пагинация не найдена - это прямая страница организации');
        }
        // Ждем загрузки main элемента
        await page.waitForSelector('main', { timeout: 10000 });
        await page.waitForTimeout(3000);
        
        // Отладка: проверим URL и содержимое страницы
        const currentUrl = page.url();
        console.log('Текущий URL:', currentUrl);
        
        // Проверим, есть ли main элемент
        const mainExists = await page.locator('main').count() > 0;
        console.log('Main элемент найден:', mainExists);
        
        // Получаем данные из конкретных элементов
        const mainText = await page.evaluate(this.getMainText);
        console.log('mainText длина:', mainText?.length || 0);
        console.log('mainText первые 200 символов:', mainText?.substring(0, 200) || 'ПУСТО');
        // Проверяем, что организация найдена
        if (isOrganizationNotFound(mainText, inn)) return null;
        
        return await this.parseWithAI(mainText, inn);
      });

      if (!text) return null;
      
      // text уже является KonturOrganizationData от AI
      const hasIllegalActivity = await cbrService.searchOrganization(inn);
      text.hasIllegalActivity = hasIllegalActivity;
      return text;
    } catch (error) {
      logger.error(`Ошибка Playwright для ИНН ${inn}:`, error);
      return null;
    }
  }

  async checkMultipleOrganizations(
    inns: string[]
  ): Promise<Map<string, KonturOrganizationData>> {
    const results = new Map<string, KonturOrganizationData>();
    for (const inn of inns) {
      try {
        const data = await this.getOrganizationData(inn);
        if (data) results.set(inn, data);
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e) {
        logger.error(`Ошибка при проверке ИНН ${inn} (Playwright):`, e);
      }
    }
    return results;
  }

  async close(): Promise<void> {
    try {
      await this.browser?.close();
    } catch {}
    this.browser = null;
  }
}

export const playwrightScrapeService = new PlaywrightScrapeService();
