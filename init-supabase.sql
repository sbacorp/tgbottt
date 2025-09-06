-- Инициализация базы данных Supabase для CBR Monitoring Bot
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Включаем Row Level Security
SET row_security = on;

-- =======================
-- ОСНОВНЫЕ ТАБЛИЦЫ БОТА
-- =======================

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица отслеживаемых организаций
CREATE TABLE IF NOT EXISTS tracked_organizations (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(12) UNIQUE NOT NULL,
  name VARCHAR(500),
  status VARCHAR(20) DEFAULT 'green' CHECK (status IN ('red', 'orange', 'green', 'removed')),
  zsk_status VARCHAR(20) DEFAULT 'green' CHECK (zsk_status IN ('red', 'green')),
  address TEXT,
  websites TEXT[],
  is_liquidated BOOLEAN DEFAULT FALSE,
  illegality_signs TEXT[],
  region VARCHAR(255),
  additional_info TEXT,
  comment TEXT,
  risk_info TEXT,
  has_illegal_activity BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица проверок организаций
CREATE TABLE IF NOT EXISTS organization_checks (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(12) NOT NULL,
  check_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('red', 'orange', 'green', 'removed')),
  details JSONB,
  notified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
);

-- Таблица проверок ЗСК
CREATE TABLE IF NOT EXISTS zsk_checks (
  id SERIAL PRIMARY KEY,
  inn VARCHAR(12) NOT NULL,
  check_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('red', 'green')),
  result_text TEXT,
  notified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE
);

-- Таблицы для групп пользователей
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id BIGINT NOT NULL,
  invite_code VARCHAR(50) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_organizations (
  group_id INTEGER NOT NULL,
  inn VARCHAR(12) NOT NULL,
  added_by BIGINT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, inn),
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (inn) REFERENCES tracked_organizations(inn) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- =======================
-- ТАБЛИЦЫ ДЛЯ GRAMMY
-- =======================

-- Таблица для хранения сессий Grammy
CREATE TABLE IF NOT EXISTS grammy_sessions (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =======================
-- ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ
-- =======================

-- Индексы для пользователей
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Индексы для организаций
CREATE INDEX IF NOT EXISTS idx_organizations_inn ON tracked_organizations(inn);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON tracked_organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_zsk_status ON tracked_organizations(zsk_status);
CREATE INDEX IF NOT EXISTS idx_organizations_updated_at ON tracked_organizations(updated_at);
CREATE INDEX IF NOT EXISTS idx_organizations_region ON tracked_organizations(region);

-- Индексы для проверок
CREATE INDEX IF NOT EXISTS idx_checks_inn ON organization_checks(inn);
CREATE INDEX IF NOT EXISTS idx_checks_date ON organization_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_checks_status ON organization_checks(status);
CREATE INDEX IF NOT EXISTS idx_checks_notified ON organization_checks(notified);

-- Индексы для проверок ЗСК
CREATE INDEX IF NOT EXISTS idx_zsk_checks_inn ON zsk_checks(inn);
CREATE INDEX IF NOT EXISTS idx_zsk_checks_date ON zsk_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_zsk_checks_status ON zsk_checks(status);
CREATE INDEX IF NOT EXISTS idx_zsk_checks_notified ON zsk_checks(notified);


-- Индексы для групп
CREATE INDEX IF NOT EXISTS idx_user_groups_owner_id ON user_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_invite_code ON user_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_organizations_group_id ON group_organizations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_organizations_inn ON group_organizations(inn);

-- Индексы для Grammy сессий
CREATE INDEX IF NOT EXISTS idx_grammy_sessions_key ON grammy_sessions(key);
CREATE INDEX IF NOT EXISTS idx_grammy_sessions_updated_at ON grammy_sessions(updated_at);

-- =======================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- =======================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_tracked_organizations_updated_at 
    BEFORE UPDATE ON tracked_organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grammy_sessions_updated_at 
    BEFORE UPDATE ON grammy_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- ROW LEVEL SECURITY (RLS)
-- =======================

-- Включаем RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE zsk_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammy_sessions ENABLE ROW LEVEL SECURITY;

-- Политики для полного доступа сервисному ключу
CREATE POLICY "Service can manage users" ON users FOR ALL USING (true);
CREATE POLICY "Service can manage tracked_organizations" ON tracked_organizations FOR ALL USING (true);
CREATE POLICY "Service can manage organization_checks" ON organization_checks FOR ALL USING (true);
CREATE POLICY "Service can manage zsk_checks" ON zsk_checks FOR ALL USING (true);
CREATE POLICY "Service can manage user_groups" ON user_groups FOR ALL USING (true);
CREATE POLICY "Service can manage group_members" ON group_members FOR ALL USING (true);
CREATE POLICY "Service can manage group_organizations" ON group_organizations FOR ALL USING (true);
CREATE POLICY "Service can manage grammy_sessions" ON grammy_sessions FOR ALL USING (true);

-- =======================
-- ФУНКЦИИ ДЛЯ ОЧИСТКИ ДАННЫХ
-- =======================

-- Функция для очистки старых сессий Grammy (старше 30 дней)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM grammy_sessions 
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Функция для очистки старых проверок (старше 90 дней)
CREATE OR REPLACE FUNCTION cleanup_old_checks()
RETURNS void AS $$
BEGIN
    DELETE FROM organization_checks 
    WHERE check_date < NOW() - INTERVAL '90 days';
    
    DELETE FROM zsk_checks 
    WHERE check_date < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =======================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- =======================

-- Представление для статистики организаций
CREATE OR REPLACE VIEW organization_stats AS
SELECT 
    status,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM tracked_organizations 
GROUP BY status;

-- Представление для активности пользователей (через группы)
CREATE OR REPLACE VIEW user_activity AS
SELECT 
    u.telegram_id,
    u.username,
    u.is_admin,
    COUNT(DISTINCT go.inn) as tracked_organizations_count,
    COUNT(DISTINCT gm.group_id) as groups_count,
    u.created_at as registered_at
FROM users u
LEFT JOIN group_members gm ON u.telegram_id = gm.user_id
LEFT JOIN group_organizations go ON gm.group_id = go.group_id
GROUP BY u.id, u.telegram_id, u.username, u.is_admin, u.created_at
ORDER BY tracked_organizations_count DESC;

-- =======================
-- КОММЕНТАРИИ К ТАБЛИЦАМ
-- =======================

COMMENT ON TABLE users IS 'Зарегистрированные пользователи бота';
COMMENT ON TABLE tracked_organizations IS 'Организации для мониторинга';
COMMENT ON TABLE organization_checks IS 'История проверок организаций';
COMMENT ON TABLE zsk_checks IS 'История проверок ЗСК';
COMMENT ON TABLE user_groups IS 'Группы пользователей для совместного мониторинга';
COMMENT ON TABLE group_members IS 'Участники групп';
COMMENT ON TABLE group_organizations IS 'Организации, отслеживаемые группами';
COMMENT ON TABLE grammy_sessions IS 'Сессии Telegram бота';

-- =======================
-- ЗАВЕРШЕНИЕ
-- =======================

-- Информационные сообщения
DO $$
BEGIN
    RAISE NOTICE 'Supabase database initialization completed successfully!';
    RAISE NOTICE 'Tables created: users, tracked_organizations, organization_checks, zsk_checks, user_groups, group_members, group_organizations, grammy_sessions';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'RLS policies configured for security';
    RAISE NOTICE 'Helper functions and views created';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Configure your .env file with SUPABASE_URL and SUPABASE_ANON_KEY';
    RAISE NOTICE '2. Optionally add SUPABASE_SERVICE_ROLE_KEY for administrative operations';
    RAISE NOTICE '3. Run your bot and verify the connection';
    RAISE NOTICE '';
    RAISE NOTICE 'Database is ready for CBR Monitoring Bot!';
END $$;
