import React from 'react';
import { Upload, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { BusinessUnit, Role } from '../types';
import { Logo } from './Logo';

interface NavbarProps {
  currentBusinessUnit: BusinessUnit;
  onBusinessUnitChange: (unit: BusinessUnit) => void;
  onOpenUpload: () => void;
  activeTab: 'dashboard' | 'cases';
  setActiveTab: (tab: 'dashboard' | 'cases') => void;
}

const ROLE_LABEL: Record<Role, string> = {
  TWO_C_TEAM: '2C 催帳',
  FA_TEAM: 'FA 財務法務',
  ADMIN: '系統管理員',
  VIEWER: '唯讀',
};

const TABS: Array<{ key: 'dashboard' | 'cases'; label: string }> = [
  { key: 'dashboard', label: '總覽' },
  { key: 'cases', label: '案件清單' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentBusinessUnit,
  onBusinessUnitChange,
  onOpenUpload,
  activeTab,
  setActiveTab,
}) => {
  const { user, logout, is2CTeam } = useAuth();

  const tabButton = (key: 'dashboard' | 'cases', label: string, mobile = false) => {
    const active = activeTab === key;
    return (
      <button
        key={key}
        onClick={() => setActiveTab(key)}
        aria-current={active ? 'page' : undefined}
        className={`relative font-semibold transition-colors ${
          mobile ? 'flex-1 py-2.5 text-[13px]' : 'h-14 px-1 text-sm'
        } ${active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
      >
        {label}
        <span
          className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-colors ${
            active ? 'bg-brand-500' : 'bg-transparent'
          }`}
        />
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-ink-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Logo className="w-7 h-7" />
              <span className="text-[15px] font-bold text-ink-900 tracking-tight">呆帳追蹤</span>
            </div>

            <nav className="hidden md:flex items-center gap-6" aria-label="主要頁面">
              {TABS.map((t) => tabButton(t.key, t.label))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              role="group"
              aria-label="事業體"
              className="flex items-center rounded-lg bg-ink-100 p-0.5 text-[13px] font-semibold"
            >
              {(['VALET', 'PEPPER'] as BusinessUnit[]).map((unit) => {
                const active = currentBusinessUnit === unit;
                return (
                  <button
                    key={unit}
                    onClick={() => onBusinessUnitChange(unit)}
                    aria-pressed={active}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      active ? 'bg-white text-ink-900 shadow-[0_1px_2px_rgba(13,31,28,0.08)]' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {unit === 'VALET' ? 'Valet' : 'Pepper'}
                  </button>
                );
              })}
            </div>

            {is2CTeam && (
              <button onClick={onOpenUpload} className="btn btn-primary hidden sm:inline-flex !py-1.5">
                <Upload className="w-4 h-4" />
                上傳週報
              </button>
            )}

            <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-ink-200">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-[13px]">
                {user?.name?.charAt(0) || '?'}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-[13px] font-semibold text-ink-900">{user?.name || '使用者'}</div>
                <div className="text-xs text-ink-500">{ROLE_LABEL[user?.role ?? 'VIEWER']}</div>
              </div>
              <button
                onClick={logout}
                title="登出"
                aria-label="登出"
                className="p-1.5 rounded-md text-ink-400 hover:text-ink-800 hover:bg-ink-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <nav className="md:hidden flex border-t border-ink-100 px-4" aria-label="主要頁面">
        {TABS.map((t) => tabButton(t.key, t.label, true))}
      </nav>
    </header>
  );
};
