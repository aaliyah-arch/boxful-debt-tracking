import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';

/** 催帳升級階梯：逾期天數 → 階段，顏色與全站階段標示一致 */
const LADDER = [
  { day: 30, name: '勸導', color: 'bg-stage-1', height: '34%' },
  { day: 50, name: '催告', color: 'bg-stage-2', height: '56%' },
  { day: 80, name: '終止', color: 'bg-stage-3', height: '78%' },
  { day: 95, name: '待沖銷', color: 'bg-stage-4', height: '100%' },
];

const GoogleIcon: React.FC = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
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
);

export const LoginPage: React.FC = () => {
  const { loginWithFirebaseGoogle, isFirebaseConfigured } = useAuth();
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="min-h-screen flex flex-col bg-ink-50 overflow-hidden">
      <style>{`
        @keyframes login-step-rise {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        .login-step {
          transform-origin: bottom;
          animation: login-step-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* 登入 */}
      <main className="flex-1 flex items-center justify-center px-4 pt-16 pb-10">
        <div className="w-full max-w-[360px] flex flex-col items-center text-center animate-fade-in">
          <Logo className="w-14 h-14" />

          <h1 className="mt-7 text-[30px] sm:text-[34px] leading-tight font-extrabold tracking-tight text-ink-900">
            Boxful 呆帳追蹤
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            從逾期第 30 天，一路追到結案。
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="mt-10 w-full h-12 inline-flex items-center justify-center gap-3 rounded-full bg-white text-[15px] font-semibold text-ink-900 ring-1 ring-ink-200 shadow-[0_1px_2px_rgba(22,48,43,0.06),0_8px_24px_-12px_rgba(22,48,43,0.18)] transition hover:ring-brand-400 hover:shadow-[0_1px_2px_rgba(22,48,43,0.06),0_12px_28px_-12px_rgba(30,107,98,0.35)] active:translate-y-px disabled:opacity-70 disabled:cursor-wait"
          >
            {isGoogleLoading ? (
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" aria-hidden />
            ) : (
              <GoogleIcon />
            )}
            {isGoogleLoading ? '登入中…' : '使用 Google 帳號登入'}
          </button>

          {!isFirebaseConfigured && (
            <p className="mt-3 text-xs text-amber-700">尚未設定 Firebase，Google 登入暫時無法使用。</p>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 w-full p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-red-800 text-[13px] flex items-start gap-2 text-left"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed whitespace-pre-line">{error}</div>
            </div>
          )}
        </div>
      </main>

      {/* 催帳升級階梯 */}
      <div
        className="relative h-[26vh] min-h-[130px] max-h-[260px] flex items-end gap-1 sm:gap-1.5"
        aria-hidden
      >
        {LADDER.map((step, i) => (
          <div key={step.day} className="flex-1 h-full flex flex-col justify-end">
            <div className="flex flex-col" style={{ height: step.height }}>
              <div className="px-3 sm:px-5 pb-2 sm:pb-3 flex flex-wrap items-baseline gap-x-2 text-ink-700">
                <span className="text-lg sm:text-2xl font-extrabold tabular-nums tracking-tight">
                  {step.day}
                  <span className="ml-0.5 text-xs sm:text-sm font-semibold">天</span>
                </span>
                <span className="text-xs sm:text-[13px] font-medium text-ink-500">{step.name}</span>
              </div>
              <div
                className={`login-step flex-1 min-h-[12px] ${step.color} rounded-t-lg sm:rounded-t-xl`}
                style={{ animationDelay: `${0.15 + i * 0.12}s` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
