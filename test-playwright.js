#!/usr/bin/env node

const { chromium } = require('playwright');

async function testPlaywright() {
  console.log('🧪 Тестирование Playwright...');
  
  let browser;
  try {
    console.log('🚀 Запуск браузера...');
    
    // Запуск браузера в headless режиме
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ Браузер успешно запущен');
    
    // Создание новой страницы
    const page = await browser.newPage();
    console.log('📄 Новая страница создана');
    
    // Переход на простую страницу для теста
    await page.goto('https://example.com');
    console.log('🌐 Переход на example.com выполнен');
    
    // Получение заголовка страницы
    const title = await page.title();
    console.log(`📋 Заголовок страницы: ${title}`);
    
    console.log('✅ Все тесты Playwright прошли успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании Playwright:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Браузер закрыт');
    }
  }
}

// Проверка переменных окружения
console.log('🔍 Проверка переменных окружения:');
console.log('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:', process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD);
console.log('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:', process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);

// Запуск теста
testPlaywright().catch(console.error);
