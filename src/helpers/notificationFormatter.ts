import { KonturOrganizationData } from '../services/playwrightScrapeService';
import { formatCheckResult } from './messages';

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
    options: NotificationOptions = {}
  ): string {
    const {
      showTimestamp = true,
      showRiskInfo = true,
      showIllegalActivity = true,
      customMessage
    } = options;

    let message = '';

    // Заголовок с статусом
    const statusMessage = formatCheckResult(data.status);
    message += `${statusMessage}\n\n`;

    // Основная информация
    if (data.name) {
      message += `🏢 <b>Название:</b> ${data.name}\n`;
    }
    
    message += `🔢 <b>ИНН:</b> ${inn}\n`;

    // Адрес и регион
    if (data.address) {
      message += `📍 <b>Адрес:</b> ${data.address}\n`;
    } else if (data.region) {
      message += `📍 <b>Регион:</b> ${data.region}\n`;
    }

    // Основные реквизиты
    if (data.ogrn) {
      message += `📋 <b>ОГРН:</b> ${data.ogrn}\n`;
    }
    if (data.kpp) {
      message += `📋 <b>КПП:</b> ${data.kpp}\n`;
    }
    if (data.okpo) {
      message += `📋 <b>ОКПО:</b> ${data.okpo}\n`;
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

    // Статус ликвидации
    if (data.isLiquidated !== undefined) {
      message += `⚠️ <b>Ликвидирована:</b> ${data.isLiquidated ? 'Да' : 'Нет'}\n`;
    }

    // Налоговый орган
    if (data.taxAuthority) {
      message += `🏛️ <b>Налоговый орган:</b> ${data.taxAuthority}\n`;
    }

    // Уставный капитал
    if (data.capital) {
      message += `💰 <b>Уставный капитал:</b> ${data.capital}\n`;
    }

    // Виды деятельности
    if (data.activities && data.activities.length > 0) {
      message += `🔧 <b>Основной вид деятельности:</b> ${data.activities.join(', ')}\n`;
    }

    // Учредители
    if (data.founders && data.founders.length > 0) {
      message += `👥 <b>Учредители:</b> ${data.founders.join(', ')}\n`;
    }

    // Веб-сайты
    if (data.websites && data.websites.length > 0) {
      message += `🌐 <b>Веб-сайты:</b> ${data.websites.join(', ')}\n`;
    }

    // Признаки нелегальности
    if (data.illegalitySigns && data.illegalitySigns.length > 0) {
      message += `🚨 <b>Признаки нелегальности:</b> ${data.illegalitySigns.join(', ')}\n`;
    }

    // Информация о рисках
    if (showRiskInfo && data.riskInfo) {
      message += `\n⚠️ <b>Информация о рисках:</b>\n${data.riskInfo}\n`;
    }

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

    // Нелегальная деятельность (ЦБ РФ)
    if (showIllegalActivity && data.hasIllegalActivity !== undefined) {
      message += `\n🏦 <b>Проверка ЦБ РФ:</b> ${data.hasIllegalActivity ? '❌ Найдена нелегальная деятельность' : '✅ Нарушений не найдено'}\n`;
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

    // Временная метка
    if (showTimestamp) {
      message += `\n➕ <b>Обновлено:</b> ${new Date().toLocaleDateString('ru-RU')}`;
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
    options: NotificationOptions = {}
  ): string {
    const statusEmojis = {
      red: '🔴',
      orange: '🟡',
      green: '🟢'
    };

    const statusNames = {
      red: 'Красный список',
      orange: 'Желтый список', 
      green: 'Зеленый список'
    };

    const oldEmoji = statusEmojis[oldStatus as keyof typeof statusEmojis] || '⚪';
    const newEmoji = statusEmojis[newData.status as keyof typeof statusEmojis] || '⚪';
    const oldName = statusNames[oldStatus as keyof typeof statusNames] || 'Неизвестно';
    const newName = statusNames[newData.status as keyof typeof statusNames] || 'Неизвестно';

    const header = `🔄 <b>Изменение статуса организации</b>\n\n`;
    const statusChange = `${oldEmoji} ${oldName} → ${newEmoji} ${newName}\n\n`;
    
    // Добавляем информацию о дате события
    let eventInfo = '';
    if (newData.liquidationDate && newData.isLiquidated) {
      eventInfo = `📅 <b>Дата ликвидации:</b> ${newData.liquidationDate}\n\n`;
    } else if (newData.unreliableDate) {
      eventInfo = `📅 <b>Дата недостоверных сведений:</b> ${newData.unreliableDate}\n\n`;
    }

    return header + statusChange + eventInfo + this.formatOrganizationCheck(inn, newData, {
      ...options,
      showTimestamp: true
    });
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
    const statusIcon = status === 'red' ? '🔴' : '🟢';
    const statusText = status === 'red' ? 'Найдены нарушения' : 'Нарушений не найдено';

    let message = `🔍 <b>Проверка через ЗСК</b>\n\n`;
    message += `${statusIcon} <b>Статус:</b> ${statusText}\n`;
    message += `🔢 <b>ИНН:</b> ${inn}\n\n`;
    message += `📋 <b>Результат проверки:</b>\n${resultText}\n\n`;

    if (options.showTimestamp !== false) {
      message += `➕ <b>Обновлено:</b> ${new Date().toLocaleDateString('ru-RU')}`;
    }

    return message;
  }

  /**
   * Формирует краткое сообщение для быстрой проверки
   */
  static formatQuickCheck(
    inn: string,
    data: KonturOrganizationData
  ): string {
    const statusEmojis = {
      red: '🔴',
      orange: '🟡',
      green: '🟢'
    };

    const emoji = statusEmojis[data.status] || '⚪';
    
    let message = `${emoji} <b>${data.name || `Организация ${inn}`}</b>\n`;
    message += `🔢 ИНН: ${inn}\n`;
    message += `📍 ${data.region || data.address || 'Адрес не указан'}\n`;
    
    if (data.isLiquidated) {
      message += `⚠️ Ликвидирована\n`;
    }
    
    if (data.hasIllegalActivity) {
      message += `🚨 Нарушения ЦБ РФ\n`;
    }

    return message;
  }
}
