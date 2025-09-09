const { chromium } = require('playwright');
require('dotenv').config();

async function testProxy() {
    console.log('🔍 Тестирование прокси для Playwright...\n');
    
    // Проверяем настройки прокси
    const proxyConfig = {
        enabled: process.env.PROXY_ENABLED === 'true',
        server: '',
        username: process.env.PROXY_USERNAME || '',
        password: process.env.PROXY_PASSWORD || '',
        bypass: process.env.PROXY_BYPASS || ''
    };
    
    console.log('📋 Настройки прокси:');
    console.log(`   Включен: ${proxyConfig.enabled ? '✅ Да' : '❌ Нет'}`);
    console.log(`   Сервер: ${proxyConfig.server || 'Не указан'}`);
    console.log(`   Пользователь: ${proxyConfig.username || 'Не указан'}`);
    console.log(`   Пароль: ${proxyConfig.password ? '***' : 'Не указан'}`);
    console.log(`   Исключения: ${proxyConfig.bypass || 'Не указаны'}\n`);
    
    if (!proxyConfig.enabled || !proxyConfig.server) {
        console.log('❌ Прокси не настроен. Установите PROXY_ENABLED=true и PROXY_POOL_IPS в .env файле');
        return;
    }
    
    let browser;
    try {
        console.log('🚀 Запуск браузера с прокси...');
        
        const launchOptions = {
            headless: false, // Показываем браузер для тестирования
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        };
        
        // Добавляем прокси
        launchOptions.proxy = {
            server: proxyConfig.server
        };
        
        if (proxyConfig.username && proxyConfig.password) {
            launchOptions.proxy.username = proxyConfig.username;
            launchOptions.proxy.password = proxyConfig.password;
        }
        
        if (proxyConfig.bypass) {
            launchOptions.proxy.bypass = proxyConfig.bypass;
        }
        
        browser = await chromium.launch(launchOptions);
        const page = await browser.newPage();
        
        console.log('✅ Браузер запущен с прокси');
        
        // Проверяем IP-адрес
        console.log('🌐 Проверка IP-адреса...');
        await page.goto('https://api.ipify.org?format=json');
        await page.waitForLoadState('networkidle');
        
        const ipText = await page.textContent('body');
        const ipData = JSON.parse(ipText);
        console.log(`   Текущий IP: ${ipData.ip}`);
        
        // Проверяем работу с сайтом ЦБ РФ
        console.log('🏦 Тестирование доступа к сайту ЦБ РФ...');
        await page.goto('https://cbr.ru/');
        await page.waitForLoadState('networkidle');
        
        const title = await page.title();
        console.log(`   Заголовок страницы: ${title}`);
        
        if (title.includes('ЦБ РФ') || title.includes('CBR')) {
            console.log('✅ Доступ к сайту ЦБ РФ успешен');
        } else {
            console.log('⚠️  Доступ к сайту ЦБ РФ может быть ограничен');
        }
        
        // Делаем скриншот
        const screenshot = await page.screenshot();
        require('fs').writeFileSync('proxy-test-screenshot.png', screenshot);
        console.log('📸 Скриншот сохранен в proxy-test-screenshot.png');
        
        console.log('\n✅ Тест прокси завершен успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании прокси:', error.message);
        
        if (error.message.includes('proxy')) {
            console.log('\n💡 Возможные решения:');
            console.log('   - Проверьте правильность адреса прокси-сервера');
            console.log('   - Убедитесь, что прокси-сервер доступен');
            console.log('   - Проверьте учетные данные аутентификации');
            console.log('   - Убедитесь, что прокси поддерживает HTTPS');
        }
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Браузер закрыт');
        }
    }
}

// Запускаем тест
testProxy().catch(console.error);
