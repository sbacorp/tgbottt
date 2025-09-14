// Простой тест сервиса PlaywrightScrapeService
async function testService() {
  const inn = process.argv[2] || '7707083893';
  console.log(`Тестируем PlaywrightScrapeService для ИНН: ${inn}`);
  
  try {
    // Устанавливаем движок
    process.env.SCRAPER_ENGINE = 'playwright';
    
    // Импортируем сервис
    const { playwrightScrapeService } = require('./dist/services/playwrightScrapeService.js');
    
    console.log('Запускаем getOrganizationData...');
    const result = await playwrightScrapeService.getOrganizationData(inn);
    
    console.log('\n=== РЕЗУЛЬТАТ ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result) {
      console.log('\n=== СВОДКА ===');
      console.log(`Название: ${result.name}`);
      console.log(`Статус: ${result.status}`);
      console.log(`Адрес: ${result.address || 'не найден'}`);
      console.log(`ОГРН: ${result.ogrn || 'не найден'}`);
      console.log(`Ликвидирована: ${result.isLiquidated ? 'да' : 'нет'}`);
      console.log(`Нелегальная деятельность: ${result.hasIllegalActivity ? 'да' : 'нет'}`);
    } else {
      console.log('❌ Данные не получены');
    }
    
    // Закрываем браузер
    await playwrightScrapeService.close();
    console.log('\n✅ Тест завершён');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

testService();