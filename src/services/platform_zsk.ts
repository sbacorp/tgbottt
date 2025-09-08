import { chromium, Browser, Page, BrowserContext } from 'playwright';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import Jimp from 'jimp';
import { config } from '../utils/config';
// Убрана генерация браузера. Фиксированный профиль macOS.

export class PlatformZskService {
    private browser: Browser | null = null;
    private anthropic: Anthropic | null = null;

    constructor() {
        const apiKey = config.CLAUDE_API_KEY
        if (apiKey) {
            this.anthropic = new Anthropic({ apiKey });
        }
    }

    async init(): Promise<void> {
        try {
            const launchOptions: any = {
                headless: true,
                slowMo: 1000,
                args: [
                    '--lang=ru-RU,ru',
                    '--disable-blink-features=AutomationControlled'
                ]
            };

            // Добавляем прокси если он включен
            // Поддерживаются HTTP/HTTPS, SOCKS4/SOCKS5 прокси с аутентификацией
            if (config.proxy.enabled && config.proxy.server) {
                launchOptions.proxy = {
                    server: config.proxy.server
                };
                console.log(config.proxy);
                // Добавляем аутентификацию прокси если указаны учетные данные
                if (config.proxy.username && config.proxy.password) {
                    launchOptions.proxy.username = config.proxy.username;
                    launchOptions.proxy.password = config.proxy.password;
                }
                
                logger.info(`Proxy enabled: ${config.proxy.server}`);
            }

            this.browser = await chromium.launch(launchOptions);
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

        // Фиксированный профиль macOS Chrome
        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
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
                'sec-ch-ua': '"Google Chrome";v="126", "Chromium";v="126", "Not.A/Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
            }
        } as const;

        logger.info(`Creating new browser context with macOS profile: ${userAgent.substring(0, 60)}...`);

        const context = await this.browser.newContext(contextOptions);

        // Убираем глобальный перехват referer: может ломать загрузку статики/CORS

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
                        { brand: 'Chromium', version: '126' },
                        { brand: 'Google Chrome', version: '126' },
                        { brand: 'Not.A/Brand', version: '24' },
                    ],
                    fullVersionList: [
                        { brand: 'Chromium', version: '126.0.0.0' },
                        { brand: 'Google Chrome', version: '126.0.0.0' },
                        { brand: 'Not.A/Brand', version: '24.0.0.0' },
                    ],
                    platform: 'macOS',
                    platformVersion: '14.5.0',
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

    async checkInn(inn: string): Promise<{ success: boolean; result: string }> {
        let context: BrowserContext | null = null;
        let page: Page | null = null;

        try {
            // Создаем новый контекст с рандомными данными для каждого запроса
            const browserContext = await this.createNewContext();
            context = browserContext.context;
            page = browserContext.page;

            logger.info(`Starting INN check for: ${inn} with new browser context`);

            // Переходим на страницу (точечно передаем referer)
            await page.goto('https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/', {
                referer: 'https://cbr.ru/'
            });
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);

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
            try {
                await page.waitForSelector('#BlackINN_INN', { state: 'visible', timeout: 30000 });
            } catch (e) {
                try {
                    const timeoutShotPath = path.join(process.cwd(), 'screenshot_wait_inn.png');
                    await page.screenshot({ path: timeoutShotPath, fullPage: true });
                    logger.error(`Timeout while waiting for #BlackINN_INN. Screenshot saved: ${timeoutShotPath}`);
                } catch (scrErr) {
                    logger.error('Failed to capture timeout screenshot:', scrErr);
                }
            }
            await page.locator('#BlackINN_INN').fill(inn);

            await page.locator('#BlackINN_AuthorType').selectOption('Other');

            await page.evaluate(() => window.scrollBy(0, 400));

            // Работаем с капчей
            const checkboxIframe = page.locator('[data-testid="checkbox-iframe"]').contentFrame();
            if (checkboxIframe) {
                await checkboxIframe.getByRole('checkbox', { name: 'Я не робот' }).click();
            } else {
                throw new Error('Капча не найдена');
            }

            // Работаем с advanced капчей
            await page.waitForSelector('[data-testid="advanced-iframe"]', {timeout: 5000, state: 'visible' });
            const advancedIframe = page.locator('[data-testid="advanced-iframe"]').contentFrame();
            if (!advancedIframe) {
                throw new Error('Advanced капча не найдена');
            }

            const captchaView = advancedIframe.locator('.AdvancedCaptcha-View');
            await captchaView.waitFor({ timeout: 10000 });

            const screenshot = await captchaView.screenshot();
            const screenshotPath = path.join(process.cwd(), 'captcha_screenshot.png');
            fs.writeFileSync(screenshotPath, screenshot);

            // Решаем капчу
            let attempts = 0;
            const maxAttempts = 5;
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
        if (!config.proxy.enabled || !config.proxy.server) {
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
