# Миграция на Supabase

Этот документ содержит пошаговое руководство по переходу с PostgreSQL на Supabase для CBR Monitoring Bot.

## Преимущества Supabase

- ✅ **Управляемая база данных** - никаких настроек сервера
- ✅ **Автоматические резервные копии** - ваши данные в безопасности  
- ✅ **Масштабируемость** - автоматическое масштабирование нагрузки
- ✅ **Веб-интерфейс** - удобное управление данными через Dashboard
- ✅ **Real-time подписки** - возможность получать обновления в реальном времени
- ✅ **Встроенная авторизация** - готовые механизмы аутентификации
- ✅ **Row Level Security** - гранулярное управление доступом
- ✅ **Бесплатный тариф** - до 500 МБ БД и 2 ГБ трафика

## Шаг 1: Создание проекта в Supabase

1. Перейдите на [supabase.com](https://supabase.com) и создайте аккаунт
2. Нажмите "New project"
3. Выберите организацию и введите:
   - **Name**: cbr-monitoring-bot
   - **Database Password**: создайте надежный пароль
   - **Region**: выберите ближайший регион
4. Нажмите "Create new project" и дождитесь завершения установки

## Шаг 2: Получение параметров подключения

1. В Dashboard проекта перейдите в `Settings` → `API`
2. Скопируйте:
   - **Project URL** (например: https://abc123.supabase.co)
   - **Project API keys** → **anon public** (публичный ключ)
   - При необходимости: **service_role** (приватный ключ для административных операций)

## Шаг 3: Инициализация базы данных

1. В Dashboard проекта перейдите в `SQL Editor`
2. Создайте новый запрос
3. Скопируйте и выполните содержимое файла `init-supabase.sql`
4. Дождитесь успешного выполнения скрипта

Скрипт создаст:
- Все необходимые таблицы
- Индексы для оптимизации производительности  
- Политики Row Level Security
- Вспомогательные функции и представления
- Триггеры для автоматического обновления временных меток

## Шаг 4: Настройка переменных окружения

Обновите ваш `.env` файл:

```env
# Основные настройки
BOT_TOKEN=ваш_telegram_bot_token
NODE_ENV=production

# Supabase конфигурация
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Закомментируйте или удалите PostgreSQL URL
# DATABASE_URL=postgresql://...

# Остальные настройки остаются без изменений
FIRECRAWL_API_KEY=your_firecrawl_api_key
CLAUDE_API_KEY=your_claude_api_key
MONITORING_INTERVAL=2700000
ADMIN_USER_IDS=123456789,987654321
```

## Шаг 5: Миграция данных (опционально)

Если у вас уже есть данные в PostgreSQL, выполните миграцию:

### Экспорт данных из PostgreSQL

```bash
# Экспорт только данных (без схемы)
pg_dump --data-only --inserts --no-owner --no-privileges \
  postgresql://user:password@host:port/database > data_export.sql

# Или экспорт конкретных таблиц
pg_dump --data-only --inserts --table=users \
  --table=tracked_organizations \
  --table=organization_checks \
  postgresql://user:password@host:port/database > data_export.sql
```

### Импорт в Supabase

1. Отредактируйте `data_export.sql` и удалите команды для таблиц, которых нет в Supabase
2. В Supabase Dashboard перейдите в `SQL Editor`
3. Выполните отредактированный SQL-скрипт

## Шаг 6: Обновление зависимостей

Убедитесь, что у вас установлены необходимые пакеты:

```bash
npm install @supabase/supabase-js@^2.46.1 zod@^3.22.4
```

## Шаг 7: Запуск и тестирование

1. Запустите бот:
```bash
npm run build
npm start
```

2. Проверьте логи - должно появиться сообщение:
```
Database connected successfully (supabase)
```

3. Протестируйте основные функции:
   - Регистрация пользователя (`/start`)
   - Добавление организации (`/add_inn`)
   - Проверка организации (`/check`)
   - Просмотр списка (`/organizations`)

## Мониторинг и управление

### Supabase Dashboard

В Dashboard вы можете:
- Просматривать и редактировать данные в `Table Editor`
- Мониторить производительность в `Reports`
- Просматривать логи в `Logs`
- Управлять API ключами в `Settings` → `API`

### Встроенные функции очистки

Выполняйте периодически для оптимизации:

```sql
-- Очистка старых сессий (старше 30 дней)
SELECT cleanup_old_sessions();

-- Очистка старых проверок (старше 90 дней)  
SELECT cleanup_old_checks();
```

### Полезные представления

```sql
-- Статистика по статусам организаций
SELECT * FROM organization_stats;

-- Активность пользователей
SELECT * FROM user_activity;
```

## Откат к PostgreSQL

Если потребуется вернуться к PostgreSQL:

1. Закомментируйте Supabase переменные в `.env`
2. Раскомментируйте `DATABASE_URL`
3. Перезапустите бот

Бот автоматически определит доступную базу данных и переключится.

## Troubleshooting

### Ошибка подключения
- Проверьте правильность `SUPABASE_URL` и `SUPABASE_ANON_KEY`
- Убедитесь, что проект Supabase активен

### Ошибки доступа
- Проверьте настройки Row Level Security
- Убедитесь, что используете правильный API ключ

### Медленные запросы
- Проверьте наличие индексов в `Table Editor`
- Оптимизируйте запросы в `SQL Editor`

### Превышение лимитов
- Мониторьте использование в `Settings` → `Usage`
- При необходимости обновите план

## Дополнительные возможности

### Real-time подписки
Supabase поддерживает real-time подписки на изменения данных:

```typescript
// Пример подписки на изменения организаций
supabaseService.client
  .channel('organization-changes')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'tracked_organizations' }, 
    (payload) => {
      console.log('Organization updated:', payload);
      // Отправить уведомление пользователям
    }
  )
  .subscribe();
```

### Хранение файлов
Для хранения изображений и документов используйте Supabase Storage:

```typescript
const { data, error } = await supabaseService.client.storage
  .from('screenshots')
  .upload('organization-check.png', file);
```

### Аналитика
Создавайте дашборды и отчеты прямо в Supabase Dashboard или интегрируйтесь с внешними инструментами аналитики.

---

Поздравляем! Ваш CBR Monitoring Bot теперь работает на современной облачной инфраструктуре Supabase. 🎉
