# Руководство по миграции базы данных

## Обзор
Данная миграция добавляет новые поля в таблицу `tracked_organizations` для поддержки улучшенного формата данных организаций из PDF экспресс-отчетов Контур.Фокус.

## Добавляемые поля

### Новые столбцы в `tracked_organizations`:
- `organization_status` - Статус организации (active/liquidated/liquidating)
- `has_rejections_by_lists` - Найдена в списках отказов ЦБ РФ 764/639/550
- `unreliable_address` - Недостоверность сведений об адресе
- `unreliable_director` - Недостоверность сведений о директоре  
- `unreliable_founders` - Недостоверность сведений об учредителях
- `unreliable_data_update_date` - Дата обновления недостоверных сведений

## Способы выполнения миграции

### Вариант 1: Автоматический скрипт (Рекомендуется)

```bash
# Убедитесь, что настроены переменные окружения
# SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env файле

# Запуск миграции
node scripts/run-migration.js

# Или указать конкретный файл
node scripts/run-migration.js 001_add_new_organization_fields.sql
```

### Вариант 2: Ручное выполнение через Supabase Dashboard

1. Откройте Supabase Dashboard
2. Перейдите в раздел **SQL Editor**
3. Скопируйте содержимое файла `migrations/001_add_new_organization_fields.sql`
4. Вставьте и выполните SQL код
5. Проверьте, что все команды выполнились успешно

### Вариант 3: Через CLI Supabase

```bash
# Если у вас установлен Supabase CLI
supabase db push

# Или напрямую через psql (если есть доступ)
psql "postgresql://[connection-string]" < migrations/001_add_new_organization_fields.sql
```

## Проверка результатов

После выполнения миграции проверьте:

### 1. Структура таблицы
```sql
-- В SQL Editor выполните:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tracked_organizations'
ORDER BY ordinal_position;
```

### 2. Новые индексы
```sql
-- Проверьте созданные индексы:
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'tracked_organizations'
AND indexname LIKE 'idx_organizations_%';
```

### 3. Представления (Views)
```sql
-- Проверьте обновленное представление статистики:
SELECT * FROM organization_stats LIMIT 5;

-- Проверьте новое представление недостоверных данных:
SELECT * FROM unreliable_data_stats;
```

### 4. Миграция данных
```sql
-- Проверьте, что данные мигрировали корректно:
SELECT 
  organization_status, 
  has_rejections_by_lists,
  COUNT(*) as count
FROM tracked_organizations 
GROUP BY organization_status, has_rejections_by_lists;
```

## Откат миграции

Если потребуется откатить изменения:

```sql
-- В SQL Editor выполните:
SELECT rollback_migration_001();
```

⚠️ **Внимание**: Откат удалит все новые поля и данные в них!

## Обновление кода приложения

После успешной миграции БД код приложения уже обновлен для работы с новыми полями:

### Обновленные файлы:
- `src/types/index.ts` - Добавлены новые поля в интерфейс Organization
- `src/services/supabase-service.ts` - Обновлен маппинг и методы для работы с БД
- `src/services/playwrightScrapeService.ts` - Новый формат данных KonturOrganizationData
- `src/helpers/notificationFormatter.ts` - Обновлено отображение для пользователей
- `src/services/monitoringService.ts` - Логика сохранения новых полей

## Тестирование

После миграции рекомендуется:

1. **Запустить бота в dev режиме:**
   ```bash
   npm run dev
   ```

2. **Протестировать добавление организации:**
   - Добавьте тестовую организацию через команду `/check [ИНН]`
   - Проверьте, что новые поля корректно заполняются

3. **Проверить уведомления:**
   - Убедитесь, что уведомления отображают новую информацию
   - Проверьте форматирование сообщений

4. **Мониторинг:**
   - Запустите цикл мониторинга
   - Проверьте обновление данных в БД

## Troubleshooting

### Ошибка: "relation does not exist"
- Проверьте, что миграция выполнилась полностью
- Убедитесь, что используется правильная схема БД

### Ошибка: "column does not exist" 
- Перезапустите сервис после миграции
- Проверьте, что все SQL команды выполнились

### Ошибка прав доступа
- Убедитесь, что используете SUPABASE_SERVICE_ROLE_KEY, а не ANON_KEY
- Проверьте RLS политики в Supabase Dashboard

### Проблемы с типами TypeScript
- Перезапустите TypeScript сервер в IDE
- Выполните `npm run build` для проверки

## Мониторинг после миграции

Следите за логами бота на предмет:
- Ошибок при сохранении данных
- Корректности парсинга PDF файлов  
- Правильности отображения статусов организаций

При обнаружении проблем проверьте:
1. Логи приложения в `logs/combined.log`
2. Логи ошибок в `logs/error.log`
3. Состояние БД через Supabase Dashboard

---

**Дата создания миграции:** 2025-01-18  
**Версия:** 001  
**Статус:** Готово к применению ✅
