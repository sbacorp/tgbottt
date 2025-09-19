# CBR Monitoring Bot

Telegram бот для мониторинга организаций через API ЦБ РФ с автоматическими проверками каждые 4 часа.

## 🏗️ Архитектура

- **База данных**: Supabase (PostgreSQL в облаке)
- **Сессии**: Сохраняются в Supabase
- **Развертывание**: Docker или локально
- **Мониторинг**: Веб-интерфейс Supabase Dashboard

## 🚀 Быстрый запуск

### 1. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL скрипт из `init-supabase.sql` в SQL Editor
3. Получите SUPABASE_URL и SUPABASE_ANON_KEY из настроек проекта

### 2. Настройка переменных окружения
```bash
cp env.example .env
```

Отредактируйте файл `.env`:
```env
BOT_TOKEN=your_telegram_bot_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
ADMIN_USER_IDS=123456789,987654321
CLAUDE_API_KEY=your_claude_api_key_here
```

### 3. Запуск

#### Docker (рекомендуется)
```bash
# Запуск бота
npm run docker:run

# Просмотр логов
npm run docker:logs

# Остановка
npm run docker:stop
```

#### Локально
```bash
# Установка зависимостей
npm install

# Сборка
npm run build

# Запуск
npm start
```

## 🌐 Управление данными

- **Supabase Dashboard**: Управление данными через веб-интерфейс
- **SQL Editor**: Выполнение произвольных запросов
- **Real-time**: Мониторинг изменений в реальном времени

## 🛠 Команды

```bash
# Сборка проекта
npm run build

# Запуск
npm start
```

## 📁 Структура проекта

```
src/
├── commands/          # Управление командами бота
├── guards/           # Проверки доступа
├── handlers/         # Обработчики команд и callback
├── helpers/          # Вспомогательные функции
├── services/         # Бизнес-логика
├── types/           # TypeScript типы
├── utils/           # Утилиты и конфигурация
└── database/        # Работа с базой данных
```

## 🔧 Основные функции

### Для пользователей:
- `/start` - Запуск бота
- `/check ИНН` - Проверить конкретную организацию
- `/help` - Справка по командам

### Для администраторов:
- `/add_admins 123456789 987654321` - Добавить администраторов по telegram_id
- `/remove_admins 123456789 987654321` - Удалить администраторов по telegram_id
- `/status` - Статус системы
- `/setcommands` - Обновить команды бота

### Групповое управление:
- Создание групп для совместного мониторинга
- Добавление/удаление организаций в группы
- Управление участниками групп
- Централизованные уведомления

## ⚙️ Мониторинг

- **Автоматические проверки**: каждые 4 часа
- **Уведомления**: при изменении статуса организаций
- **Логирование**: подробные логи всех операций

## 🌐 Прокси для Playwright

Бот поддерживает использование прокси-серверов для обхода блокировок и изменения IP-адреса при работе с сайтами ЦБ РФ.

### Настройка прокси

Добавьте в файл `.env`:

```env
# Включить прокси
PROXY_ENABLED=true

# Адрес прокси-сервера
PROXY_POOL_IPS=149.126.216.86,149.126.220.245,149.126.221.17

# Аутентификация (если требуется)
PROXY_USERNAME=username
PROXY_PASSWORD=password

# Исключения
PROXY_BYPASS=localhost,127.0.0.1
```

### Поддерживаемые форматы прокси

- **HTTP/HTTPS**: `http://proxy.com:8080`
- **SOCKS4**: `socks4://proxy.com:1080`
- **SOCKS5**: `socks5://proxy.com:1080`

### Примеры использования

```env
# HTTP прокси без аутентификации
PROXY_ENABLED=true
PROXY_POOL_IPS=1.2.3.4,5.6.7.8

# SOCKS5 прокси с аутентификацией
PROXY_ENABLED=true
PROXY_POOL_IPS=proxy.example.com
PROXY_USERNAME=user123
PROXY_PASSWORD=pass123

# Прокси с исключениями
PROXY_ENABLED=true
PROXY_POOL_IPS=proxy.example.com
PROXY_BYPASS=localhost,127.0.0.1,*.internal.com
```

## 📋 Требования

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Telegram Bot Token
- FireCrawl API Key

## 📄 Лицензия

MIT License
