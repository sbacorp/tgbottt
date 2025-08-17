-- Инициализация базы данных для CBR Bot

-- Создание пользователя базы данных (если не существует)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cbr_user') THEN
    CREATE ROLE cbr_user WITH LOGIN PASSWORD 'cbr_password';
  END IF;
END
$$;

-- Предоставление прав пользователю
GRANT ALL PRIVILEGES ON DATABASE cbr_bot TO cbr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cbr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cbr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cbr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cbr_user;

-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы отслеживаемых организаций
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

-- Создание таблицы проверок организаций
CREATE TABLE IF NOT EXISTS organization_checks (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(12) NOT NULL,
  check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  details JSONB,
  notified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
);

-- Создание таблицы связи пользователь-организация
CREATE TABLE IF NOT EXISTS user_organizations (
  user_id INTEGER NOT NULL,
  inn VARCHAR(12) NOT NULL,
  PRIMARY KEY (user_id, inn),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
);

-- Добавление первичных ИНН для отслеживания
INSERT INTO tracked_organizations (inn, name, status) VALUES
  ('9704209904', 'Организация 9704209904', 'green'),
  ('9719075594', 'Организация 9719075594', 'green'),
  ('7720942551', 'Организация 7720942551', 'green'),
  ('7720943749', 'Организация 7720943749', 'green'),
  ('9719075989', 'Организация 9719075989', 'green'),
  ('9719076044', 'Организация 9719076044', 'green'),
  ('5024250841', 'Организация 5024250841', 'green'),
  ('9729401367', 'Организация 9729401367', 'green'),
  ('9726098881', 'Организация 9726098881', 'green'),
  ('9728156881', 'Организация 9728156881', 'green'),
  ('9727107641', 'Организация 9727107641', 'green')
ON CONFLICT (inn) DO NOTHING;

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_organizations_inn ON tracked_organizations(inn);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON tracked_organizations(status);
CREATE INDEX IF NOT EXISTS idx_checks_inn ON organization_checks(inn);
CREATE INDEX IF NOT EXISTS idx_checks_date ON organization_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_inn ON user_organizations(inn);
