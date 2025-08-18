-- Миграция для добавления поля risk_info в таблицу tracked_organizations
-- Выполните этот скрипт в вашей базе данных PostgreSQL

-- Добавляем новое поле risk_info
ALTER TABLE tracked_organizations ADD COLUMN IF NOT EXISTS risk_info TEXT;

-- Проверяем, что поле добавлено
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracked_organizations' 
AND column_name = 'risk_info';
