import { InlineKeyboard } from "grammy";

export function createMainMenuKeyboard(isAdmin: boolean = false) {
  const keyboard = new InlineKeyboard()
    .text("📋 Список организаций", "organizations_list")
    .text("➕ Добавить ИНН", "add_inn")
    .row();

  if (isAdmin) {
    keyboard
      .text("👥 Список получателей", "users_list")
      .text("⚙️ Управление получателями", "manage_users")
      .row()
      .text("🔧 Управление администраторами", "manage_admins")
      .row();
  }

  return keyboard;
}

export function createBackKeyboard(backAction: string = "menu") {
  return new InlineKeyboard()
    .text("🔙 Назад", backAction);
}

export function createManageUsersKeyboard() {
  return new InlineKeyboard()
    .text("➕ Добавить пользователей", "add_users")
    .text("➖ Удалить пользователей", "remove_users")
    .row()
    .text("🔙 Назад", "menu");
}

export function createManageAdminsKeyboard() {
  return new InlineKeyboard()
    .text("➕ Добавить администратора", "add_admin")
    .text("➖ Удалить администратора", "remove_admin")
    .row()
    .text("🔙 Назад", "menu");
}

export function createCancelKeyboard() {
  return new InlineKeyboard()
    .text("❌ Отменить", "cancel_conversation");
}
