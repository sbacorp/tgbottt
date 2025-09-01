const { Pool } = require('pg');
const config = require('../dist/utils/config').config;

async function updateDatabase() {
  const client = new Pool({
    connectionString: config.databaseUrl,
  });

  try {
    console.log('Подключение к базе данных...');
    await client.connect();
    console.log('Подключение установлено');

    // Добавляем поле zsk_status в таблицу tracked_organizations
    console.log('Добавление поля zsk_status...');
    await client.query(`
      ALTER TABLE tracked_organizations 
      ADD COLUMN IF NOT EXISTS zsk_status VARCHAR(20) DEFAULT 'green';
    `);
    console.log('Поле zsk_status добавлено');

    // Создаем таблицу zsk_checks
    console.log('Создание таблицы zsk_checks...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS zsk_checks (
        id SERIAL PRIMARY KEY,
        inn VARCHAR(12) NOT NULL,
        check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        result_text TEXT,
        notified BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
      );
    `);
    console.log('Таблица zsk_checks создана');

    // Создаем индексы
    console.log('Создание индексов...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organizations_zsk_status ON tracked_organizations(zsk_status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_zsk_checks_inn ON zsk_checks(inn);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_zsk_checks_date ON zsk_checks(check_date);
    `);
    console.log('Индексы созданы');

    console.log('Обновление базы данных завершено успешно!');

  } catch (error) {
    console.error('Ошибка при обновлении базы данных:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Соединение с базой данных закрыто');
  }
}

// Запускаем обновление
updateDatabase()
  .then(() => {
    console.log('Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Скрипт завершен с ошибкой:', error);
    process.exit(1);
  });
