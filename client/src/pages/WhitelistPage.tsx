import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2, Edit2, Check, X, AlertCircle, RefreshCw, FileSpreadsheet, ExternalLink, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import type { Role } from '../types';
import { whitelistApi } from '../api';

export const WhitelistPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('boxful_gas_sync_url') || 'https://script.google.com/macros/s/AKfycbx-1i9fSZXDylorowLFoQlz43aV1tlc3VxLDlDxA7jt1xZ_5z2npeP1QbHXoOyRm-8d/exec');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('TWO_C_TEAM');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('TWO_C_TEAM');
  const [editNote, setEditNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: whitelist, isLoading } = useQuery({
    queryKey: ['whitelist'],
    queryFn: whitelistApi.list,
  });

  const syncMutation = useMutation({
    mutationFn: (url: string) => whitelistApi.sync({ gasUrl: url }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      setSyncStatusMsg(data.message);
      if (gasUrl) localStorage.setItem('boxful_gas_sync_url', gasUrl);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || '同步失敗');
    },
  });

  // Auto sync on page visit
  React.useEffect(() => {
    if (gasUrl) {
      syncMutation.mutate(gasUrl);
    }
  }, []);

  const addMutation = useMutation({
    mutationFn: whitelistApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      setIsAddOpen(false);
      setNewEmail('');
      setNewNote('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || '新增失敗');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role: Role; note?: string } }) =>
      whitelistApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: whitelistApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    addMutation.mutate({
      email: newEmail.trim(),
      role: newRole,
      note: newNote.trim() || undefined,
    });
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'TWO_C_TEAM':
        return { label: '2C Team 催帳專員', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'FA_TEAM':
        return { label: 'FA 財務法務專員', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'ADMIN':
        return { label: '系統管理員 (Admin)', color: 'bg-amber-50 text-amber-700 border-amber-300' };
      default:
        return { label: '訪客唯讀 (Viewer)', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Google 登入白名單與權限設定</h1>
            <p className="text-xs text-slate-500">
              透過 Google 信箱自動授予對應角色權限（2C Team / FA Team / Admin）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsSyncOpen(true);
              setErrorMsg(null);
              setSyncStatusMsg(null);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            從 Google 試算表同步
          </button>
          <button
            onClick={() => {
              setIsAddOpen(true);
              setErrorMsg(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新增白名單信箱
          </button>
        </div>
      </div>

      {/* Google Sheet Sync Modal */}
      {isSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">從 Google 試算表同步權限名單</h3>
              </div>
              <button onClick={() => setIsSyncOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {syncStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>連結之 Google 試算表：</span>
                <a
                  href="https://docs.google.com/spreadsheets/d/1sxEHrQUqVxxzgy-a5bqAMOZ1ObV9fORn50c1-njCLYQ/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                >
                  開啟試算表 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-slate-500">
                此功能透過 Google Apps Script 將試算表中的 <code className="bg-slate-200 px-1 py-0.5 rounded">Email</code>、<code className="bg-slate-200 px-1 py-0.5 rounded">角色</code>、<code className="bg-slate-200 px-1 py-0.5 rounded">備註</code> 自動同步至系統白名單。
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Apps Script Web App 網址 (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-white px-3 py-2.5 border focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  貼入 Apps Script 部署為 Web 應用程式後的網址即可即時同步
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSyncOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  關閉
                </button>
                <button
                  type="button"
                  disabled={syncMutation.isPending || !gasUrl.trim()}
                  onClick={() => syncMutation.mutate(gasUrl.trim())}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {syncMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      同步中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      立即同步名單
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">新增人員至白名單</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google 企業信箱 (Email)
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@boxful.com.tw"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-white px-3 py-2.5 border focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  指派系統角色 (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-white px-3 py-2.5 border focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TWO_C_TEAM">2C Team 催帳專員 (可維護 Line/Email/電話催帳)</option>
                  <option value="FA_TEAM">FA 財務法務專員 (可維護 50天催告 / 80天終止 Google Doc)</option>
                  <option value="ADMIN">系統管理員 (全功能與白名單管理)</option>
                  <option value="VIEWER">訪客 (僅能檢視報表)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  備註說明 (選填)
                </label>
                <input
                  type="text"
                  placeholder="例如: 客服組專員 Alice"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-white px-3 py-2.5 border focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
                >
                  {addMutation.isPending ? '處理中...' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Whitelist Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <th className="py-3 px-4">Google 帳號 (Email)</th>
              <th className="py-3 px-3">系統權限角色</th>
              <th className="py-3 px-3">備註說明</th>
              <th className="py-3 px-3">建立時間</th>
              <th className="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  載入中...
                </td>
              </tr>
            ) : whitelist?.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  尚未設定任何白名單
                </td>
              </tr>
            ) : (
              whitelist?.map((item) => {
                const isEditing = editingId === item.id;
                const roleBadge = getRoleLabel(item.role);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      {item.email}
                    </td>
                    <td className="py-3.5 px-3">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as Role)}
                          className="text-xs rounded-lg border-slate-300 p-1"
                        >
                          <option value="TWO_C_TEAM">2C Team 催帳專員</option>
                          <option value="FA_TEAM">FA 財務法務專員</option>
                          <option value="ADMIN">系統管理員</option>
                          <option value="VIEWER">訪客唯讀</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${roleBadge.color}`}
                        >
                          {roleBadge.label}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="text-xs rounded-lg border-slate-300 px-2 py-1 w-full"
                        />
                      ) : (
                        item.note || '-'
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                      {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: item.id,
                                data: { role: editRole, note: editNote },
                              })
                            }
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded text-slate-400 hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingId(item.id);
                              setEditRole(item.role);
                              setEditNote(item.note || '');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`確定要將 ${item.email} 從白名單移除嗎？`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
