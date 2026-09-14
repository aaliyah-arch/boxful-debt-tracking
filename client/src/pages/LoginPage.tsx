import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

export const LoginPage: React.FC = () => {
  const { devLogin, loginWithFirebaseGoogle, isFirebaseConfigured, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await loginWithFirebaseGoogle();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Google 登入失敗');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDevLogin = async (role: Role) => {
    setLoadingRole(role);
    setError(null);
    try {
      await devLogin(role);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100/20 overflow-hidden p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-500/30">
            ZP
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            呆帳催款追蹤管理系統
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            2C Team 與 FA 共同協作追蹤平台
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-xs flex items-start gap-2 border border-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed whitespace-pre-line">{error}</div>
          </div>
        )}

        {/* Google OAuth Login Area */}
        <div className="space-y-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-2.5">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Boxful 企業 Google 帳號登入
              </span>
              {!isFirebaseConfigured && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                  待設定 Firebase
                </span>
              )}
            </div>
            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || !!loadingRole}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium text-xs shadow-xs transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              {isGoogleLoading ? '登入驗證中...' : '使用 Boxful Google 帳號驗證登入'}
            </button>
            <span className="text-[10px] text-slate-400 block">
              僅限 @boxful.com.tw 網域 • 系統將自動比對信箱白名單給予角色權限
            </span>
          </div>
        </div>

        {/* Quick Role Switch for Testing & Demo */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>測試與角色快速切換登入：</span>
          </div>

          <div className="space-y-2">
            {/* 2C Team Specialist */}
            <button
              onClick={() => handleDevLogin('TWO_C_TEAM')}
              disabled={!!loadingRole}
              className="w-full text-left p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  2C Team 催帳專員 (Alice)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  權限：維護 Line / Email / 電話催帳、填寫催帳備註
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* FA Team Specialist */}
            <button
              onClick={() => handleDevLogin('FA_TEAM')}
              disabled={!!loadingRole}
              className="w-full text-left p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  FA 財務法務專員 (Bob)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  權限：滿50天催告/滿80天終止、維護 Google 雲端文件連結
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Admin */}
            <button
              onClick={() => handleDevLogin('ADMIN')}
              disabled={!!loadingRole}
              className="w-full text-left p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  系統主管 (Admin)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  權限：全系統完整管理、信箱白名單權限設定
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
