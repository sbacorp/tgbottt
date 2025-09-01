import { STATUS_EMOJIS } from "../utils/config";

export function formatOrganizationList(organizations: any[]): string {
  if (organizations.length === 0) {
    return "📋 Список отслеживаемых организаций пуст.";
  }

  let message = "📋 Список отслеживаемых организаций:\n\n";
  console.log(organizations, 'organizations')
  
  for (const org of organizations) {
    const emoji = STATUS_EMOJIS[org.status as keyof typeof STATUS_EMOJIS];
    const statusMessage = formatCheckResult(org.status);
    
    message += `${emoji} <b>${org.inn}</b>\n`;
    message += `   Актуальное название компании: ${org.name || 'Не указано'}\n`;
    message += `   Обновлено: ${org.undated_at ? org.undated_at.toLocaleDateString('ru-RU') : 'Не указано'}\n`;
    message += `   Регион: ${org.region || 'Не указано'}\n`;
    
    // Добавляем информацию о рисках для оранжевого статуса
    if (org.status === 'orange' && org.riskInfo) {
      message += `   ⚠️ Риски: ${org.riskInfo}\n`;
    }
    
    message += `\n${statusMessage}\n\n`;
    
  }

  return message;
}

export function formatUsersList(users: any[]): string {
  if (users.length === 0) {
    return "👥 Список получателей пуст.";
  }

  let message = "👥 Список получателей (актуальный):\n\n";
  
  for (const user of users) {
    const adminBadge = user.isAdmin ? ' Администратор' : '';
    const username = user.username ? `@${user.username}` : `ID: ${user.telegramId}`;
    
    message += `${username}${adminBadge}\n`;
  }

  return message;
}

export function formatCheckResult(status: any): string {

  let message = '';
  if (status === 'red') {
    message += `🔴 <b>Уровень риска:</b> Внимание! Компания находится в красной зоне.\n`;
    message += `🚫 <b>Рекомендация:</b> работать с данной компанией не рекомендуется.\n`;
  } else if (status === 'orange') {
    message += `🟡 <b>Уровень риска:</b> Средний уровень риска.\n`;
    message += `⚠️ <b>Рекомендация:</b> работать с осторожностью\n`;
  } else if (status === 'green') {
    message += `🟢 <b>Уровень риска:</b> Низкий уровень риска.\n`;
    message += `✅ <b>Рекомендация:</b> работа с компанией одобрена\n`;
  } else {
    message += `🟢 <b>Уровень риска:</b> Низкий уровень риска.\n`;
    message += `✅ <b>Рекомендация:</b> работа с компанией одобрена\n`;
  }
  return message;
}

export function formatSystemStatus(status: any, organizations: any[], users: any[]): string {
  let message = '📊 Статус системы:\n\n';
  message += `🔄 Мониторинг: ${status.isRunning ? '✅ Запущен' : '❌ Остановлен'}\n`;
  
  if (status.lastCheck) {
    message += `🕐 Последняя проверка: ${status.lastCheck.toLocaleString('ru-RU')}\n`;
  }

  const redCount = organizations.filter(org => org.status === 'red').length;
  const orangeCount = organizations.filter(org => org.status === 'orange').length;
  const greenCount = organizations.filter(org => org.status === 'green').length;

  message += `\n📈 Статистика:\n`;
  message += `🏢 Организаций: ${organizations.length}\n`;
  message += `🔴 Красный список: ${redCount}\n`;
  message += `🟡 Желтый список: ${orangeCount}\n`;
  message += `🟢 Зелёный список: ${greenCount}\n`;
  message += `👥 Пользователей: ${users.length}`;

  return message;
}
