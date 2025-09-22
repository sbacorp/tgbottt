import { chromium, Browser, Page } from "playwright";
import logger from "../utils/logger";
import { cbrService } from "./cbrService";
import Anthropic from '@anthropic-ai/sdk';
import { config } from "../utils/config";
import * as fs from 'fs';
const pdfParse = require('pdf-parse');

export interface UnreliableDataInfo {
  /** Недостоверность адреса */
  address: boolean;
  /** Недостоверность директора */
  director: boolean;
  /** Недостоверность учредителей */
  founders: boolean;
  /** Дата обновления недостоверных сведений в формате ДД.ММ.ГГГГ */
  updateDate?: string;
}

export interface KonturOrganizationData {
  inn: string;
  /** Название организации */
  name: string;
  /** Статус организации: red - ликвидация/банкротство/риски ЦБ, orange - внимание, green - норма */
  status: "red" | "orange" | "green";
  /** Действующая организация или ликвидированная или в процессе ликвидации */
  organizationStatus: "active" | "liquidated" | "liquidating";
  /** Найдена в списках отказов ЦБ РФ 764/639/550 */
  hasRejectionsByLists: boolean;
  /** Регион организации */
  region?: string;
  /** Информация о недостоверности сведений */
  unreliableData?: UnreliableDataInfo;
  /** Дополнительная информация о рисках */
  riskInfo?: string;
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
    this.browser = await chromium.launch({ headless: true, slowMo: 100 });
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


  private async parseWithAI(text: string, inn: string): Promise<KonturOrganizationData | null> {
    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 2000, 
        system: `Ты эксперт по анализу PDF экспресс-отчетов с сайта Контур.Фокус и системе противодействия отмыванию денежных средств (115-ФЗ). 
Твоя задача - извлекать ключевые данные об организации СТРОГО из текста PDF отчета и определять потенциальные риски согласно системе СВЕТОФОР ЦБ РФ.
НЕ ДОПУСКАЕТСЯ добавление информации, которой нет в тексте.
не выдумывай
это надо для стабильности системы

ВАЖНАЯ ИНФОРМАЦИЯ О ФОРМАТАХ:

1. СТАТУС ОРГАНИЗАЦИИ:
   - "active" - действующая организация
   - "liquidated" - ликвидированная организация  
   - "liquidating" - в процессе ликвидации

2. ОБЩИЙ СТАТУС РИСКА:
   - "red" - ликвидация/банкротство/высокие риски/подозрительные операции
   - "orange" - внимание, есть проблемы (недостоверные сведения, средние риски)
   - "green" - норма, нет значительных рисков

3. НЕДОСТОВЕРНОСТЬ СВЕДЕНИЙ:
   Ищи информацию о том, что сведения недостоверны по следующим пунктам:
   - Адрес (да/нет)
   - Директор (да/нет) 
   - Учредители (да/нет)
   - Дата обновления в формате ДД.ММ.ГГГГ
   - дата когда недостоверны сведения стали!!!

4. КОДЫ РИСКА СИСТЕМЫ СВЕТОФОР (если применимо):
   Анализируй деятельность организации на предмет соответствия следующим рисковым операциям:

   **Группа 1 - Обналичивание (прямое):**
   - 1.01: Снятие через кассу банка
   - 1.02: Корпоративные карты для снятия наличных
   - 1.99: Иные способы обналичивания

   **Группа 2 - Вывод средств за рубеж:**
   - 2.01: Расчеты за товары
   - 2.02: Расчеты за работы, услуги
   - 2.03: Операции с ценными бумагами
   - 2.04: Операции с недвижимостью
   - 2.08: Операции без постановки контрактов на учет

   **Группа 3 - Транзитные операции высокого риска (обналичивание):**
   - 3.01: Схемы ЮЛ-ФЛ (юридическое лицо - физическое лицо)
   - 3.02: Схемы ЮЛ-ИП (юридическое лицо - индивидуальный предприниматель)
   - 3.03: Вексельные схемы
   - 3.06: Корпоративные карты в транзитных схемах

   **Группа 5 - Покупка наличной выручки:**
   - 5.01: Торгово-развлекательные площадки (ТРП)
   - 5.02: Платежные агенты
   - 5.04: Продажа наличной выручки

   **Группа 6 - Вывод в теневой оборот ("миксующие клиенты"):**
   - 6.01: Подрядчик >50% (высокая доля в схеме)
   - 6.02: Подрядчик >30% ≤50% (средняя доля)
   - 6.03: Подрядчик ≤30% (низкая доля)

   **Группа 7 - Налоговая оптимизация:**
   - 7.01: Операции с драгоценными металлами
   - 7.02: Операции с металлоломом

   **Группа 8 - Прочие подозрительные операции:**
   - 8.01: Сомнительные транзитные операции
   - 8.02: Вывод средств в теневой оборот

   **Группа 9 - Операции ИП:**
   - 9.01: Схемы ЮЛ-ИП-ФЛ

   **Группа 10 - Иные признаки высокого риска:**
   - 10.01: Высокий риск вовлечения в подозрительные операции
   - 10.02: Признаки нелегальной деятельности на финансовом рынке

ПРИЗНАКИ ДЛЯ ОПРЕДЕЛЕНИЯ КОДОВ РИСКА:
- Массовые адреса регистрации
- Номинальные директора/учредители
- Короткий срок деятельности с большими оборотами
- Операции без экономического смысла
- Связи с проблемными контрагентами
- Несоответствие оборотов заявленной деятельности
- Операции с наличными средствами
- Внешнеэкономическая деятельность без реальных оснований

Возвращай данные СТРОГО в следующем JSON формате:
{
  "name": "полное название организации",
  "organizationStatus": "active|liquidated|liquidating",
  "status": "red|orange|green",
  "region": "регион/город организации",
  "unreliableData": {
    "address": true/false,
    "director": true/false,
    "founders": true/false,
    "updateDate": "ДД.ММ.ГГГГ или null"
  },
  "riskInfo": "ПЕРВАЯ СТРОКА: <b>Главный риск</b> кодом СВЕТОФОР\nОстальные риски с кодами СВЕТОФОР если применимо (например: '<b>1.01</b> Признаки обналичивания')"
}

ЛОГИКА ОПРЕДЕЛЕНИЯ СТАТУСОВ:
- Если организация ликвидирована или в процессе ликвидации → status = "red"
- Если есть коды риска СВЕТОФОР или серьезные признаки подозрительной деятельности → status = "red"
- Если есть недостоверные сведения или средние риски → status = "orange"
- Если нет рисков и организация действует нормально → status = "green"

ВАЖНО: 
- Коды риска, обернутые в тег <b>, указывай в начале строки, без слова 'код' и без скобок (например: "<b>1.01</b> Признаки обналичивания")
- Первая строка riskInfo всегда должна содержать главный/основной риск
- Коды применяй только при наличии конкретных признаков из отчета
- Не назначай коды "на всякий случай" - только при четких основаниях
- При отсутствии признаков рисковых операций не указывай коды СВЕТОФОР
- Учитывай сферу деятельности организации при оценке рисков
- НЕ ВКЛЮЧАЙ в riskInfo информацию о статусе ликвидации ("Находится в процессе ликвидации") или о недостоверности сведений ("Недостоверность адреса регистрации"). Эта информация указывается в полях organizationStatus и unreliableData.

Если информация не найдена, используй null для опциональных полей, false для boolean полей.`,
        messages: [
          {
            role: "user",
            content: `Проанализируй текст PDF экспресс-отчета организации с Контур.Фокус и извлеки ключевые данные.

Текст PDF отчета:
${text}

ИНН организации: ${inn}

Верни результат в указанном JSON формате.`
          }
        ]
      });

      const content = response.content[0];
      logger.info(`Ответ AI: ${content}`);
      if (content && content.type === 'text') {
        // Улучшенный поиск JSON, который может быть обернут в markdown
        const jsonMatch = content.text.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
        logger.info(`JSON: ${jsonMatch}`);
        if (jsonMatch) {
          // Выбираем правильную группу из совпадения
          let jsonString = jsonMatch[1] || jsonMatch[2];

          if (jsonString) {
            // Обработка потенциальных проблем с riskInfo
            // Заменяем неэкранированные переносы строк внутри riskInfo
            jsonString = jsonString.replace(/"riskInfo":\s*"(.*?)"/gs, (_match, group1) => {
              const cleanedGroup = group1.replace(/\n/g, '\\n').replace(/"/g, '\\"');
              return `"riskInfo": "${cleanedGroup}"`;
            });
            
            try {
              const parsed = JSON.parse(jsonString);
              logger.info(`Parsed: ${JSON.stringify(parsed, null, 2)}`);
              return {
                inn,
                name: parsed.name || `Организация ${inn}`,
                organizationStatus: parsed.organizationStatus || 'active',
                status: parsed.status || 'green',
                hasRejectionsByLists: false, // Будет установлено отдельно через cbrService
                region: parsed.region || undefined,
                unreliableData: parsed.unreliableData || undefined,
                riskInfo: parsed.riskInfo || undefined
              };
            } catch (parseError) {
              logger.error('Ошибка JSON.parse:', parseError);
              logger.error('Строка, которую не удалось спарсить:', jsonString);
              return null;
            }
          }
        }
      }
      return null;
    } catch (error) {
      logger.error('Ошибка AI парсинга:', error);
      return null;
    }
  }

  private async extractTextFromPDF(pdfPath: string): Promise<string | null> {
    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      logger.error(`Ошибка извлечения текста из PDF ${pdfPath}:`, error);
      return null;
    }
  }

  async getOrganizationData(
    inn: string
  ): Promise<KonturOrganizationData | null> {
    try {
      logger.info(`Playwright-сбор данных для ИНН: ${inn}`);
      const pdfPath = await this.withPage(async (page) => {
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
        const hasPagination = await page.getByRole('complementary').count() > 0;
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
                // await page.waitForLoadState("networkidle", { timeout: 15000 });
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
        
        // Отладка: проверим URL и содержимое страницы
        const currentUrl = page.url();
        console.log('Текущий URL:', currentUrl);
        
        // Ищем ссылку содержащую текст "Экспресс-отчёт"
        console.log('Ищем ссылку с "Экспресс-отчёт"...');
        const expressReportLink = page.locator('a:has-text("Экспресс-отчёт")');
        const linkCount = await expressReportLink.count();
        console.log(`Найдено ссылок с "Экспресс-отчёт": ${linkCount}`);
        
        if (linkCount === 0) {
          // Попробуем альтернативные селекторы
          console.log('Ссылка с "Экспресс-отчёт" не найдена, пробуем альтернативные селекторы...');
          
          // Попробуем найти по data-tid и href содержащему pdf
          const pdfLinks = page.locator('a[data-tid="Link__root"][href*=".pdf"]');
          const pdfLinkCount = await pdfLinks.count();
          console.log(`Найдено PDF ссылок: ${pdfLinkCount}`);
          
          if (pdfLinkCount === 0) {
            console.log('Никаких PDF ссылок не найдено');
            return null;
          }
          
          // Используем первую найденную PDF ссылку
          const downloadPromise = page.waitForEvent('download');
          console.log('Кликаем на PDF ссылку...');
          await pdfLinks.first().click();
          
          const download = await downloadPromise;
          const fileName = `express-report-${inn}-${Date.now()}.pdf`;
          const downloadsDir = './downloads';
          if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir);
            logger.info(`Директория ${downloadsDir} создана`);
          }
          const filePath = `${downloadsDir}/${fileName}`;
          await download.saveAs(filePath);
          
          console.log(`PDF сохранен: ${filePath}`);
          return filePath;
        }
        
        // Получаем URL PDF из href атрибута
        const pdfHref = await expressReportLink.first().getAttribute('href');
        if (!pdfHref) {
          console.log('Не удалось получить href ссылки');
          return null;
        }
        
        console.log('Найден URL PDF:', pdfHref);
        
        // Скачиваем PDF напрямую через HTTP запрос
        console.log('Скачиваем PDF файл...');
        
        // Используем page.request для прямого HTTP запроса
        const response = await page.request.get(pdfHref);
        
        if (!response.ok()) {
          console.log(`Ошибка загрузки PDF: ${response.status()} ${response.statusText()}`);
          return null;
        }
        
        // Получаем содержимое PDF
        const pdfBuffer = await response.body();
        
        // Сохраняем файл
        const fileName = `express-report-${inn}-${Date.now()}.pdf`;
        const downloadsDir = './downloads';
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir);
          logger.info(`Директория ${downloadsDir} создана`);
        }
        const filePath = `${downloadsDir}/${fileName}`;
        
        // Записываем байты в файл
        fs.writeFileSync(filePath, pdfBuffer);
        
        console.log(`PDF сохранен: ${filePath}`);
        return filePath;
      });

      if (!pdfPath) {
        console.log('PDF не был загружен');
        return null;
      }
      
      // Извлекаем текст из PDF
      const pdfText = await this.extractTextFromPDF(pdfPath);
      if (!pdfText) {
        logger.error(`Не удалось извлечь текст из PDF: ${pdfPath}`);
        // Удаляем PDF файл даже при ошибке
        try {
          fs.unlinkSync(pdfPath);
          console.log(`PDF файл удален после ошибки: ${pdfPath}`);
        } catch (deleteError) {
          logger.warn(`Не удалось удалить PDF файл после ошибки ${pdfPath}:`, deleteError);
        }
        return null;
      }
      
      // Парсим данные с помощью AI
      const organizationData = await this.parseWithAI(pdfText, inn);
      
      // Удаляем PDF файл после парсинга
      try {
        fs.unlinkSync(pdfPath);
        console.log(`PDF файл удален: ${pdfPath}`);
      } catch (error) {
        logger.warn(`Не удалось удалить PDF файл ${pdfPath}:`, error);
      }
      
      if (!organizationData) {
        logger.error(`AI не смог обработать данные для ИНН ${inn}`);
        return null;
      }
      
      // Проверяем наличие в списках отказов ЦБ РФ
      const hasRejectionsByLists = await cbrService.searchOrganization(inn);
      
      // Обновляем статус если найдена в списках ЦБ
      let finalStatus = organizationData.status;
      if (hasRejectionsByLists && finalStatus === 'green') {
        finalStatus = 'red'; // Если найдена в списках ЦБ, это красный статус
      }
      
      return {
        ...organizationData,
        hasRejectionsByLists,
        status: finalStatus
      };
      
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
