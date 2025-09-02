# CBR Monitoring Bot

Telegram бот для мониторинга организаций через API ЦБ РФ с автоматическими проверками каждые 4 часа.

## 🚀 Быстрый запуск с Docker

### 1. Клонирование и настройка
```bash
git clone <repository-url>
cd tgbot
cp env.example .env
```

### 2. Настройка переменных окружения
Отредактируйте файл `.env`:
```env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_USER_IDS=123456789,987654321
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### 3. Запуск в production
```bash
# Запуск всех сервисов (бот + PostgreSQL + pgAdmin)
npm run docker:run

# Просмотр логов
npm run docker:logs

# Остановка
npm run docker:stop
```

## 🌐 Доступ к сервисам

После запуска будут доступны:

- **pgAdmin (Web UI для PostgreSQL)**: http://localhost:5050
  - Email: `admin@cbrbot.com`
  - Password: `admin123`

- **PostgreSQL**: `localhost:5432`
  - Database: `cbr_bot`
  - User: `cbr_user`
  - Password: `cbr_password`

## 📊 Подключение к базе данных через pgAdmin

1. Откройте http://localhost:5050
2. Войдите с учетными данными выше
3. Добавьте новый сервер:
   - **Name**: CBR Bot DB
   - **Host**: `postgres` (для Docker)
   - **Port**: `5432`
   - **Database**: `cbr_bot`
   - **Username**: `cbr_user`
   - **Password**: `cbr_password`

## 🛠 Команды

```bash
# Сборка проекта
npm run build

# Запуск
npm start

# Инициализация администраторов
npm run init-admin

# Инициализация базы данных
npm run init-db
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
- `/menu` - Главное меню
- `/organizations` - Список организаций
- `/add_inn ИНН1 ИНН2` - Добавить ИНН для отслеживания
- `/check ИНН` - Проверить конкретную организацию
- `/status` - Статус системы

### Для администраторов:
- `/users` - Список получателей
- `/add_users 123456789 987654321` - Добавить пользователей по telegram_id
- `/remove_users 123456789 987654321` - Удалить пользователей по telegram_id
- `/add_admins 123456789 987654321` - Добавить администраторов по telegram_id
- `/remove_admins 123456789 987654321` - Удалить администраторов по telegram_id
- `/remove_inn ИНН1 ИНН2` - Удалить ИНН из отслеживания

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
PROXY_SERVER=http://your-proxy.com:8080

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
PROXY_SERVER=http://proxy.example.com:8080

# SOCKS5 прокси с аутентификацией
PROXY_ENABLED=true
PROXY_SERVER=socks5://proxy.example.com:1080
PROXY_USERNAME=user123
PROXY_PASSWORD=pass123

# Прокси с исключениями
PROXY_ENABLED=true
PROXY_SERVER=http://proxy.example.com:8080
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
