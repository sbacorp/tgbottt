import { KonturOrganizationData } from "../services/playwrightScrapeService";

export interface NotificationOptions {
  showTimestamp?: boolean;
  showRiskInfo?: boolean;
  showIllegalActivity?: boolean;
  customMessage?: string;
}

export class NotificationFormatter {
  /**
   * Формирует сообщение о проверке организации
   */
  static formatOrganizationCheck(
    inn: string,
    data: KonturOrganizationData,
    zskResult?: {
      success: boolean;
      result: string;
    },
    options: NotificationOptions = {}
  ): string {
    const { customMessage } = options;

    let message = `Запрос: /${inn}\n`;

    // Основная информация
    if (data.name) {
      message += `🏢 <b>Название:</b> ${data.name}\n`;
    }

    if (data.region) {
      message += `📍 <b>Регион:</b> ${data.region}\n`;
    }

    // Даты
    if (data.registrationDate) {
      message += `📅 <b>Дата регистрации:</b> ${data.registrationDate}\n`;
    }
    if (data.liquidationDate) {
      message += `⚠️ <b>Дата ликвидации:</b> ${data.liquidationDate}\n`;
    }
    if (data.unreliableDate) {
      message += `❌ <b>Дата недостоверных сведений:</b> ${data.unreliableDate}\n`;
    }

    // Виды деятельности
    if (data.activities && data.activities.length > 0) {
      message += `🔧 <b>Основной вид деятельности:</b> ${data.activities.join(
        ", "
      )}\n`;
    }

    // Веб-сайты
    if (data.websites && data.websites.length > 0) {
      message += `🌐 <b>Веб-сайты:</b> ${data.websites.join(", ")}\n`;
    }

    message += `\n\n🚦 ЗСК\n`;

    // Добавляем результат проверки ЗСК
    if (zskResult && zskResult.success && zskResult.result) {
      const cleanResult = zskResult.result
        .replace("Проверить ещё один ИНН", "")
        .trim();
      message += `📋 Результат проверки: ${cleanResult}\n`;
    } else {
      message += `📋 Результат проверки: Данные временно недоступны\n`;
    }

    // Определяем статус на основе данных Контур.Фокус
    let statusIcon = "🟢";
    let statusText = "ЗЕЛЁНОЙ зоне, низкий риск";
    let riskLevel = "0";

    if (data.status === "red") {
      statusIcon = "🔴";
      statusText = "КРАСНОЙ зоне, очень большой риск для работы!";
      riskLevel = "2";
    } else if (data.status === "orange") {
      statusIcon = "🟡";
      statusText = "ЖЁЛТОЙ зоне, средний риск для работы";
      riskLevel = "1";
    }

    message += `\nТекущий риск:\n Уровень риска: ${statusIcon} ${riskLevel} - компания находится в ${statusText}\n`;
    message += `\n==============\n`;

    // Основной риск и дата
    if (data.primaryRisk) {
      message += `\n⚠️ <b>Основной риск:</b> ${data.primaryRisk}\n`;
    }
    if (data.primaryRiskDate) {
      message += `📅 <b>Обновлено:</b> ${data.primaryRiskDate}\n`;
    }

    // Недостоверные сведения
    if (data.unreliableInfo) {
      message += `\n❌ <b>Недостоверные сведения:</b> ${data.unreliableInfo}\n`;
      if (data.unreliableDate) {
        message += `📅 <b>Дата:</b> ${data.unreliableDate}\n`;
      }
    }

    // Дополнительная информация
    if (data.additionalInfo) {
      message += `\n📋 <b>Дополнительная информация:</b>\n${data.additionalInfo}\n`;
    }

    // Комментарий
    if (data.comment) {
      message += `\n💬 <b>Комментарий:</b> ${data.comment}\n`;
    }

    // Кастомное сообщение
    if (customMessage) {
      message += `\n${customMessage}\n`;
    }

    return message;
  }

  /**
   * Формирует сообщение об изменении статуса
   */
  static formatStatusChange(
    inn: string,
    oldStatus: string,
    newData: KonturOrganizationData,
    newZsk?: {
      rezult: string;
      success: boolean;
    },
    options: NotificationOptions = {}
  ): string {
    if (newZsk) {
    }

    const statusEmojis = {
      red: "🔴",
      orange: "🟡",
      green: "🟢",
    };

    const statusNames = {
      red: "Красный список",
      orange: "Желтый список",
      green: "Зеленый список",
    };

    const oldEmoji =
      statusEmojis[oldStatus as keyof typeof statusEmojis] || "⚪";
    const newEmoji =
      statusEmojis[newData.status as keyof typeof statusEmojis] || "⚪";
    const oldName =
      statusNames[oldStatus as keyof typeof statusNames] || "Неизвестно";
    const newName =
      statusNames[newData.status as keyof typeof statusNames] || "Неизвестно";

    const header = `🔄 <b>Изменение статуса организации</b>\n\n`;
    const statusChange = `${oldEmoji} ${oldName} → ${newEmoji} ${newName}\n\n`;

    // Добавляем информацию о дате события
    let eventInfo = "";
    if (newData.liquidationDate && newData.isLiquidated) {
      eventInfo = `📅 <b>Дата ликвидации:</b> ${newData.liquidationDate}\n\n`;
    } else if (newData.unreliableDate) {
      eventInfo = `📅 <b>Дата недостоверных сведений:</b> ${newData.unreliableDate}\n\n`;
    }

    return (
      header +
      statusChange +
      eventInfo +
      this.formatOrganizationCheck(inn, newData, undefined, {
        ...options,
        showTimestamp: true,
      })
    );
  }

  /**
   * Формирует сообщение о проверке ЗСК
   */
  static formatZskCheck(
    inn: string,
    status: string,
    resultText: string,
    options: NotificationOptions = {}
  ): string {
    const statusIcon = status === "red" ? "🔴" : "🟢";
    const statusText =
      status === "red" ? "Найдены нарушения" : "Нарушений не найдено";

    let message = `🔍 <b>Проверка через ЗСК</b>\n\n`;
    message += `${statusIcon} <b>Статус:</b> ${statusText}\n`;
    message += `🔢 <b>ИНН:</b> ${inn}\n\n`;
    message += `📋 <b>Результат проверки:</b>\n${resultText}\n\n`;

    if (options.showTimestamp !== false) {
      message += `➕ <b>Обновлено:</b> ${new Date().toLocaleDateString(
        "ru-RU"
      )}`;
    }

    return message;
  }

  /**
   * Формирует краткое сообщение для быстрой проверки
   */
  static formatQuickCheck(inn: string, data: KonturOrganizationData): string {
    const statusEmojis = {
      red: "🔴",
      orange: "🟡",
      green: "🟢",
    };

    const emoji = statusEmojis[data.status] || "⚪";

    let message = `${emoji} <b>${data.name || `Организация ${inn}`}</b>\n`;
    message += `🔢 ИНН: ${inn}\n`;
    message += `📍 ${data.region || data.address || "Адрес не указан"}\n`;

    if (data.isLiquidated) {
      message += `⚠️ Ликвидирована\n`;
    }

    if (data.hasIllegalActivity) {
      message += `🚨 Нарушения ЦБ РФ\n`;
    }

    return message;
  }
}
