import { chromium, Browser, Page, BrowserContext } from 'playwright';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import Jimp from 'jimp';
import { config } from '../utils/config';

/**
 * Сервис для работы с платформой ЗСК (Знай Своего Клиента) ЦБ РФ
 * Автоматизирует проверку организаций через веб-интерфейс с обходом капчи
 */

export class PlatformZskService {
    private browser: Browser | null = null;
    private anthropic: Anthropic | null = null;

    constructor() {
        const apiKey = config.CLAUDE_API_KEY;
        if (apiKey) {
            this.anthropic = new Anthropic({ apiKey });
        }
    }

    /**
     * Инициализация браузера с настройкой прокси
     */

    async init(): Promise<void> {
        try {
            // Настройка базовых опций браузера
            const launchOptionsBase: any = {
                headless: true,
                slowMo: 0,
                args: [
                    '--lang=ru-RU,ru'
                ]
            };

            // Добавляем прокси если он включен
            // Поддерживаются HTTP/HTTPS, SOCKS4/SOCKS5 прокси с аутентификацией
            let lastError: any = null;
            const proxyIps = (config.proxy.poolIps && config.proxy.poolIps.length > 0)
                ? config.proxy.poolIps
                : [];

            const targets = proxyIps.length > 0 ? proxyIps : [''];

            for (const ip of targets) {
                const launchOptions: any = { ...launchOptionsBase };

                if (config.proxy.enabled) {
                    const serverHost = ip;
                    if (!serverHost) continue;
                    const server = serverHost.startsWith('http') ? serverHost : `http://${serverHost}:${config.proxy.port}`;
                    launchOptions.proxy = { server };
                    if (config.proxy.username && config.proxy.password) {
                        launchOptions.proxy.username = config.proxy.username;
                        launchOptions.proxy.password = config.proxy.password;
                    }
                    logger.info(`Trying proxy: ${launchOptions.proxy.server}`);
                }

                try {
                    this.browser = await chromium.launch(launchOptions);
                    logger.info('Platform ZSK service initialized');
                    lastError = null;
                    break;
                } catch (e) {
                    lastError = e;
                    logger.warn(`Failed to launch with proxy ${config.proxy.enabled ? launchOptions.proxy.server : 'NO_PROXY'}: ${String(e)}`);
                    this.browser = null;
                }
            }

            if (!this.browser) {
                throw lastError || new Error('Failed to initialize browser with provided proxy settings');
            }
            logger.info('Platform ZSK service initialized');
        } catch (error) {
            logger.error('Error initializing Platform ZSK service:', error);
            throw error;
        }
    }

    private async createNewContext(): Promise<{ context: BrowserContext; page: Page }> {
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        // Фиксированный профиль macOS Chrome (под реальные данные пользователя)
        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
        const contextOptions = {
            userAgent,
            viewport: { width: 1512, height: 982 },
            deviceScaleFactor: 2,
            locale: 'ru-RU',
            timezoneId: 'Europe/Moscow',
            colorScheme: 'light',
            hasTouch: false,
            isMobile: false,
            serviceWorkers: 'allow' as const,
            extraHTTPHeaders: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'upgrade-insecure-requests': '1',
                // UA-CH хедеры (client hints)
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
            }
        } as const;

        logger.info(`Creating new browser context with macOS profile: ${userAgent.substring(0, 60)}...`);

        const context = await this.browser.newContext(contextOptions);

        const page = await context.newPage();

        // Добавляем скрипты для маскировки автоматизации
        await page.addInitScript(() => {
            // Маскируем webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Маскируем автоматизацию
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            Object.defineProperty(navigator, 'languages', {
                get: () => ['ru-RU', 'ru', 'en-US', 'en'],
            });

            // Маскируем платформу под macOS
            Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

            // Маскируем Chrome runtime
            if ((window as any).chrome) {
                Object.defineProperty((window as any).chrome, 'runtime', {
                    get: () => undefined,
                });
            }

            // Маскируем Permissions API
            const originalQuery = window.navigator.permissions.query;
            (window.navigator.permissions as any).query = (parameters: any) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Эмулируем navigator.connection
            if (!(navigator as any).connection) {
                Object.defineProperty(navigator, 'connection', {
                    configurable: true,
                    enumerable: true,
                    get: () => ({
                        downlink: 10,
                        effectiveType: '4g',
                        rtt: 50,
                        saveData: false,
                        onchange: null,
                    }),
                });
            }

            // Эмулируем медиа-устройства
            if (navigator.mediaDevices && 'enumerateDevices' in navigator.mediaDevices) {
                const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
                navigator.mediaDevices.enumerateDevices = async () => {
                    try {
                        const list = await originalEnumerate();
                        if (Array.isArray(list) && list.length > 0) return list;
                    } catch {}
                    return [
                        { kind: 'audioinput', deviceId: 'default', label: '', groupId: '' },
                        { kind: 'audiooutput', deviceId: 'default', label: '', groupId: '' },
                        { kind: 'videoinput', deviceId: 'default', label: '', groupId: '' },
                    ] as any;
                };
            }

            // Подменяем WebGL параметры для правдоподобности
            const patchWebGL = (gl: any) => {
                if (!gl) return;
                const originalGetParameter = gl.getParameter.bind(gl);
                gl.getParameter = (parameter: number) => {
                    const UNMASKED_VENDOR_WEBGL = 0x9245;
                    const UNMASKED_RENDERER_WEBGL = 0x9246;
                    if (parameter === UNMASKED_VENDOR_WEBGL) return 'Apple Inc.';
                    if (parameter === UNMASKED_RENDERER_WEBGL) return 'Apple GPU';
                    return originalGetParameter(parameter);
                };
            };
            try {
                const canvas = document.createElement('canvas');
                patchWebGL(canvas.getContext('webgl'));
                patchWebGL(canvas.getContext('webgl2'));
            } catch {}
        });

        // Настраиваем UA Client Hints через CDP, чтобы совпадали с Chrome/macOS
        try {
            const client = await context.newCDPSession(page);
            await client.send('Network.setUserAgentOverride', {
                userAgent,
                userAgentMetadata: {
                    brands: [
                        { brand: 'Chromium', version: '139' },
                        { brand: 'Google Chrome', version: '139' },
                        { brand: 'Not;A=Brand', version: '99' },
                    ],
                    fullVersionList: [
                        { brand: 'Chromium', version: '139.0.0.0' },
                        { brand: 'Google Chrome', version: '139.0.0.0' },
                        { brand: 'Not;A=Brand', version: '99.0.0.0' },
                    ],
                    platform: 'macOS',
                    platformVersion: '10.15.7',
                    architecture: 'x86',
                    model: '',
                    mobile: false,
                }
            });
        } catch {}

        // Небольшая «очеловеченная» активность до перехода на сайт с проверкой
        try {
            await page.mouse.move(100 + Math.random() * 300, 150 + Math.random() * 200);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300 + Math.floor(Math.random() * 500));
            await page.mouse.move(200 + Math.random() * 400, 300 + Math.random() * 200);
            await page.evaluate(() => window.scrollBy(0, 200 + Math.floor(Math.random() * 200)));
        } catch {}

        return { context, page };
    }

    /**
     * Основной метод проверки организации по ИНН через платформу ЗСК
     * Включает обход защиты DDOS-Guard и решение капчи через AI
     * 
     * @param inn - ИНН организации для проверки
     * @returns Promise с результатом проверки
     */
    async checkInn(inn: string): Promise<{ success: boolean; result: string }> {
        let context: BrowserContext | null = null;
        let page: Page | null = null;

        try {
            // Создаем новый контекст с рандомными данными для каждого запроса
            const browserContext = await this.createNewContext();
            context = browserContext.context;
            page = browserContext.page;

            logger.info(`Starting INN check for: ${inn} with new browser context`);

            // Ограничим дефолтные таймауты страницы, чтобы не висеть бесконечно
            page.setDefaultNavigationTimeout(25000);
            page.setDefaultTimeout(25000);

            // === ЭТАП 1: РАЗОГРЕВ И ПОЛУЧЕНИЕ DDOS-GUARD КУКИ ===
            // Разогрев: идём на корень, чтобы DDOS-Guard поставил нужные куки
            await page.goto('https://www.cbr.ru/', { referer: 'https://www.google.com/' });
            try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
            await page.waitForTimeout(2000);
            // Ждём появления ddos-куки
            try {
                for (let i = 0; i < 5; i++) {
                    const cookies = await context.cookies('https://www.cbr.ru');
                    const hasDdg = cookies.some(c => c.name.startsWith('__ddg'));
                    if (hasDdg) break;
                    await page.waitForTimeout(2000);
                }
            } catch {}

            // Пробуем перейти к разделу через меню на главной (чисто через DOM клики)
            let navigatedViaMenu = false;
            try {
                await page.waitForSelector('.header_menu', { timeout: 15000 });
                await page.evaluate(() => {
                    const menu = document.querySelector('.header_menu') as HTMLElement | null;
                    if (menu) menu.click();
                });
                await page.waitForSelector('#menu_tab_Services', { timeout: 15000 });
                await page.evaluate(() => {
                    const tab = document.querySelector('#menu_tab_Services') as HTMLElement | null;
                    if (tab) tab.click();
                });
                await page.waitForTimeout(500);
                // Прямой клик через DOM, как в ручном сценарии
                const clicked = await page.evaluate(() => {
                    const a = document.querySelector('a[href="/counteraction_m_ter/platform_zsk/proverka-po-inn/"]') as HTMLElement | null;
                    if (a) { a.click(); return true; }
                    return false;
                });
                if (!clicked) {
                    throw new Error('Не удалось найти ссылку на страницу проверки по ИНН через меню');
                }
                await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
                navigatedViaMenu = true;
            } catch (e) {
                // === ЭТАП 2: ПЕРЕХОД НА ПЛАТФОРМУ ЗСК ===
                // Фолбэк: прямой переход на страницу проверки ИНН
                await page.goto('https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/', { referer: 'https://www.cbr.ru/' });
                try { await page.waitForLoadState('domcontentloaded', { timeout: 20000 }); } catch {}
            }

            // === ЭТАП 3: ОБХОД DDOS-GUARD ЗАЩИТЫ ===
            // Если попали на экран DDOS-Guard — несколько попыток автообновления
            for (let attempt = 1; attempt <= 4; attempt++) {
                const guardText = await page.locator('text=Проверка браузера перед переходом на cbr.ru').count();
                if (guardText === 0) break;
                await page.waitForTimeout(4000 + Math.floor(Math.random() * 2000));
                try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
            }
            await page.waitForTimeout(2000);

            // Логируем способ навигации для диагностики
            logger.info(`Navigated to target via ${navigatedViaMenu ? 'menu' : 'direct goto'}`);

            // Проверяем Cloudflare
            const cloudflareCheck = await page.locator('text="accessing"').count();
            if (cloudflareCheck > 0) {
                await page.waitForFunction(() => {
                    return !document.body.textContent?.includes('accessing');
                }, { timeout: 10000 });
                await page.waitForTimeout(10000);
            }
            //тут добавить скриншот страницы
            const screenshot1 = await page.screenshot();
            const screenshotPath1 = path.join(process.cwd(), 'screenshot.png');
            fs.writeFileSync(screenshotPath1, screenshot1);
            logger.info(`Screenshot saved to: ${screenshotPath1}`);

            // Заполняем форму
            // === ЭТАП 4: ЗАПОЛНЕНИЕ ФОРМЫ ПРОВЕРКИ ===
            let innFieldVisible = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await page.waitForSelector('#BlackINN_INN', { state: 'visible', timeout: 10000 });
                    innFieldVisible = true;
                    break;
                } catch (e) {
                    try {
                        const timeoutShotPath = path.join(process.cwd(), `screenshot_wait_inn_attempt${attempt}.png`);
                        await page.screenshot({ path: timeoutShotPath, fullPage: true });
                        logger.error(`Attempt ${attempt}: timeout waiting for #BlackINN_INN. Screenshot saved: ${timeoutShotPath}`);
                    } catch (scrErr) {
                        logger.error('Failed to capture timeout screenshot:', scrErr);
                    }
                    if (attempt < 3) {
                        try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
                        try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
                        await page.waitForTimeout(3000);
                        continue;
                    } else {
                        throw e;
                    }
                }
            }

            if (!innFieldVisible) {
                throw new Error('Поле #BlackINN_INN не появилось после 3 попыток');
            }

            await page.locator('#BlackINN_INN').fill(inn);

            await page.locator('#BlackINN_AuthorType').selectOption('Other');

            await page.evaluate(() => window.scrollBy(0, 400));

            // === ЭТАП 5: ОБРАБОТКА КАПЧИ ===
            // Работаем с капчей
            await page.waitForSelector('[data-testid="checkbox-iframe"]', { timeout: 6000, state: 'visible' });
            const checkboxIframe = page.locator('[data-testid="checkbox-iframe"]').contentFrame();
            if (checkboxIframe) {
                await checkboxIframe.getByRole('checkbox', { name: 'Я не робот' }).click();
                await page.waitForTimeout(1000);
                try {
                    const ariaChecked = await checkboxIframe.getByRole('checkbox', { name: 'Я не робот' }).getAttribute('aria-checked');
                    if (ariaChecked === 'true') {
                        // Капча уже отмечена — пробуем сразу получить результат
                        await page.locator('#BlackINN_searchbtn').click();
                        await page.waitForTimeout(3000);
                        const resultBlock = page.locator('.block-part');
                        await resultBlock.waitFor({ timeout: 10000 });
                        const resultText = await resultBlock.textContent();
                        return {
                            success: true,
                            result: resultText?.trim() || 'Результат не найден'
                        };
                    }
                } catch {}
            } else {
                throw new Error('Капча не найдена');
            }

            // Работаем с advanced капчей
            try {
                await page.waitForSelector('[data-testid="advanced-iframe"]', { timeout: 6000, state: 'visible' });
            } catch {
                // Advanced окно не появилось — пробуем сразу поиск
                await page.locator('#BlackINN_searchbtn').click();
                //делаем скриншот
                const screenshot = await page.screenshot();
                const screenshotPath = path.join(process.cwd(), 'advanced_captcha_screenshot_no_visible.png');
                fs.writeFileSync(screenshotPath, screenshot);
                logger.info(`Screenshot saved to: ${screenshotPath}`);
                await page.waitForTimeout(3000);
                try {   
                    const resultBlock = page.locator('.block-part');
                    await resultBlock.waitFor({ timeout: 10000 });
                    const resultText = await resultBlock.textContent();
                    return {
                        success: true,
                        result: resultText?.trim() || 'Результат не найден'
                    };
                } catch {
                    throw new Error('Advanced капча не появилась и результат без неё не получен');
                }
            }
            const advancedIframe = page.locator('[data-testid="advanced-iframe"]').contentFrame();
            if (!advancedIframe) {
                // Нет доступа к фрейму — последний шанс без капчи
                await page.locator('#BlackINN_searchbtn').click();
                await page.waitForTimeout(3000);
                const resultBlock = page.locator('.block-part');
                await resultBlock.waitFor({ timeout: 10000 });
                const resultText = await resultBlock.textContent();
                return {
                    success: true,
                    result: resultText?.trim() || 'Результат не найден'
                };
            }

            const captchaView = advancedIframe.locator('.AdvancedCaptcha-View');
            await captchaView.waitFor({ timeout: 30000 });

            const screenshot = await captchaView.screenshot();
            const screenshotPath = path.join(process.cwd(), 'captcha_screenshot.png');
            fs.writeFileSync(screenshotPath, screenshot);

            // Решаем капчу
            let attempts = 0;
            const maxAttempts = 10;
            let success = false;

            while (attempts < maxAttempts && !success) {
                attempts++;

                const analysis = await this.analyzeCaptchaScreenshot(screenshotPath);
                if (analysis.success && analysis.text) {
                    await advancedIframe.getByRole('textbox', { name: 'Введите текст с картинки' }).fill(analysis.text);
                    await advancedIframe.getByTestId('submit').click();

                    await page.waitForTimeout(3000);

                    const originalCheckbox = page.locator('[data-testid="checkbox-iframe"]').contentFrame()?.getByRole('checkbox', { name: 'Я не робот' });
                    const ariaChecked = await originalCheckbox?.getAttribute('aria-checked');

                    if (ariaChecked === 'true') {
                        success = true;
                        break;
                    } else {
                        await page.waitForTimeout(3000);
                        const newCaptchaView = advancedIframe.locator('.AdvancedCaptcha-View');
                        await newCaptchaView.waitFor({ timeout: 10000 });
                        const newScreenshot = await newCaptchaView.screenshot();
                        fs.writeFileSync(screenshotPath, newScreenshot);
                    }
                } else {
                    await page.waitForTimeout(3000);
                    const newCaptchaView = advancedIframe.locator('.AdvancedCaptcha-View');
                    await newCaptchaView.waitFor({ timeout: 10000 });
                    const newScreenshot = await newCaptchaView.screenshot();
                    fs.writeFileSync(screenshotPath, newScreenshot);
                }
            }

            if (success) {
                // Нажимаем кнопку поиска
                await page.locator('#BlackINN_searchbtn').click();
                await page.waitForTimeout(3000);

                // Извлекаем результат
                const resultBlock = page.locator('.block-part');
                await resultBlock.waitFor({ timeout: 10000 });
                const resultText = await resultBlock.textContent();

                return {
                    success: true,
                    result: resultText?.trim() || 'Результат не найден'
                };
            } else {
                return {
                    success: false,
                    result: 'Не удалось решить капчу'
                };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            logger.error('Error in checkInn:', error);
            return {
                success: false,
                result: `Ошибка: ${errorMessage}`
            };
        } finally {
            // Закрываем контекст и страницу после каждого запроса
            if (page) {
                try {
                    await page.close();
                } catch (error) {
                    logger.error('Error closing page:', error);
                }
            }
            if (context) {
                try {
                    await context.close();
                } catch (error) {
                    logger.error('Error closing context:', error);
                }
            }
        }
    }

    async enhanceImageForOCR(inputPath: string, outputPath: string): Promise<boolean> {
        try {
            const image = await Jimp.read(inputPath);
            
            await image
                .brightness(0.2)        // Увеличиваем яркость (+20%)
                .contrast(0.5)          // Увеличиваем контрастность (+50%)
                .greyscale()            // Делаем черно-белым
                .resize(Jimp.AUTO, 800) // Изменяем размер до высоты 800px
                .writeAsync(outputPath);
                
            return true;
        } catch (error) {
            logger.error('Ошибка обработки изображения:', error);
            return false;
        }
    }

    async analyzeCaptchaScreenshot(screenshotPath: string): Promise<{ success: boolean; text?: string; error?: string }> {
        try {
            if (!this.anthropic) {
                return { success: false, error: 'Claude AI client not initialized' };
            }

            if (!fs.existsSync(screenshotPath)) {
                return { success: false, error: 'Screenshot file not found' };
            }

            const enhancedPath = screenshotPath.replace('.png', '_enhanced.png');
            const enhanced = await this.enhanceImageForOCR(screenshotPath, enhancedPath);
            const imagePath = enhanced ? enhancedPath : screenshotPath;
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');

            const message = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-0',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Это скриншот капчи с сайта ЦБР. На изображении текст только русские буквы, слова не всегда связанные, без символов и цифр. Пожалуйста, проанализируй изображение и ответь на следующие вопросы:

1. Можешь ли ты прочитать текст на этом изображении?
2. Если да, то какой именно текст ты видишь? (только текст который видишь, в кавычках например "кусочка игрушки")

Ответь кратко и по существу. Если текст не читается, так и скажи.`
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ]
            });

            const response = message.content[0];
            if (response && response.type === 'text') {
                const lines = response.text.split('\n');
                const firstLine = lines[0]?.toLowerCase().trim() || '';

                if (firstLine.includes('да')) {
                    const quotedTextMatch = response.text.match(/"([^"]+)"/);
                    if (quotedTextMatch && quotedTextMatch[1]) {
                        return { success: true, text: quotedTextMatch[1] };
                    } else {
                        return { success: false, error: 'No quoted text found in response' };
                    }
                } else {
                    return { success: false, error: 'Text not readable according to Claude AI' };
                }
            } else {
                return { success: false, error: 'Unexpected response format from Claude AI' };
            }

        } catch (error) {
            logger.error('Error analyzing screenshot with Claude AI:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Проверяет работоспособность прокси
     */
    async checkProxyStatus(): Promise<{ success: boolean; message: string; ip?: string; country?: string }> {
        if (!config.proxy.enabled || !(config.proxy.poolIps && config.proxy.poolIps.length > 0)) {
            return {
                success: false,
                message: 'Прокси не настроен или отключен'
            };
        }

        let context: BrowserContext | null = null;
        let page: Page | null = null;

        try {
            // Создаем новый контекст с прокси
            const browserContext = await this.createNewContext();
            context = browserContext.context;
            page = browserContext.page;

            logger.info('Checking proxy status...');

            // Проверяем IP через httpbin.org
            await page.goto('https://httpbin.org/ip', { timeout: 15000 });
            await page.waitForLoadState('networkidle');

            const content = await page.textContent('body');
            if (!content) {
                throw new Error('Не удалось получить ответ от сервиса проверки IP');
            }

            const ipData = JSON.parse(content);
            const currentIp = ipData.origin;

            // Дополнительно проверяем геолокацию
            let country = 'Неизвестно';
            try {
                await page.goto('https://ipapi.co/json/', { timeout: 15000 });
                const ipApiContent = await page.textContent('body');
                if (ipApiContent) {
                    const ipApiData = JSON.parse(ipApiContent);
                    country = ipApiData.country_name || 'Неизвестно';
                }
            } catch (error) {
                logger.warn('Could not get country info:', error);
            }

            return {
                success: true,
                message: `Прокси работает корректно`,
                ip: currentIp,
                country: country
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
            logger.error('Error checking proxy status:', error);
            
            return {
                success: false,
                message: `Ошибка проверки прокси: ${errorMessage}`
            };
        } finally {
            // Закрываем контекст и страницу
            if (page) {
                try {
                    await page.close();
                } catch (error) {
                    logger.error('Error closing page:', error);
                }
            }
            if (context) {
                try {
                    await context.close();
                } catch (error) {
                    logger.error('Error closing context:', error);
                }
            }
        }
    }

    /**
     * Закрытие браузера и освобождение ресурсов
     */
    async close(): Promise<void> {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            logger.info('Platform ZSK service closed');
        } catch (error) {
            logger.error('Error closing Platform ZSK service:', error);
        }
    }
}

export const platformZskService = new PlatformZskService();
