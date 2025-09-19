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
      message += `<b>Название:</b> ${data.name}\n`;
    }

    // Статус организации
    const orgStatusText = {
      active: "Действующая",
      liquidated: "Ликвидированная",
      liquidating: "В процессе ликвидации",
    };
    message += `<b>Статус:</b> ${
      orgStatusText[data.organizationStatus] || data.organizationStatus
    }\n`;

    // Регион
    if (data.region) {
      message += `<b>Регион:</b> ${data.region}\n`;
    }

    message += `\n\n🚦 ЗСК\n`;

    // Добавляем результат проверки ЗСК
    if (zskResult && zskResult.success && zskResult.result) {
      const cleanResult = zskResult.result
        .replace("Проверить ещё один ИНН", "")
        .trim();
      message += `Результат проверки: ${cleanResult}\n`;
    } else {
      message += `Результат проверки: Данные временно недоступны\n`;
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

    // Информация о рисках
    if (data.riskInfo) {
      message += `\n<b>Риски:</b> ${data.riskInfo}\n`;
    }

    // Недостоверные сведения
    if (data.unreliableData) {
      message += `\n❌ <b>Недостоверность сведений:</b>\n`;
      message += `Адрес: ${data.unreliableData.address ? "Да" : "Нет"}\n`;
      message += `Директор: ${data.unreliableData.director ? "Да" : "Нет"}\n`;
      message += `Учредители: ${data.unreliableData.founders ? "Да" : "Нет"}\n`;
      if (data.unreliableData.updateDate) {
        message += `📅 <b>Обновлено:</b> ${data.unreliableData.updateDate}\n`;
      }
    }

    // Проверка по спискам ЦБ РФ
    message += `<b>Отказы по спискам 764/639/550:</b> ${
      data.hasRejectionsByLists ? "Да" : "Нет"
    }\n`;

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
    if (
      newData.organizationStatus === "liquidated" ||
      newData.organizationStatus === "liquidating"
    ) {
      eventInfo = `📅 <b>Статус организации:</b> ${
        newData.organizationStatus === "liquidated"
          ? "Ликвидирована"
          : "В процессе ликвидации"
      }\n\n`;
    } else if (newData.unreliableData?.updateDate) {
      eventInfo = `📅 <b>Дата недостоверных сведений:</b> ${newData.unreliableData.updateDate}\n\n`;
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
      message += `<b>Обновлено:</b> ${new Date().toLocaleDateString(
        "ru-RU"
      )}`;
    }

    return message;
  }
}
