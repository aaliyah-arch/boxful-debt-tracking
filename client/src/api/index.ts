import api from './client';
import type { BusinessUnit, DashboardOverview, CaseRecord, WhitelistItem, User, Role } from '../types';

export const authApi = {
  loginWithGoogle: async (payload: string | { credential?: string; email?: string; name?: string; avatarUrl?: string }) => {
    const body = typeof payload === 'string' ? { credential: payload } : payload;
    const res = await api.post<{ token: string; user: User }>('/auth/google', body);
    return res.data;
  },
  devLogin: async (role: Role) => {
    const res = await api.post<{ token: string; user: User }>('/auth/dev-login', { role });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<{ user: User }>('/auth/me');
    return res.data.user;
  },
};

export const dashboardApi = {
  getOverview: async (businessUnit: BusinessUnit, refDate?: string) => {
    const res = await api.get<DashboardOverview>('/dashboard/overview', {
      params: { businessUnit, refDate },
    });
    return res.data;
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
  },
  getById: async (id: string) => {
    const res = await api.get<{ case: CaseRecord }>(`/cases/${id}`);
    return res.data.case;
  },
  update2C: async (id: string, data: Partial<CaseRecord>) => {
    const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/2c`, data);
    return res.data;
  },
  updateFA: async (id: string, data: Partial<CaseRecord>) => {
    const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/fa`, data);
    return res.data;
  },
  closeCase: async (id: string, data: { isClosed: boolean; closedDate?: string | null }) => {
    const res = await api.patch<{ message: string; case: CaseRecord }>(`/cases/${id}/close`, data);
    return res.data;
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
    const res = await api.get('/reports/history');
    return res.data.history;
  },
  downloadSample: async () => {
    const res = await api.get('/reports/sample-template', { responseType: 'blob' });
    return res.data;
  },
};

export const whitelistApi = {
  list: async () => {
    const res = await api.get<{ whitelist: WhitelistItem[] }>('/whitelist');
    return res.data.whitelist;
  },
  create: async (data: { email: string; role: Role; note?: string }) => {
    const res = await api.post<{ item: WhitelistItem }>('/whitelist', data);
    return res.data.item;
  },
  update: async (id: string, data: { role?: Role; note?: string }) => {
    const res = await api.patch<{ item: WhitelistItem }>(`/whitelist/${id}`, data);
    return res.data.item;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/whitelist/${id}`);
    return res.data;
  },
  sync: async (data: { items?: Array<{ email: string; role?: string; note?: string }>; gasUrl?: string }) => {
    const res = await api.post<{ message: string; result: any }>('/whitelist/sync', data);
    return res.data;
  },
};

