import { STATUS_EMOJIS, STATUS_MESSAGE } from "../utils/config";

export function formatOrganizationList(organizations: any[]): string {
  if (organizations.length === 0) {
    return "📋 Список отслеживаемых организаций пуст.";
  }

  let message = "📋 Список отслеживаемых организаций:\n\n";
  console.log(organizations, 'organizations')
  
  for (const org of organizations) {
    const emoji = STATUS_EMOJIS[org.status as keyof typeof STATUS_EMOJIS];
    const statusMessage = STATUS_MESSAGE[org.status as keyof typeof STATUS_MESSAGE];
    
    message += `${emoji} <b>${org.inn}</b>\n`;
    message += `   Актуальное название компании: ${org.name || 'Не указано'}\n`;
    message += `   Обновлено: ${org.undated_at ? org.undated_at.toLocaleDateString('ru-RU') : 'Не указано'}\n`;
    message += `   Регион: ${org.region || 'Не указано'}\n`;
    
    message += `\n${statusMessage}\n\n`;
    // Добавляем информацию о рисках для оранжевого статуса
    if (org.status === 'orange' && org.riskInfo) {
      message += `   ⚠️ Риски: ${org.riskInfo}\n`;
    }
    
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

export function formatCheckResult(inn: string, result: any): string {
  let riskEmoji = '❓';
  if (result.riskLevel === 'high') riskEmoji = '🔴';
  else if (result.riskLevel === 'medium') riskEmoji = '🟡';
  else if (result.riskLevel === 'low') riskEmoji = '🟢';
  
  let message = `📊 <b>Результат проверки ИНН ${inn}</b>\n\n`;
  message += `${riskEmoji} <b>Уровень риска:</b> ${result.riskLevel}\n`;
  message += `📝 <b>Сообщение:</b> ${result.message}\n`;
  
  if (result.details) {
    message += `\n📈 <b>Детали:</b>\n`;
    if (result.details.liquidationFacts && result.details.liquidationFacts > 0) {
      message += `🔴 Факты ликвидации/банкротства: ${result.details.liquidationFacts}\n`;
    }
    if (result.details.attentionFacts && result.details.attentionFacts > 0) {
      message += `� Факты внимания: ${result.details.attentionFacts}\n`;
    }
    if (result.details.favorableFacts && result.details.favorableFacts > 0) {
      message += `🟢 Благоприятные факты: ${result.details.favorableFacts}\n`;
    }
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
