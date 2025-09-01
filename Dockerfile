# Используем официальный образ Playwright
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Установка Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs

# Устанавливаем timezone неинтерактивно
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Moscow

# Установка базовых зависимостей и Xvfb для GUI браузера
RUN apt-get update && apt-get install -y \
    tzdata \
    build-essential \
    python3 \
    make \
    g++ \
    xvfb \
    x11vnc \
    && ln -fs /usr/share/zoneinfo/$TZ /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
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

# Создаем улучшенный скрипт запуска с Xvfb и VNC
RUN echo '#!/bin/bash\n\
echo "Запускаем виртуальный дисплей..."\n\
Xvfb :99 -screen 0 1920x1080x24 > /dev/null 2>&1 &\n\
export DISPLAY=:99\n\
echo "Ждем запуска X-сервера..."\n\
sleep 3\n\
echo "Запускаем VNC сервер..."\n\
x11vnc -display :99 -nopw -listen localhost -xkb -forever > /dev/null 2>&1 &\n\
echo "VNC сервер запущен на порту 5900"\n\
echo "Chrome DevTools будет доступен на порту 9222"\n\
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