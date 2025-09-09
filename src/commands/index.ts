/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { BotCommand } from "@grammyjs/types";
import { CommandContext } from "grammy";
import { config } from "../utils/config";
import type { MyContext } from "../types";

// Импорт всех команд
export { handleStart } from './start';
export { handleCheck } from './check';
export { handleCheckCbr } from './checkCbr';
export { handleStatus } from './status';
export { handleHelp } from './help';
export { handleAddAdmins } from './addAdmins';
export { handleRemoveAdmins } from './removeAdmins';
export { handleDeleteGroup } from './removeGroup';

function getPrivateChatCommands(): BotCommand[] {
  return [
    {
      command: "start",
      description: "Запуск бота",
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
      command: "help",
      description: "Справка по командам",
    },
  ];
}

function getPrivateChatAdminCommands(): BotCommand[] {
  return [
    {
      command: "add_admins",
      description: "Добавить администраторов по telegram_id",
    },
    {
      command: "remove_admins",
      description: "Удалить администраторов по telegram_id",
    },
    {
      command: "status",
      description: "Статус системы",
    },
    {
      command: "setcommands",
      description: "Обновить команды",
    },
    {
      command: "delete_group",
      description: "Удалить мою группу",
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
