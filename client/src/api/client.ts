import axios from 'axios';
import { isGasHosted } from './gas';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  // 網頁由 Apps Script 提供時沒有 /api 後端，直接改走各功能的 Apps Script 路徑
  if (isGasHosted()) return Promise.reject(new Error('NO_BACKEND'));
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    return Promise.reject(error);
  }
);

export default api;
