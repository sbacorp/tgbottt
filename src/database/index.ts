import { Pool } from 'pg';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { User, Organization, OrganizationCheck } from '../types';
import { INITIAL_INNS } from '../utils/config';

class Database {
  private client: Pool;

  constructor() {
    this.client = new Pool({
      connectionString: config.databaseUrl,
    });
  }

  /**
   * Подключение к базе данных
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to PostgreSQL database');
      
      // Создание таблиц
      await this.createTables();
      
      // Инициализация первичных данных
      await this.initializeData();
    } catch (error) {
      logger.error('Database connection error:', error);
      throw error;
    }
  }

  /**
   * Отключение от базы данных
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.end();
      logger.info('Disconnected from PostgreSQL database');
    } catch (error) {
      logger.error('Database disconnection error:', error);
    }
  }

  /**
   * Создание таблиц
   */
  private async createTables(): Promise<void> {
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

    try {
      await this.client.query(createUsersTable);
      await this.client.query(createOrganizationsTable);
      await this.client.query(createChecksTable);
      await this.client.query(createUserOrganizationsTable);
      
      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Инициализация первичных данных
   */
  private async initializeData(): Promise<void> {
    try {
      // Добавление первичных ИНН только если их нет
      
      for (const inn of INITIAL_INNS) {
        // Добавляем только если организации нет
        const addedOrg = await this.addOrganizationIfNotExists({
          inn,
          name: `Организация ${inn}`,
          status: 'green'
        });
        
        if (addedOrg) {
          logger.info(`Added initial organization with INN: ${inn}`);
        } else {
          logger.info(`Organization with INN ${inn} already exists, skipping initialization`);
        }
      }
      
      logger.info('Initial data initialization completed');
    } catch (error) {
      logger.error('Error initializing data:', error);
    }
  }

  // Методы для работы с пользователями

  /**
   * Получение пользователя по Telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    try {
      const result = await this.client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user by telegram ID:', error);
      throw error;
    }
  }

  /**
   * Создание нового пользователя
   */
  async createUser(telegramId: number, username?: string, isAdmin: boolean = false): Promise<User> {
    try {
      const result = await this.client.query(
        'INSERT INTO users (telegram_id, username, is_admin) VALUES ($1, $2, $3) RETURNING *',
        [telegramId, username, isAdmin]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Получение всех пользователей
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const result = await this.client.query('SELECT * FROM users ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса администратора
   */
  async updateUserAdminStatus(telegramId: number, isAdmin: boolean): Promise<void> {
    try {
      await this.client.query(
        'UPDATE users SET is_admin = $1 WHERE telegram_id = $2',
        [isAdmin, telegramId]
      );
    } catch (error) {
      logger.error('Error updating user admin status:', error);
      throw error;
    }
  }

  /**
   * Удаление пользователя
   */
  async deleteUser(telegramId: number): Promise<void> {
    try {
      await this.client.query('DELETE FROM users WHERE telegram_id = $1', [telegramId]);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  // Методы для работы с организациями

  /**
   * Добавление организации
   */
  async addOrganization(organization: Partial<Organization>): Promise<Organization> {
    try {
      const result = await this.client.query(
        `INSERT INTO tracked_organizations 
         (inn, name, status, address, websites, is_liquidated, illegality_signs, region, additional_info, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (inn) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         address = EXCLUDED.address,
         websites = EXCLUDED.websites,
         is_liquidated = EXCLUDED.is_liquidated,
         illegality_signs = EXCLUDED.illegality_signs,
         region = EXCLUDED.region,
         additional_info = EXCLUDED.additional_info,
         comment = EXCLUDED.comment,
         updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          organization.inn,
          organization.name,
          organization.status || 'green',
          organization.address,
          organization.websites,
          organization.isLiquidated,
          organization.illegalitySigns,
          organization.region,
          organization.additionalInfo,
          organization.comment
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error adding organization:', error);
      throw error;
    }
  }

  /**
   * Добавление организации только если её нет (без перезаписи)
   */
  async addOrganizationIfNotExists(organization: Partial<Organization>): Promise<Organization | null> {
    try {
      const result = await this.client.query(
        `INSERT INTO tracked_organizations 
         (inn, name, status, address, websites, is_liquidated, illegality_signs, region, additional_info, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (inn) DO NOTHING
         RETURNING *`,
        [
          organization.inn,
          organization.name,
          organization.status || 'green',
          organization.address,
          organization.websites,
          organization.isLiquidated,
          organization.illegalitySigns,
          organization.region,
          organization.additionalInfo,
          organization.comment
        ]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error adding organization if not exists:', error);
      throw error;
    }
  }

  /**
   * Получение организации по ИНН
   */
  async getOrganizationByInn(inn: string): Promise<Organization | null> {
    try {
      const result = await this.client.query(
        'SELECT * FROM tracked_organizations WHERE inn = $1',
        [inn]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting organization by INN:', error);
      throw error;
    }
  }

  /**
   * Получение всех организаций
   */
  async getAllOrganizations(): Promise<Organization[]> {
    try {
      const result = await this.client.query(
        'SELECT * FROM tracked_organizations ORDER BY updated_at DESC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting all organizations:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса организации
   */
  async updateOrganizationStatus(inn: string, status: string): Promise<void> {
    try {
      await this.client.query(
        'UPDATE tracked_organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE inn = $2',
        [status, inn]
      );
    } catch (error) {
      logger.error('Error updating organization status:', error);
      throw error;
    }
  }

  /**
   * Полное обновление данных организации
   */
  async updateOrganizationData(inn: string, organizationData: Partial<Organization>): Promise<void> {
    try {
      const result = await this.client.query(
        `UPDATE tracked_organizations SET
         name = COALESCE($1, name),
         status = COALESCE($2, status),
         address = COALESCE($3, address),
         websites = COALESCE($4, websites),
         is_liquidated = COALESCE($5, is_liquidated),
         illegality_signs = COALESCE($6, illegality_signs),
         region = COALESCE($7, region),
         additional_info = COALESCE($8, additional_info),
         comment = COALESCE($9, comment),
         updated_at = CURRENT_TIMESTAMP
         WHERE inn = $10
         RETURNING *`,
        [
          organizationData.name,
          organizationData.status,
          organizationData.address,
          organizationData.websites,
          organizationData.isLiquidated,
          organizationData.illegalitySigns,
          organizationData.region,
          organizationData.additionalInfo,
          organizationData.comment,
          inn
        ]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Updated organization data for INN ${inn}: ${JSON.stringify(organizationData)}`);
      } else {
        logger.warn(`No organization found with INN ${inn} for update`);
      }
    } catch (error) {
      logger.error('Error updating organization data:', error);
      throw error;
    }
  }

  /**
   * Удаление организации
   */
  async deleteOrganization(inn: string): Promise<void> {
    try {
      await this.client.query('DELETE FROM tracked_organizations WHERE inn = $1', [inn]);
    } catch (error) {
      logger.error('Error deleting organization:', error);
      throw error;
    }
  }

  // Методы для работы с проверками

  /**
   * Добавление записи о проверке
   */
  async addOrganizationCheck(check: Partial<OrganizationCheck>): Promise<OrganizationCheck> {
    try {
      const result = await this.client.query(
        `INSERT INTO organization_checks (inn, status, details)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [check.inn, check.status, check.details]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error adding organization check:', error);
      throw error;
    }
  }

  /**
   * Получение последней проверки организации
   */
  async getLastOrganizationCheck(inn: string): Promise<OrganizationCheck | null> {
    try {
      const result = await this.client.query(
        'SELECT * FROM organization_checks WHERE inn = $1 ORDER BY check_date DESC LIMIT 1',
        [inn]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting last organization check:', error);
      throw error;
    }
  }

  /**
   * Отметка проверки как уведомленной
   */
  async markCheckAsNotified(inn: string, status: string): Promise<void> {
    try {
      await this.client.query(
        'UPDATE organization_checks SET notified = true WHERE inn = $1 AND status = $2',
        [inn, status]
      );
    } catch (error) {
      logger.error('Error marking check as notified:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса уведомления
   */
  async updateCheckNotificationStatus(checkId: number, notified: boolean): Promise<void> {
    try {
      await this.client.query(
        'UPDATE organization_checks SET notified = $1 WHERE id = $2',
        [notified, checkId]
      );
    } catch (error) {
      logger.error('Error updating check notification status:', error);
      throw error;
    }
  }

  // Методы для работы со связями пользователь-организация

  /**
   * Добавление связи пользователь-организация
   */
  async addUserOrganization(userId: number, inn: string): Promise<void> {
    try {
      await this.client.query(
        'INSERT INTO user_organizations (user_id, inn) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, inn]
      );
    } catch (error) {
      logger.error('Error adding user-organization link:', error);
      throw error;
    }
  }

  /**
   * Удаление связи пользователь-организация
   */
  async removeUserOrganization(userId: number, inn: string): Promise<void> {
    try {
      await this.client.query(
        'DELETE FROM user_organizations WHERE user_id = $1 AND inn = $2',
        [userId, inn]
      );
    } catch (error) {
      logger.error('Error removing user-organization link:', error);
      throw error;
    }
  }

  /**
   * Получение организаций пользователя
   */
  async getUserOrganizations(userId: number): Promise<Organization[]> {
    try {
      const result = await this.client.query(
        `SELECT o.* FROM tracked_organizations o
         INNER JOIN user_organizations uo ON o.inn = uo.inn
         WHERE uo.user_id = $1
         ORDER BY o.updated_at DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting user organizations:', error);
      throw error;
    }
  }

  /**
   * Получение пользователей, отслеживающих организацию
   */
  async getOrganizationUsers(inn: string): Promise<User[]> {
    try {
      const result = await this.client.query(
        `SELECT u.* FROM users u
         INNER JOIN user_organizations uo ON u.id = uo.user_id
         WHERE uo.inn = $1`,
        [inn]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting organization users:', error);
      throw error;
    }
  }
}

// Экспорт единственного экземпляра
export const database = new Database();
