FROM node:18-alpine

# Установка базовых зависимостей
RUN apk add --no-cache \
    ca-certificates

# Создание рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка зависимостей
RUN npm install --only=production

# Копирование исходного кода
COPY . .

# Сборка TypeScript
RUN npm run build

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Изменение владельца файлов
RUN chown -R bot:nodejs /app
USER bot

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]
