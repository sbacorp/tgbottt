import { database } from "../database/index";

export async function addOrganizations(inns: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const inn of inns) {
    try {
      await database.addOrganization({
        inn,
        name: `Организация ${inn}`,
        status: 'green'
      });
      success.push(inn);
    } catch (error) {
      console.error(`Error adding organization ${inn}:`, error);
      failed.push(inn);
    }
  }

  return { success, failed };
}

export async function removeOrganizations(inns: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const inn of inns) {
    try {
      const org = await database.getOrganizationByInn(inn);
      if (org) {
        await database.deleteOrganization(inn);
        success.push(inn);
      } else {
        failed.push(inn);
      }
    } catch (error) {
      console.error(`Error removing organization ${inn}:`, error);
      failed.push(inn);
    }
  }

  return { success, failed };
}

export async function addUsers(usernames: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const username of usernames) {
    try {
      // Здесь должна быть логика получения telegram_id по username
      console.log(`Would add user with username: ${username}`);
      success.push(username);
    } catch (error) {
      console.error(`Error adding user ${username}:`, error);
      failed.push(username);
    }
  }

  return { success, failed };
}

export async function removeUsers(usernames: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const username of usernames) {
    try {
      // Здесь должна быть логика удаления пользователя по username
      console.log(`Would remove user with username: ${username}`);
      success.push(username);
    } catch (error) {
      console.error(`Error removing user ${username}:`, error);
      failed.push(username);
    }
  }

  return { success, failed };
}

export async function addAdmins(usernames: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const username of usernames) {
    try {
      // Здесь должна быть логика назначения администратора
      console.log(`Would make ${username} an admin`);
      success.push(username);
    } catch (error) {
      console.error(`Error making ${username} admin:`, error);
      failed.push(username);
    }
  }

  return { success, failed };
}

export async function removeAdmins(usernames: string[]): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const username of usernames) {
    try {
      // Здесь должна быть логика снятия прав администратора
      console.log(`Would remove admin rights from ${username}`);
      success.push(username);
    } catch (error) {
      console.error(`Error removing admin rights from ${username}:`, error);
      failed.push(username);
    }
  }

  return { success, failed };
}
