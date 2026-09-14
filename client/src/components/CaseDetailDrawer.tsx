import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  Clock,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  Save,
  AlertTriangle,
  History,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import type { CaseRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { casesApi } from '../api';
import { StatusBadge } from './StatusBadge';

interface CaseDetailDrawerProps {
  caseId: string | null;
  onClose: () => void;
  onCaseUpdated?: (updatedCase: CaseRecord) => void;
}

export const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({
  caseId,
  onClose,
  onCaseUpdated,
}) => {
  const { is2CTeam, isFATeam } = useAuth();
  const [caseData, setCaseData] = useState<CaseRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving2C, setIsSaving2C] = useState(false);
  const [isSavingFA, setIsSavingFA] = useState(false);
  const [isSavingClose, setIsSavingClose] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states - 2C
  const [lineNoticeDate, setLineNoticeDate] = useState('');
  const [lineStatus, setLineStatus] = useState('');
  const [emailNoticeDate, setEmailNoticeDate] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [phoneNoticeDate, setPhoneNoticeDate] = useState('');
  const [phoneStatus, setPhoneStatus] = useState('');
  const [twoCNotes, setTwoCNotes] = useState('');

  // Form states - FA
  const [demandNoticeDate, setDemandNoticeDate] = useState('');
  const [demandDueDate, setDemandDueDate] = useState('');
  const [demandDocUrl, setDemandDocUrl] = useState('');
  const [terminationNoticeDate, setTerminationNoticeDate] = useState('');
  const [terminationDocUrl, setTerminationDocUrl] = useState('');
  const [faNotes, setFaNotes] = useState('');

  // Form states - Close
  const [isClosed, setIsClosed] = useState(false);
  const [closedDate, setClosedDate] = useState('');

  const formatDateInput = (d?: string | null) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

  const loadCase = async (id: string) => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      const data = await casesApi.getById(id);
      setCaseData(data);

      // Populate 2C states
      setLineNoticeDate(formatDateInput(data.lineNoticeDate));
      setLineStatus(data.lineStatus || '');
      setEmailNoticeDate(formatDateInput(data.emailNoticeDate));
      setEmailStatus(data.emailStatus || '');
      setPhoneNoticeDate(formatDateInput(data.phoneNoticeDate));
      setPhoneStatus(data.phoneStatus || '');
      setTwoCNotes(data.twoCNotes || '');

      // Populate FA states
      setDemandNoticeDate(formatDateInput(data.demandNoticeDate));
      setDemandDueDate(formatDateInput(data.demandDueDate));
      setDemandDocUrl(data.demandDocUrl || '');
      setTerminationNoticeDate(formatDateInput(data.terminationNoticeDate));
      setTerminationDocUrl(data.terminationDocUrl || '');
      setFaNotes(data.faNotes || '');

      // Populate Close states
      setIsClosed(data.isClosed);
      setClosedDate(formatDateInput(data.closedDate) || format(new Date(), 'yyyy-MM-dd'));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || '載入案件失敗' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadCase(caseId);
    } else {
      setCaseData(null);
    }
  }, [caseId]);

  if (!caseId) return null;

  const handleSave2C = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;
    setIsSaving2C(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.update2C(caseData.id, {
        lineNoticeDate: lineNoticeDate || null,
        lineStatus: lineStatus || null,
        emailNoticeDate: emailNoticeDate || null,
        emailStatus: emailStatus || null,
        phoneNoticeDate: phoneNoticeDate || null,
        phoneStatus: phoneStatus || null,
        twoCNotes: twoCNotes || null,
      });
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: '2C 催帳紀錄已儲存' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || err.message || '更新失敗' });
    } finally {
      setIsSaving2C(false);
    }
  };

  const handleSaveFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;
    setIsSavingFA(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.updateFA(caseData.id, {
        demandNoticeDate: demandNoticeDate || null,
        demandDueDate: demandDueDate || null,
        demandDocUrl: demandDocUrl || null,
        terminationNoticeDate: terminationNoticeDate || null,
        terminationDocUrl: terminationDocUrl || null,
        faNotes: faNotes || null,
      });
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: 'FA 催告/終止紀錄已儲存' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || err.message || '更新失敗' });
    } finally {
      setIsSavingFA(false);
    }
  };

  const handleSaveClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;
    setIsSavingClose(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.closeCase(caseData.id, {
        isClosed,
        closedDate: isClosed ? closedDate || new Date().toISOString() : null,
      });
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: isClosed ? '案件已標記為已結案' : '案件已重新開啟' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || err.message || '結案操作失敗' });
    } finally {
      setIsSavingClose(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  caseData?.businessUnit === 'VALET'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {caseData?.businessUnit}
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {caseData?.name || '載入中...'}
              </h2>
              <span className="text-xs font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                UID: {caseData?.uid}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              {caseData && (
                <>
                  <StatusBadge stage={caseData.stage} isClosed={caseData.isClosed} />
                  <span>逾期天數: <strong className="text-slate-800">{caseData.outstandingDays} 天</strong></span>
                  <span>欠款金額: <strong className="text-red-600 font-semibold">${caseData.outstandingAmount.toLocaleString()}</strong></span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm">載入案件資料中...</p>
            </div>
          )}

          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              {feedbackMsg.text}
            </div>
          )}

          {caseData && (
            <>
              {/* Section 1: Customer Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">聯絡電話</span>
                  <span className="text-xs font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {caseData.phone || '無電話紀錄'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">電子信箱</span>
                  <span className="text-xs font-medium text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {caseData.email || '無 Email'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">帳單/應繳日</span>
                  <span className="text-xs font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {caseData.billDate ? format(new Date(caseData.billDate), 'yyyy-MM-dd') : '未提供'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">催帳開始日</span>
                  <span className="text-xs font-medium text-indigo-700 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    {caseData.collectionStartDate ? format(new Date(caseData.collectionStartDate), 'yyyy-MM-dd') : '尚未啟動'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">最後報表匯入</span>
                  <span className="text-xs font-medium text-slate-600 mt-0.5 block">
                    {format(new Date(caseData.lastImportedAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">結案狀態</span>
                  <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                    {caseData.isClosed ? `已結案 (${caseData.closedDate ? format(new Date(caseData.closedDate), 'yyyy-MM-dd') : ''})` : '未結案進行中'}
                  </span>
                </div>
              </div>

              {/* Section 2: 2C Team Collection Section */}
              <form onSubmit={handleSave2C} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">2C Team 催帳作業 (勸導期)</h3>
                      <p className="text-[11px] text-slate-500">
                        主要管道：<strong className="text-indigo-600">Line</strong> ➜ 未聯繫到依序以 <strong>Email</strong> ➜ <strong>電話</strong> 通知
                      </p>
                    </div>
                  </div>
                  {!is2CTeam && (
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">唯讀檢視</span>
                  )}
                </div>

                {/* Line Notice (Primary) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-950 mb-1">
                      🟢 Line 通知日期 (主要通知)
                    </label>
                    <input
                      type="date"
                      disabled={!is2CTeam}
                      value={lineNoticeDate}
                      onChange={(e) => setLineNoticeDate(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-950 mb-1">
                      Line 回覆狀態
                    </label>
                    <input
                      type="text"
                      disabled={!is2CTeam}
                      placeholder="例如: 已讀未回 / 承諾 9/15 繳款"
                      value={lineStatus}
                      onChange={(e) => setLineStatus(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* Email Notice */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      📧 Email 通知日期
                    </label>
                    <input
                      type="date"
                      disabled={!is2CTeam}
                      value={emailNoticeDate}
                      onChange={(e) => setEmailNoticeDate(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email 寄送/回覆備註
                    </label>
                    <input
                      type="text"
                      disabled={!is2CTeam}
                      placeholder="例如: 已寄送第1次催繳信"
                      value={emailStatus}
                      onChange={(e) => setEmailStatus(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* Phone Notice */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      📞 電話通知日期
                    </label>
                    <input
                      type="date"
                      disabled={!is2CTeam}
                      value={phoneNoticeDate}
                      onChange={(e) => setPhoneNoticeDate(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      電話通話紀錄
                    </label>
                    <input
                      type="text"
                      disabled={!is2CTeam}
                      placeholder="例如: 通話中承諾本週繳清 / 無人接聽"
                      value={phoneStatus}
                      onChange={(e) => setPhoneStatus(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* 2C Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    2C 催帳詳細備註
                  </label>
                  <textarea
                    rows={2}
                    disabled={!is2CTeam}
                    placeholder="填寫客戶狀況、還款承諾或轉交 FA 注意事項..."
                    value={twoCNotes}
                    onChange={(e) => setTwoCNotes(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                  />
                </div>

                {is2CTeam && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSaving2C}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs disabled:opacity-50"
                    >
                      {isSaving2C ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      儲存 2C 催帳紀錄
                    </button>
                  </div>
                )}
              </form>

              {/* Section 3: FA Team Legal & Demand Section */}
              <form onSubmit={handleSaveFA} className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-50 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">FA Team 催告與終止作業</h3>
                      <p className="text-[11px] text-slate-500">
                        滿 50 天：<strong>催告期</strong> ➜ 滿 80 天：<strong>終止期</strong> ➜ 終止函 15 天未結案/滿95天：<strong>待 write-off</strong>
                      </p>
                    </div>
                  </div>
                  {!isFATeam && (
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">唯讀檢視</span>
                  )}
                </div>

                {/* Demand Notice Fields (Stage 2) */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      ⚠️ 第二階段：催告作業 (逾期滿 50 天)
                    </span>
                    {caseData.outstandingDays >= 50 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        已達催告標準
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        催告日期
                      </label>
                      <input
                        type="date"
                        disabled={!isFATeam}
                        value={demandNoticeDate}
                        onChange={(e) => setDemandNoticeDate(e.target.value)}
                        className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        催告到期日
                      </label>
                      <input
                        type="date"
                        disabled={!isFATeam}
                        value={demandDueDate}
                        onChange={(e) => setDemandDueDate(e.target.value)}
                        className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      催告檔案 (Google 雲端文件連結)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        disabled={!isFATeam}
                        placeholder="https://docs.google.com/document/d/..."
                        value={demandDocUrl}
                        onChange={(e) => setDemandDocUrl(e.target.value)}
                        className="flex-1 text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 font-mono"
                      />
                      {demandDocUrl && (
                        <a
                          href={demandDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          開啟文件
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Termination Notice Fields (Stage 3 & 4) */}
                <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                      🛑 第三階段：終止期 (逾期滿 80 天)
                    </span>
                    {caseData.outstandingDays >= 80 && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        已達終止標準
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      終止函發送日期 (發送後15天未結案自動進入待write-off)
                    </label>
                    <input
                      type="date"
                      disabled={!isFATeam}
                      value={terminationNoticeDate}
                      onChange={(e) => setTerminationNoticeDate(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      終止函檔案 (Google 雲端文件連結)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        disabled={!isFATeam}
                        placeholder="https://docs.google.com/document/d/..."
                        value={terminationDocUrl}
                        onChange={(e) => setTerminationDocUrl(e.target.value)}
                        className="flex-1 text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 font-mono"
                      />
                      {terminationDocUrl && (
                        <a
                          href={terminationDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          開啟文件
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* FA Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    FA 法務/財務備註
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isFATeam}
                    placeholder="存證信函編號、法院支付命令進度或呆帳沖銷評估..."
                    value={faNotes}
                    onChange={(e) => setFaNotes(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 bg-white px-3 py-2 border shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>

                {isFATeam && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingFA}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-xs disabled:opacity-50"
                    >
                      {isSavingFA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      儲存 FA 催告紀錄
                    </button>
                  </div>
                )}
              </form>

              {/* Section 4: Case Closure */}
              <form onSubmit={handleSaveClose} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${isClosed ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">結案狀態設定</h4>
                      <p className="text-[11px] text-slate-500">客戶繳清款項或完成沖銷時結案</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isClosed}
                      onChange={(e) => setIsClosed(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {isClosed && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-700">結案日期:</label>
                    <input
                      type="date"
                      value={closedDate}
                      onChange={(e) => setClosedDate(e.target.value)}
                      className="text-xs rounded-lg border-slate-300 bg-white px-3 py-1.5 border shadow-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingClose}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isSavingClose ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    更新結案狀態
                  </button>
                </div>
              </form>

              {/* Section 5: Audit Logs */}
              {caseData.auditLogs && caseData.auditLogs.length > 0 && (
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    操作異動歷程 ({caseData.auditLogs.length})
                  </h4>
                  <div className="divide-y divide-slate-200/60 max-h-40 overflow-y-auto pr-1 text-xs text-slate-600 space-y-2">
                    {caseData.auditLogs.map((log) => (
                      <div key={log.id} className="pt-2 first:pt-0 flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{log.user?.name || '使用者'}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">({log.action})</span>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{log.details}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {format(new Date(log.createdAt), 'MM/dd HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
