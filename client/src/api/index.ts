import api from './client';
import type { BusinessUnit, DashboardOverview, CaseRecord, WhitelistItem, User, Role } from '../types';
import { standaloneStore } from './standaloneStore';

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
      if (savedUser) return JSON.parse(savedUser) as User;
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
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
      }>('/cases', { params });
      return res.data;
    } catch {
      let items = standaloneStore.getCases();
      if (params.businessUnit) items = items.filter((c) => c.businessUnit === params.businessUnit);
      if (params.stage) items = items.filter((c) => c.stage === params.stage);
      if (params.search) {
        const s = params.search.toLowerCase();
        items = items.filter((c) => c.name.toLowerCase().includes(s) || c.uid.toLowerCase().includes(s));
      }
      const totalAmountSum = items.reduce((sum, c) => sum + c.outstandingAmount, 0);
      return {
        items,
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: items.length,
          totalPages: 1,
        },
        totalAmountSum,
      };
    }
  },
  getById: async (id: string) => {
    try {
      const res = await api.get<{ case: CaseRecord }>(`/cases/${id}`);
      return res.data.case;
    } catch {
      const found = standaloneStore.getCases().find((c) => c.id === id);
      if (!found) throw new Error('Case not found');
      return found;
    }
  },
  update2C: async (id: string, data: Partial<CaseRecord>) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/2c`, data);
      return res.data;
    } catch {
      const updated = standaloneStore.updateCase2C(id, data);
      return { message: '更新成功', case: updated };
    }
  },
  updateFA: async (id: string, data: Partial<CaseRecord>) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/fa`, data);
      return res.data;
    } catch {
      const updated = standaloneStore.updateCaseFA(id, data);
      return { message: '更新成功', case: updated };
    }
  },
  closeCase: async (id: string, data: { isClosed: boolean; closedDate?: string | null }) => {
    try {
      const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/close`, data);
      return res.data;
    } catch {
      const updated = standaloneStore.closeCase(id, data);
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('businessUnit', businessUnit);
    const res = await api.post('/reports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getHistory: async () => {
    try {
      const res = await api.get('/reports/history');
      return res.data.history;
    } catch {
      return [];
    }
  },
  downloadSample: async () => {
    const res = await api.get('/reports/sample-template', { responseType: 'blob' });
    return res.data;
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

