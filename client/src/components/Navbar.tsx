import React from 'react';
import { LayoutDashboard, Users, ShieldCheck, Upload, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { BusinessUnit, Role } from '../types';

interface NavbarProps {
  currentBusinessUnit: BusinessUnit;
  onBusinessUnitChange: (unit: BusinessUnit) => void;
  onOpenUpload: () => void;
  activeTab: 'dashboard' | 'cases' | 'whitelist';
  setActiveTab: (tab: 'dashboard' | 'cases' | 'whitelist') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentBusinessUnit,
  onBusinessUnitChange,
  onOpenUpload,
  activeTab,
  setActiveTab,
}) => {
  const { user, logout, is2CTeam, isAdmin } = useAuth();

  const getRoleBadge = (role?: Role) => {
    switch (role) {
      case 'TWO_C_TEAM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            2C Team 催帳
          </span>
        );
      case 'FA_TEAM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
            訪客唯讀
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                ZP
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  呆帳催款追蹤系統
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  2C Team & FA 協同作業平台
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                總覽看板
              </button>

              <button
                onClick={() => setActiveTab('cases')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'cases'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-600" />
                案件清單
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('whitelist')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'whitelist'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  權限白名單
                </button>
              )}
            </nav>
          </div>

          {/* Business Unit Switcher & Actions */}
          <div className="flex items-center gap-3">
            {/* Valet / Pepper Segmented Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => onBusinessUnitChange('VALET')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentBusinessUnit === 'VALET'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
                Valet
              </button>
              <button
                onClick={() => onBusinessUnitChange('PEPPER')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentBusinessUnit === 'PEPPER'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                上傳週報
              </button>
            )}

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="text-right hidden lg:block">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1.5">
                  {user?.name || '使用者'}
                  {getRoleBadge(user?.role)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {user?.email}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-300">
                {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>

              <button
                onClick={logout}
                title="登出系統"
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
