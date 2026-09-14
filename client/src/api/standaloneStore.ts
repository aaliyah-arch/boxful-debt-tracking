import type { BusinessUnit, CaseRecord, DashboardOverview, Role, WhitelistItem, User } from '../types';

const WHITELIST_STORAGE_KEY = 'boxful_whitelist_data';
const CASES_STORAGE_KEY = 'boxful_cases_data';
export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbx-1i9fSZXDylorowLFoQlz43aV1tlc3VxLDlDxA7jt1xZ_5z2npeP1QbHXoOyRm-8d/exec';

const DEFAULT_ALLOWED_DOMAIN = 'boxful.com.tw';

const DEFAULT_WHITELIST: WhitelistItem[] = [
  {
    id: 'wl-1',
    email: 'aaliyah@boxful.com.tw',
    role: 'ADMIN',
    note: '系統最高管理員 / 2C Team',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-2',
    email: 'lika@boxful.com.tw',
    role: 'TWO_C_TEAM',
    note: '2C Team 催款專員',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-3',
    email: 'steven@boxful.com.tw',
    role: 'FA_TEAM',
    note: 'FA 財務法務專員',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wl-4',
    email: 'andy.chen@boxful.com.tw',
    role: 'FA_TEAM',
    note: 'FA 財務法務專員',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_CASES: CaseRecord[] = [
  {
    id: 'c-v-1',
    uid: 'V-2607-001',
    name: '陳國華',
    email: 'guohua.chen@boxful.com.tw',
    phone: '0928-111-222',
    businessUnit: 'VALET',
    outstandingAmount: 18500,
    outstandingDays: 68,
    billDate: '2026-07-02',
    collectionStartDate: '2026-07-10',
    stage: 'STAGE_2',
    isClosed: false,
    lineNoticeDate: '2026-07-12',
    lineStatus: '已讀未回',
    emailNoticeDate: '2026-07-18',
    phoneNoticeDate: '2026-07-25',
    phoneStatus: '承諾7月底繳款，逾期未繳',
    demandNoticeDate: '2026-08-20',
    demandDueDate: '2026-09-05',
    demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-chen',
    twoCNotes: '客戶電話中態度消極，轉交 FA 進行第二階段催告',
    faNotes: '已寄送存證信函/催告函，待到期日追蹤',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-v-2',
    uid: 'V-2607-002',
    name: '林雅慧',
    email: 'yahui.lin@boxful.com.tw',
    phone: '0935-333-444',
    businessUnit: 'VALET',
    outstandingAmount: 45000,
    outstandingDays: 88,
    billDate: '2026-07-05',
    collectionStartDate: '2026-07-15',
    stage: 'STAGE_3',
    isClosed: false,
    lineNoticeDate: '2026-07-16',
    demandNoticeDate: '2026-08-25',
    demandDueDate: '2026-09-08',
    demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-lin',
    terminationNoticeDate: '2026-09-02',
    terminationDocUrl: 'https://docs.google.com/document/d/1valet-term-lin',
    twoCNotes: 'Line封鎖，電話空號',
    faNotes: '滿80天發送終止函，等待15天期滿',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-v-3',
    uid: 'V-2608-001',
    name: '黃志強',
    email: 'chihchiang.huang@boxful.com.tw',
    phone: '0912-888-999',
    businessUnit: 'VALET',
    outstandingAmount: 12000,
    outstandingDays: 42,
    billDate: '2026-08-01',
    collectionStartDate: '2026-08-10',
    stage: 'STAGE_1',
    isClosed: false,
    lineNoticeDate: '2026-08-10',
    lineStatus: '已回覆會於發薪日繳納',
    twoCNotes: '預計補繳，持續觀察中',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-v-4',
    uid: 'V-2608-002',
    name: '張淑芬',
    email: 'shufen.chang@boxful.com.tw',
    phone: '0958-666-777',
    businessUnit: 'VALET',
    outstandingAmount: 23400,
    outstandingDays: 52,
    billDate: '2026-08-03',
    collectionStartDate: '2026-08-12',
    stage: 'STAGE_2',
    isClosed: false,
    lineNoticeDate: '2026-08-12',
    demandNoticeDate: '2026-09-01',
    demandDueDate: '2026-09-15',
    demandDocUrl: 'https://docs.google.com/document/d/1valet-demand-chang',
    twoCNotes: '多次未接聽',
    faNotes: '已發出催告通知',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-v-5',
    uid: 'V-2609-001',
    name: '周建明',
    email: 'chienming.chou@boxful.com.tw',
    phone: '0972-555-666',
    businessUnit: 'VALET',
    outstandingAmount: 8800,
    outstandingDays: 32,
    billDate: '2026-09-01',
    collectionStartDate: '2026-09-05',
    stage: 'STAGE_1',
    isClosed: false,
    lineNoticeDate: '2026-09-05',
    lineStatus: '已傳送第一階段勸導通知',
    twoCNotes: '首次通知',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-v-6',
    uid: 'V-2609-002',
    name: '許美玲',
    email: 'meiling.hsu@boxful.com.tw',
    phone: '0988-222-333',
    businessUnit: 'VALET',
    outstandingAmount: 16000,
    outstandingDays: 35,
    billDate: '2026-09-02',
    collectionStartDate: '2026-09-06',
    stage: 'CLOSED',
    isClosed: true,
    closedDate: '2026-09-08',
    lineNoticeDate: '2026-09-06',
    lineStatus: '收到通知後即刻匯款',
    twoCNotes: '2C Line 通知後已結案',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // PEPPER (Self-Storage) cases
  {
    id: 'c-p-1',
    uid: 'P-2607-001',
    name: '極品咖啡館',
    email: 'premium.cafe@gmail.com',
    phone: '0966-123-987',
    businessUnit: 'PEPPER',
    outstandingAmount: 48000,
    outstandingDays: 82,
    billDate: '2026-07-01',
    collectionStartDate: '2026-07-08',
    stage: 'STAGE_3',
    isClosed: false,
    lineNoticeDate: '2026-07-09',
    demandNoticeDate: '2026-08-15',
    demandDueDate: '2026-08-30',
    demandDocUrl: 'https://docs.google.com/document/d/1pepper-demand-cafe',
    terminationNoticeDate: '2026-09-03',
    terminationDocUrl: 'https://docs.google.com/document/d/1pepper-term-cafe',
    faNotes: '已寄送終止合約通知函',
    lastImportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c-p-2',
    uid: 'P-2608-001',
    name: '饗樂燒肉殿',
    email: 'feast.yakiniku@gmail.com',
    phone: '0977-888-111',
    businessUnit: 'PEPPER',
    outstandingAmount: 64000,
    outstandingDays: 55,
    billDate: '2026-08-05',
    collectionStartDate: '2026-08-15',
    stage: 'STAGE_2',
    isClosed: false,
    lineNoticeDate: '2026-08-15',
    demandNoticeDate: '2026-09-02',
    demandDueDate: '2026-09-16',
    demandDocUrl: 'https://docs.google.com/document/d/1pepper-demand-yakiniku',
    faNotes: 'FA 催告期，等待回覆中',
    lastImportedAt: new Date().toISOString(),
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
        // If it's the old mock list containing 2c.team@boxful.com.tw, replace with real team
        if (Array.isArray(parsed) && parsed.some((x: any) => x.email?.includes('2c.team@boxful.com.tw'))) {
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
      // Column B (role) = 2C Team, Column C (note) = FA Team
      if (roleStr === 'O' && noteStr === 'O') {
        role = 'ADMIN';
      } else if (noteStr === 'O') {
        role = 'FA_TEAM';
      } else if (roleStr === 'O') {
        role = 'TWO_C_TEAM';
      } else if (roleStr.includes('ADMIN') || roleStr.includes('主管') || roleStr.includes('管理')) {
        role = 'ADMIN';
      } else if (roleStr.includes('FA') || roleStr.includes('法務') || roleStr.includes('財務')) {
        role = 'FA_TEAM';
      } else if (roleStr.includes('VIEWER') || roleStr.includes('訪客')) {
        role = 'VIEWER';
      }

      // Main administrator
      if (normalizedEmail.includes('aaliyah')) {
        role = 'ADMIN';
      }

      let defaultNote = '來自 Google 試算表同步';
      if (role === 'ADMIN') defaultNote = '系統管理員 / 2C Team';
      else if (role === 'TWO_C_TEAM') defaultNote = '2C Team 催款專員';
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

    // If whitelist is present, match role; if not present, grant ADMIN if first user or admin email
    let role: Role = matched ? matched.role : 'TWO_C_TEAM';
    if (!matched) {
      if (whitelist.length <= 4 || email.includes('admin') || email.includes('aaliyah') || email.includes('shancai')) {
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
  getCases: (): CaseRecord[] => {
    try {
      const saved = localStorage.getItem(CASES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading cases from localStorage', e);
    }
    localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(INITIAL_CASES));
    return INITIAL_CASES;
  },

  saveCases: (cases: CaseRecord[]) => {
    localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
  },

  updateCase2C: (id: string, data: Partial<CaseRecord>): CaseRecord => {
    const cases = standaloneStore.getCases();
    const index = cases.findIndex((c) => c.id === id);
    if (index >= 0) {
      cases[index] = { ...cases[index], ...data, updatedAt: new Date().toISOString() };
      standaloneStore.saveCases(cases);
      return cases[index];
    }
    throw new Error('找不到該案件');
  },

  updateCaseFA: (id: string, data: Partial<CaseRecord>): CaseRecord => {
    const cases = standaloneStore.getCases();
    const index = cases.findIndex((c) => c.id === id);
    if (index >= 0) {
      cases[index] = { ...cases[index], ...data, updatedAt: new Date().toISOString() };
      standaloneStore.saveCases(cases);
      return cases[index];
    }
    throw new Error('找不到該案件');
  },

  closeCase: (id: string, data: { isClosed: boolean; closedDate?: string | null }): CaseRecord => {
    const cases = standaloneStore.getCases();
    const index = cases.findIndex((c) => c.id === id);
    if (index >= 0) {
      cases[index] = {
        ...cases[index],
        isClosed: data.isClosed,
        closedDate: data.isClosed ? data.closedDate || new Date().toISOString() : null,
        stage: data.isClosed ? 'CLOSED' : cases[index].stage,
        updatedAt: new Date().toISOString(),
      };
      standaloneStore.saveCases(cases);
      return cases[index];
    }
    throw new Error('找不到該案件');
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
};
