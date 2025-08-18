import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Проверка обязательных переменных окружения
const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'FIRECRAWL_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Конфигурация приложения
export const config = {
  botToken: process.env['BOT_TOKEN']!,
  databaseUrl: process.env['DATABASE_URL']!,
  firecrawlApiKey: process.env['FIRECRAWL_API_KEY'] || 'fc-ab1e434c66f143b0a0f09c2ba98b8381',
  monitoringInterval: parseInt(process.env['MONITORING_INTERVAL'] || '2700000'),
  adminUserIds: process.env['ADMIN_USER_IDS']?.split(',').map(id => parseInt(id.trim())) || [],
  logLevel: process.env['LOG_LEVEL'] || 'info',
  
  MESSAGES: {
    welcome: `Привет, коллега! 🚦

Этот бот работает как "светофор" для организаций

🔴 Красный — организация в чёрном списке ЦБ РФ.
🟡 Желтый — есть риски, но организация пока не заблокирована
🟢 Зелёный — всё чисто, рисков нет.

Если организация попала в 🔴красный или 🟡 желтый списки вы получите оповещение в виде сообщения. Если организация находится в 🟢 Зелёном списке - все супер, вы оповещение не получаете.

Посмотреть актуальный список организаций можно по кнопке меню "меню"

Чтобы добавить организацию нажмите "добавить инн" (несколько организаций добавляете через "пробел")

**(Все кнопки должны быть ниже поля сообщения)**`,

    notRegistered: 'Вы не зарегистрированы в системе. Обратитесь к администратору.',
    help: `📋 Доступные команды:

Основные команды:
/start - Запуск бота
/menu - Главное меню
/organizations - Список организаций
/add_inn - Добавить ИНН для отслеживания
/check - Проверить организацию
/status - Статус системы
/help - Справка

Административные команды:
/users - Список получателей
/add_users - Добавить получателей по telegram_id
/remove_users - Удалить получателей по telegram_id
/add_admins - Добавить администраторов по telegram_id
/remove_admins - Удалить администраторов по telegram_id
/remove_inn - Удалить ИНН из отслеживания
/setcommands - Обновить команды`,

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
  STATUS_MESSAGE: {
    red: 'Текущее состояние\n*Уровень риска:* 🔴 3 – компания находится в *КРАСНОЙ* зоне, рекомендация - не работать с компанией\n',
    orange: 'Текущее состояние\n*Уровень риска:* 🟡 1 – компания находится в ЖЕЛТОЙ зоне, рекомендация - работать с осторожностью\n',
    green: 'Текущее состояние\n*Уровень риска:* 🟢 0 – компания находится в ЗЕЛЕНОЙ зоне, рекомендация - работать с компанией\n'
  }
};

// Первичные ИНН для отслеживания
export const INITIAL_INNS = [];

// Сообщения бота
export const MESSAGES = {
  welcome: `Привет, коллега! 🚦
Этот бот работает как "светофор" для организаций
🔴 Красный — организация в чёрном списке ЦБ РФ.
🟡 Желтый — есть риски, но организация пока не заблокирована
🟢 Зелёный — всё чисто, рисков нет.

Если организация попала в 🔴красный или 🟡 желтый списки вы получите оповещение в виде сообщения. Если организация находится в 🟢 Зелёном списке - все супер, вы оповещение не получаете.

Посмотреть актуальный список организаций можно по кнопке меню "меню"
Чтобы добавить организацию нажмите "добавить инн" (несколько организаций добавляете через "пробел")`,

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
export const STATUS_MESSAGE = {
  [ORGANIZATION_STATUS.RED]: 'Текущее состояние\nУровень риска: 🔴 3 – компания находится в *КРАСНОЙ* зоне, рекомендация - не работать с компанией',
  [ORGANIZATION_STATUS.ORANGE]: 'Текущее состояние\nУровень риска: 🟡 1 – компания находится в ЖЕЛТОЙ зоне, рекомендация - работать с осторожностью',
  [ORGANIZATION_STATUS.GREEN]: 'Текущее состояние\nУровень риска: 🟢 0 – компания находится в ЗЕЛЕНОЙ зоне, рекомендация - работать с компанией'
}
