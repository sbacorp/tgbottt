import { InlineKeyboard, Context } from "grammy";
import type { MyConversation } from "../types";
import { database } from "../database";
import logger from "../utils/logger";

export async function newsletterConversation(conversation: MyConversation, ctx: Context) {
  const session = await conversation.external((ctx) => (ctx as any).session);
  if (!session?.isAdmin) {
    await ctx.reply("❌ Эта функция доступна только администраторам.");
    return;
  }

  await ctx.reply("✉️ Рассылка: введите заголовок (он будет выделен жирным)");
  const titleMsg = await conversation.wait();
  const title = titleMsg.message?.text?.trim();
  if (!title) {
    await ctx.reply("❌ Не удалось прочитать заголовок. Попробуйте снова: /newsletter");
    return;
  }

  await ctx.reply("📝 Введите текст рассылки (обычный текст)");
  const bodyMsg = await conversation.wait();
  const body = bodyMsg.message?.text?.trim();
  if (!body) {
    await ctx.reply("❌ Не удалось прочитать текст. Попробуйте снова: /newsletter");
    return;
  }

  const kbYesNo = new InlineKeyboard()
    .text("Да", "add_photo_yes")
    .text("Нет", "add_photo_no");
  await ctx.reply("🖼 Добавить фото?", { reply_markup: kbYesNo });

  const cb = await conversation.waitFor("callback_query:data");
  let photoFileId: string | null = null;

  if (cb.callbackQuery?.data === "add_photo_yes") {
    await ctx.reply("Отправьте фото одним сообщением. Или напишите /skip чтобы пропустить.");
    const photoOrSkip = await conversation.wait();

    if (photoOrSkip.message?.text === "/skip") {
      // no photo
    } else if (photoOrSkip.message?.photo && photoOrSkip.message.photo.length > 0) {
      const sizes = photoOrSkip.message.photo;
      if (sizes && sizes.length > 0) {
        photoFileId = sizes[sizes.length - 1]!.file_id;
      }
    } else {
      await ctx.reply("❌ Фото не получено. Пропускаю фото.");
    }
  }

  const composed = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;

  // Preview
  try {
    if (photoFileId) {
      await ctx.api.sendPhoto(ctx.chat!.id, photoFileId, { caption: composed, parse_mode: "HTML" });
    } else {
      await ctx.api.sendMessage(ctx.chat!.id, composed, { parse_mode: "HTML" });
    }
  } catch (e) {
    logger.error("Error sending preview:", e);
  }

  const kbConfirm = new InlineKeyboard()
    .text("Отправить", "confirm_send")
    .text("Отмена", "confirm_cancel");
  await ctx.reply("Подтвердите отправку рассылки", { reply_markup: kbConfirm });

  const confirmCb = await conversation.waitFor("callback_query:data");
  if (confirmCb.callbackQuery?.data !== "confirm_send") {
    await ctx.reply("❎ Рассылка отменена");
    return;
  }

  await ctx.reply("🚀 Начинаю рассылку... Это может занять время.");

  // Fetch all users
  let users: { telegram_id: number }[] = [];
  try {
    users = (await database.getAllUsers()).map(u => ({ telegram_id: u.telegram_id }));
  } catch (e) {
    logger.error("Error fetching users for newsletter:", e);
    await ctx.reply("❌ Ошибка получения списка пользователей");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const u of users) {
    try {
      if (photoFileId) {
        await ctx.api.sendPhoto(u.telegram_id, photoFileId, { caption: composed, parse_mode: "HTML" });
      } else {
        await ctx.api.sendMessage(u.telegram_id, composed, { parse_mode: "HTML" });
      }
      sent += 1;
    } catch (e) {
      failed += 1;
      logger.error(`Error sending newsletter to ${u.telegram_id}:`, e);
    }

    // Basic pacing to avoid hitting flood limits
    await sleep(100);
  }

  await ctx.reply(`✅ Рассылка завершена\nУспешно: ${sent}\nОшибок: ${failed}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
