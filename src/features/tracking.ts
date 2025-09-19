import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types";
import { database } from "../database";
import { MESSAGES } from "../utils/config";
import logger from "../utils/logger";
import { formatOrganizationList } from "../helpers/messages";
import { createMainMenuKeyboard } from "../helpers/keyboard";

// Создаем Composer для feature tracking
export const tracking = new Composer<MyContext>();

// Создание клавиатуры для меню отслеживания
export function createTrackingMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📋 Список организаций", "tracking_organizations")
    .row()
    .text("👥 Список пользователей", "tracking_users")
    .row()
    .text("🗑 Удалить группу", "delete_group")
    .row()
    .text("🔙 Назад в меню", "back_to_main_menu");
}

// Создание клавиатуры для управления организациями
function createOrganizationsManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ Добавить", "add_organization")
    .text("➖ Удалить", "remove_organization")
    .row()
    .text("🔙 Назад к отслеживанию", "back_to_tracking");
}

// Создание клавиатуры для управления пользователями
function createUsersManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ Добавить", "add_user")
    .text("➖ Удалить", "remove_user")
    .row()
    .text("🔙 Назад к отслеживанию", "back_to_tracking");
}

// Обработчик кнопки "📋 Отслеживание"
tracking.hears("📋 Отслеживание", async (ctx) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply(MESSAGES.error);
      return;
    }

    // Проверяем, есть ли у пользователя группа
    const userGroup = await database.getUserGroup(telegramId);

    if (!userGroup) {
      await ctx.deleteMessage();
      // У пользователя нет группы - предлагаем создать
      const keyboard = new InlineKeyboard()
        .text("➕ Создать группу отслеживания", "create_group")
        .row()
        .text("🔙 Назад в меню", "back_to_main_menu");

      await ctx.reply(
        "🏢 <b>Группы отслеживания</b>\n\nУ вас пока нет группы отслеживания. Создайте группу для мониторинга организаций и управления участниками.",
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } else {
      // У пользователя есть группа - показываем меню группы
      await ctx.deleteMessage();
      const keyboard = createTrackingMenuKeyboard();
      await ctx.reply(
        `🏢 <b>Группа "${userGroup.name}"</b>\n\nСоставьте список организаций на отслеживание и список участников для получения уведомлений об изменении статуса надежности.`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    }
  } catch (error) {
    logger.error("Error in tracking menu:", error);
    await ctx.reply(MESSAGES.error);
  }
});

// Обработчик создания группы через conversation
tracking.callbackQuery("create_group", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("create_group");
  } catch (error) {
    logger.error("Error starting create group conversation:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при создании группы");
  }
});

// Обработчик получения ссылки приглашения
tracking.callbackQuery("get_invite_link", async (ctx) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery("❌ Ошибка идентификации пользователя");
      return;
    }

    const userGroup = await database.getUserGroup(telegramId);
    if (!userGroup) {
      await ctx.answerCallbackQuery("❌ Группа не найдена");
      return;
    }

    const botUsername = ctx.me.username || "your_bot";
    const inviteLink = `https://t.me/${botUsername}?start=joinGroup_${userGroup.invite_code}`;

    await ctx.editMessageText(
      `🔗 <b>Ссылка для приглашения в группу "${userGroup.name}"</b>\n\n` +
        `<code>${inviteLink}</code>\n\n` +
        `📋 <b>Поделитесь этой ссылкой с людьми, которых хотите пригласить в группу.</b>`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(
          "🔙 Назад к управлению",
          "back_to_tracking"
        ),
      }
    );

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error getting invite link:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при получении ссылки");
  }
});

// Обработчик callback "tracking_organizations" - показать список организаций
tracking.callbackQuery("tracking_organizations", async (ctx) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery("❌ Ошибка идентификации пользователя");
      return;
    }

    const userGroup = await database.getUserGroup(telegramId);
    if (!userGroup) {
      await ctx.answerCallbackQuery("❌ Группа не найдена");
      return;
    }

    const organizations = await database.getGroupOrganizations(userGroup.id);

    let message = `📋 <b>Организации группы "${userGroup.name}":</b>\n\n`;

    if (organizations.length === 0) {
      message +=
        "Список организаций пуст. Добавьте организации для отслеживания.";
    } else {
      message += formatOrganizationList(organizations);
    }

    const keyboard = createOrganizationsManagementKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error showing organizations list:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при загрузке списка организаций");
  }
});

// Обработчик callback "tracking_users" - показать список участников
tracking.callbackQuery("tracking_users", async (ctx) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery("❌ Ошибка идентификации пользователя");
      return;
    }

    const userGroup = await database.getUserGroup(telegramId);
    if (!userGroup) {
      await ctx.answerCallbackQuery("❌ Группа не найдена");
      return;
    }

    const members = await database.getGroupMembers(userGroup.id);

    let message = `👥 <b>Участники группы "${userGroup.name}":</b>\n\n`;

    if (members.length === 0) {
      message += "В группе пока нет участников.";
    } else {
      for (const member of members) {
        const isOwner = member.telegram_id === userGroup.owner_id;
        const ownerBadge = isOwner ? " 👑 (Владелец)" : "";
        const username = member.username
          ? `@${member.username}`
          : `ID: ${member.telegram_id}`;
        message += `${username}${ownerBadge}\n`;
      }
    }

    message += `\n🔗 <b>Код приглашения:</b> <code>${userGroup.invite_code}</code>\n`;
    message += `Ссылка: https://t.me/${ctx.me.username}?start=joinGroup_${userGroup.invite_code}`;

    const keyboard = createUsersManagementKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error showing members list:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при загрузке списка участников");
  }
});

// Обработчик callback "add_organization" - добавить организацию через conversation
tracking.callbackQuery("add_organization", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add_inn_to_group");
  } catch (error) {
    logger.error("Error starting add organization conversation:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при добавлении организации");
  }
});

// Обработчик callback "remove_organization" - удалить организацию через conversation
tracking.callbackQuery("remove_organization", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("remove_inn_from_group");
  } catch (error) {
    logger.error("Error starting remove organization conversation:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при удалении организации");
  }
});

// Обработчик callback "add_user" - добавить пользователя через conversation
tracking.callbackQuery("add_user", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("add_user_to_group");
  } catch (error) {
    logger.error("Error starting add user conversation:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при добавлении пользователя");
  }
});

// Обработчик callback "remove_user" - удалить пользователя через conversation
tracking.callbackQuery("remove_user", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("remove_user_from_group");
  } catch (error) {
    logger.error("Error starting remove user conversation:", error);
    await ctx.answerCallbackQuery("❌ Ошибка при удалении пользователя");
  }
});

// Обработчики навигации
tracking.callbackQuery("back_to_tracking", async (ctx) => {
  try {
    const keyboard = createTrackingMenuKeyboard();
    await ctx.editMessageText(
      "Составьте список организаций на отслеживание и список пользователей для получения уведомлений об изменении статуса надежности. Если список пользователей не заполнен, то уведомления будете получать только Вы.",
      { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error going back to tracking:", error);
    await ctx.answerCallbackQuery("❌ Ошибка навигации");
  }
});

tracking.callbackQuery("back_to_organizations", async (ctx) => {
  try {
    const organizations = await database.getAllOrganizations();

    let message = "📋 <b>Список отслеживаемых организаций:</b>\n\n";

    if (organizations.length === 0) {
      message +=
        "Список организаций пуст. Добавьте организации для отслеживания.";
    } else {
      message += formatOrganizationList(organizations);
    }

    const keyboard = createOrganizationsManagementKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error going back to organizations:", error);
    await ctx.answerCallbackQuery("❌ Ошибка навигации");
  }
});

tracking.callbackQuery("back_to_users", async (ctx) => {
  try {
    const users = await database.getAllUsers();

    let message = "👥 <b>Список пользователей для уведомлений:</b>\n\n";

    if (users.length === 0) {
      message +=
        "Список пользователей пуст. Уведомления будете получать только Вы.";
    } else {
      for (const user of users) {
        const adminBadge = user.is_admin ? " (Администратор)" : "";
        const username = user.username
          ? `@${user.username}`
          : `ID: ${user.telegram_id}`;
        message += `${username}${adminBadge}\n`;
      }
    }

    const keyboard = createUsersManagementKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error going back to users:", error);
    await ctx.answerCallbackQuery("❌ Ошибка навигации");
  }
});

// Обработчик для возврата в главное меню
tracking.callbackQuery("back_to_main_menu", async (ctx) => {
  try {
    const keyboard = createMainMenuKeyboard();
    await ctx.editMessageText(
      `Для разовой проверки воспользуйтесь кнопкой "разовая проверка" или командой /check

      Для подписки организаций на постоянное отслеживание воспользуйтесь кнопкой "отслеживание". В структуре меню на отслеживание вы можете назначить группу организаций и указать пользователей-получателей отчетов, просматривать списки пользователей-получателей уведомлений и редактировать их.`,
      {
        reply_markup: keyboard,
      }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error("Error going back to main menu:", error);
    await ctx.answerCallbackQuery("❌ Ошибка навигации");
  }
});

// Обработчик удаления группы
tracking.callbackQuery("delete_group", async (ctx) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery("❌ Ошибка идентификации пользователя");
      return;
    }

    const userGroup = await database.getUserGroup(telegramId);
    if (!userGroup) {
      await ctx.answerCallbackQuery("❌ Группа не найдена");
      return;
    }

    await database.deleteUserGroup(userGroup.id, telegramId);
    const keyboard = createMainMenuKeyboard();
    await ctx.editMessageText(MESSAGES.welcome, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error('Error deleting group from tracking menu:', error);
    await ctx.answerCallbackQuery('❌ Не удалось удалить группу');
  }
});
