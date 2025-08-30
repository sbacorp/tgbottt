# Используем официальный образ Playwright
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Установка Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs

# Создание рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Сборка TypeScript
RUN npm run build

# Создание пользователя для безопасности
RUN groupadd -r bot && useradd -r -g bot bot
RUN chown -R bot:bot /app
USER bot

# Установка переменных окружения для Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]
