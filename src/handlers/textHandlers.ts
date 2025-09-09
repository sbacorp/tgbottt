import logger from "../utils/logger";
import { MyContext } from "../types";
import { MESSAGES } from "../utils/config";
import { monitoringService } from "../services/monitoringService";
import { cbrService } from "../services/cbrService";
import { PlatformZskService } from "../services/platform_zsk";
import { createCheckResultKeyboard } from "../helpers/keyboard";
import { validateInn } from "../helpers";
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
      const msg = await ctx.reply('🔍 Выполняется проверка организации...\n Это может занять до 60 секунд.');
      try {
        // Контур
        const konturResult = await monitoringService.checkOrganization(inn as string);
        if (!konturResult) {
          await ctx.reply(`❌ Организация с ИНН ${inn} не найдена или не существует`, {
            reply_markup: createCheckResultKeyboard()
          });
          return;
        }

        await ctx.api.editMessageText(
          msg.chat.id,
          msg.message_id,
          '🔍 Проверяю в списках ЦБР...'
        );
        const cbrResult = await cbrService.searchOrganization(inn as string);

        await ctx.api.editMessageText(
          msg.chat.id,
          msg.message_id,
          '🔍 Проверяю в системе ЗСК...'
        );
        let zskResult: any = null;
        try {
          const zsk = new PlatformZskService();
          await zsk.init();
          zskResult = await zsk.checkInn(inn as string);
          await zsk.close();
        } catch (e) {
          logger.error('Error checking ZSK (hears):', e);
        }

        let message = `Запрос: /${inn}\n`;
        message += `Актуальное название компании: ${konturResult.name}\n`;
        if (konturResult.address) message += `Адрес: ${konturResult.address}\n`;

        if (konturResult.isLiquidated) {
          message += `Ликвидированная организация\n`;
        } else {
          message += `Действующая организация\n`;
        }

        message += `\n🚦 ЗСК\n`;
        if (zskResult && zskResult.success && zskResult.result) {
          const cleanResult = zskResult.result.replace('Проверить ещё один ИНН', '').trim();
          message += `📋 Результат проверки: ${cleanResult}\n`;
        } else {
          message += `📋 Результат проверки: Данные временно недоступны\n`;
        }

        let statusIcon = '🟢';
        let statusText = 'ЗЕЛЁНОЙ зоне, низкий риск';
        let riskLevel = '0';
        if (konturResult.status === 'red') {
          statusIcon = '🔴';
          statusText = 'КРАСНОЙ зоне, очень большой риск для работы!';
          riskLevel = '2';
        } else if (konturResult.status === 'orange') {
          statusIcon = '🟡';
          statusText = 'ЖЁЛТОЙ зоне, средний риск для работы';
          riskLevel = '1';
        }
        message += `\nТекущий риск: Уровень риска: ${statusIcon} ${riskLevel} - компания находится в ${statusText}\n`;
        message += `\n==============\n`;

        message += `\n〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️\n`;
        if (cbrResult) {
          message += `По данному ИНН найдены записи в отказах по спискам 764/639/550.\n`;
        } else {
          message += `По данному ИНН записей в отказах по спискам 764/639/550 не найдено.\n`;
        }

        if (konturResult.additionalInfo) {
          message += `📊 ${konturResult.additionalInfo}\n\n`;
        }

        message += `\n🧾 Сведения недостоверны:\n\n`;
        if ((konturResult as any).unreliableInfo) {
          const ur = (konturResult as any);
          message += `${ur.unreliableInfo}${ur.unreliableDate ? ` (дата: ${ur.unreliableDate})` : ''}\n`;
        } else {
          message += `Признаков недостоверности не обнаружено\n`;
        }

        await ctx.reply(message, { reply_markup: createCheckResultKeyboard() });
        return;
      } catch (error) {
        logger.error('Error in inline INN check:', error);
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
