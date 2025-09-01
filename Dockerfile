# Используем официальный образ Playwright
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Установка Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs

# Установка базовых зависимостей
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Создание рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка зависимостей
RUN npm ci

# Копирование исходного кода
COPY . .

# Сборка TypeScript
RUN npm run build

# Удаление dev-зависимостей
RUN npm prune --production

# Создание пользователя для безопасности  
RUN groupadd -r bot && useradd -r -g bot bot
RUN chown -R bot:bot /app

# Создаем простой скрипт запуска
RUN echo '#!/bin/bash\n\
echo "Запускаем приложение..."\n\
exec "$@"' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    chown bot:bot /app/entrypoint.sh

USER bot

# Установка переменных окружения
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV NODE_ENV=production
ENV DISPLAY=:99

EXPOSE 3000

# Используем entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]