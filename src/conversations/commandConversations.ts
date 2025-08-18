import { MyConversation } from '../types';
import { validateInnList, validateTelegramIdList, validateInn } from '../utils/validation';
import { database } from '../database';
import { monitoringService } from '../services/monitoringService';
import { getNotificationService } from '../services/notificationService';
import { MESSAGES, config } from '../utils/config';
import logger from '../utils/logger';
import { Context } from "grammy";

/**
 * Conversation для команды /check
 * Запрашивает ИНН у пользователя и выполняет проверку с валидацией
 */
export async function checkConversation(
  conversation: MyConversation,
  ctx: Context
) {
  let inn: string;
  
  // Валидация ИНН с помощью do while
  do {
    await ctx.reply('🔍 Введите ИНН организации для проверки:');
    const { message } = await conversation.waitFor("message:text");
    inn = message.text?.trim() || '';
    
    if (!inn) {
      await ctx.reply('❌ ИНН не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    if (!validateInn(inn)) {
      await ctx.reply(MESSAGES.invalidInn + '\nПопробуйте еще раз.');
      continue;
    }
    
    break;
  } while (true);
  
  await ctx.reply('🔍 Выполняется проверка организации через Контур.Фокус...');
  
  try {
    const result = await monitoringService.checkOrganization(inn);
    
    if (result) {
      const statusMessage = config.STATUS_MESSAGE[result.status];
      
      let message = `📊 <b>Результат проверки ИНН ${inn}</b>\n\n`;
      message += `🏢 <b>Актуальное название компании:</b> ${result.name}\n`;
      
      if (result.address) {
        message += `📍 <b>Адрес:</b> ${result.address}\n`;
      }
      
      if (result.registrationDate) {
        message += `📅 <b>Дата регистрации:</b> ${result.registrationDate}\n`;
      }
      
      if (result.isLiquidated && result.liquidationDate) {
        message += `⚠️ <b>Ликвидация:</b> ${result.liquidationDate}\n`;
      }
      
      if (result.illegalitySigns && result.illegalitySigns.length > 0) {
        message += `🚨 <b>Санкции:</b> ${result.illegalitySigns.join(', ')}\n`;
      }
      
      if (result.activities && result.activities.length > 0) {
        message += `🏢 <b>Деятельность:</b> ${result.activities[0]}\n`;
      }
      
      if (result.hasIllegalActivity !== undefined) {
        message += `🚨 <b>Признаки нелегальной деятельности:</b> ${result.hasIllegalActivity ? 'Да' : 'Нет'}\n`;
      }
      
      message += `🚦 ЗСК:\n${statusMessage}\n`;
      
      await ctx.reply(message, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ Организация с ИНН ${inn} не найдена`);
    }
  } catch (error) {
    logger.error('Error in checkConversation:', error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Conversation для команды /add_inn
 * Запрашивает ИНН у пользователя и добавляет организации с валидацией
 */
export async function addInnConversation(
  conversation: MyConversation,
  ctx: Context,
) {
  let inns: string;
  let validInns: string[] = [];
  
  // Валидация ИНН с помощью do while
  do {
    await ctx.reply('➕ Введите ИНН организации(й) для добавления (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    inns = message.text || '';
    
    if (!inns) {
      await ctx.reply('❌ ИНН не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateInnList(inns);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат ИНН: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных ИНН. Попробуйте еще раз.');
      continue;
    }
    
    validInns = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Добавляю ${validInns.length} организацию(й)...`);
  
  // Добавление организаций
  const addedOrganizations = [];
  for (const inn of validInns) {
    try {
      const addedOrg = await database.addOrganizationIfNotExists({
        inn,
        name: `Организация ${inn}`,
        status: 'green'
      });
      
      if (!addedOrg) {
        logger.info(`Organization with INN ${inn} already exists, skipping addition`);
        addedOrganizations.push(inn);
        continue;
      }
      
      const orgData = await monitoringService.checkOrganization(inn);
      if (orgData) {
        logger.info(`Получены актуальные данные для организации ${inn}: ${orgData.name}`);
      }
      
      addedOrganizations.push(inn);
    } catch (error) {
      logger.error(`Error adding organization ${inn}:`, error);
    }
  }
  
  if (addedOrganizations.length > 0) {
    await ctx.reply(MESSAGES.innAdded(addedOrganizations));
    
    const session = await conversation.external((ctx) => ctx.session);
    if (session.isAdmin) {
      await getNotificationService().sendNewOrganizationsNotification(
        addedOrganizations.map(inn => ({ inn, name: `Организация ${inn}` }))
      );
    }
  } else {
    await ctx.reply('Не удалось добавить ни одной организации.');
  }
}

/**
 * Conversation для команды /remove_inn
 */
export async function removeInnConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }
  
  let inns: string;
  let validInns: string[] = [];
  
  do {
    await ctx.reply('🗑️ Введите ИНН организации(й) для удаления (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    inns = message.text?.trim() || '';
    
    if (!inns) {
      await ctx.reply('❌ ИНН не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateInnList(inns);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат ИНН: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных ИНН. Попробуйте еще раз.');
      continue;
    }
    
    validInns = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Удаляю ${validInns.length} организацию(й)...`);
  
  const removedOrganizations = [];
  for (const inn of validInns) {
    try {
      const org = await database.getOrganizationByInn(inn);
      if (org) {
        await database.deleteOrganization(inn);
        removedOrganizations.push({ inn, name: org.name });
      }
    } catch (error) {
      logger.error(`Error removing organization ${inn}:`, error);
    }
  }
  
  if (removedOrganizations.length > 0) {
    await ctx.reply(MESSAGES.innRemoved(removedOrganizations.map(org => org.inn)));
    await getNotificationService().sendRemovedOrganizationsNotification(removedOrganizations);
  } else {
    await ctx.reply('Не удалось удалить ни одной организации.');
  }
}

/**
 * Conversation для команды /add_users
 */
export async function addUsersConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }
  
  let telegramIdsStr: string;
  let validIds: number[] = [];
  
  do {
    await ctx.reply('👥 Введите telegram_id пользователей для добавления (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    telegramIdsStr = message.text?.trim() || '';
    
    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.');
      continue;
    }
    
    validIds = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Добавляю ${validIds.length} пользователя(ей)...`);
  
  const addedUsers = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (existingUser) {
        logger.info(`User with telegram_id ${telegramId} already exists`);
        continue;
      }
      
      await database.createUser(telegramId, undefined, false);
      addedUsers.push(telegramId.toString());
      logger.info(`Added user with telegram_id: ${telegramId}`);
    } catch (error) {
      logger.error(`Error adding user ${telegramId}:`, error);
    }
  }
  
  if (addedUsers.length > 0) {
    await ctx.reply(`✅ Пользователи успешно добавлены: ${addedUsers.join(', ')}`);
  } else {
    await ctx.reply('Не удалось добавить ни одного пользователя.');
  }
}

/**
 * Conversation для команды /remove_users
 */
export async function removeUsersConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }
  
  let telegramIdsStr: string;
  let validIds: number[] = [];
  
  do {
    await ctx.reply('🗑️ Введите telegram_id пользователей для удаления (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    telegramIdsStr = message.text?.trim() || '';
    
    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.');
      continue;
    }
    
    validIds = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Удаляю ${validIds.length} пользователя(ей)...`);
  
  const removedUsers = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (!existingUser) {
        logger.info(`User with telegram_id ${telegramId} does not exist`);
        continue;
      }
      
      await database.deleteUser(telegramId);
      removedUsers.push(telegramId.toString());
      logger.info(`Removed user with telegram_id: ${telegramId}`);
    } catch (error) {
      logger.error(`Error removing user ${telegramId}:`, error);
    }
  }
  
  if (removedUsers.length > 0) {
    await ctx.reply(`✅ Пользователи успешно удалены: ${removedUsers.join(', ')}`);
  } else {
    await ctx.reply('Не удалось удалить ни одного пользователя.');
  }
}

/**
 * Conversation для команды /add_admins
 */
export async function addAdminsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }
  
  let telegramIdsStr: string;
  let validIds: number[] = [];
  
  do {
    await ctx.reply('👑 Введите telegram_id пользователей для назначения администраторами (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    telegramIdsStr = message.text || '';
    
    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.');
      continue;
    }
    
    validIds = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Назначаю ${validIds.length} администратора(ов)...`);
  
  const addedAdmins = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (!existingUser) {
        await database.createUser(telegramId, undefined, true);
        logger.info(`Created new admin user with telegram_id: ${telegramId}`);
      } else {
        await database.updateUserAdminStatus(telegramId, true);
        logger.info(`Updated user ${telegramId} to admin`);
      }
      addedAdmins.push(telegramId.toString());
    } catch (error) {
      logger.error(`Error making ${telegramId} admin:`, error);
    }
  }
  
  if (addedAdmins.length > 0) {
    await ctx.reply(`✅ Администраторы успешно назначены: ${addedAdmins.join(', ')}`);
  } else {
    await ctx.reply('Не удалось назначить ни одного администратора.');
  }
}

/**
 * Conversation для команды /remove_admins
 * Запрашивает telegram_id у администратора и снимает права администратора
 */
export async function removeAdminsConversation(
  conversation: MyConversation,
  ctx: Context
) {
  const session = await conversation.external((ctx) => ctx.session);
  if (!session.isAdmin) {
    await ctx.reply(MESSAGES.adminOnly);
    return;
  }
  
  let telegramIdsStr: string;
  let validIds: number[] = [];
  
  do {
    await ctx.reply('➖ Введите telegram_id администраторов для снятия прав (можно несколько через пробел):');
    const { message } = await conversation.waitFor("message:text");
    telegramIdsStr = message.text || '';
    
    if (!telegramIdsStr) {
      await ctx.reply('❌ telegram_id не может быть пустым. Попробуйте еще раз.');
      continue;
    }
    
    const { valid, invalid } = validateTelegramIdList(telegramIdsStr);
    
    if (invalid.length > 0) {
      await ctx.reply(`❌ Неверный формат telegram_id: ${invalid.join(', ')}\nПопробуйте еще раз.`);
      continue;
    }
    
    if (valid.length === 0) {
      await ctx.reply('❌ Не найдено валидных telegram_id. Попробуйте еще раз.');
      continue;
    }
    
    validIds = valid;
    break;
  } while (true);
  
  await ctx.reply(`🔄 Снимаю права администратора у ${validIds.length} пользователя(ей)...`);
  
  const removedAdmins = [];
  for (const telegramId of validIds) {
    try {
      const existingUser = await database.getUserByTelegramId(telegramId);
      if (!existingUser) {
        logger.info(`User with telegram_id ${telegramId} does not exist`);
        continue;
      }
      
      if (!existingUser.is_admin) {
        logger.info(`User with telegram_id ${telegramId} is not an admin`);
        continue;
      }
      
      await database.updateUserAdminStatus(telegramId, false);
      removedAdmins.push(telegramId.toString());
      logger.info(`Removed admin rights from user ${telegramId}`);
    } catch (error) {
      logger.error(`Error removing admin rights from ${telegramId}:`, error);
    }
  }
  
  if (removedAdmins.length > 0) {
    await ctx.reply(`✅ Права администратора сняты у: ${removedAdmins.join(', ')}`);
  } else {
    await ctx.reply('Не удалось снять права ни у одного администратора.');
  }
}
