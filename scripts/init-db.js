#!/usr/bin/env node

/**
 * Скрипт для инициализации базы данных
 * Создает таблицы и добавляет первичные данные
 */

const { Client } = require('pg');
require('dotenv').config();

// Первичные ИНН для отслеживания
const INITIAL_INNS = [
  '9704209904',
  '9719075594', 
  '7720942551',
  '7720943749',
  '9719075989',
  '9719076044',
  '5024250841',
  '9729401367',
  '9726098881',
  '9728156881',
  '9727107641'
];

async function initDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Подключение к базе данных...');
    await client.connect();
    console.log('✅ Подключение успешно');

    // Создание таблиц
    console.log('📋 Создание таблиц...');
    
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createOrganizationsTable = `
      CREATE TABLE IF NOT EXISTS tracked_organizations (
        id SERIAL PRIMARY KEY,
        inn VARCHAR(12) UNIQUE NOT NULL,
        name VARCHAR(500),
        status VARCHAR(20) DEFAULT 'green',
        address TEXT,
        websites TEXT[],
        is_liquidated BOOLEAN DEFAULT FALSE,
        illegality_signs TEXT[],
        region VARCHAR(255),
        additional_info TEXT,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createChecksTable = `
      CREATE TABLE IF NOT EXISTS organization_checks (
        id SERIAL PRIMARY KEY,
        inn VARCHAR(12) NOT NULL,
        check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        details JSONB,
        notified BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
      );
    `;

    const createUserOrganizationsTable = `
      CREATE TABLE IF NOT EXISTS user_organizations (
        user_id INTEGER NOT NULL,
        inn VARCHAR(12) NOT NULL,
        PRIMARY KEY (user_id, inn),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
      );
    `;

    await client.query(createUsersTable);
    await client.query(createOrganizationsTable);
    await client.query(createChecksTable);
    await client.query(createUserOrganizationsTable);
    
    console.log('✅ Таблицы созданы успешно');

    // Добавление первичных ИНН
    console.log('🏢 Добавление первичных организаций...');
    
    for (const inn of INITIAL_INNS) {
      try {
        await client.query(
          `INSERT INTO tracked_organizations (inn, name, status)
           VALUES ($1, $2, $3)
           ON CONFLICT (inn) DO NOTHING`,
          [inn, `Организация ${inn}`, 'green']
        );
        console.log(`✅ Добавлена организация: ${inn}`);
      } catch (error) {
        console.log(`⚠️  Организация ${inn} уже существует`);
      }
    }

    // Создание индексов для оптимизации
    console.log('📊 Создание индексов...');
    
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);',
      'CREATE INDEX IF NOT EXISTS idx_organizations_inn ON tracked_organizations(inn);',
      'CREATE INDEX IF NOT EXISTS idx_organizations_status ON tracked_organizations(status);',
      'CREATE INDEX IF NOT EXISTS idx_checks_inn ON organization_checks(inn);',
      'CREATE INDEX IF NOT EXISTS idx_checks_date ON organization_checks(check_date);',
      'CREATE INDEX IF NOT EXISTS idx_user_org_user_id ON user_organizations(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_user_org_inn ON user_organizations(inn);'
    ];

    for (const indexQuery of createIndexes) {
      await client.query(indexQuery);
    }
    
    console.log('✅ Индексы созданы успешно');

    // Проверка данных
    console.log('🔍 Проверка данных...');
    
    const orgCount = await client.query('SELECT COUNT(*) FROM tracked_organizations');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    
    console.log(`📊 Статистика базы данных:`);
    console.log(`   Организаций: ${orgCount.rows[0].count}`);
    console.log(`   Пользователей: ${userCount.rows[0].count}`);

    console.log('🎉 Инициализация базы данных завершена успешно!');

  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Запуск скрипта
if (require.main === module) {
  initDatabase().catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { initDatabase };
