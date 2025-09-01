-- Обновление базы данных для поддержки ЗСК проверок

-- Добавляем поле zsk_status в таблицу tracked_organizations
ALTER TABLE tracked_organizations 
ADD COLUMN IF NOT EXISTS zsk_status VARCHAR(20) DEFAULT 'green';

-- Создаем таблицу zsk_checks
CREATE TABLE IF NOT EXISTS zsk_checks (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(12) NOT NULL,
  check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  result_text TEXT,
  notified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_organizations_zsk_status ON tracked_organizations(zsk_status);
CREATE INDEX IF NOT EXISTS idx_zsk_checks_inn ON zsk_checks(inn);
CREATE INDEX IF NOT EXISTS idx_zsk_checks_date ON zsk_checks(check_date);

-- Выводим сообщение об успешном завершении
SELECT 'Обновление базы данных для ЗСК завершено успешно!' as message;
