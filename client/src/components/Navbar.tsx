import React from 'react';
import { LayoutDashboard, Users, Upload, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { BusinessUnit, Role } from '../types';

interface NavbarProps {
  currentBusinessUnit: BusinessUnit;
  onBusinessUnitChange: (unit: BusinessUnit) => void;
  onOpenUpload: () => void;
  activeTab: 'dashboard' | 'cases';
  setActiveTab: (tab: 'dashboard' | 'cases') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentBusinessUnit,
  onBusinessUnitChange,
  onOpenUpload,
  activeTab,
  setActiveTab,
}) => {
  const { user, logout, is2CTeam } = useAuth();

  const getRoleBadge = (role?: Role) => {
    switch (role) {
      case 'TWO_C_TEAM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
            2C Team 催帳
          </span>
        );
      case 'FA_TEAM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            FA 財務法務
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
            系統管理員
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-ink-100 text-ink-600">
            訪客唯讀
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-ink-200/80 shadow-[0_1px_0_0_rgba(16,24,23,0.02)] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-brand-300 before:via-brand-400 before:to-brand-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-black text-lg tracking-tight shadow-md shadow-brand-600/25 ring-1 ring-inset ring-white/20">
                ZP
              </div>
              <div>
                <h1 className="text-base font-bold text-ink-900 leading-tight">
                  呆帳催款追蹤系統
                </h1>
                <p className="text-xs text-ink-400 font-medium">
                  2C Team & FA 協同作業平台
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-ink-100/70 p-1 rounded-xl ring-1 ring-inset ring-ink-200/60">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-brand-800 shadow-sm ring-1 ring-ink-200/70'
                    : 'text-ink-500 hover:text-ink-900 hover:bg-white/60'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-brand-500' : 'text-ink-400'}`} />
                總覽看板
              </button>

              <button
                onClick={() => setActiveTab('cases')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'cases'
                    ? 'bg-white text-brand-800 shadow-sm ring-1 ring-ink-200/70'
                    : 'text-ink-500 hover:text-ink-900 hover:bg-white/60'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'cases' ? 'text-brand-500' : 'text-ink-400'}`} />
                案件清單
              </button>
            </nav>
          </div>

          {/* Business Unit Switcher & Actions */}
          <div className="flex items-center gap-3">
            {/* Valet / Pepper Segmented Switcher */}
            <div className="flex items-center bg-ink-100 p-1 rounded-xl border border-ink-200/60">
              <button
                onClick={() => onBusinessUnitChange('VALET')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentBusinessUnit === 'VALET'
                    ? 'bg-valet-600 text-white shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
                Valet
              </button>
              <button
                onClick={() => onBusinessUnitChange('PEPPER')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentBusinessUnit === 'PEPPER'
                    ? 'bg-pepper-600 text-white shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
                Pepper
              </button>
            </div>

            {/* Upload Report Button */}
            {is2CTeam && (
              <button
                onClick={onOpenUpload}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-xl transition-all shadow-sm shadow-brand-700/20"
              >
                <Upload className="w-3.5 h-3.5" />
                上傳週報
              </button>
            )}

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-ink-200">
              <div className="text-right hidden lg:block">
                <div className="text-xs font-bold text-ink-800 flex items-center justify-end gap-1.5">
                  {user?.name || '使用者'}
                  {getRoleBadge(user?.role)}
                </div>
                <div className="text-[11px] text-ink-400 font-mono">
                  {user?.email}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>

              <button
                onClick={logout}
                title="登出系統"
                className="p-2 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
