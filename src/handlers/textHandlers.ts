import logger from "../utils/logger";
import { MyContext } from "../types";
import { MESSAGES } from "../utils/config";
import { monitoringService } from "../services/monitoringService";
import { PlatformZskService } from "../services/platform_zsk";
import { createCheckResultKeyboard } from "../helpers/keyboard";
import { NotificationFormatter } from "../helpers/notificationFormatter";
import { validateInn } from "../utils/validation";
/**
 * Обработчик текстовых сообщений
 * Теперь большая часть логики обрабатывается в conversations
 */
export async function handleText(ctx: MyContext): Promise<void> {
  try {
    if (!ctx.session.isRegistered) {
      await ctx.reply(MESSAGES.notRegistered);
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      return;
    }

    // Обработка дефолтного текста (если не в conversation)
    await handleDefaultText(ctx, text);
  } catch (error) {
    logger.error("Error in handleText:", error);
    await ctx.reply(MESSAGES.error);
  }
}

/**
 * Обработчик обычного текста (не команды)
 */
async function handleDefaultText(ctx: MyContext, text: string): Promise<void> {
  // Проверка на ИНН в тексте
  const innRegex = /\b\d{10,12}\b/g;
  const possibleInns = text.match(innRegex);

  if (possibleInns && possibleInns.length > 0) {
    const validInns = possibleInns.filter((inn) => validateInn(inn));

    if (validInns.length > 0) {
      const inn = validInns[0];
      const msg = await ctx.reply(
        "🔍 Выполняется проверка организации...\n Это может занять до 60 секунд."
      );
      try {
        // Контур
        const konturResult = await monitoringService.checkOrganization(
          inn as string
        );
        if (!konturResult) {
          await ctx.reply(
            `❌ Организация с ИНН ${inn} не найдена или не существует`,
            {
              reply_markup: createCheckResultKeyboard(),
            }
          );
          return;
        }

        await ctx.api.editMessageText(
          msg.chat.id,
          msg.message_id,
          "🔍 Проверяю в списках ЦБР..."
        );

        await ctx.api.editMessageText(
          msg.chat.id,
          msg.message_id,
          "🔍 Проверяю в системе ЗСК..."
        );
        let zskResult: any = null;
        try {
          const zsk = new PlatformZskService();
          await zsk.init();
          zskResult = await zsk.checkInn(inn as string);
          await zsk.close();
        } catch (e) {
          logger.error("Error checking ZSK (hears):", e);
        }

        const messageHeader = NotificationFormatter.formatOrganizationCheck(
          inn as string,
          konturResult,
          zskResult,
          {
            showTimestamp: true,
            showRiskInfo: true,
            showIllegalActivity: true,
          }
        );

        await ctx.reply(messageHeader, {
          reply_markup: createCheckResultKeyboard(),
          parse_mode: "HTML",
        });
        return;
      } catch (error) {
        logger.error("Error in inline INN check:", error);
        await ctx.reply(MESSAGES.error);
        return;
      }
    }
  }

  // Если текст не содержит ИНН, показываем помощь
  await ctx.reply(
    "💡 Я могу помочь вам:\n\n" +
      "🔍 Для проверки организации используйте: /check\n" +
      "📋 Для просмотра меню: /start\n" +
      "❓ Для справки по командам: /help"
  );
}
