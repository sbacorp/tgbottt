import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

async function main() {
  const statePath = 'playwright/.auth/kontur.json';
  await mkdir(dirname(statePath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Открыл браузер. Перейду на https://focus.kontur.ru ...');
  await page.goto('https://focus.kontur.ru', { waitUntil: 'domcontentloaded' });
  console.log('Поставил паузу. Выполните вход вручную, закройте баннеры и нажмите Resume в панели Playwright, затем вернитесь в терминал.');
  await page.pause();

  await context.storageState({ path: statePath });
  console.log(`Состояние сохранено в ${statePath}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


