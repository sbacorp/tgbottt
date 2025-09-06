import { database } from "../database";
import logger from "../utils/logger";

/**
 * Функция для создания пользователя-администратора
 */
export async function createAdminUser(
  telegramId: number,
  username?: string
): Promise<void> {
  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await database.getUserByTelegramId(telegramId);

    if (existingUser) {
      // Если пользователь существует, обновляем его права на администратора
      await database.updateUserAdminStatus(telegramId, true);
      logger.info(`User ${telegramId} (@${username}) promoted to admin`);
    } else {
      // Создаем нового пользователя-администратора
      await database.createUser(telegramId, username, true);
      logger.info(`Created new admin user ${telegramId} (@${username})`);
    }
  } catch (error) {
    logger.error(`Error creating admin user ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Функция для создания обычного пользователя
 */
export async function createRegularUser(
  telegramId: number,
  username?: string
): Promise<void> {
  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await database.getUserByTelegramId(telegramId);

    if (!existingUser) {
      // Создаем нового обычного пользователя
      await database.createUser(telegramId, username, false);
      logger.info(`Created new regular user ${telegramId} (@${username})`);
    }
  } catch (error) {
    logger.error(`Error creating regular user ${telegramId}:`, error);
    throw error;
  }
}
