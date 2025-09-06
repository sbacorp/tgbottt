import { StorageAdapter } from "grammy";
import { supabaseService } from "./supabase-service";
import logger from "../utils/logger";

/**
 * Адаптер для Grammy storage с использованием Supabase
 * Реализует интерфейс StorageAdapter для хранения сессий
 */
export class SupabaseStorageAdapter implements StorageAdapter<unknown> {
  private tableName: string;

  constructor(tableName: string = "grammy_sessions") {
    this.tableName = tableName;
  }

  /**
   * Получает значение по ключу
   */
  async read(key: string): Promise<unknown | undefined> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning undefined for read',
        key
      });
      return undefined;
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Ключ не найден
          logger.debug({
            msg: 'Key not found in storage',
            key
          });
          return undefined;
        }
        logger.error({
          msg: 'Failed to read from storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value read from storage',
        key
      });

      return data.value;
    } catch (error) {
      logger.error({
        msg: 'Error reading from storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  /**
   * Сохраняет значение по ключу
   */
  async write(key: string, value: unknown): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping write',
        key
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        logger.error({
          msg: 'Failed to write to storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value written to storage',
        key
      });
    } catch (error) {
      logger.error({
        msg: 'Error writing to storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Удаляет значение по ключу
   */
  async delete(key: string): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping delete',
        key
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .eq('key', key);

      if (error) {
        logger.error({
          msg: 'Failed to delete from storage',
          key,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Value deleted from storage',
        key
      });
    } catch (error) {
      logger.error({
        msg: 'Error deleting from storage',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает несколько значений по ключам
   */
  async readMany(keys: string[]): Promise<(unknown | undefined)[]> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning undefined array for readMany',
        keysCount: keys.length
      });
      return new Array(keys.length).fill(undefined);
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('key, value')
        .in('key', keys);

      if (error) {
        logger.error({
          msg: 'Failed to read many from storage',
          keys,
          error: error.message
        });
        throw error;
      }

      // Создаем Map для быстрого поиска
      const valueMap = new Map(data.map(item => [item.key, item.value]));

      // Возвращаем значения в том же порядке, что и ключи
      const result = keys.map(key => valueMap.get(key));

      logger.debug({
        msg: 'Values read many from storage',
        keysCount: keys.length,
        foundCount: data.length
      });

      return result;
    } catch (error) {
      logger.error({
        msg: 'Error reading many from storage',
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
      return new Array(keys.length).fill(undefined);
    }
  }

  /**
   * Сохраняет несколько значений
   */
  async writeMany(entries: readonly (readonly [string, unknown])[]): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping writeMany',
        entriesCount: entries.length
      });
      return;
    }

    try {
      const data = entries.map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabaseService.client!
        .from(this.tableName)
        .upsert(data, {
          onConflict: 'key'
        });

      if (error) {
        logger.error({
          msg: 'Failed to write many to storage',
          entriesCount: entries.length,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Values written many to storage',
        entriesCount: entries.length
      });
    } catch (error) {
      logger.error({
        msg: 'Error writing many to storage',
        entriesCount: entries.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Удаляет несколько значений
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping deleteMany',
        keysCount: keys.length
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .in('key', keys);

      if (error) {
        logger.error({
          msg: 'Failed to delete many from storage',
          keys,
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Values deleted many from storage',
        keysCount: keys.length
      });
    } catch (error) {
      logger.error({
        msg: 'Error deleting many from storage',
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает все ключи
   */
  async *readAllKeys(): AsyncIterable<string> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, returning empty keys array'
      });
      return;
    }

    try {
      const { data, error } = await supabaseService.client!
        .from(this.tableName)
        .select('key');

      if (error) {
        logger.error({
          msg: 'Failed to read all keys from storage',
          error: error.message
        });
        throw error;
      }

      const keys = data.map(item => item.key);

      logger.debug({
        msg: 'All keys read from storage',
        keysCount: keys.length
      });

      for (const key of keys) {
        yield key;
      }
    } catch (error) {
      logger.error({
        msg: 'Error reading all keys from storage',
        error: error instanceof Error ? error.message : String(error)
      });
      // Возвращаем пустой итератор
    }
  }

  /**
   * Очищает все данные
   */
  async clear(): Promise<void> {
    if (!supabaseService.isSupabaseEnabled()) {
      logger.debug({
        msg: 'Supabase disabled, skipping clear'
      });
      return;
    }

    try {
      const { error } = await supabaseService.client!
        .from(this.tableName)
        .delete()
        .neq('key', ''); // Удаляем все записи

      if (error) {
        logger.error({
          msg: 'Failed to clear storage',
          error: error.message
        });
        throw error;
      }

      logger.debug({
        msg: 'Storage cleared'
      });
    } catch (error) {
      logger.error({
        msg: 'Error clearing storage',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Создает адаптер для Grammy storage с Supabase
 */
export function createSupabaseStorageAdapter(tableName?: string): StorageAdapter<unknown> {
  return new SupabaseStorageAdapter(tableName);
}
