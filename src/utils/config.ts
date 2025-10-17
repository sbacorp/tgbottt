import dotenv from 'dotenv';
import { z } from 'zod';

// Загрузка переменных окружения
dotenv.config();

// Схема конфигурации с Zod
const configSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  
  // Supabase конфигурация (обязательная)
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Другие API ключи
  CLAUDE_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  
  // Настройки мониторинга
  MONITORING_INTERVAL: z.string().default('2700000'),
  ADMIN_USER_IDS: z.string().default(''),
  LOG_LEVEL: z.string().default('info'),
  
  // Настройки прокси
  PROXY_ENABLED: z.string().default('false'),
  PROXY_USERNAME: z.string().default(''),
  PROXY_PASSWORD: z.string().default(''),
  PROXY_BYPASS: z.string().default(''),
  PROXY_POOL_IPS: z.string().default(''),
  PROXY_PORT: z.string().default('50101')
});

const parseConfig = (environment: NodeJS.ProcessEnv) => {
  const parsed = configSchema.parse(environment);
  
  return {
    ...parsed,
    isDev: parsed.NODE_ENV === "development",
    isProd: parsed.NODE_ENV === "production",
    monitoringInterval: parseInt(parsed.MONITORING_INTERVAL),
    adminUserIds: parsed.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
    // Настройки прокси
    proxy: {
      enabled: parsed.PROXY_ENABLED === 'true',
      username: parsed.PROXY_USERNAME,
      password: parsed.PROXY_PASSWORD,
      bypass: parsed.PROXY_BYPASS,
      poolIps: parsed.PROXY_POOL_IPS
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0),
      port: parseInt(parsed.PROXY_PORT || '50101', 10)
    }
  };
};

export type Config = ReturnType<typeof parseConfig>;
export const config = parseConfig(process.env);


// Сообщения бота
export const MESSAGES = {
  welcome: `Для разовой проверки воспользуйтесь кнопкой "разовая проверка" или командой /check

Для подписки организаций на постоянное отслеживание воспользуйтесь кнопкой "отслеживание".
В структуре меню на отслеживание вы можете назначить группу организаций и указать пользователей-получателей отчетов,
просматривать списки пользователей-получателей уведомлений и редактировать их.`,
  
  notRegistered: `❌ Вы не зарегистрированы в системе. Обратитесь к администратору.`,
  error: `❌ Произошла ошибка. Попробуйте позже.`,
  invalidInn: `❌ Неверный формат ИНН. ИНН должен содержать 10 или 12 цифр.`,
  adminOnly: `🔒 Эта функция доступна только администраторам.`,
  noOrganizations: `📋 Список отслеживаемых организаций пуст.`,
  noUsers: `👥 Список пользователей пуст.`
};

// Эмодзи для статусов
export const STATUS_EMOJIS = {
  red: '🔴',
  orange: '🟡',
  green: '🟢'
};