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
  FIRECRAWL_API_KEY: z.string().default(''),
  CLAUDE_API_KEY: z.string().default(''),
  
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

// Конфигурация приложения (для обратной совместимости)
export const legacyConfig = {
  botToken: config.BOT_TOKEN,
  firecrawlApiKey: config.FIRECRAWL_API_KEY,
  monitoringInterval: config.monitoringInterval,
  adminUserIds: config.adminUserIds,
  logLevel: config.LOG_LEVEL,
  ANTHROPIC_API_KEY: config.CLAUDE_API_KEY,
  
  // Настройки прокси для Playwright (для обратной совместимости)
  proxy: config.proxy,
  
  MESSAGES: {
    notRegistered: 'Вы не зарегистрированы в системе. Обратитесь к администратору.',
    help: `📋 Доступные команды:

Основные команды:
/start - Запуск бота
/menu - Главное меню
/organizations - Список организаций
/add_inn - Добавить ИНН для отслеживания
/check - Проверить организацию
/check_cbr - Проверить организацию по зск ЦБР
/status - Статус системы
/help - Справка

Административные команды:
/users - Список получателей
/add_users - Добавить получателей по telegram_id
/remove_users - Удалить получателей по telegram_id
/add_admins - Добавить администраторов по telegram_id
/remove_admins - Удалить администраторов по telegram_id
/remove_inn - Удалить ИНН из отслеживания`,

    systemStatus: (uptime: string, memoryUsage: string, dbStatus: string) => 
      `🖥 Статус системы:

⏱ Время работы: ${uptime}
💾 Использование памяти: ${memoryUsage}
🗄 База данных: ${dbStatus}`,

    organizationAdded: (inn: string) => `✅ ИНН ${inn} добавлен для отслеживания`,
    organizationRemoved: (inn: string) => `❌ ИНН ${inn} удален из отслеживания`,
    userAdded: (username: string) => `✅ Пользователь @${username} добавлен`,
    userRemoved: (username: string) => `❌ Пользователь @${username} удален`,
    adminAdded: (username: string) => `✅ Администратор @${username} добавлен`,
    adminRemoved: (username: string) => `❌ Администратор @${username} удален`,
    
    enterInn: 'Введите новые отслеживаемые ИНН в формате "1234 1235 1236"',
    enterUsers: 'Введите новых получателей в формате "123456789 987654321"',
    enterAdmins: 'Введите новых администраторов в формате "123456789 987654321"',
    enterRemoveInn: 'Введите ИНН для удаления в формате "1234 1235 1236"',
    enterRemoveUsers: 'Введите получателей для удаления в формате "123456789 987654321"',
    enterRemoveAdmins: 'Введите администраторов для удаления в формате "123456789 987654321"',
    
    noOrganizations: 'Список отслеживаемых организаций пуст',
    noUsers: 'Список получателей пуст',
    invalidInn: '❌ Неверный формат ИНН. ИНН должен содержать 10 или 12 цифр',
    invalidUsername: '❌ Неверный формат telegram_id. Используйте числовой ID',
    organizationNotFound: '❌ Организация не найдена',
    accessDenied: '❌ Доступ запрещен. Требуются права администратора',
    errorOccurred: '❌ Произошла ошибка. Попробуйте позже',
    operationCancelled: '❌ Операция отменена'
  },

  STATUS_EMOJIS: {
    red: '🔴',
    orange: '🟡', 
    green: '🟢'
  },

  STATUS_NAMES: {
    red: 'Красный список',
    orange: 'Желтый список',
    green: 'Зеленый список'
  },
};

// Первичные ИНН для отслеживания
export const INITIAL_INNS = [];

// Сообщения бота
export const MESSAGES = {
  welcome: `Для разовой проверки воспользуйтесь кнопкой "разовая проверка" или командой /check

Для подписки организаций на постоянное отслеживание воспользуйтесь кнопкой "отслеживание".
В структуре меню на отслеживание вы можете назначить группу организаций и указать пользователей-получателей отчетов,
просматривать списки пользователей-получателей уведомлений и редактировать их.`,

  notRegistered: `❌ Вы не зарегистрированы в системе.
Обратитесь к администратору для получения доступа.`,

  adminOnly: `🔒 Эта функция доступна только администраторам.`,

  invalidInn: `❌ Неверный формат ИНН. ИНН должен содержать 10 или 12 цифр.`,

  innAdded: (inns: string[]) => `✅ ИНН успешно добавлены: ${inns.join(', ')}`,

  innRemoved: (inns: string[]) => `✅ ИНН успешно удалены: ${inns.join(', ')}`,

  userAdded: (users: string[]) => `✅ Пользователи успешно добавлены: ${users.join(', ')}`,

  userRemoved: (users: string[]) => `✅ Пользователи успешно удалены: ${users.join(', ')}`,

  noOrganizations: `📋 Список отслеживаемых организаций пуст.`,

  noUsers: `👥 Список пользователей пуст.`,

  error: `❌ Произошла ошибка. Попробуйте позже.`,

  monitoringStarted: `🔄 Мониторинг запущен. Проверка каждые 45 минут.`,

  monitoringStopped: `⏹️ Мониторинг остановлен.`
};

// Статусы организаций
export const ORGANIZATION_STATUS = {
  RED: 'red' as const,
  ORANGE: 'orange' as const,
  GREEN: 'green' as const,
  REMOVED: 'removed' as const
};

// Эмодзи для статусов
export const STATUS_EMOJIS = {
  [ORGANIZATION_STATUS.RED]: '🔴',
  [ORGANIZATION_STATUS.ORANGE]: '🟡',
  [ORGANIZATION_STATUS.GREEN]: '🟢',
  [ORGANIZATION_STATUS.REMOVED]: '⚪'
};

// Названия статусов
export const STATUS_NAMES = {
  [ORGANIZATION_STATUS.RED]: 'Красный список',
  [ORGANIZATION_STATUS.ORANGE]: 'Желтый список',
  [ORGANIZATION_STATUS.GREEN]: 'Зелёный список',
  [ORGANIZATION_STATUS.REMOVED]: 'Удалено из списка'
};