# Руководство разработчика - CBR Monitoring Bot

## 📋 Содержание

- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)
- [Технологии](#технологии)
- [Быстрый старт](#быстрый-старт)
- [Основные компоненты](#основные-компоненты)
- [База данных](#база-данных)
- [Добавление функций](#добавление-функций)
- [Деплой](#деплой)

---

## 🏗️ Архитектура

```
Telegram Bot (Grammy)
    ↓
Commands → Conversations → Handlers
    ↓
Services Layer
    ├── MonitoringService (cron: каждые 2/12 часов)
    ├── PlaywrightScrapeService (web scraping)
    ├── PlatformZskService (ЗСК проверки)
    ├── NotificationService (уведомления)
    └── CbrService (API ЦБ РФ)
    ↓
Database Layer (Supabase PostgreSQL)
```

**Поток данных:**
1. Пользователь → Telegram → Bot Handler → Service → Database
2. Cron → Monitoring → Scraping → Database → Notifications → Users

---

## 📁 Структура проекта

```
src/
├── bot.ts                  # Точка входа, инициализация
├── commands/               # Обработчики команд (/start, /check, etc.)
├── conversations/          # Многошаговые диалоги (Grammy conversations)
├── handlers/               # Обработчики событий (callback, text)
├── guards/                 # Middleware проверки доступа
├── services/               # Бизнес-логика
│   ├── monitoringService.ts       # Автоматический мониторинг
│   ├── playwrightScrapeService.ts # Web scraping
│   ├── platform_zsk.ts            # Проверка ЗСК
│   ├── notificationService.ts     # Уведомления
│   └── supabase-service.ts        # Работа с БД
├── database/               # Запросы к БД
├── helpers/                # Клавиатуры, сообщения, форматирование
├── types/                  # TypeScript типы
└── utils/                  # Config, logger, validation
```

---

## 🛠️ Технологии

- **Node.js 18+** + **TypeScript 5.3+**
- **Grammy 1.21+** - Telegram Bot Framework
- **Supabase** - PostgreSQL в облаке
- **Playwright 1.55+** - Web scraping
- **Anthropic Claude API** - Распознавание captcha
- **node-cron** - Планировщик задач
- **winston** - Логирование
- **zod** - Валидация

---

## ⚙️ Быстрый старт

### 1. Установка

```bash
git clone <repository>
cd tgbot
npm install
```

### 2. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL из `init-supabase.sql` в SQL Editor
3. Скопируйте SUPABASE_URL и SUPABASE_ANON_KEY

### 3. Настройка .env

```env
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
ADMIN_USER_IDS=123456789,987654321
CLAUDE_API_KEY=your_claude_key

# Опционально: прокси
PROXY_ENABLED=false
PROXY_POOL_IPS=ip1,ip2,ip3
PROXY_USERNAME=user
PROXY_PASSWORD=pass
```

### 4. Запуск

```bash
# Разработка
npm run dev:watch

# Production
npm run build
npm start

# Docker
npm run docker:run
npm run docker:logs
```

### 5. Инициализация админа

```bash
npm run init-admin
```

### 6. Сохранение состояния Playwright (для обхода captcha)

```bash
npm run playwright:auth
```

---

## 🔧 Основные компоненты

### Bot.ts

Точка входа приложения:
- Инициализация Grammy бота
- Настройка middleware (сессии, логирование)
- Регистрация команд и conversations
- Запуск monitoring service
- Graceful shutdown

```typescript
const bot = new Bot<MyContext>(config.BOT_TOKEN);
bot.use(session({ storage: createSupabaseStorageAdapter() }));
bot.use(conversations());
await run(bot);
```

### Commands

**Файлы:** `src/commands/*.ts`

Каждая команда - отдельный файл:

```typescript
// commands/check.ts
export async function handleCheck(ctx: MyContext) {
  await ctx.conversation.enter("check");
}
```

**Доступные команды:**
- `/start` - Регистрация
- `/check` - Проверка ИНН
- `/check_cbr` - Проверка через API ЦБР
- `/help` - Справка
- `/status` - Статус системы (админы)
- `/add_admins` - Добавить админов
- `/remove_admins` - Удалить админов
- `/delete_group` - Удалить группу

### Conversations

**Файлы:** `src/conversations/*.ts`

Многошаговые диалоги:

```typescript
export async function checkConversation(
  conversation: MyConversation,
  ctx: MyContext
) {
  await ctx.reply("Введите ИНН:");
  const { message } = await conversation.wait();
  const inn = message?.text;
  
  if (!validateInn(inn)) {
    return ctx.reply("❌ Неверный ИНН");
  }
  
  const data = await monitoringService.checkOrganization(inn);
  await ctx.reply(formatData(data));
}
```

### MonitoringService

**Файл:** `src/services/monitoringService.ts`

Автоматический мониторинг по расписанию:

```typescript
// Каждые 2 часа в 20 минут
cron.schedule('20 */2 * * *', async () => {
  await this.performMonitoring();
});

// Каждые 12 часов в 40 минут (ЗСК)
cron.schedule('40 */12 * * *', async () => {
  await this.performZskMonitoring();
});
```

**Методы:**
- `startMonitoring()` - Запуск cron
- `performMonitoring()` - Проверка всех организаций
- `checkOrganization(inn)` - Ручная проверка
- `stopMonitoring()` - Остановка

### PlaywrightScrapeService

**Файл:** `src/services/playwrightScrapeService.ts`

Web scraping через Playwright:

```typescript
// Получение данных организации
const data = await playwrightScrapeService.getOrganizationData('1234567890');
// data.status: 'red' | 'orange' | 'green' | 'removed'

// Пакетная проверка
const results = await playwrightScrapeService.checkMultipleOrganizations([
  '1234567890',
  '0987654321'
]);
```

**Особенности:**
- Автоматическое решение captcha через Claude API
- Поддержка прокси
- Сохранение состояния браузера (cookies)
- Retry логика

### NotificationService

**Файл:** `src/services/notificationService.ts`

Отправка уведомлений:

```typescript
// Уведомление об организации
await notificationService.sendOrganizationNotification(
  '1234567890',
  '⚠️ Статус изменился'
);

// Уведомление об ошибке
await notificationService.sendErrorNotification(
  'Заголовок',
  { error: 'Детали' }
);
```

### Database Layer

**Файл:** `src/database/index.ts`

Все запросы к Supabase:

```typescript
// Пользователи
await database.createUser(telegramId, username, isAdmin);
const user = await database.getUserByTelegramId(telegramId);

// Организации
await database.addOrganization(inn, name, userId);
const org = await database.getOrganizationByInn(inn);
await database.updateOrganizationData(inn, { status: 'red' });

// Проверки
await database.addOrganizationCheck({ inn, status, details });
const lastCheck = await database.getLastOrganizationCheck(inn);

// Группы
const group = await database.createGroup(name, ownerId);
await database.addUserToGroup(groupId, userId);
await database.addOrganizationToGroup(groupId, inn, addedBy);
```

---

## 🗄️ База данных

### Основные таблицы

```sql
-- Пользователи
users (id, telegram_id, username, is_admin, created_at)

-- Организации
tracked_organizations (
  id, inn, name, status, zsk_status, 
  region, created_at, updated_at
)

-- Проверки
organization_checks (id, inn, check_date, status, details, notified)
zsk_checks (id, inn, check_date, status, result_text, notified)

-- Группы
user_groups (id, name, owner_id, invite_code, created_at)
group_members (group_id, user_id, joined_at)
group_organizations (group_id, inn, added_by, added_at)

-- Grammy сессии
grammy_sessions (key, value, created_at, updated_at)
```

### Статусы

**Организации:**
- `green` - Нет проблем
- `orange` - Предупреждение
- `red` - Критическая проблема
- `removed` - Удалена из реестра

**ЗСК:**
- `green` - Нет незаконной деятельности
- `red` - Обнаружена незаконная деятельность

---

## ➕ Добавление функций

### Новая команда

1. **Создайте файл:**

```typescript
// src/commands/myCommand.ts
import { MyContext } from '../types';

export async function handleMyCommand(ctx: MyContext) {
  await ctx.reply('✅ Команда выполнена');
}
```

2. **Экспортируйте:**

```typescript
// src/commands/index.ts
export { handleMyCommand } from './myCommand';
```

3. **Зарегистрируйте:**

```typescript
// src/bot.ts
import { handleMyCommand } from './commands';
bot.command('mycommand', handleMyCommand);
```

4. **Добавьте в список:**

```typescript
// src/commands/index.ts
function getPrivateChatCommands(): BotCommand[] {
  return [
    { command: "mycommand", description: "Описание" }
  ];
}
```

### Новый conversation

```typescript
// src/conversations/myConversation.ts
export async function myConversation(
  conversation: MyConversation,
  ctx: MyContext
) {
  await ctx.reply('Введите данные:');
  const { message } = await conversation.wait();
  // Обработка
  await ctx.reply('✅ Готово');
}

// Регистрация в bot.ts
bot.use(createConversation(myConversation, "my_conv"));

// Использование
bot.command('mycommand', async (ctx) => {
  await ctx.conversation.enter("my_conv");
});
```

### Новое поле в БД

1. **SQL:**

```sql
ALTER TABLE tracked_organizations 
ADD COLUMN new_field VARCHAR(255);
```

2. **TypeScript тип:**

```typescript
// src/types/index.ts
export interface Organization {
  new_field?: string;
}
```

3. **Database метод:**

```typescript
// src/database/index.ts
async updateNewField(inn: string, value: string) {
  await this.supabase
    .from('tracked_organizations')
    .update({ new_field: value })
    .eq('inn', inn);
}
```

### Новый источник данных для мониторинга

```typescript
// src/services/newCheckService.ts
export class NewCheckService {
  async checkOrganization(inn: string) {
    // Логика проверки
    return { status: 'green', data: {} };
  }
}

// src/services/monitoringService.ts
import { NewCheckService } from './newCheckService';

class MonitoringService {
  private newService = new NewCheckService();
  
  startMonitoring(): void {
    // Добавляем новый cron job
    cron.schedule('0 */6 * * *', async () => {
      const orgs = await database.getAllOrganizations();
      for (const org of orgs) {
        const result = await this.newService.checkOrganization(org.inn);
        // Обработка результата
      }
    });
  }
}
```

---

## 🚀 Деплой

### Docker (рекомендуется)

```bash
# Запуск
npm run docker:run

# Логи
npm run docker:logs

# Остановка
npm run docker:stop

# Пересборка
npm run docker:rebuild
```

### PM2 на сервере

```bash
# Установка
npm install
npm run build

# Запуск
pm2 start dist/bot.js --name cbr-bot

# Автозапуск
pm2 startup
pm2 save

# Обновление
git pull
npm install
npm run build
pm2 restart cbr-bot
```

---

## 🐛 Отладка

### Логи

```bash
# Локально
tail -f logs/combined.log
tail -f logs/error.log

# Docker
npm run docker:logs

# PM2
pm2 logs cbr-bot
```

### Уровни логирования

```typescript
logger.error('Критическая ошибка');
logger.warn('Предупреждение');
logger.info('Информация');
logger.debug('Отладка');
```

### Тестирование

```bash
# Разработка с hot reload
npm run dev:watch

# Тест scraping
npm run test:scrape

# Ручная проверка мониторинга
node -e "require('./dist/services/monitoringService').monitoringService.performMonitoring()"
```

---

## 📚 Полезные ссылки

- **Grammy Docs:** https://grammy.dev/
- **Supabase Docs:** https://supabase.com/docs
- **Playwright Docs:** https://playwright.dev/
- **TypeScript Docs:** https://www.typescriptlang.org/docs/

---

## 🔑 Ключевые концепции

### Grammy Conversations

Позволяют создавать многошаговые диалоги с сохранением состояния:

```typescript
await ctx.conversation.enter("conversation_name");
```

### Supabase Storage Adapter

Сессии Grammy хранятся в Supabase, что позволяет:
- Сохранять состояние при перезапуске
- Масштабировать бот на несколько инстансов
- Просматривать сессии в Supabase Dashboard

### Cron Jobs

Автоматические задачи по расписанию:
- `'20 */2 * * *'` - каждые 2 часа в 20 минут
- `'40 */12 * * *'` - каждые 12 часов в 40 минут
- Timezone: 'Europe/Moscow'

### Playwright State

Сохранение cookies и localStorage для обхода повторных captcha:

```bash
npm run playwright:auth
```

Создает файл `playwright/kontur-state.json`.

---

## ⚠️ Важные замечания

1. **Captcha:** Требуется Claude API key для автоматического решения
2. **Прокси:** Рекомендуется для обхода блокировок
3. **Мониторинг:** Не запускайте слишком часто, чтобы не перегружать источники
4. **Логи:** Регулярно очищайте старые логи
5. **База данных:** Используйте функции `cleanup_old_sessions()` и `cleanup_old_checks()`

---

## 🆘 Частые проблемы

### Бот не отвечает

```bash
# Проверьте логи
npm run docker:logs

# Проверьте статус
pm2 status

# Перезапустите
pm2 restart cbr-bot
```

### Ошибки Playwright

```bash
# Переустановите браузеры
npx playwright install chromium

# Обновите состояние авторизации (локально сам)
npm run playwright:auth
```

### Ошибки Supabase

- Проверьте SUPABASE_URL и SUPABASE_ANON_KEY
- Убедитесь, что выполнен `init-supabase.sql`
- Проверьте RLS политики в Supabase Dashboard

### Captcha не решается

- Проверьте CLAUDE_API_KEY
- Проверьте баланс Claude API
- Попробуйте обновить состояние Playwright

---

**Версия:** 1.0.0  
**Последнее обновление:** Октябрь 2025
