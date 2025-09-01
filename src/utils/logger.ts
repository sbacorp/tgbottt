import winston from 'winston';
import fs from 'fs';

// Создание директории для логов
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Конфигурация Winston
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cbr-monitoring-bot' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Добавление консольного транспорта
// В Docker всегда выводим в консоль для просмотра через docker logs
if (process.env['NODE_ENV'] !== 'production' || process.env['DOCKER_ENV'] === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, service }) => {
        return `${timestamp} [${service}] ${level}: ${message}`;
      })
    )
  }));
}

export default logger;
