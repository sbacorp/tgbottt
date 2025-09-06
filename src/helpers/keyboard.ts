import { InlineKeyboard } from "grammy";

export function createMainMenuKeyboard() {
  const keyboard = new InlineKeyboard()
    .text("📋 Отслеживание", "tracking_menu")
    .row()
    .text("➕ Разовая проверка по ИНН", "single_check");
  return keyboard;
}


export function createBackKeyboard(backAction: string = "menu") {
  return new InlineKeyboard()
    .text("🔙 Назад", backAction);
}

export function createManageAdminsKeyboard() {
  return new InlineKeyboard()
    .text("➕ Добавить администратора", "add_admin")
    .text("➖ Удалить администратора", "remove_admin")
    .row()
    .text("🔙 Назад", "menu");
}

export function createCancelKeyboard(backAction?: string, backText: string = "🔙 Назад") {
  return new InlineKeyboard()
    .text(backAction ? backText : "❌ Отменить", backAction || "cancel_conversation");
}

export function createBackToTrackingKeyboard() {
  return new InlineKeyboard()
    .text("🔙 Назад к управлению", "back_to_tracking");
}

export function createCheckResultKeyboard() {
  return new InlineKeyboard()
    .text("🔍 Проверить еще один ИНН", "single_check")
    .row()
    .text("🔙 В главное меню", "menu");
}
