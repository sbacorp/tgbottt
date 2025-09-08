#!/usr/bin/env node

// Простая утилита для одиночного прогона проверки ИНН через dist-сборку
// Использование: node scripts/run-check-inn.js 7704207300

(async () => {
  try {
    const inn = process.argv[2] || '7704207300';
    const { platformZskService } = require('../dist/services/platform_zsk.js');

    console.log(`[run-check-inn] Init browser...`);
    await platformZskService.init();

    console.log(`[run-check-inn] Checking INN: ${inn}`);
    const result = await platformZskService.checkInn(inn);
    console.log(`[run-check-inn] Result:`);
    console.log(JSON.stringify(result, null, 2));

    await platformZskService.close();
    process.exit(0);
  } catch (err) {
    console.error('[run-check-inn] Error:', err);
    try {
      const { platformZskService } = require('../dist/services/platform_zsk.js');
      await platformZskService.close();
    } catch {}
    process.exit(1);
  }
})();


