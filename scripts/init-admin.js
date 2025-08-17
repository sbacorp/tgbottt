import dotenv from 'dotenv';
import { database } from '../dist/database/index.js';
import { createAdminUser } from '../dist/handlers/commandHandlers.js';

// Загрузка переменных окружения
dotenv.config();

async function initAdmin() {
  try {
    console.log('Connecting to database...');
    await database.connect();
    console.log('Database connected successfully');

    // Получаем ID администраторов из конфигурации
    const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id.trim())) || [];
    
    if (adminIds.length === 0) {
      console.log('No admin IDs found in ADMIN_USER_IDS environment variable');
      return;
    }

    console.log(`Found ${adminIds.length} admin IDs:`, adminIds);

    // Создаем администраторов
    for (const adminId of adminIds) {
      try {
        await createAdminUser(adminId);
        console.log(`✅ Admin user ${adminId} created/updated successfully`);
      } catch (error) {
        console.error(`❌ Error creating admin user ${adminId}:`, error);
      }
    }

    console.log('Admin initialization completed');
  } catch (error) {
    console.error('Error during admin initialization:', error);
  } finally {
    await database.disconnect();
    console.log('Database disconnected');
  }
}

// Запуск скрипта
initAdmin().catch(console.error);
