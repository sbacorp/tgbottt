import { chromium, Browser, Page } from 'playwright';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import Jimp from 'jimp';
import { config } from '../utils/config';

export class PlatformZskService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private anthropic: Anthropic | null = null;

    constructor() {
        const apiKey = config.ANTHROPIC_API_KEY
        if (apiKey) {
            this.anthropic = new Anthropic({ apiKey });
        }
    }

    async init(): Promise<void> {
        try {
            this.browser = await chromium.launch({
                headless: true,
                slowMo: 1000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            this.page = await this.browser.newPage({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            await this.page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            });

            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

            logger.info('Platform ZSK service initialized');
        } catch (error) {
            logger.error('Error initializing Platform ZSK service:', error);
            throw error;
        }
    }

    async checkInn(inn: string): Promise<{ success: boolean; result: string }> {
        try {
            if (!this.page) {
                throw new Error('Browser not initialized');
            }

            logger.info(`Starting INN check for: ${inn}`);

            // Переходим на страницу
            await this.page.goto('https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/');
            await this.page.waitForLoadState('networkidle');
            await this.page.waitForTimeout(3000);

            // Улучшенная проверка и обход Cloudflare/DDoS-GUARD
            await this.handleCloudflareProtection();
            //тут добавить скриншот страницы
            const screenshot1 = await this.page.screenshot();
            const screenshotPath1 = path.join(process.cwd(), 'screenshot.png');
            fs.writeFileSync(screenshotPath1, screenshot1);
            logger.info(`Screenshot saved to: ${screenshotPath1}`);

            // Заполняем форму
            await this.page.waitForSelector('#BlackINN_INN', { state: 'visible' });
            await this.page.locator('#BlackINN_INN').fill(inn);

            await this.page.locator('#BlackINN_AuthorType').selectOption('Other');

            await this.page.evaluate(() => window.scrollBy(0, 400));

            // Работаем с капчей
            const checkboxIframe = this.page.locator('[data-testid="checkbox-iframe"]').contentFrame();
            if (checkboxIframe) {
                await checkboxIframe.getByRole('checkbox', { name: 'Я не робот' }).click();
            } else {
                throw new Error('Капча не найдена');
            }

            // Работаем с advanced капчей
            await this.page.waitForSelector('[data-testid="advanced-iframe"]', {timeout: 5000, state: 'visible' });
            const advancedIframe = this.page.locator('[data-testid="advanced-iframe"]').contentFrame();
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

                    await this.page.waitForTimeout(3000);

                    const originalCheckbox = this.page.locator('[data-testid="checkbox-iframe"]').contentFrame()?.getByRole('checkbox', { name: 'Я не робот' });
                    const ariaChecked = await originalCheckbox?.getAttribute('aria-checked');

                    if (ariaChecked === 'true') {
                        success = true;
                        break;
                    } else {
                        await this.page.waitForTimeout(3000);
                        const newCaptchaView = advancedIframe.locator('.AdvancedCaptcha-View');
                        await newCaptchaView.waitFor({ timeout: 10000 });
                        const newScreenshot = await newCaptchaView.screenshot();
                        fs.writeFileSync(screenshotPath, newScreenshot);
                    }
                } else {
                    await this.page.waitForTimeout(3000);
                    const newCaptchaView = advancedIframe.locator('.AdvancedCaptcha-View');
                    await newCaptchaView.waitFor({ timeout: 10000 });
                    const newScreenshot = await newCaptchaView.screenshot();
                    fs.writeFileSync(screenshotPath, newScreenshot);
                }
            }

            if (success) {
                // Нажимаем кнопку поиска
                await this.page.locator('#BlackINN_searchbtn').click();
                await this.page.waitForTimeout(3000);

                // Извлекаем результат
                const resultBlock = this.page.locator('.block-part');
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
     * Обрабатывает Cloudflare/DDoS-GUARD защиту
     */
    private async handleCloudflareProtection(): Promise<void> {
        try {
            logger.info('Проверяем наличие Cloudflare/DDoS-GUARD защиты...');
            
            // Ждем появления защиты или основного контента
            await this.page?.waitForTimeout(2000);
            
            // Проверяем различные типы защиты
            const protectionSelectors = [
                'text="Проверка браузера"',
                'text="Checking your browser"',
                'text="DDOS-GUARD"',
                'text="I\'m not a robot"',
                '[data-testid="checkbox-iframe"]',
                '.cf-browser-verification',
                '#cf-please-wait'
            ];
            
            let hasProtection = false;
            for (const selector of protectionSelectors) {
                try {
                    const count = await this.page?.locator(selector).count() || 0;
                    if (count > 0) {
                        hasProtection = true;
                        logger.info(`Обнаружена защита: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Игнорируем ошибки для несуществующих селекторов
                }
            }
            
            if (hasProtection) {
                logger.info('Ожидаем прохождения проверки защиты...');
                
                // Ждем исчезновения защиты или появления основного контента
                await this.page?.waitForFunction(() => {
                    const bodyText = document.body.textContent || '';
                    const hasProtection = bodyText.includes('Проверка браузера') || 
                                        bodyText.includes('Checking your browser') ||
                                        bodyText.includes('DDOS-GUARD') ||
                                        bodyText.includes('not a robot');
                    
                    const hasMainContent = document.querySelector('#BlackINN_INN') !== null;
                    
                    return !hasProtection || hasMainContent;
                }, { timeout: 30000 });
                
                // Дополнительная пауза после прохождения защиты
                await this.page?.waitForTimeout(5000);
                
                logger.info('Защита пройдена успешно');
            } else {
                logger.info('Защита не обнаружена, продолжаем...');
            }
            
            // Проверяем, что основная форма загрузилась
            await this.page?.waitForSelector('#BlackINN_INN', { 
                state: 'visible', 
                timeout: 15000 
            });
            
        } catch (error) {
            logger.error('Ошибка при обработке Cloudflare защиты:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Не удалось пройти Cloudflare защиту: ${errorMessage}`);
        }
    }

    async close(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
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
