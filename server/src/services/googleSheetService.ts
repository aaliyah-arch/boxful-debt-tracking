import { config } from '../config';

export interface RawReportSyncPayload {
  businessUnit: 'VALET' | 'PEPPER';
  headers: string[];
  rows: any[][];
}

export interface SummaryItemPayload {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  serviceType?: string;
  address?: string;
  outstandingDays: number;
  totalOutstandingAmount: number;
  stage?: string;
  statusTag?: string;
}

/**
 * 取得 Google 試算表 Web App 網址
 */
export function getGoogleDebtBackupUrl(): string {
  return config.googleDebtBackupUrl || '';
}

/**
 * 通用呼叫 Google Apps Script Web App 的 POST 方法
 */
async function callGoogleAppsScript(action: string, data: Record<string, any>): Promise<any> {
  const url = getGoogleDebtBackupUrl();
  if (!url || !url.startsWith('http')) {
    console.info(`[GoogleSheetService] 尚未設定 GOOGLE_DEBT_BACKUP_URL，略過本次試算表回寫 (${action})`);
    return { skipped: true, reason: 'GOOGLE_DEBT_BACKUP_URL_NOT_CONFIGURED' };
  }

  const payload = {
    action,
    ...data,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[GoogleSheetService] Web App 回應 HTTP ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const resJson = await response.json();
    return resJson;
  } catch (err: any) {
    console.error(`[GoogleSheetService] 回寫 Google 試算表失敗 (${action}):`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 1. 覆蓋寫入原始報表 (OutstandingReportValet / OutstandingReportPepper)
 */
export async function overwriteRawReportInSheet(
  businessUnit: 'VALET' | 'PEPPER',
  headers: string[],
  rows: any[][]
) {
  return callGoogleAppsScript('OVERWRITE_RAW_REPORT', {
    businessUnit,
    headers,
    rows,
  });
}

/**
 * 2. 彙整並同步至追蹤工作表 (Valet扣款失敗通知追蹤 / Pepper扣款失敗通知追蹤)
 */
export async function syncSummaryTrackingToSheet(
  businessUnit: 'VALET' | 'PEPPER',
  items: SummaryItemPayload[]
) {
  return callGoogleAppsScript('SYNC_SUMMARY_TRACKING', {
    businessUnit,
    items,
  });
}

/**
 * 3. 前端單筆回寫 (當 2C/FA 在前端調整催帳狀態、備註或結案狀態時即時回寫)
 */
export async function updateRowStatusInSheet(
  businessUnit: 'VALET' | 'PEPPER',
  uid: string,
  fields: Record<string, any>
) {
  return callGoogleAppsScript('UPDATE_ROW_STATUS', {
    businessUnit,
    uid,
    fields,
  });
}
