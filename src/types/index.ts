import { Context, SessionFlavor } from "grammy";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
// import { HydrateFlavor } from "@grammyjs/hydrate";

// Расширенный контекст с сессией
export interface SessionData {
  isRegistered: boolean;
  isAdmin: boolean;
  language: string;
  currentAction?: string | null;
  tempData?: Record<string, any>;
  // Состояния для feature tracking (больше не используются)
}
export type ContextSession = 
    Context &
    SessionFlavor<SessionData>


export type MyContext = ConversationFlavor<ContextSession>;
export type MyConversation = Conversation<MyContext, Context>;



// Типы для организаций
export interface Organization {
  id: number;
  inn: string;
  name: string;
  status: 'red' | 'orange' | 'green';
  zskStatus: 'red' | 'green';
  address?: string;
  websites?: string[];
  isLiquidated?: boolean;
  illegalitySigns?: string[];
  region?: string;
  additionalInfo?: string;
  comment?: string;
  riskInfo?: string;
  hasIllegalActivity?: boolean;
  addedDate: Date;
  updatedDate: Date;
}

// Типы для проверок организаций
export interface OrganizationCheck {
  id: number;
  inn: string;
  checkDate: Date;
  status: 'red' | 'orange' | 'green' | 'removed';
  details: Record<string, any>;
  notified: boolean;
}

// Типы для проверок ЗСК
export interface ZskCheck {
  id: number;
  inn: string;
  checkDate: Date;
  status: 'red' | 'green';
  resultText: string;
  notified: boolean;
}

// Типы для пользователей
export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  is_admin: boolean;
  createdAt: Date;
}

// Типы для групп отслеживания
export interface UserGroup {
  id: number;
  name: string;
  owner_id: number;
  invite_code: string;
  created_at: Date;
}

// Типы для участников групп
export interface GroupMember {
  group_id: number;
  user_id: number;
  joined_at: Date;
}

// Типы для организаций в группах
export interface GroupOrganization {
  group_id: number;
  inn: string;
  added_by: number;
  added_at: Date;
}

// Типы для связи пользователь-организация
export interface UserOrganization {
  userId: number;
  inn: string;
}

// Типы для API ЦБ РФ Warning List
export interface CBRWarningListSearchResponse {
  Data: Array<{
    id: number | null;
    dt: string | null;
    nameOrg: string | null;
    comment: string | null;
  }>;
}

export interface CBRWarningListDetailResponse {
  Info: Array<{
    id: number | null;
    dt: string | null;
    nameOrg: string | null;
    inn: string | null;
    addr: string | null;
    site: string | null;
    info: string | null;
    dateUpdate: string | null;
    isLikvid: string | null;
    comment: string | null;
  }>;
  Signs: Array<{
    id: number | null;
    signRus: string | null;
    signEng: string | null;
  }>;
  Regions: Array<{
    name: string | null;
    okato: number | null;
  }>;
}

export interface CBRWarningListLibResponse {
  Themas: Array<{
    id: number | null;
    signRus: string | null;
    signEng: string | null;
  }>;
  Regions: Array<{
    reg_name: string | null;
    reg_eng_name: string | null;
    okato: number | null;
  }>;
}

// Для обратной совместимости
export interface CBRResponse {
  RawData: Array<{
    element_id: number;
    measure_id: number;
    unit_id: number;
    obs_val: number;
    rowId: number;
    dt: string;
    periodicity: string;
    colId: number;
    date: string;
    digits: number;
  }>;
  headerData: Array<{
    id: number;
    elname: string;
  }>;
  units: Array<{
    id: number;
    val: string;
  }>;
  DTRange: Array<{
    FromY: number;
    ToY: number;
  }>;
  SType: Array<{
    sType: number;
    dsName: string;
    PublName: string;
  }>;
}

// Типы для уведомлений
export interface Notification {
  type: 'red' | 'orange' | 'green' | 'removed';
  organization: Organization;
  message: string;
  timestamp: Date;
}

// Типы для меню
export interface MenuItem {
  text: string;
  callback_data: string;
}

// Типы для ошибок
export interface BotError {
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
}

// Типы для конфигурации
export interface BotConfig {
  token: string;
  databaseUrl: string;
  cbrApiUrl: string;
  monitoringInterval: number;
  adminUserIds: number[];
  logLevel: string;
}

// Типы для мониторинга
export interface MonitoringResult {
  inn: string;
  status: 'red' | 'orange' | 'green' | 'removed';
  details: Record<string, any>;
  timestamp: Date;
}