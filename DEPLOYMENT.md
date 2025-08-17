# 🚀 Инструкции по развертыванию

Подробное руководство по развертыванию Telegram бота для мониторинга нелегальных организаций ЦБ РФ.

## 📋 Предварительные требования

### Системные требования
- **ОС**: Linux (Ubuntu 20.04+), macOS, Windows 10+
- **RAM**: минимум 2GB, рекомендуется 4GB+
- **CPU**: 2 ядра, рекомендуется 4+
- **Диск**: минимум 10GB свободного места
- **Сеть**: стабильное интернет-соединение

### Программное обеспечение
- **Node.js**: версия 18.0.0 или выше
- **Docker**: версия 20.10.0 или выше
- **Docker Compose**: версия 2.0.0 или выше
- **PostgreSQL**: версия 15.0 или выше (если не используете Docker)

## 🔧 Подготовка к развертыванию

### 1. Получение Telegram Bot Token

1. Откройте Telegram и найдите [@BotFather](https://t.me/botfather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Введите имя бота (например: "CBR Monitoring Bot")
   - Введите username бота (например: "cbr_monitoring_bot")
4. Сохраните полученный токен

### 2. Настройка переменных окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Отредактируйте `.env` файл:

```env
# Telegram Bot Token (получите у @BotFather)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Database Configuration
DATABASE_URL=postgresql://botuser:secure_password@db:5432/telegram_bot
DB_USER=botuser
DB_PASSWORD=your_secure_password_here


# Logging
LOG_LEVEL=info

# Monitoring Configuration (4 hours = 14400000 ms)
MONITORING_INTERVAL=14400000

# Admin Configuration (замените на ваши Telegram ID)
ADMIN_USER_IDS=123456789,987654321
```

### 3. Получение Telegram User ID

Для настройки администраторов нужно получить ваш Telegram User ID:

1. Найдите бота [@userinfobot](https://t.me/userinfobot)
2. Отправьте ему любое сообщение
3. Скопируйте ваш ID и добавьте в `ADMIN_USER_IDS`

## 🐳 Развертывание с Docker (рекомендуется)

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd tgbot
```

### 2. Настройка переменных окружения

```bash
cp env.example .env
# Отредактируйте .env файл
nano .env
```

### 3. Сборка и запуск

```bash
# Сборка образов
docker-compose build

# Запуск в фоновом режиме
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f bot
```

### 4. Инициализация базы данных

```bash
# Запуск скрипта инициализации
docker-compose exec bot npm run init-db
```

### 5. Проверка работоспособности

```bash
# Проверка статуса контейнеров
docker-compose ps

# Проверка логов
docker-compose logs bot

# Проверка базы данных
docker-compose exec db psql -U botuser -d telegram_bot -c "SELECT COUNT(*) FROM tracked_organizations;"
```

## 💻 Развертывание без Docker

### 1. Установка зависимостей

```bash
# Установка Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Установка зависимостей проекта
npm install
```

### 2. Настройка базы данных

```bash
# Создание пользователя базы данных
sudo -u postgres psql
CREATE USER botuser WITH PASSWORD 'your_secure_password';
CREATE DATABASE telegram_bot OWNER botuser;
GRANT ALL PRIVILEGES ON DATABASE telegram_bot TO botuser;
\q

# Обновление DATABASE_URL в .env
DATABASE_URL=postgresql://botuser:your_secure_password@localhost:5432/telegram_bot
```

### 3. Инициализация базы данных

```bash
npm run init-db
```

### 4. Сборка и запуск

```bash
# Сборка TypeScript
npm run build

# Запуск в продакшене
npm start

# Запуск в режиме разработки
npm run dev
```

## 🔄 Развертывание на сервере

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Клонирование и настройка

```bash
# Клонирование репозитория
git clone <repository-url>
cd tgbot

# Настройка переменных окружения
cp env.example .env
nano .env
```

### 3. Запуск с systemd (для автозапуска)

Создайте файл сервиса:

```bash
sudo nano /etc/systemd/system/cbr-bot.service
```

Содержимое файла:

```ini
[Unit]
Description=CBR Monitoring Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/your/tgbot
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активация сервиса:

```bash
sudo systemctl enable cbr-bot.service
sudo systemctl start cbr-bot.service
sudo systemctl status cbr-bot.service
```

## 🔒 Настройка безопасности

### 1. Firewall

```bash
# Настройка UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 5432/tcp  # PostgreSQL (если внешний доступ)
sudo ufw enable
```

### 2. SSL/TLS (для webhook)

Если используете webhook вместо long polling:

```bash
# Установка Certbot
sudo apt install certbot

# Получение SSL сертификата
sudo certbot certonly --standalone -d your-domain.com

# Настройка nginx
sudo apt install nginx
```

### 3. Обновление переменных окружения

```env
# Добавьте в .env для webhook
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_SECRET=your_secret_here
```

## 📊 Мониторинг и логирование

### 1. Просмотр логов

```bash
# Docker
docker-compose logs -f bot

# Systemd
sudo journalctl -u cbr-bot.service -f

# Файлы логов
tail -f logs/combined.log
tail -f logs/error.log
```

### 2. Мониторинг ресурсов

```bash
# Использование ресурсов контейнеров
docker stats

# Использование диска
df -h

# Использование памяти
free -h
```

### 3. Настройка ротации логов

Создайте файл конфигурации logrotate:

```bash
sudo nano /etc/logrotate.d/cbr-bot
```

Содержимое:

```
/path/to/your/tgbot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 bot bot
    postrotate
        docker-compose restart bot
    endscript
}
```

## 🔧 Обновление бота

### 1. Обновление с Docker

```bash
# Остановка бота
docker-compose down

# Получение обновлений
git pull origin main

# Пересборка и запуск
docker-compose build --no-cache
docker-compose up -d

# Проверка статуса
docker-compose ps
docker-compose logs -f bot
```

### 2. Обновление без Docker

```bash
# Остановка бота
npm run stop  # или Ctrl+C

# Получение обновлений
git pull origin main

# Установка новых зависимостей
npm install

# Пересборка
npm run build

# Запуск
npm start
```

## 🐛 Устранение неполадок

### Частые проблемы

#### 1. Бот не отвечает

```bash
# Проверка токена
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Проверка логов
docker-compose logs bot | grep -i error
```

#### 2. Ошибки базы данных

```bash
# Проверка подключения к БД
docker-compose exec db psql -U botuser -d telegram_bot -c "SELECT 1;"

# Проверка таблиц
docker-compose exec db psql -U botuser -d telegram_bot -c "\dt"
```

#### 3. Проблемы с мониторингом

```bash
# Проверка API ЦБ РФ
curl "https://www.cbr.ru/dataservice/publications"

# Проверка логов мониторинга
docker-compose logs bot | grep -i monitoring
```

#### 4. Проблемы с уведомлениями

```bash
# Проверка пользователей в БД
docker-compose exec db psql -U botuser -d telegram_bot -c "SELECT * FROM users;"

# Проверка связей пользователь-организация
docker-compose exec db psql -U botuser -d telegram_bot -c "SELECT * FROM user_organizations;"
```

### Команды диагностики

```bash
# Полная диагностика системы
docker-compose exec bot npm run diagnose

# Проверка здоровья сервисов
docker-compose exec bot npm run health-check

# Очистка старых данных
docker-compose exec bot npm run cleanup
```

## 📈 Масштабирование

### 1. Горизонтальное масштабирование

Для высоких нагрузок можно запустить несколько экземпляров бота:

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  bot:
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
```

### 2. Настройка Redis для сессий

```yaml
# Добавьте в docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  bot:
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
```

### 3. Настройка балансировщика нагрузки

```nginx
# nginx.conf
upstream bot_backend {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /webhook {
        proxy_pass http://bot_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔄 Резервное копирование

### 1. Автоматическое резервное копирование

Создайте скрипт резервного копирования:

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/cbr-bot"

# Создание резервной копии БД
docker-compose exec -T db pg_dump -U botuser telegram_bot > "$BACKUP_DIR/db_$DATE.sql"

# Создание резервной копии логов
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" logs/

# Удаление старых резервных копий (старше 30 дней)
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### 2. Восстановление из резервной копии

```bash
# Восстановление БД
docker-compose exec -T db psql -U botuser -d telegram_bot < backup.sql

# Восстановление логов
tar -xzf logs_backup.tar.gz
```

## 📞 Поддержка

### Контакты для поддержки

- **Issues**: Создайте issue в репозитории
- **Discussions**: Используйте Discussions для вопросов
- **Email**: support@example.com

### Полезные ссылки

- [GrammyJS Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

### Логи и отладка

Все логи сохраняются в папке `logs/`:
- `combined.log` - все логи
- `error.log` - только ошибки

Для отладки используйте:

```bash
# Подробные логи
LOG_LEVEL=debug npm start

# Логи в реальном времени
tail -f logs/combined.log
```
