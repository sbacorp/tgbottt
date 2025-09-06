import logger from "./logger";

/**
 * Интерфейс для ошибки валидации
 */
export interface ValidationError {
  code: number;
  message: string;
}

/**
 * Валидация ИНН с проверкой контрольных чисел
 * @param inn - ИНН для проверки
 * @param error - объект для записи ошибки
 * @returns true если ИНН корректный
 */
export function validateInn(inn: string | number, error?: ValidationError): boolean {
  let result = false;
  
  // Приводим к строке
  if (typeof inn === 'number') {
    inn = inn.toString();
  } else if (typeof inn !== 'string') {
    inn = '';
  }

  // Создаем временный объект ошибки, если не передан
  const tempError: ValidationError = error || { code: 0, message: '' };

  if (!inn.length) {
    tempError.code = 1;
    tempError.message = 'ИНН пуст';
  } else if (/[^0-9]/.test(inn)) {
    tempError.code = 2;
    tempError.message = 'ИНН может состоять только из цифр';
  } else if ([10, 12].indexOf(inn.length) === -1) {
    tempError.code = 3;
    tempError.message = 'ИНН может состоять только из 10 или 12 цифр';
  } else {
    const checkDigit = function (inn: string, coefficients: number[]) {
      let n = 0;
      for (let i = 0; i < coefficients.length; i++) {
        const digit = inn[i];
        const coeff = coefficients[i];
        if (digit !== undefined && coeff !== undefined) {
          n += coeff * parseInt(digit);
        }
      }
      return parseInt((n % 11 % 10).toString());
    };

    switch (inn.length) {
      case 10:
        const n10 = checkDigit(inn, [2, 4, 10, 3, 5, 9, 4, 6, 8]);
        const lastDigit10 = inn[9];
        if (lastDigit10 !== undefined && n10 === parseInt(lastDigit10)) {
          result = true;
        }
        break;
      case 12:
        const n11 = checkDigit(inn, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
        const n12 = checkDigit(inn, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
        const lastDigit11 = inn[10];
        const lastDigit12 = inn[11];
        if (lastDigit11 !== undefined && lastDigit12 !== undefined && 
            (n11 === parseInt(lastDigit11)) && (n12 === parseInt(lastDigit12))) {
          result = true;
        }
        break;
    }
    
    if (!result) {
      tempError.code = 4;
      tempError.message = 'Неправильное контрольное число';
    }
  }

  return result;
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
    const error: ValidationError = { code: 0, message: '' };
    if (validateInn(inn, error)) {
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

/**
 * Проверяет, содержит ли ответ от Firecrawl сообщение о том, что компания не найдена
 * @param markdown - markdown текст от Firecrawl
 * @param inn - ИНН для поиска в сообщении
 * @returns true если компания не найдена
 */
export function isOrganizationNotFound(markdown: string, inn: string): boolean {
  if (!markdown || !inn) {
    return false;
  }

  const text = markdown.toLowerCase();
  
  // Ищем паттерны "не найдено" с ИНН
  const notFoundPatterns = [
    `компаний по запросу\n«${inn}»\nне найдено`,
    `компаний по запросу «${inn}» не найдено`,
  ];
  logger.info(`Проверяем наличие паттернов в тексте: ${text}`);
  const result = notFoundPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  logger.info(`Результат проверки: ${result}`);
  return result;
}
