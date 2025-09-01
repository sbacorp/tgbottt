# Используем официальный образ Playwright
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Установка Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs

# КРИТИЧНО: Установка libvips для Sharp
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips42 \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Создание рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка всех зависимостей включая Sharp (но игнорируем скрипты установки)
RUN npm ci --ignore-scripts

# Принудительно удаляем предустановленные бинарники Sharp
RUN rm -rf node_modules/sharp/vendor

# Устанавливаем Sharp заново с компиляцией из исходников
RUN npm_config_sharp_binary_host="" \
    npm_config_sharp_libvips_binary_host="" \
    npm install sharp --build-from-source --verbose

# Копирование исходного кода
COPY . .

# Сборка TypeScript
RUN npm run build

# Удаление dev-зависимостей (но оставляем build tools для Sharp)
RUN npm prune --production --ignore-scripts

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
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0
ENV DISPLAY=:99

EXPOSE 3000

# Используем entrypoint для установки Sharp в runtime
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]