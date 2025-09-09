import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { User, Organization, OrganizationCheck, ZskCheck } from '../types';

// Типы для Supabase таблиц
export interface SupabaseUser {
  id: number;
  telegram_id: number;
  username?: string;
  is_admin: boolean;
  created_at: string;
}

export interface SupabaseOrganization {
  id: number;
  inn: string;
  name?: string;
  status: string;
  zsk_status: string;
  address?: string;
  websites?: string[];
  is_liquidated?: boolean;
  illegality_signs?: string[];
  region?: string;
  additional_info?: string;
  comment?: string;
  risk_info?: string;
  has_illegal_activity?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseOrganizationCheck {
  id: number;
  inn: string;
  check_date: string;
  status: string;
  details?: any;
  notified: boolean;
}

export interface SupabaseZskCheck {
  id: number;
  inn: string;
  check_date: string;
  status: string;
  result_text?: string;
  notified: boolean;
}

export interface SupabaseUserOrganization {
  user_id: number;
  inn: string;
}

export interface SupabaseUserGroup {
  id: number;
  name: string;
  owner_id: number;
  invite_code: string;
  created_at: string;
}

export interface SupabaseGroupMember {
  group_id: number;
  user_id: number;
  joined_at: string;
}

export interface SupabaseGroupOrganization {
  group_id: number;
  inn: string;
  added_by: number;
  added_at: string;
}

export interface GrammySession {
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  public client;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
    
    if (this.isEnabled) {
      this.client = createClient(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
      logger.info({
        msg: 'Supabase client initialized',
        url: config.SUPABASE_URL,
      });
    } else {
      logger.warn({
        msg: 'Supabase not configured, using PostgreSQL',
        supabaseUrl: config.SUPABASE_URL,
        supabaseKey: config.SUPABASE_ANON_KEY ? 'configured' : 'not configured'
      });
    }
  }

  /**
   * Проверяет, включен ли Supabase
   */
  isSupabaseEnabled(): boolean {
    return this.isEnabled;
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ

  /**
   * Получение пользователя по Telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting user by telegram ID:', error);
        throw error;
      }

      return {
        id: data.id,
        telegram_id: data.telegram_id,
        username: data.username,
        is_admin: data.is_admin,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Error getting user by telegram ID:', error);
      throw error;
    }
  }

  /**
   * Создание нового пользователя
   */
  async createUser(telegramId: number, username?: string, isAdmin: boolean = false): Promise<User> {
    if (!this.isEnabled) {
      throw new Error('Supabase not enabled');
    }

    try {
      const { data, error } = await this.client!
        .from('users')
        .insert({
          telegram_id: telegramId,
          username,
          is_admin: isAdmin
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating user:', error);
        throw error;
      }

      return {
        id: data.id,
        telegram_id: data.telegram_id,
        username: data.username,
        is_admin: data.is_admin,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Получение всех пользователей
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.client!
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error getting all users:', error);
        throw error;
      }

      return data.map(user => ({
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        is_admin: user.is_admin,
        createdAt: new Date(user.created_at)
      }));
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса администратора
   */
  async updateUserAdminStatus(telegramId: number, isAdmin: boolean): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('users')
        .update({ is_admin: isAdmin })
        .eq('telegram_id', telegramId);

      if (error) {
        logger.error('Error updating user admin status:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error updating user admin status:', error);
      throw error;
    }
  }

  /**
   * Удаление пользователя
   */
  async deleteUser(telegramId: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('users')
        .delete()
        .eq('telegram_id', telegramId);

      if (error) {
        logger.error('Error deleting user:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async removeUser(telegramId: number): Promise<void> {
    return this.deleteUser(telegramId);
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ С ОРГАНИЗАЦИЯМИ

  /**
   * Добавление организации
   */
  async addOrganization(organization: Partial<Organization>): Promise<Organization> {
    if (!this.isEnabled) {
      throw new Error('Supabase not enabled');
    }

    try {
      const { data, error } = await this.client!
        .from('tracked_organizations')
        .upsert({
          inn: organization.inn,
          name: organization.name,
          status: organization.status || 'green',
          zsk_status: organization.zskStatus || 'green',
          address: organization.address,
          websites: organization.websites,
          is_liquidated: organization.isLiquidated,
          illegality_signs: organization.illegalitySigns,
          region: organization.region,
          additional_info: organization.additionalInfo,
          comment: organization.comment,
          risk_info: organization.riskInfo,
          has_illegal_activity: organization.hasIllegalActivity,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'inn'
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding organization:', error);
        throw error;
      }

      return this.mapSupabaseOrganization(data);
    } catch (error) {
      logger.error('Error adding organization:', error);
      throw error;
    }
  }

  /**
   * Добавление организации только если её нет
   */
  async addOrganizationIfNotExists(organization: Partial<Organization>): Promise<Organization | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('tracked_organizations')
        .insert({
          inn: organization.inn,
          name: organization.name,
          status: organization.status || 'green',
          zsk_status: organization.zskStatus || 'green',
          address: organization.address,
          websites: organization.websites,
          is_liquidated: organization.isLiquidated,
          illegality_signs: organization.illegalitySigns,
          region: organization.region,
          additional_info: organization.additionalInfo,
          comment: organization.comment,
          risk_info: organization.riskInfo,
          has_illegal_activity: organization.hasIllegalActivity
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Duplicate key
          return null;
        }
        logger.error('Error adding organization if not exists:', error);
        throw error;
      }

      return data ? this.mapSupabaseOrganization(data) : null;
    } catch (error) {
      logger.error('Error adding organization if not exists:', error);
      throw error;
    }
  }

  /**
   * Получение организации по ИНН
   */
  async getOrganizationByInn(inn: string): Promise<Organization | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('tracked_organizations')
        .select('*')
        .eq('inn', inn)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting organization by INN:', error);
        throw error;
      }

      return this.mapSupabaseOrganization(data);
    } catch (error) {
      logger.error('Error getting organization by INN:', error);
      throw error;
    }
  }

  /**
   * Получение всех организаций
   */
  async getAllOrganizations(): Promise<Organization[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.client!
        .from('tracked_organizations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error getting all organizations:', error);
        throw error;
      }

      return data.map(org => this.mapSupabaseOrganization(org));
    } catch (error) {
      logger.error('Error getting all organizations:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса организации
   */
  async updateOrganizationStatus(inn: string, status: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('tracked_organizations')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('inn', inn);

      if (error) {
        logger.error('Error updating organization status:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error updating organization status:', error);
      throw error;
    }
  }

  /**
   * Полное обновление данных организации
   */
  async updateOrganizationData(inn: string, organizationData: Partial<Organization>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const updateData: Partial<SupabaseOrganization> = {
        updated_at: new Date().toISOString()
      };

      if (organizationData.name !== undefined) updateData.name = organizationData.name;
      if (organizationData.status !== undefined) updateData.status = organizationData.status;
      if (organizationData.zskStatus !== undefined) updateData.zsk_status = organizationData.zskStatus;
      if (organizationData.address !== undefined) updateData.address = organizationData.address;
      if (organizationData.websites !== undefined) updateData.websites = organizationData.websites;
      if (organizationData.isLiquidated !== undefined) updateData.is_liquidated = organizationData.isLiquidated;
      if (organizationData.illegalitySigns !== undefined) updateData.illegality_signs = organizationData.illegalitySigns;
      if (organizationData.region !== undefined) updateData.region = organizationData.region;
      if (organizationData.additionalInfo !== undefined) updateData.additional_info = organizationData.additionalInfo;
      if (organizationData.comment !== undefined) updateData.comment = organizationData.comment;
      if (organizationData.riskInfo !== undefined) updateData.risk_info = organizationData.riskInfo;
      if (organizationData.hasIllegalActivity !== undefined) updateData.has_illegal_activity = organizationData.hasIllegalActivity;

      const { data, error } = await this.client!
        .from('tracked_organizations')
        .update(updateData)
        .eq('inn', inn)
        .select();

      if (error) {
        logger.error('Error updating organization data:', error);
        throw error;
      }

      if (data && data.length > 0) {
        logger.info(`Updated organization data for INN ${inn}`);
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
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('tracked_organizations')
        .delete()
        .eq('inn', inn);

      if (error) {
        logger.error('Error deleting organization:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error deleting organization:', error);
      throw error;
    }
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ С ПРОВЕРКАМИ

  /**
   * Добавление записи о проверке
   */
  async addOrganizationCheck(check: Partial<OrganizationCheck>): Promise<OrganizationCheck> {
    if (!this.isEnabled) {
      throw new Error('Supabase not enabled');
    }

    try {
      const { data, error } = await this.client!
        .from('organization_checks')
        .insert({
          inn: check.inn,
          status: check.status,
          details: check.details
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding organization check:', error);
        throw error;
      }

      return {
        id: data.id,
        inn: data.inn,
        checkDate: new Date(data.check_date),
        status: data.status as any,
        details: data.details,
        notified: data.notified
      };
    } catch (error) {
      logger.error('Error adding organization check:', error);
      throw error;
    }
  }

  /**
   * Получение последней проверки организации
   */
  async getLastOrganizationCheck(inn: string): Promise<OrganizationCheck | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('organization_checks')
        .select('*')
        .eq('inn', inn)
        .order('check_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting last organization check:', error);
        throw error;
      }

      return {
        id: data.id,
        inn: data.inn,
        checkDate: new Date(data.check_date),
        status: data.status as any,
        details: data.details,
        notified: data.notified
      };
    } catch (error) {
      logger.error('Error getting last organization check:', error);
      throw error;
    }
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ С ПРОВЕРКАМИ ЗСК

  /**
   * Добавление записи о проверке ЗСК
   */
  async addZskCheck(check: Partial<ZskCheck>): Promise<ZskCheck> {
    if (!this.isEnabled) {
      throw new Error('Supabase not enabled');
    }

    try {
      const { data, error } = await this.client!
        .from('zsk_checks')
        .insert({
          inn: check.inn,
          status: check.status,
          result_text: check.resultText
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding ZSK check:', error);
        throw error;
      }

      return {
        id: data.id,
        inn: data.inn,
        checkDate: new Date(data.check_date),
        status: data.status as any,
        resultText: data.result_text,
        notified: data.notified
      };
    } catch (error) {
      logger.error('Error adding ZSK check:', error);
      throw error;
    }
  }

  /**
   * Получение последней проверки ЗСК организации
   */
  async getLastZskCheck(inn: string): Promise<ZskCheck | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('zsk_checks')
        .select('*')
        .eq('inn', inn)
        .order('check_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting last ZSK check:', error);
        throw error;
      }

      return {
        id: data.id,
        inn: data.inn,
        checkDate: new Date(data.check_date),
        status: data.status as any,
        resultText: data.result_text,
        notified: data.notified
      };
    } catch (error) {
      logger.error('Error getting last ZSK check:', error);
      throw error;
    }
  }

  /**
   * Обновление статуса ЗСК организации
   */
  async updateOrganizationZskStatus(inn: string, zskStatus: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('tracked_organizations')
        .update({ 
          zsk_status: zskStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('inn', inn);

      if (error) {
        logger.error('Error updating organization ZSK status:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error updating organization ZSK status:', error);
      throw error;
    }
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ СО СВЯЗЯМИ ПОЛЬЗОВАТЕЛЬ-ОРГАНИЗАЦИЯ (ЗАГЛУШКИ)
  // Индивидуальное отслеживание не используется - только групповое

  async addUserOrganization(_userId: number, _inn: string): Promise<void> {
    logger.warn('Individual user-organization tracking is disabled, use groups instead');
  }

  async removeUserOrganization(_userId: number, _inn: string): Promise<void> {
    logger.warn('Individual user-organization tracking is disabled, use groups instead');
  }

  async getUserOrganizations(_userId: number): Promise<Organization[]> {
    logger.warn('Individual user-organization tracking is disabled, use groups instead');
    return [];
  }

  async getOrganizationUsers(_inn: string): Promise<User[]> {
    logger.warn('Individual user-organization tracking is disabled, use groups instead');
    return [];
  }

  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

  /**
   * Маппинг Supabase организации в интерфейс Organization
   */
  private mapSupabaseOrganization(data: SupabaseOrganization): Organization {
    const org: Organization = {
      id: data.id,
      inn: data.inn,
      name: data.name || '',
      status: data.status as any,
      zskStatus: data.zsk_status as any,
      addedDate: new Date(data.created_at),
      updatedDate: new Date(data.updated_at)
    };
    
    // Добавляем опциональные поля только если они определены
    if (data.address !== undefined) org.address = data.address;
    if (data.websites !== undefined) org.websites = data.websites;
    if (data.is_liquidated !== undefined) org.isLiquidated = data.is_liquidated;
    if (data.illegality_signs !== undefined) org.illegalitySigns = data.illegality_signs;
    if (data.region !== undefined) org.region = data.region;
    if (data.additional_info !== undefined) org.additionalInfo = data.additional_info;
    if (data.comment !== undefined) org.comment = data.comment;
    if (data.risk_info !== undefined) org.riskInfo = data.risk_info;
    if (data.has_illegal_activity !== undefined) org.hasIllegalActivity = data.has_illegal_activity;
    
    return org;
  }

  // МЕТОДЫ ДЛЯ РАБОТЫ С ГРУППАМИ

  /**
   * Создание группы пользователя
   */
  async createUserGroup(name: string, ownerId: number): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Supabase not enabled');
    }

    try {
      // Генерируем уникальный код приглашения
      const inviteCode = this.generateInviteCode();
      
      const { data, error } = await this.client!
        .from('user_groups')
        .insert({
          name,
          owner_id: ownerId,
          invite_code: inviteCode
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating user group:', error);
        throw error;
      }

      // Добавляем владельца как участника группы
      await this.addGroupMember(data.id, ownerId);
      
      logger.info(`User group created: ${name} for user ${ownerId}`);
      return data;
    } catch (error) {
      logger.error('Error creating user group:', error);
      throw error;
    }
  }

  /**
   * Получение группы пользователя
   */
  async getUserGroup(ownerId: number): Promise<any | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('user_groups')
        .select('*')
        .eq('owner_id', ownerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting user group:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting user group:', error);
      throw error;
    }
  }

  /**
   * Получение группы по коду приглашения
   */
  async getGroupByInviteCode(inviteCode: string): Promise<any | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.client!
        .from('user_groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error getting group by invite code:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting group by invite code:', error);
      throw error;
    }
  }

  /**
   * Удаление группы владельцем: удаляет членов и организации, затем саму группу
   */
  async deleteUserGroup(groupId: number, ownerId: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Проверяем, что владелец совпадает
      const { data: group, error: groupErr } = await this.client!
        .from('user_groups')
        .select('*')
        .eq('id', groupId)
        .single();
      if (groupErr) throw groupErr;
      if (!group || group.owner_id !== ownerId) {
        throw new Error('Недостаточно прав для удаления группы');
      }

      // Удаляем участников
      const { error: delMembersErr } = await this.client!
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
      if (delMembersErr) throw delMembersErr;

      // Удаляем организации группы
      const { error: delOrgErr } = await this.client!
        .from('group_organizations')
        .delete()
        .eq('group_id', groupId);
      if (delOrgErr) throw delOrgErr;

      // Удаляем саму группу
      const { error: delGroupErr } = await this.client!
        .from('user_groups')
        .delete()
        .eq('id', groupId);
      if (delGroupErr) throw delGroupErr;

      logger.info(`Group ${groupId} deleted by owner ${ownerId}`);
    } catch (error) {
      logger.error('Error deleting user group:', error);
      throw error;
    }
  }

  /**
   * Добавление участника в группу
   */
  async addGroupMember(groupId: number, userId: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('group_members')
        .upsert({
          group_id: groupId,
          user_id: userId
        }, {
          onConflict: 'group_id,user_id'
        });

      if (error) {
        logger.error('Error adding group member:', error);
        throw error;
      }

      logger.info(`User ${userId} added to group ${groupId}`);
    } catch (error) {
      logger.error('Error adding group member:', error);
      throw error;
    }
  }

  /**
   * Удаление участника из группы
   */
  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error removing group member:', error);
        throw error;
      }

      logger.info(`User ${userId} removed from group ${groupId}`);
    } catch (error) {
      logger.error('Error removing group member:', error);
      throw error;
    }
  }

  /**
   * Получение участников группы
   */
  async getGroupMembers(groupId: number): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.client!
        .from('group_members')
        .select(`
          users (*)
        `)
        .eq('group_id', groupId)
        .order('joined_at');

      if (error) {
        logger.error('Error getting group members:', error);
        throw error;
      }

      return data
        .map((item: any) => item.users)
        .filter(user => user !== null)
        .map((user: any) => ({
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          is_admin: user.is_admin,
          createdAt: new Date(user.created_at)
        }));
    } catch (error) {
      logger.error('Error getting group members:', error);
      throw error;
    }
  }

  /**
   * Получение организаций группы
   */
  async getGroupOrganizations(groupId: number): Promise<Organization[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.client!
        .from('group_organizations')
        .select(`
          inn,
          tracked_organizations!inner (
            inn,
            name,
            status,
            zsk_status,
            address,
            websites,
            is_liquidated,
            illegality_signs,
            region,
            additional_info,
            comment,
            risk_info,
            has_illegal_activity,
            created_at,
            updated_at
          )
        `)
        .eq('group_id', groupId)
        .order('added_at', { ascending: false });

      if (error) {
        logger.error('Error getting group organizations:', error);
        throw error;
      }

      return data
        .map((item: any) => item.tracked_organizations)
        .filter(org => org !== null)
        .map((org: any) => this.mapSupabaseOrganization(org));
    } catch (error) {
      logger.error('Error getting group organizations:', error);
      throw error;
    }
  }

  /**
   * Добавление организации в группу
   */
  async addGroupOrganization(groupId: number, inn: string, addedBy: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Сначала добавляем организацию в общий список, если её нет
      await this.addOrganizationIfNotExists({ inn });
      
      // Затем добавляем в группу
      const { error } = await this.client!
        .from('group_organizations')
        .upsert({
          group_id: groupId,
          inn,
          added_by: addedBy
        }, {
          onConflict: 'group_id,inn'
        });

      if (error) {
        logger.error('Error adding group organization:', error);
        throw error;
      }

      logger.info(`Organization ${inn} added to group ${groupId} by user ${addedBy}`);
    } catch (error) {
      logger.error('Error adding group organization:', error);
      throw error;
    }
  }

  /**
   * Удаление организации из группы
   */
  async removeGroupOrganization(groupId: number, inn: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await this.client!
        .from('group_organizations')
        .delete()
        .eq('group_id', groupId)
        .eq('inn', inn);

      if (error) {
        logger.error('Error removing group organization:', error);
        throw error;
      }

      logger.info(`Organization ${inn} removed from group ${groupId}`);
    } catch (error) {
      logger.error('Error removing group organization:', error);
      throw error;
    }
  }

  /**
   * Получение групп, которые отслеживают организацию
   */
  async getGroupsByOrganization(inn: string): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.client!
        .from('group_organizations')
        .select(`
          group_id,
          user_groups!inner (
            id,
            name,
            owner_id,
            invite_code,
            created_at
          )
        `)
        .eq('inn', inn);

      if (error) {
        logger.error('Error getting groups by organization:', error);
        throw error;
      }

      return data
        .map((item: any) => item.user_groups)
        .filter(group => group !== null);
    } catch (error) {
      logger.error('Error getting groups by organization:', error);
      throw error;
    }
  }

  /**
   * Генерация уникального кода приглашения
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // МЕТОДЫ-ЗАГЛУШКИ ДЛЯ УВЕДОМЛЕНИЙ (НЕ РЕАЛИЗОВАНЫ В SUPABASE)

  async markCheckAsNotified(_inn: string, _status: string): Promise<void> {
    logger.warn('markCheckAsNotified not implemented in Supabase service');
  }

  async markZskCheckAsNotified(_inn: string, _status: string): Promise<void> {
    logger.warn('markZskCheckAsNotified not implemented in Supabase service');
  }
}

// Создаем singleton экземпляр
export const supabaseService = new SupabaseService();
