// Экспорт Supabase сервиса как основной database
export { supabaseService as database } from '../services/supabase-service';

// Также экспортируем под оригинальным именем для совместимости
export { supabaseService } from '../services/supabase-service';