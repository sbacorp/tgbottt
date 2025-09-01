/**
 * Валидация ИНН
 * @param inn - ИНН для проверки
 * @returns true если ИНН корректный
 */
export function validateInn(inn: string): boolean {
  // Простая проверка: только цифры и длина 10-12 символов
  return /^\d{10,12}$/.test(inn);
}

/**
 * Валидация Telegram username
 * @param username - username для проверки
 * @returns true если username корректный
 */
export function validateUsername(username: string): boolean {
  // Telegram username должен начинаться с @ и содержать 5-32 символа
  return /^@[a-zA-Z0-9_]{5,32}$/.test(username);
}

/**
 * Валидация Telegram user ID
 * @param userId - ID пользователя для проверки
 * @returns true если ID корректный
 */
export function validateUserId(userId: number): boolean {
  return Number.isInteger(userId) && userId > 0;
}

/**
 * Очистка и валидация списка ИНН
 * @param inns - строка с ИНН через пробел
 * @returns объект с валидными и невалидными ИНН
 */
export function validateInnList(inns: string): {
  valid: string[];
  invalid: string[];
} {
  const innList = inns.trim().split(/\s+/).filter(inn => inn.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const inn of innList) {
    if (validateInn(inn)) {
      valid.push(inn);
    } else {
      invalid.push(inn);
    }
  }

  return { valid, invalid };
}

/**
 * Очистка и валидация списка username
 * @param usernames - строка с username через пробел
 * @returns объект с валидными и невалидными username
 */
export function validateUsernameList(usernames: string): {
  valid: string[];
  invalid: string[];
} {
  const usernameList = usernames.trim().split(/\s+/).filter(username => username.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const username of usernameList) {
    if (validateUsername(username)) {
      valid.push(username);
    } else {
      invalid.push(username);
    }
  }

  return { valid, invalid };
}

/**
 * Очистка и валидация списка telegram_id
 * @param telegramIds - строка с telegram_id через пробел
 * @returns объект с валидными и невалидными telegram_id
 */
export function validateTelegramIdList(telegramIds: string): {
  valid: number[];
  invalid: string[];
} {
  const telegramIdList = telegramIds.trim().split(/\s+/).filter(id => id.length > 0);
  const valid: number[] = [];
  const invalid: string[] = [];

  for (const id of telegramIdList) {
    const numId = parseInt(id, 10);
    if (validateUserId(numId)) {
      valid.push(numId);
    } else {
      invalid.push(id);
    }
  }

  return { valid, invalid };
}

/**
 * Валидация email
 * @param email - email для проверки
 * @returns true если email корректный
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Валидация URL
 * @param url - URL для проверки
 * @returns true если URL корректный
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Санитизация строки (удаление опасных символов)
 * @param str - строка для очистки
 * @returns очищенная строка
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Удаление < и >
    .replace(/javascript:/gi, '') // Удаление javascript:
    .replace(/on\w+=/gi, '') // Удаление обработчиков событий
    .trim();
}

/**
 * Ограничение длины строки
 * @param str - строка
 * @param maxLength - максимальная длина
 * @returns обрезанная строка
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Проверка на пустую строку или только пробелы
 * @param str - строка для проверки
 * @returns true если строка пустая или содержит только пробелы
 */
export function isEmptyString(str: string): boolean {
  return !str || str.trim().length === 0;
}
