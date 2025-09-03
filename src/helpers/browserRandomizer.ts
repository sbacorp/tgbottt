import { BrowserContextOptions } from 'playwright';

export interface RandomBrowserData {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
    timezoneId: string;
    extraHeaders: Record<string, string>;
    geolocation: { latitude: number; longitude: number };
    permissions: string[];
    colorScheme: 'light' | 'dark';
    reducedMotion: 'reduce' | 'no-preference';
    forcedColors: 'none' | 'active';
}

export class BrowserRandomizer {
    private static readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0'
    ];

    private static readonly viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 1600, height: 900 },
        { width: 1024, height: 768 },
        { width: 1680, height: 1050 }
    ];

    private static readonly locales = [
        'ru-RU',
        'ru',
        'en-US',
        'en-GB',
        'en',
        'de-DE',
        'de',
        'fr-FR',
        'fr',
        'es-ES',
        'es'
    ];

    private static readonly timezones = [
        'Europe/Moscow',
        'Europe/London',
        'Europe/Berlin',
        'Europe/Paris',
        'America/New_York',
        'America/Los_Angeles',
        'Asia/Tokyo',
        'Asia/Shanghai'
    ];

    private static readonly geolocations = [
        { latitude: 55.7558, longitude: 37.6176 }, // Москва
        { latitude: 59.9311, longitude: 30.3609 }, // Санкт-Петербург
        { latitude: 51.5074, longitude: -0.1278 }, // Лондон
        { latitude: 52.5200, longitude: 13.4050 }, // Берлин
        { latitude: 48.8566, longitude: 2.3522 }, // Париж
        { latitude: 40.7128, longitude: -74.0060 }, // Нью-Йорк
        { latitude: 34.0522, longitude: -118.2437 }, // Лос-Анджелес
        { latitude: 35.6762, longitude: 139.6503 }, // Токио
        { latitude: 31.2304, longitude: 121.4737 } // Шанхай
    ];

    private static readonly acceptLanguages = [
        'ru-RU,ru;q=0.9,en;q=0.8',
        'ru,en-US;q=0.9,en;q=0.8',
        'en-US,en;q=0.9,ru;q=0.8',
        'en-GB,en;q=0.9,ru;q=0.8',
        'de-DE,de;q=0.9,en;q=0.8,ru;q=0.7',
        'fr-FR,fr;q=0.9,en;q=0.8,ru;q=0.7',
        'es-ES,es;q=0.9,en;q=0.8,ru;q=0.7'
    ];

    private static readonly acceptEncodings = [
        'gzip, deflate, br',
        'gzip, deflate',
        'br, gzip, deflate',
        'deflate, gzip, br'
    ];

    private static readonly dntValues = ['1', '0'];

    private static readonly colorSchemes: ('light' | 'dark')[] = ['light', 'dark'];
    private static readonly reducedMotions: ('reduce' | 'no-preference')[] = ['reduce', 'no-preference'];
    private static readonly forcedColors: ('none' | 'active')[] = ['none', 'active'];

    static generateRandomBrowserData(): RandomBrowserData {
        const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)]!;
        const randomViewport = this.viewports[Math.floor(Math.random() * this.viewports.length)]!;
        const randomLocale = this.locales[Math.floor(Math.random() * this.locales.length)]!;
        const randomTimezone = this.timezones[Math.floor(Math.random() * this.timezones.length)]!;
        const randomGeolocation = this.geolocations[Math.floor(Math.random() * this.geolocations.length)]!;
        const randomAcceptLanguage = this.acceptLanguages[Math.floor(Math.random() * this.acceptLanguages.length)]!;
        const randomAcceptEncoding = this.acceptEncodings[Math.floor(Math.random() * this.acceptEncodings.length)]!;
        const randomDNT = this.dntValues[Math.floor(Math.random() * this.dntValues.length)]!;
        const randomColorScheme = this.colorSchemes[Math.floor(Math.random() * this.colorSchemes.length)]!;
        const randomReducedMotion = this.reducedMotions[Math.floor(Math.random() * this.reducedMotions.length)]!;
        const randomForcedColors = this.forcedColors[Math.floor(Math.random() * this.forcedColors.length)]!;

        return {
            userAgent: randomUserAgent,
            viewport: randomViewport,
            locale: randomLocale,
            timezoneId: randomTimezone,
            extraHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': randomAcceptLanguage,
                'Accept-Encoding': randomAcceptEncoding,
                'DNT': randomDNT,
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            geolocation: randomGeolocation,
            permissions: ['geolocation', 'notifications', 'microphone', 'camera'],
            colorScheme: randomColorScheme,
            reducedMotion: randomReducedMotion,
            forcedColors: randomForcedColors
        };
    }

    static getRandomLaunchArgs(): string[] {
        const baseArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection'
        ];

        const randomArgs = [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ignore-certificate-errors',
            '--disable-extensions',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-zygote',
            '--disable-logging',
            '--disable-in-process-stack-traces',
            '--disable-histogram-customizer',
            '--disable-gl-extensions',
            '--disable-composited-antialiasing',
            '--disable-canvas-aa',
            '--disable-3d-apis',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-jpeg-decoding',
            '--disable-accelerated-mjpeg-decode',
            '--disable-accelerated-video-decode',
            '--disable-gpu-sandbox',
            '--disable-software-rasterizer'
        ];

        // Выбираем случайные аргументы
        const selectedRandomArgs: string[] = [];
        for (let i = 0; i < 5; i++) {
            const randomIndex = Math.floor(Math.random() * randomArgs.length);
            const randomArg = randomArgs[randomIndex];
            if (randomArg && !selectedRandomArgs.includes(randomArg)) {
                selectedRandomArgs.push(randomArg);
            }
        }

        return [...baseArgs, ...selectedRandomArgs];
    }

    static getRandomContextOptions(browserData: RandomBrowserData): BrowserContextOptions {
        return {
            userAgent: browserData.userAgent,
            viewport: browserData.viewport,
            locale: browserData.locale,
            timezoneId: browserData.timezoneId,
            geolocation: browserData.geolocation,
            permissions: browserData.permissions,
            colorScheme: browserData.colorScheme,
            reducedMotion: browserData.reducedMotion,
            forcedColors: browserData.forcedColors,
            extraHTTPHeaders: browserData.extraHeaders
        };
    }

    static getRandomScreenResolution(): { width: number; height: number; depth: number } {
        const resolutions = [
            { width: 1920, height: 1080, depth: 24 },
            { width: 1366, height: 768, depth: 24 },
            { width: 1536, height: 864, depth: 24 },
            { width: 1440, height: 900, depth: 24 },
            { width: 1280, height: 720, depth: 24 },
            { width: 1600, height: 900, depth: 24 },
            { width: 1024, height: 768, depth: 24 },
            { width: 1680, height: 1050, depth: 24 }
        ];

        return resolutions[Math.floor(Math.random() * resolutions.length)]!;
    }

    static getRandomPlatform(): string {
        const platforms = [
            'Win32',
            'MacIntel',
            'Linux x86_64',
            'Linux armv8l',
            'Win64',
            'MacIntel'
        ];

        return platforms[Math.floor(Math.random() * platforms.length)]!;
    }

    static getRandomVendor(): string {
        const vendors = [
            'Google Inc.',
            'Apple Computer, Inc.',
            'Intel Inc.',
            'Microsoft Corporation'
        ];

        return vendors[Math.floor(Math.random() * vendors.length)]!;
    }
}
