import api from './client';
import type { BusinessUnit, DashboardOverview, CaseRecord, WhitelistItem, User, Role } from '../types';
import { standaloneStore, loadCasesFromSheet, matchesMonthBucket } from './standaloneStore';
import { getTerminationReminder } from '../utils/terminationReminder';

export const authApi = {
  loginWithGoogle: async (payload: string | { credential?: string; email?: string; name?: string; avatarUrl?: string }) => {
    const body = typeof payload === 'string' ? { credential: payload } : payload;
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/google', body);
      return res.data;
    } catch {
      // Fallback to client-side authentication on GitHub Pages
      return await standaloneStore.loginWithGoogleFallback(body);
    }
  },
  devLogin: async (role: Role) => {
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/dev-login', { role });
      return res.data;
    } catch {
      return standaloneStore.devLoginFallback(role);
    }
  },
  getMe: async () => {
    try {
      const res = await api.get<{ user: User }>('/auth/me');
      return res.data.user;
    } catch {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        const u = JSON.parse(savedUser) as User;
        const wl = standaloneStore.getWhitelist();
        const found = wl.find((w) => w.email.toLowerCase() === u.email.toLowerCase());
        if (found && found.role !== u.role) {
          u.role = found.role;
          localStorage.setItem('auth_user', JSON.stringify(u));
        }
        return u;
      }
      throw new Error('Not authenticated');
    }
  },
};

export const dashboardApi = {
  getOverview: async (businessUnit: BusinessUnit, refDate?: string) => {
    try {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: { businessUnit, refDate },
      });
      return res.data;
    } catch {
      await loadCasesFromSheet();
      return standaloneStore.getDashboardOverview(businessUnit);
    }
  },
};

export interface CaseListQuery {
  businessUnit?: BusinessUnit;
  stage?: string;
  monthBucket?: string;
  isClosed?: boolean;
  search?: string;
  minDays?: number;
  maxDays?: number;
  contactStatus?: string;
  statusTag?: string;
  /** 'ANY'：只看可發或即將可發終止函的案件 */
  terminationReminder?: 'ANY';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TerminationReminderSummary {
  businessUnit: BusinessUnit;
  dueCount: number;
  soonCount: number;
}

/** 兩個事業體各有幾件可發 / 即將可發終止函（儀表板提醒用） */
export async function getTerminationReminderSummary(): Promise<TerminationReminderSummary[]> {
  const all = await loadCasesFromSheet();
  return (['VALET', 'PEPPER'] as BusinessUnit[]).map((bu) => {
    const rs = all
      .filter((c) => c.businessUnit === bu)
      .map((c) => getTerminationReminder(c))
      .filter(Boolean);
    const dueCount = rs.filter((r) => r!.status === 'DUE').length;
    return { businessUnit: bu, dueCount, soonCount: rs.length - dueCount };
  });
}

export const casesApi = {
  list: async (params: CaseListQuery) => {
    try {
      const res = await api.get<{
        items: CaseRecord[];
        pagination: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
        totalAmountSum: number;
        pendingConfirmationCount?: number;
        terminationDueCount?: number;
        terminationSoonCount?: number;
      }>('/cases', { params });
      return res.data;
    } catch {
      const allCases = await loadCasesFromSheet();
      let items = allCases;
      if (params.businessUnit) items = items.filter((c) => c.businessUnit === params.businessUnit);
      if (params.stage) items = items.filter((c) => c.stage === params.stage);
      if (params.monthBucket) items = items.filter((c) => matchesMonthBucket(c, params.monthBucket!));
      if (params.statusTag) items = items.filter((c) => c.statusTag === params.statusTag);
      if (params.terminationReminder) items = items.filter((c) => !!getTerminationReminder(c));
      if (params.minDays !== undefined) items = items.filter((c) => c.outstandingDays >= params.minDays!);
      if (params.maxDays !== undefined) items = items.filter((c) => c.outstandingDays <= params.maxDays!);
      if (params.contactStatus) {
        const cs = params.contactStatus;
        items = items.filter((c) => {
          if (cs === 'line_contacted') return !!c.lineNoticeDate;
          if (cs === 'email_contacted') return !!c.emailNoticeDate;
          if (cs === 'phone_contacted') return !!c.phoneNoticeDate;
          if (cs === 'uncontacted') return !c.lineNoticeDate && !c.emailNoticeDate && !c.phoneNoticeDate && !c.smsNoticeDate;
          return true;
        });
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        items = items.filter(
          (c) => c.name.toLowerCase().includes(s) || c.uid.toLowerCase().includes(s) || c.id.toLowerCase().includes(s)
        );
      }

      // 排序
      const sortBy = (params.sortBy || 'outstandingDays') as keyof CaseRecord;
      const dir = params.sortOrder === 'asc' ? 1 : -1;
      items = [...items].sort((a, b) => {
        const av = a[sortBy] as any;
        const bv = b[sortBy] as any;
        if (typeof av === 'number' || typeof bv === 'number') return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av ?? '').localeCompare(String(bv ?? ''), 'zh-Hant') * dir;
      });

      const totalAmountSum = items.reduce((sum, c) => sum + c.outstandingAmount, 0);
      const unitCases = allCases.filter((c) => !params.businessUnit || c.businessUnit === params.businessUnit);
      const reminders = unitCases.map((c) => getTerminationReminder(c)).filter(Boolean);
      const terminationDueCount = reminders.filter((r) => r!.status === 'DUE').length;
      const terminationSoonCount = reminders.length - terminationDueCount;
      const pendingConfirmationCount = allCases.filter(
        (c) => (!params.businessUnit || c.businessUnit === params.businessUnit) && !c.isClosed && c.statusTag === 'PENDING_CONFIRMATION'
      ).length;

      // 分頁：一次只顯示一頁，避免案件多時畫面卡住
      const pageSize = params.pageSize || 20;
      const totalCount = items.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const page = Math.min(Math.max(1, params.page || 1), totalPages);

      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalCount, totalPages },
        totalAmountSum,
        pendingConfirmationCount,
        terminationDueCount,
        terminationSoonCount,
      };
    }
  },
  getById: async (id: string) => {
    try {
      const res = await api.get<{ case: CaseRecord }>(`/cases/${id}`);
      return res.data.case;
    } catch {
      let found = standaloneStore.getCases().find((c) => c.id === id);
      if (!found) found = (await loadCasesFromSheet(true)).find((c) => c.id === id);
      if (!found) throw new Error('Case not found');
      return found;
    }
  },
  update2C: async (id: string, data: Partial<CaseRecord>) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/2c`, data);
      return res.data;
    } catch {
      const updated = await standaloneStore.updateCase2C(id, data);
      return { message: '更新成功', case: updated };
    }
  },
  updateFA: async (id: string, data: Partial<CaseRecord>) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/fa`, data);
      return res.data;
    } catch {
      const updated = await standaloneStore.updateCaseFA(id, data);
      return { message: '更新成功', case: updated };
    }
  },
  closeCase: async (id: string, data: { isClosed: boolean; closedDate?: string | null }) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/close`, data);
      return res.data;
    } catch {
      const updated = await standaloneStore.closeCase(id, data);
      return { message: '結案狀態已更新', case: updated };
    }
  },
  exportExcel: async (params: CaseListQuery) => {
    const res = await api.get('/cases/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

export const reportsApi = {
  upload: async (file: File, businessUnit: BusinessUnit) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('businessUnit', businessUnit);
      const res = await api.post('/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch {
      // Fallback: 支援 GitHub Pages 等純靜態環境，在瀏覽器端直接解析並回寫 Google 試算表
      return await standaloneStore.importReportFallback(file, businessUnit);
    }
  },
  getHistory: async () => {
    try {
      const res = await api.get('/reports/history');
      return res.data.history;
    } catch {
      return standaloneStore.getImportHistory();
    }
  },
  downloadSample: async () => {
    try {
      const res = await api.get('/reports/sample-template', { responseType: 'blob' });
      return res.data;
    } catch {
      return standaloneStore.downloadSampleTemplateFallback();
    }
  },
};

export const whitelistApi = {
  list: async () => {
    try {
      const res = await api.get<{ whitelist: WhitelistItem[] }>('/whitelist');
      return res.data.whitelist;
    } catch {
      return standaloneStore.getWhitelist();
    }
  },
  create: async (data: { email: string; role: Role; note?: string }) => {
    try {
      const res = await api.post<{ item: WhitelistItem }>('/whitelist', data);
      return res.data.item;
    } catch {
      return standaloneStore.addWhitelistItem(data);
    }
  },
  update: async (id: string, data: { role?: Role; note?: string }) => {
    try {
      const res = await api.patch<{ item: WhitelistItem }>(`/whitelist/${id}`, data);
      return res.data.item;
    } catch {
      return standaloneStore.updateWhitelistItem(id, data);
    }
  },
  delete: async (id: string) => {
    try {
      const res = await api.delete(`/whitelist/${id}`);
      return res.data;
    } catch {
      standaloneStore.deleteWhitelistItem(id);
      return { message: '已成功移除' };
    }
  },
  sync: async (data: { items?: Array<{ email: string; role?: string; note?: string }>; gasUrl?: string }) => {
    try {
      const res = await api.post<{ message: string; result: any }>('/whitelist/sync', data);
      return res.data;
    } catch {
      if (data.gasUrl) {
        return await standaloneStore.syncFromGoogleAppsScript(data.gasUrl);
      }
      throw new Error('未提供 Google Apps Script 網址');
    }
  },
};

