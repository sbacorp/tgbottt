import logger from '../utils/logger';

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

export class CBRService {
  private baseUrl = 'http://www.cbr.ru/warninglistapi';

  /**
   * Поиск организации в списке ЦБ РФ
   */
  async searchOrganization(inn: string): Promise<boolean> {
    try {
      logger.info(`Поиск организации с ИНН ${inn} в списке ЦБ РФ`);
      
      const url = `${this.baseUrl}/Search?sphrase=${inn}&page=0`;
      const response = await fetch(url);
      
      if (!response.ok) {
        logger.error(`Ошибка при поиске в ЦБ РФ для ИНН ${inn}: ${response.status}`);
        return false;
      }

      const data: CBRWarningListSearchResponse = await response.json();
      
      // Если найдены организации в списке
      const hasIllegalActivity = data.Data && data.Data.length > 0;
      
      logger.info(`Результат поиска в ЦБ РФ для ИНН ${inn}: ${hasIllegalActivity ? 'найдена' : 'не найдена'}`);
      
      return hasIllegalActivity;
    } catch (error) {
      logger.error(`Ошибка при поиске в ЦБ РФ для ИНН ${inn}:`, error);
      return false;
    }
  }
}

export const cbrService = new CBRService();
