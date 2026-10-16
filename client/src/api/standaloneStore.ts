import type { BusinessUnit, CaseRecord, DashboardOverview, Role, WhitelistItem, User } from '../types';
import { parseSpreadsheetFile, generateSampleExcelBlob, computeStage } from '../utils/reportParser';

const WHITELIST_STORAGE_KEY = 'boxful_whitelist_data';
const CASES_STORAGE_KEY = 'boxful_cases_data';
const IMPORT_HISTORY_STORAGE_KEY = 'boxful_import_history';
export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbx-1i9fSZXDylorowLFoQlz43aV1tlc3VxLDlDxA7jt1xZ_5z2npeP1QbHXoOyRm-8d/exec';

export const DEFAULT_DEBT_BACKUP_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzbayhWa_N7qzx_jhw7R9uRp1v6itw7zK8amzcbdEXHMP96mt91dXaPnUPhuEj9JvcR/exec';

/**
 * 上傳檔案至 Google 雲端（試算表所在資料夾的「2bad-debtbackup 附件」），回傳檔案連結
 */
export async function uploadFileToGas(
  file: File,
  meta: { businessUnit: string; uid: string; kind: string }
): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('檔案超過 20MB，請壓縮後再上傳');
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
  const res = await fetch(DEFAULT_DEBT_BACKUP_GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'UPLOAD_FILE',
      ...meta,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!json || !json.success || !json.result?.url) {
    throw new Error(json?.error || '上傳至 Google 雲端失敗，請確認 Apps Script 已重新部署');
  }
  return json.result.url as string;
}

export interface SheetSyncStatus {
  ok: boolean;
  message: string;
}

/**
 * 呼叫 Apps Script 並等待回應；任何失敗都會丟出可讀的錯誤訊息
 */
async function postToGas(action: string, payload: Record<string, any>): Promise<any> {
  if (!DEFAULT_DEBT_BACKUP_GAS_URL) throw new Error('尚未設定 Google 試算表 Apps Script 網址');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  let res: Response;
  try {
    res = await fetch(DEFAULT_DEBT_BACKUP_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Apps Script 回應逾時（超過 5 分鐘）');
    throw new Error(
      '無法連線到 Google Apps Script。請確認部署設定「誰可以存取」為「任何人」，並已用「新版本」重新部署'
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Apps Script 回應 HTTP ${res.status}`);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Apps Script 回應格式錯誤（可能需要重新授權或重新部署）');
  }
  if (!json.success) throw new Error(`Apps Script 錯誤：${json.error || '未知錯誤'}`);
  return json.result;
}

// ==============================================================================
// 案件資料：以 Google 試算表（Valet/Pepper扣款失敗通知追蹤）為唯一資料來源
// 所有使用者讀寫同一份試算表，瀏覽器只保留一份快取，離線時才使用
// ==============================================================================

const CASES_CACHE_TTL_MS = 5 * 1000;
let lastCasesFetchAt = 0;
let inflightCasesFetch: Promise<CaseRecord[]> | null = null;
let lastCasesError: string | null = null;

const str = (v: any): string => (v === null || v === undefined ? '' : String(v).trim());
const strOrNull = (v: any): string | null => str(v) || null;
const num = (v: any): number => {
  const n = Number(str(v).replace(/[,\s$NT]/g, ''));
  return isNaN(n) ? 0 : n;
};

/** 試算表一列 → 前端案件資料 */
function sheetRowToCase(r: any): CaseRecord {
  const isClosed = r.isClosed === true;
  const outstandingDays = num(r.outstandingDays);
  const terminationNoticeDate = strOrNull(r.terminationNoticeDate);
  const updatedAt = str(r.updatedAt);
  return {
    id: str(r.caseId) || `${r.businessUnit}-${str(r.uid)}`,
    uid: str(r.uid),
    name: str(r.name) || `客戶-${str(r.uid)}`,
    email: strOrNull(r.email),
    phone: strOrNull(r.phone),
    businessUnit: r.businessUnit as BusinessUnit,
    outstandingAmount: num(r.amount),
    outstandingDays,
    billDate: strOrNull(r.billDate),
    address: strOrNull(r.address),
    serviceType: strOrNull(r.serviceType),
    statusTag: r.statusTag === 'PENDING_CONFIRMATION' ? 'PENDING_CONFIRMATION' : 'NORMAL',
    // 階段一律依逾期天數與終止日重新計算，避免試算表手動輸入的文字造成誤判
    stage: computeStage({ isClosed, outstandingDays, terminationNoticeDate }),
    isClosed,
    closedDate: strOrNull(r.closedDate),
    collectionStartDate: strOrNull(r.collectionStartDate),
    lineNoticeDate: strOrNull(r.lineNoticeDate),
    emailNoticeDate: strOrNull(r.emailNoticeDate),
    smsNoticeDate: strOrNull(r.smsNoticeDate),
    phoneNoticeDate: strOrNull(r.phoneNoticeDate),
    twoCNotes: strOrNull(r.twoCNotes),
    demandMethod: r.demandMethod === 'EMAIL' || r.demandMethod === 'CERTIFIED_LETTER' ? r.demandMethod : null,
    demandSmsDate: strOrNull(r.demandSmsDate),
    demandDocUrl: strOrNull(r.demandDocUrl),
    demandNoticeDate: strOrNull(r.demandNoticeDate),
    demandDueDate: strOrNull(r.demandDueDate),
    terminationSmsDate: strOrNull(r.terminationSmsDate),
    terminationNoticeDate,
    terminationDueDate: strOrNull(r.terminationDueDate),
    certifiedLetterSentDate: strOrNull(r.certifiedLetterSentDate),
    certifiedLetterReceivedDate: strOrNull(r.certifiedLetterReceivedDate),
    faNotes: strOrNull(r.faNotes),
    lastImportedAt: updatedAt,
    createdAt: strOrNull(r.collectionStartDate) || updatedAt,
    updatedAt,
  };
}

/** 最近一次從試算表讀取失敗的原因（成功時為 null） */
export function getCasesSyncError(): string | null {
  return lastCasesError;
}

/**
 * 從 Google 試算表讀取最新案件；5 秒內重複呼叫直接用快取
 * 讀取失敗時沿用瀏覽器快取，並記錄錯誤原因
 */
export async function loadCasesFromSheet(force = false): Promise<CaseRecord[]> {
  if (!force && Date.now() - lastCasesFetchAt < CASES_CACHE_TTL_MS) {
    return standaloneStore.getCases();
  }
  if (inflightCasesFetch) return inflightCasesFetch;
  inflightCasesFetch = (async () => {
    try {
      const result = await postToGas('LIST_CASES', {});
      const cases: CaseRecord[] = (result?.cases || [])
        .filter((r: any) => str(r.uid))
        .map(sheetRowToCase);
      standaloneStore.saveCases(cases);
      lastCasesFetchAt = Date.now();
      lastCasesError = null;
      return cases;
    } catch (e: any) {
      lastCasesError = e?.message || '讀取 Google 試算表失敗';
      console.warn('[GAS Sync] 讀取案件失敗，改用瀏覽器快取：', lastCasesError);
      return standaloneStore.getCases();
    } finally {
      inflightCasesFetch = null;
    }
  })();
  return inflightCasesFetch;
}

/** 依案件ID回寫試算表；失敗會丟出錯誤，確保使用者知道沒存成功 */
async function writeCaseToSheet(c: CaseRecord, fields: Record<string, any>) {
  const result = await postToGas('UPDATE_ROW_STATUS', {
    businessUnit: c.businessUnit,
    uid: c.uid,
    caseId: c.id,
    fields,
  });
  if (result && result.success === false) {
    throw new Error(result.message || '回寫 Google 試算表失敗');
  }
}

/** 原始報表列整理：日期轉 yyyy-MM-dd、補齊欄數、去除整列空白 */
function sanitizeRawRows(headers: string[], rows: any[][]): any[][] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return rows
    .map((r) =>
      headers.map((_, i) => {
        const v = r?.[i];
        if (v === undefined || v === null) return '';
        if (v instanceof Date) {
          return isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
        }
        return v;
      })
    )
    .filter((r) => r.some((v) => String(v).trim() !== ''));
}

let lastSyncSummary: any = null;

let lastReportSync: null | {
  businessUnit: BusinessUnit;
  headers: string[];
  rows: any[][];
  items: any[];
} = null;

async function syncReportToSheet(job: NonNullable<typeof lastReportSync>): Promise<SheetSyncStatus> {
  lastReportSync = job;
  try {
    const raw = await postToGas('OVERWRITE_RAW_REPORT', {
      businessUnit: job.businessUnit,
      headers: job.headers,
      rows: job.rows,
    });
    const summary = await postToGas('SYNC_SUMMARY_TRACKING', {
      businessUnit: job.businessUnit,
      items: job.items,
      markMissingAsPending: true,
    });
    lastReportSync = null;
    lastSyncSummary = summary;
    await loadCasesFromSheet(true);
    return {
      ok: true,
      message: `已寫入「${raw?.sheetName ?? '原始報表'}」${raw?.rowCount ?? job.rows.length} 列；「${
        summary?.sheetName ?? '追蹤表'
      }」更新 ${summary?.updatedCount ?? 0} 筆、新增 ${summary?.newCount ?? 0} 筆、轉待確認 ${summary?.pendingCount ?? 0} 筆`,
    };
  } catch (e: any) {
    console.error('[GAS Sync] 報表回寫失敗', e);
    return { ok: false, message: e?.message || '回寫 Google 試算表失敗' };
  }
}

/** 重新同步上一次失敗的報表回寫 */
export async function retryLastReportSync(): Promise<SheetSyncStatus> {
  if (!lastReportSync) return { ok: false, message: '沒有待重新同步的報表，請重新上傳檔案' };
  return syncReportToSheet(lastReportSync);
}

const DEFAULT_ALLOWED_DOMAIN = 'boxful.com.tw';

const DEFAULT_WHITELIST: WhitelistItem[] = [
  {
    id: 'wl-1',
    email: 'aaliyah@boxful.com.tw',
    role: 'FA_TEAM',
    note: 'FA 財務法務專員',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-2',
    email: 'lika@boxful.com.tw',
    role: 'FA_TEAM',
    note: 'FA 財務法務專員',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-3',
    email: 'steven@boxful.com.tw',
    role: 'TWO_C_TEAM',
    note: '2C Team 催款專員 (可上傳週報)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-4',
    email: 'andy.chen@boxful.com.tw',
    role: 'TWO_C_TEAM',
    note: '2C Team 催款專員 (可上傳週報)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const standaloneStore = {
  // Whitelist operations
  getWhitelist: (): WhitelistItem[] => {
    try {
      const saved = localStorage.getItem(WHITELIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it's the old mock list or old admin mapping, replace with correct team roles
        if (
          Array.isArray(parsed) &&
          (parsed.some((x: any) => x.email?.includes('2c.team@boxful.com.tw')) ||
           parsed.some((x: any) => x.email === 'aaliyah@boxful.com.tw' && x.role === 'ADMIN'))
        ) {
          localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(DEFAULT_WHITELIST));
          return DEFAULT_WHITELIST;
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading whitelist from localStorage', e);
    }
    localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(DEFAULT_WHITELIST));
    return DEFAULT_WHITELIST;
  },

  saveWhitelist: (items: WhitelistItem[]) => {
    localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(items));
  },

  addWhitelistItem: (item: { email: string; role: Role; note?: string }): WhitelistItem => {
    const list = standaloneStore.getWhitelist();
    const existingIndex = list.findIndex((x) => x.email.toLowerCase() === item.email.toLowerCase());
    const newItem: WhitelistItem = {
      id: `wl-${Date.now()}`,
      email: item.email.trim(),
      role: item.role,
      note: item.note || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      list[existingIndex] = newItem;
    } else {
      list.push(newItem);
    }
    standaloneStore.saveWhitelist(list);
    return newItem;
  },

  updateWhitelistItem: (id: string, data: { role?: Role; note?: string }): WhitelistItem => {
    const list = standaloneStore.getWhitelist();
    const index = list.findIndex((x) => x.id === id);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      standaloneStore.saveWhitelist(list);
      return list[index];
    }
    throw new Error('找不到該白名單項目');
  },

  deleteWhitelistItem: (id: string) => {
    const list = standaloneStore.getWhitelist();
    const filtered = list.filter((x) => x.id !== id);
    standaloneStore.saveWhitelist(filtered);
  },

  syncFromGoogleAppsScript: async (url: string) => {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      throw new Error(`Google Apps Script 連線失敗 (HTTP ${res.status})`);
    }

    let items: Array<{ email: string; role?: string; note?: string }> = [];
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data)) {
        items = data;
      } else if (Array.isArray(data.data)) {
        items = data.data;
      } else if (Array.isArray(data.users)) {
        items = data.users;
      }
    } else {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) items = parsed;
        else if (Array.isArray(parsed.data)) items = parsed.data;
      } catch {
        // Parse CSV
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
          const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('信箱'));
          const roleIdx = headers.findIndex((h) => h.includes('role') || h.includes('角色'));
          const noteIdx = headers.findIndex((h) => h.includes('note') || h.includes('備註'));
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
            const email = cols[emailIdx >= 0 ? emailIdx : 0];
            if (email && email.includes('@')) {
              items.push({
                email,
                role: roleIdx >= 0 ? cols[roleIdx] : 'TWO_C_TEAM',
                note: noteIdx >= 0 ? cols[noteIdx] : '',
              });
            }
          }
        }
      }
    }

    if (!items.length) {
      throw new Error('無法從 Google 試算表解析出任何人員名單，請確認試算表格式');
    }

    const currentList = standaloneStore.getWhitelist();
    let syncedCount = 0;
    for (const item of items) {
      if (!item.email) continue;
      const normalizedEmail = item.email.trim().toLowerCase();
      let role: Role = 'TWO_C_TEAM';
      const roleStr = (item.role || '').toUpperCase().trim();
      const noteStr = (item.note || '').toUpperCase().trim();

      // Support O/X column checkboxes from Google Sheet
      // Column B (role) = FA Team, Column C (note) = 2C Team (可上傳週報)
      if (roleStr === 'O' && noteStr === 'O') {
        role = 'ADMIN';
      } else if (roleStr === 'O') {
        role = 'FA_TEAM';
      } else if (noteStr === 'O') {
        role = 'TWO_C_TEAM';
      } else if (roleStr.includes('ADMIN') || roleStr.includes('主管') || roleStr.includes('管理')) {
        role = 'ADMIN';
      } else if (roleStr.includes('FA') || roleStr.includes('法務') || roleStr.includes('財務')) {
        role = 'FA_TEAM';
      } else if (roleStr.includes('2C') || roleStr.includes('催帳') || roleStr.includes('催款')) {
        role = 'TWO_C_TEAM';
      } else if (roleStr.includes('VIEWER') || roleStr.includes('訪客')) {
        role = 'VIEWER';
      }

      let defaultNote = '來自 Google 試算表同步';
      if (role === 'ADMIN') defaultNote = '系統管理員';
      else if (role === 'TWO_C_TEAM') defaultNote = '2C Team 催款專員 (可上傳週報)';
      else if (role === 'FA_TEAM') defaultNote = 'FA 財務法務專員';

      const existingIdx = currentList.findIndex((x) => x.email.toLowerCase() === normalizedEmail);
      const entry: WhitelistItem = {
        id: existingIdx >= 0 ? currentList[existingIdx].id : `wl-${Date.now()}-${syncedCount}`,
        email: normalizedEmail,
        role,
        note: (item.note && item.note !== 'O' && item.note !== 'X') ? item.note : defaultNote,
        createdAt: existingIdx >= 0 ? currentList[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = entry;
      } else {
        currentList.push(entry);
      }
      syncedCount++;
    }

    standaloneStore.saveWhitelist(currentList);
    return {
      message: `成功從 Google 試算表同步 ${syncedCount} 筆人員白名單！`,
      result: { count: syncedCount, items: currentList },
    };
  },

  // Auth Operations
  loginWithGoogleFallback: async (userInfo: { email?: string; name?: string; avatarUrl?: string }): Promise<{ token: string; user: User }> => {
    const email = (userInfo.email || '').trim().toLowerCase();
    if (!email) {
      throw new Error('未取得 Google 信箱資訊');
    }

    // Check enterprise domain restriction
    if (!email.endsWith(`@${DEFAULT_ALLOWED_DOMAIN}`)) {
      throw new Error(`登入失敗：僅限 @${DEFAULT_ALLOWED_DOMAIN} 企業網域登入（目前帳號為 ${email}）`);
    }

    // Auto-sync latest permissions from Google Sheet before completing login
    try {
      await standaloneStore.syncFromGoogleAppsScript(DEFAULT_GAS_URL);
    } catch (e) {
      console.warn('Auto sync on login failed/offline:', e);
    }

    const whitelist = standaloneStore.getWhitelist();
    const matched = whitelist.find((w) => w.email.toLowerCase() === email);

    // If whitelist is present, match role; if not present, grant ADMIN if admin email
    let role: Role = matched ? matched.role : 'VIEWER';
    if (!matched) {
      if (email.includes('admin')) {
        role = 'ADMIN';
        standaloneStore.addWhitelistItem({
          email,
          role: 'ADMIN',
          note: '首次登入自動授予管理員權限',
        });
      }
    }

    const user: User = {
      id: `usr-${Date.now()}`,
      email,
      name: userInfo.name || email.split('@')[0],
      avatarUrl: userInfo.avatarUrl,
      role,
    };

    const token = `standalone-token-${Date.now()}`;
    return { token, user };
  },

  devLoginFallback: (role: Role): { token: string; user: User } => {
    const roleNames: Record<Role, string> = {
      TWO_C_TEAM: '2C 催款專員 (Alice)',
      FA_TEAM: 'FA 專員 (Bob)',
      ADMIN: '系統主管 (Admin)',
      VIEWER: '訪客唯讀 (Viewer)',
    };
    const roleEmails: Record<Role, string> = {
      TWO_C_TEAM: '2c.specialist@boxful.com.tw',
      FA_TEAM: 'fa.specialist@boxful.com.tw',
      ADMIN: 'admin@boxful.com.tw',
      VIEWER: 'viewer@boxful.com.tw',
    };

    const user: User = {
      id: `dev-${role.toLowerCase()}`,
      email: roleEmails[role],
      name: roleNames[role],
      role,
    };

    return { token: `dev-token-${Date.now()}`, user };
  },

  // Cases Operations
  // 瀏覽器快取（最新資料請用 loadCasesFromSheet 從試算表讀取）
  getCases: (): CaseRecord[] => {
    try {
      const saved = localStorage.getItem(CASES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading cases from localStorage', e);
    }
    return [];
  },

  saveCases: (cases: CaseRecord[]) => {
    try {
      localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
    } catch (e) {
      console.warn('Error saving cases to localStorage', e);
    }
  },

  /** 先寫入試算表，成功後再更新畫面；其他人重新整理即可看到 */
  updateCaseFields: async (id: string, data: Partial<CaseRecord>): Promise<CaseRecord> => {
    const cases = standaloneStore.getCases();
    const index = cases.findIndex((c) => c.id === id);
    if (index < 0) throw new Error('找不到該案件，請重新整理頁面');
    await writeCaseToSheet(cases[index], data);
    const fresh = await loadCasesFromSheet(true);
    const updated = fresh.find((c) => c.id === id);
    if (updated) return updated;
    cases[index] = { ...cases[index], ...data, updatedAt: new Date().toISOString() };
    standaloneStore.saveCases(cases);
    return cases[index];
  },

  updateCase2C: (id: string, data: Partial<CaseRecord>) => standaloneStore.updateCaseFields(id, data),

  updateCaseFA: (id: string, data: Partial<CaseRecord>) => standaloneStore.updateCaseFields(id, data),

  closeCase: (id: string, data: { isClosed: boolean; closedDate?: string | null }) => {
    if (!data.isClosed) {
      // 同一位客戶已經有另一筆未結案案件時，不允許重新開啟舊案，避免同 UID 出現兩筆追蹤中案件
      const cases = standaloneStore.getCases();
      const target = cases.find((c) => c.id === id);
      const other = target && cases.find(
        (c) => c.id !== id && !c.isClosed && c.uid === target.uid && c.businessUnit === target.businessUnit
      );
      if (other) {
        return Promise.reject(new Error(`此客戶已有追蹤中的案件（${other.id}），無法重新開啟舊案件`));
      }
    }
    return standaloneStore.updateCaseFields(id, {
      isClosed: data.isClosed,
      closedDate: data.isClosed ? data.closedDate || new Date().toISOString().split('T')[0] : null,
      statusTag: data.isClosed ? 'NORMAL' : undefined,
    });
  },

  // Dashboard Overview computation
  getDashboardOverview: (businessUnit: BusinessUnit): DashboardOverview => {
    const allCases = standaloneStore.getCases().filter((c) => c.businessUnit === businessUnit);

    const activeCases = allCases.filter((c) => !c.isClosed);
    const closedCases = allCases.filter((c) => c.isClosed);

    const totalOutstandingAmount = activeCases.reduce((sum, c) => sum + c.outstandingAmount, 0);
    const totalClosedAmount = closedCases.reduce((sum, c) => sum + c.outstandingAmount, 0);

    const stages: Array<{ code: string; label: string }> = [
      { code: 'UNREACHED', label: '未達催帳天數 (<30天)' },
      { code: 'STAGE_1', label: '第一階段：2C勸導 (30-50天)' },
      { code: 'STAGE_2', label: '第二階段：FA存證催告 (50-80天)' },
      { code: 'STAGE_3', label: '第三階段：FA終止合約 (>80天)' },
      { code: 'STAGE_4', label: '第四階段：待呆帳沖銷 (終止滿15天)' },
      { code: 'CLOSED', label: '已結案' },
    ];

    const timeBuckets = [
      { key: 'older', label: '2026/06 前' },
      { key: '2026/07', label: '2026/07' },
      { key: '2026/08', label: '2026/08' },
      { key: '2026/09', label: '2026/09' },
      { key: 'total', label: '總計', isTotal: true },
    ];

    const stageBreakdown: Record<string, { count: number; amount: number }> = {};
    stages.forEach((s) => {
      const match = allCases.filter((c) => (s.code === 'CLOSED' ? c.isClosed : !c.isClosed && c.stage === s.code));
      stageBreakdown[s.code] = {
        count: match.length,
        amount: match.reduce((sum, c) => sum + c.outstandingAmount, 0),
      };
    });

    const rows = stages.map((s) => {
      const stageCases = allCases.filter((c) => (s.code === 'CLOSED' ? c.isClosed : !c.isClosed && c.stage === s.code));
      const buckets: Record<string, { amount: number; count: number; percentage: number; percentageStr: string }> = {};

      const totalAmt = stageCases.reduce((sum, c) => sum + c.outstandingAmount, 0);
      buckets['total'] = {
        amount: totalAmt,
        count: stageCases.length,
        percentage: 100,
        percentageStr: '100%',
      };

      timeBuckets.forEach((tb) => {
        if (tb.isTotal) return;
        const bCases = stageCases.filter((c) => {
          if (tb.key === 'older') return (c.billDate || '') < '2026-07-01';
          return (c.billDate || '').startsWith(tb.key.replace('/', '-'));
        });
        const amt = bCases.reduce((sum, c) => sum + c.outstandingAmount, 0);
        buckets[tb.key] = {
          amount: amt,
          count: bCases.length,
          percentage: totalAmt > 0 ? Math.round((amt / totalAmt) * 100) : 0,
          percentageStr: totalAmt > 0 ? `${Math.round((amt / totalAmt) * 100)}%` : '0%',
        };
      });

      return {
        key: s.code,
        stageCode: s.code,
        label: s.label,
        buckets,
      };
    });

    const totalsBuckets: Record<string, { amount: number; count: number; percentage: number; percentageStr: string }> = {};
    const totalAllAmt = allCases.reduce((sum, c) => sum + c.outstandingAmount, 0);
    totalsBuckets['total'] = {
      amount: totalAllAmt,
      count: allCases.length,
      percentage: 100,
      percentageStr: '100%',
    };
    timeBuckets.forEach((tb) => {
      if (tb.isTotal) return;
      const bCases = allCases.filter((c) => {
        if (tb.key === 'older') return (c.billDate || '') < '2026-07-01';
        return (c.billDate || '').startsWith(tb.key.replace('/', '-'));
      });
      const amt = bCases.reduce((sum, c) => sum + c.outstandingAmount, 0);
      totalsBuckets[tb.key] = {
        amount: amt,
        count: bCases.length,
        percentage: totalAllAmt > 0 ? Math.round((amt / totalAllAmt) * 100) : 0,
        percentageStr: totalAllAmt > 0 ? `${Math.round((amt / totalAllAmt) * 100)}%` : '0%',
      };
    });

    return {
      businessUnit,
      referenceDate: '2026-09-14',
      timeBuckets,
      rows,
      totalsRow: {
        key: 'totals',
        stageCode: 'TOTAL',
        label: '各月份呆帳總額',
        buckets: totalsBuckets,
      },
      kpiSummary: {
        totalOutstandingAmount,
        totalClosedAmount,
        totalCases: allCases.length,
        activeCases: activeCases.length,
        closedCases: closedCases.length,
        stageBreakdown,
      },
    };
  },

  // Report & Import Operations
  getImportHistory: () => {
    try {
      const saved = localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading import history from localStorage', e);
    }
    return [];
  },

  downloadSampleTemplateFallback: (): Blob => {
    return generateSampleExcelBlob();
  },

  importReportFallback: async (file: File, businessUnit: BusinessUnit) => {
    const { rawHeaders, rawRows, parsedRawRows, aggregatedMap } = await parseSpreadsheetFile(file);
    if (parsedRawRows.length === 0) {
      throw new Error('檔案中未能解析出有效資料，請確認欄位包含 UID/客戶編號 及 逾期天數/金額');
    }

    const newCount = 0;
    const updatedCount = 0;

    let uName = '使用者';
    try {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u?.name) uName = u.name;
      }
    } catch {}

    // 記錄匯入歷史
    try {
      const history = standaloneStore.getImportHistory();
      history.unshift({
        id: `imp-${Date.now()}`,
        fileName: file.name,
        businessUnit,
        totalRows: parsedRawRows.length,
        newCases: newCount,
        updatedCases: updatedCount,
        uploadedBy: uName,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save import history:', e);
    }

    // 回寫 Google 試算表 (2bad-debtbackup)：覆蓋原始報表，再由 Apps Script 比對追蹤表
    // （同 UID 未結案 → 更新；已結案或首次欠款 → 新增一列並給新案件ID；不在報表中 → 待確認是否結案）
    const summaryItems = Array.from(aggregatedMap.values()).map((c) => ({
      uid: c.uid,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      serviceType: c.serviceType || '',
      address: c.address || '',
      billDate: c.billDate || '',
      outstandingDays: c.outstandingDays,
      totalOutstandingAmount: c.totalOutstandingAmount,
      stage: computeStage({ isClosed: false, outstandingDays: c.outstandingDays }),
      statusTag: 'NORMAL',
    }));

    const sheetSync = await syncReportToSheet({
      businessUnit,
      headers: rawHeaders,
      rows: sanitizeRawRows(rawHeaders, rawRows),
      items: summaryItems,
    });

    // 寫入失敗時保留 sheetSync 錯誤，上傳視窗會顯示「重新同步到試算表」按鈕
    const summary = sheetSync.ok ? lastSyncSummary || {} : {};

    // 更新匯入歷史中的筆數
    try {
      const history = standaloneStore.getImportHistory();
      if (history[0]) {
        history[0].newCases = summary.newCount ?? 0;
        history[0].updatedCases = summary.updatedCount ?? 0;
        localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch {}

    return {
      message: `成功匯入 ${businessUnit} 報表！新增 ${summary.newCount ?? 0} 筆，更新 ${summary.updatedCount ?? 0} 筆`,
      result: {
        totalCount: parsedRawRows.length,
        newCount: summary.newCount ?? 0,
        updatedCount: summary.updatedCount ?? 0,
        pendingConfirmationCount: summary.pendingCount ?? 0,
        errorCount: 0,
        errors: [],
        sheetSync,
      },
    };
  },
};
