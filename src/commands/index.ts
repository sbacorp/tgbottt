/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { BotCommand } from "@grammyjs/types";
import { CommandContext } from "grammy";
import { config } from "../utils/config";
import type { MyContext } from "../types";

function getPrivateChatCommands(): BotCommand[] {
  return [
    {
      command: "start",
      description: "Запуск бота",
    },
    {
      command: "menu",
      description: "Главное меню",
    },
    {
      command: "organizations",
      description: "Список организаций",
    },
    {
      command: "add_inn",
      description: "Добавить ИНН для отслеживания",
    },
    {
      command: "check",
      description: "Проверить организацию",
    },
    {
      command: "check_cbr",
      description: "Проверить ЦБР",
    },
    {
      command: "status",
      description: "Статус системы",
    },
    {
      command: "help",
      description: "Справка по командам",
    },
  ];
}

function getPrivateChatAdminCommands(): BotCommand[] {
  return [
    {
      command: "users",
      description: "Список получателей",
    },
    {
      command: "add_users",
      description: "Добавить получателей по telegram_id",
    },
    {
      command: "remove_users",
      description: "Удалить получателей по telegram_id",
    },
    {
      command: "add_admins",
      description: "Добавить администраторов по telegram_id",
    },
    {
      command: "remove_admins",
      description: "Удалить администраторов по telegram_id",
    },
    {
      command: "remove_inn",
      description: "Удалить ИНН из отслеживания",
    },
    {
      command: "setcommands",
      description: "Обновить команды",
    },
  ];
}

export async function setCommandsHandler(ctx: CommandContext<MyContext>) {
  try {
    // Установка команд для обычных пользователей
    await ctx.api.setMyCommands([...getPrivateChatCommands()], {
      scope: {
        type: "all_private_chats",
      },
    });

    // Установка команд для администраторов
    for (const adminId of config.adminUserIds) {
      await ctx.api.setMyCommands(
        [...getPrivateChatCommands(), ...getPrivateChatAdminCommands()],
        {
          scope: {
            type: "chat",
            chat_id: adminId,
          },
        }
      );
    }

    return ctx.reply("✅ Команды обновлены");
  } catch (error) {
    console.error('Error setting commands:', error);
    return ctx.reply("❌ Ошибка при обновлении команд");
  }
}

export { getPrivateChatCommands, getPrivateChatAdminCommands };
