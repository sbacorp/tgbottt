const { platformZskService } = require('./dist/services/platform_zsk');

async function testPlatformZsk() {
  try {
    console.log('🚀 Запуск тестирования Platform ZSK сервиса...');
    
    // Инициализируем сервис
    await platformZskService.init();
    console.log('✅ Сервис инициализирован');
    
    // Тестовый ИНН (можно заменить на реальный)
    const testInn = '1234567890';
    console.log(`🔍 Проверяем ИНН: ${testInn}`);
    
    // Выполняем проверку
    const result = await platformZskService.checkInn(testInn);
    
    console.log('✅ Проверка выполнена');
    console.log('📋 Результат:', result);
    
    // Закрываем сервис
    await platformZskService.close();
    console.log('✅ Сервис закрыт');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testPlatformZsk();