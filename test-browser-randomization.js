const { BrowserRandomizer } = require('./dist/helpers/browserRandomizer');

console.log('🧪 Тестирование рандомизации браузера для обхода DDoS Guard\n');

// Генерируем несколько случайных профилей браузера
for (let i = 1; i <= 5; i++) {
    console.log(`\n📱 Профиль браузера #${i}:`);
    
    const randomData = BrowserRandomizer.generateRandomBrowserData();
    
    console.log(`   User-Agent: ${randomData.userAgent.substring(0, 80)}...`);
    console.log(`   Разрешение: ${randomData.viewport.width}x${randomData.viewport.height}`);
    console.log(`   Локаль: ${randomData.locale}`);
    console.log(`   Часовой пояс: ${randomData.timezoneId}`);
    console.log(`   Геолокация: ${randomData.geolocation.latitude}, ${randomData.geolocation.longitude}`);
    console.log(`   Цветовая схема: ${randomData.colorScheme}`);
    console.log(`   DNT: ${randomData.extraHeaders.DNT}`);
    console.log(`   Accept-Language: ${randomData.extraHeaders['Accept-Language']}`);
}

console.log('\n🔧 Случайные аргументы запуска браузера:');
const randomArgs = BrowserRandomizer.getRandomLaunchArgs();
console.log(randomArgs.join('\n   '));

console.log('\n📊 Случайное разрешение экрана:');
const screenRes = BrowserRandomizer.getRandomScreenResolution();
console.log(`   ${screenRes.width}x${screenRes.height} (${screenRes.depth} бит)`);

console.log('\n💻 Случайная платформа:');
console.log(`   ${BrowserRandomizer.getRandomPlatform()}`);

console.log('\n🏢 Случайный вендор:');
console.log(`   ${BrowserRandomizer.getRandomVendor()}`);

console.log('\n✅ Рандомизация готова к использованию!');
console.log('   Каждый запрос будет использовать уникальный профиль браузера.');
