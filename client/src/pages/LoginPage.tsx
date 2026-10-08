import React, { useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { Logo } from '../components/Logo';

export const LoginPage: React.FC = () => {
  const { devLogin, loginWithFirebaseGoogle, isFirebaseConfigured } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await loginWithFirebaseGoogle();
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
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoadingRole(null);
    }
  };

  const ladder = [
    { day: '30', name: '勸導', h: 'h-10', color: 'bg-stage-1' },
    { day: '50', name: '催告', h: 'h-16', color: 'bg-stage-2' },
    { day: '80', name: '終止', h: 'h-24', color: 'bg-stage-3' },
    { day: '95', name: 'write-off', h: 'h-32', color: 'bg-stage-4' },
  ];

  const demoRoles: Array<{ role: Role; title: string; desc: string }> = [
    { role: 'TWO_C_TEAM', title: '2C 催帳專員', desc: '記錄 Line、Email、簡訊、電話通知與催帳備註' },
    { role: 'FA_TEAM', title: 'FA 財務法務專員', desc: '處理催告、終止函與存證信函，上傳文件' },
    { role: 'ADMIN', title: '系統主管', desc: '檢視全部案件並管理信箱白名單' },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* 左側：產品說明與升級階梯 */}
      <aside className="hidden lg:flex flex-col justify-between bg-brand-900 text-white p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <Logo className="w-9 h-9" />
          <span className="text-lg font-bold tracking-tight">Boxful 呆帳追蹤</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-[40px] leading-[1.15] font-bold tracking-tight">
            從逾期第 30 天，<br />一路追到結案。
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-brand-100/80">
            每週匯入 Outstanding Report，系統依逾期天數自動分到各階段。2C 負責勸導，FA 接手催告與終止，所有紀錄同步回 Google 試算表。
          </p>

          <div className="mt-12 flex items-end gap-3" aria-hidden>
            {ladder.map((step) => (
              <div key={step.day} className="flex-1">
                <div className={`${step.h} ${step.color} rounded-t-md`} />
                <div className="mt-3 text-2xl font-bold tabular-nums">{step.day}<span className="text-sm font-medium text-brand-200/70 ml-0.5">天</span></div>
                <div className="text-[13px] text-brand-100/70">{step.name}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-brand-200/50">僅供 Boxful 內部使用</p>
      </aside>

      {/* 右側：登入 */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Logo className="w-8 h-8" />
            <span className="text-base font-bold tracking-tight">Boxful 呆帳追蹤</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-ink-900">登入</h2>
          <p className="mt-1.5 text-sm text-ink-500">
            使用 @boxful.com.tw 帳號，系統會依白名單給予對應權限。
          </p>

          {error && (
            <div role="alert" className="mt-6 p-3 rounded-lg bg-red-50 text-red-800 text-[13px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed whitespace-pre-line">{error}</div>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || !!loadingRole}
            className="btn btn-secondary w-full mt-8 !py-2.5 !text-sm"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
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
            {isGoogleLoading ? '驗證中' : '使用 Google 帳號登入'}
          </button>
          {!isFirebaseConfigured && (
            <p className="mt-2 text-xs text-amber-700">尚未設定 Firebase，Google 登入暫時無法使用。</p>
          )}

          <div className="mt-10">
            <div className="flex items-center gap-3 text-xs font-semibold text-ink-500">
              以測試角色進入
              <span className="flex-1 h-px bg-ink-200" />
            </div>
            <ul className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
              {demoRoles.map((r) => (
                <li key={r.role}>
                  <button
                    onClick={() => handleDevLogin(r.role)}
                    disabled={!!loadingRole}
                    className="group w-full text-left py-3 flex items-center gap-3 disabled:opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
                        {r.title}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">{r.desc}</div>
                    </div>
                    {loadingRole === r.role ? (
                      <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-brand-600 transition-colors" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};
