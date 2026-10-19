import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, CheckCircle2, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { CaseRecord, DemandMethod } from '../types';
import { useAuth } from '../context/AuthContext';
import { casesApi } from '../api';
import { StatusBadge } from './StatusBadge';
import { AgingBar } from './AgingBar';
import { safeFormat } from '../utils/dateUtils';

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
  const [resultDialog, setResultDialog] = useState<{ ok: boolean; text: string } | null>(null);

  // Form states - 2C
  const [lineNoticeDate, setLineNoticeDate] = useState('');
  const [emailNoticeDate, setEmailNoticeDate] = useState('');
  const [smsNoticeDate, setSmsNoticeDate] = useState('');
  const [phoneNoticeDate, setPhoneNoticeDate] = useState('');
  const [twoCNotes, setTwoCNotes] = useState('');

  // Form states - FA
  const [demandNoticeDate, setDemandNoticeDate] = useState('');
  const [demandDueDate, setDemandDueDate] = useState('');
  const [demandDocUrl, setDemandDocUrl] = useState('');
  const [demandMethod, setDemandMethod] = useState<DemandMethod | ''>('');
  const [demandSmsDate, setDemandSmsDate] = useState('');
  const [terminationNoticeDate, setTerminationNoticeDate] = useState('');
  const [terminationDueDate, setTerminationDueDate] = useState('');
  const [terminationSmsDate, setTerminationSmsDate] = useState('');
  const [certifiedLetterSentDate, setCertifiedLetterSentDate] = useState('');
  const [certifiedLetterReceivedDate, setCertifiedLetterReceivedDate] = useState('');
  const [faNotes, setFaNotes] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Form states - Close
  const [closedDate, setClosedDate] = useState('');

  const formatDateInput = (d?: string | null) => safeFormat(d, 'yyyy-MM-dd', '');

  const loadCase = async (id: string) => {
    setIsLoading(true);
    setFeedbackMsg(null);
    setResultDialog(null);
    try {
      const data = await casesApi.getById(id);
      setCaseData(data);

      // Populate 2C states
      setLineNoticeDate(formatDateInput(data.lineNoticeDate));
      setEmailNoticeDate(formatDateInput(data.emailNoticeDate));
      setSmsNoticeDate(formatDateInput(data.smsNoticeDate));
      setPhoneNoticeDate(formatDateInput(data.phoneNoticeDate));
      setTwoCNotes(data.twoCNotes || '');

      // Populate FA states
      setDemandNoticeDate(formatDateInput(data.demandNoticeDate));
      setDemandDueDate(formatDateInput(data.demandDueDate));
      setDemandDocUrl(data.demandDocUrl || '');
      setDemandMethod(data.demandMethod || '');
      setDemandSmsDate(formatDateInput(data.demandSmsDate));
      setTerminationNoticeDate(formatDateInput(data.terminationNoticeDate));
      setTerminationDueDate(formatDateInput(data.terminationDueDate));
      setTerminationSmsDate(formatDateInput(data.terminationSmsDate));
      setCertifiedLetterSentDate(formatDateInput(data.certifiedLetterSentDate));
      setCertifiedLetterReceivedDate(formatDateInput(data.certifiedLetterReceivedDate));
      setFaNotes(data.faNotes || '');

      // Populate Close states
      setClosedDate(formatDateInput(data.closedDate));
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

  // Esc 關閉
  useEffect(() => {
    if (!caseId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (resultDialog) setResultDialog(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [caseId, onClose, resultDialog]);

  if (!caseId) return null;

  const errText = (err: any, fallback: string) => err?.response?.data?.error || err?.message || fallback;
  const showFail = (text: string) => {
    setFeedbackMsg({ type: 'error', text });
    setResultDialog({ ok: false, text });
  };

  const handleSave2C = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;
    setIsSaving2C(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.update2C(caseData.id, {
        lineNoticeDate: lineNoticeDate || null,
        emailNoticeDate: emailNoticeDate || null,
        smsNoticeDate: smsNoticeDate || null,
        phoneNoticeDate: phoneNoticeDate || null,
        twoCNotes: twoCNotes || null,
      });
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: 'CS 勸導紀錄已儲存，並同步回 Google 試算表' });
      setResultDialog({ ok: true, text: 'CS 勸導紀錄已同步回 Google 試算表' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      showFail(errText(err, '更新失敗'));
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
      // 只有 2C 權限（非 FA）時，只回寫 CS 負責的兩個簡訊日期，不動 FA 欄位
      const csOnly = {
        demandSmsDate: demandSmsDate || null,
        terminationSmsDate: terminationSmsDate || null,
      };
      const res = await casesApi.updateFA(caseData.id, !isFATeam ? csOnly : {
        demandNoticeDate: demandNoticeDate || null,
        demandDueDate: demandDueDate || null,
        demandDocUrl: demandDocUrl || null,
        demandMethod: demandMethod || null,
        demandSmsDate: demandSmsDate || null,
        terminationNoticeDate: terminationNoticeDate || null,
        terminationDueDate: terminationDueDate || null,
        terminationSmsDate: terminationSmsDate || null,
        certifiedLetterSentDate: certifiedLetterSentDate || null,
        certifiedLetterReceivedDate: certifiedLetterReceivedDate || null,
        faNotes: faNotes || null,
      });
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: '催告與終止紀錄已儲存，並同步回 Google 試算表' });
      setResultDialog({ ok: true, text: '催告與終止紀錄已同步回 Google 試算表' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      showFail(errText(err, '更新失敗'));
    } finally {
      setIsSavingFA(false);
    }
  };

  const handleSaveClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;
    // 有選結案日期 → 結案；清空日期 → 重新開啟（只有原本已結案才需要）
    const willClose = !!closedDate;
    if (!willClose && !caseData.isClosed) {
      showFail('請先選擇結案日期');
      return;
    }
    setIsSavingClose(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.closeCase(caseData.id, {
        isClosed: willClose,
        closedDate: willClose ? closedDate : null,
      });
      setClosedDate(willClose ? closedDate : '');
      setCaseData(res.case);
      setFeedbackMsg({ type: 'success', text: '已同步回寫試算表' });
      setResultDialog({ ok: true, text: '已同步回寫試算表' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      showFail(errText(err, '結案操作失敗'));
    } finally {
      setIsSavingClose(false);
    }
  };

  /** 只儲存「電子催告檔」連結，成功寫回試算表後跳出「儲存成功」 */
  const handleSaveDocUrl = async () => {
    if (!caseData) return;
    const url = demandDocUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      showFail('請貼上完整的網址（以 https:// 開頭）');
      return;
    }
    setIsSavingDoc(true);
    setFeedbackMsg(null);
    try {
      const res = await casesApi.updateFA(caseData.id, { demandDocUrl: url || null });
      setCaseData(res.case);
      setDemandDocUrl(res.case.demandDocUrl || url);
      setFeedbackMsg({ type: 'success', text: '電子催告檔連結已儲存，試算表顯示為「Link」' });
      setResultDialog({ ok: true, text: '電子催告檔連結已寫入 Google 試算表，儲存格顯示為「Link」' });
      if (onCaseUpdated) onCaseUpdated(res.case);
    } catch (err: any) {
      showFail(errText(err, '儲存電子催告檔連結失敗'));
    } finally {
      setIsSavingDoc(false);
    }
  };

  const renderDocUrlField = () => (
    <div className="sm:col-span-2">
      <label className="field-label">電子催告檔</label>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          disabled={!isFATeam}
          placeholder="貼上 Google 雲端檔案連結"
          value={demandDocUrl}
          onChange={(e) => setDemandDocUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveDocUrl();
            }
          }}
          className="field flex-1 !w-auto min-w-0"
        />
        {isFATeam && (
          <button type="button" onClick={handleSaveDocUrl} disabled={isSavingDoc} className="btn btn-secondary">
            {isSavingDoc && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSavingDoc ? '儲存中' : '儲存'}
          </button>
        )}
        {demandDocUrl && (
          <a href={demandDocUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
            <ExternalLink className="w-4 h-4" />
            開啟
          </a>
        )}
      </div>
    </div>
  );

  const dateField = (label: string, value: string, set: (v: string) => void, enabled: boolean) => (
    <div>
      <label className="field-label">{label}</label>
      <input type="date" disabled={!enabled} value={value} onChange={(e) => set(e.target.value)} className="field tabular-nums" />
    </div>
  );

  const sectionHead = (title: string, hint: string, editable: boolean) => (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <p className="mt-0.5 text-[13px] text-ink-500">{hint}</p>
      </div>
      {!editable && <span className="flex-shrink-0 text-xs font-medium text-ink-500 bg-ink-100 rounded px-2 py-0.5">唯讀</span>}
    </div>
  );

  const subHead = (dot: string, title: string, reached: boolean, reachedText: string) => (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2 h-2 rounded-[3px] ${dot}`} />
      <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
      {reached && <span className="text-xs font-medium text-ink-500">{reachedText}</span>}
    </div>
  );

  const fmt = (d?: string | null, f = 'yyyy-MM-dd') => safeFormat(d, f);

  const infoItems: Array<{ label: string; value: string; wide?: boolean }> = caseData
    ? [
        { label: '電話', value: caseData.phone || '未提供' },
        { label: 'Email', value: caseData.email || '未提供' },
        ...(caseData.businessUnit === 'VALET'
          ? [
              { label: '服務類型', value: caseData.serviceType || '一般倉儲' },
              { label: '地址', value: caseData.address || '未提供', wide: true },
            ]
          : []),
        { label: '帳單日', value: fmt(caseData.billDate) || '未提供' },
        { label: '開始催帳', value: fmt(caseData.collectionStartDate) || '尚未開始' },
        { label: '最後匯入', value: fmt(caseData.lastImportedAt, 'yyyy-MM-dd HH:mm') },
      ]
    : [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="案件詳情">
      <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={onClose} aria-hidden />

      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-in">
        {/* 標頭 */}
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-ink-200">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium text-ink-500 tabular-nums">
                {caseData
                  ? `${caseData.businessUnit === 'VALET' ? 'Valet' : 'Pepper'}  ${caseData.uid}${
                      caseData.id && caseData.id !== caseData.uid ? `  ·  案件ID ${caseData.id}` : ''
                    }`
                  : ' '}
              </div>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink-900 truncate">
                {caseData?.name || '載入中'}
              </h2>
            </div>
            <button onClick={onClose} aria-label="關閉" className="btn btn-ghost !p-1.5 -mr-1.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {caseData && (
            <>
              <dl className="mt-5 grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs text-ink-500">欠款</dt>
                  <dd className="mt-0.5 text-lg font-bold text-ink-900 tabular-nums">${caseData.outstandingAmount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">逾期</dt>
                  <dd className="mt-0.5 text-lg font-bold text-ink-900 tabular-nums">
                    {caseData.outstandingDays}
                    <span className="text-sm font-medium text-ink-500 ml-0.5">天</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">階段</dt>
                  <dd className="mt-1.5">
                    <StatusBadge stage={caseData.stage} isClosed={caseData.isClosed} size="lg" />
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <AgingBar days={caseData.outstandingDays} isClosed={caseData.isClosed} className="!h-2" />
                <div className="relative mt-1.5 h-4 text-2xs text-ink-400 tabular-nums">
                  {[30, 50, 80, 95].map((t) => (
                    <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / 110) * 100}%` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 內容 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="py-24 flex items-center justify-center gap-2 text-sm text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              載入案件資料
            </div>
          )}

          {feedbackMsg && (
            <div
              role="status"
              className={`mx-6 sm:mx-8 mt-6 px-4 py-3 rounded-lg text-[13px] font-medium flex items-start gap-2 ${
                feedbackMsg.type === 'success' ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              {feedbackMsg.text}
            </div>
          )}

          {caseData && (
            <div className="divide-y divide-ink-200">
              {/* 待確認是否結案 */}
              {caseData.statusTag === 'PENDING_CONFIRMATION' && !caseData.isClosed && (
                <div className="px-6 sm:px-8 py-5 bg-amber-50 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 max-w-md">
                    <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-950">可能已繳清</h4>
                      <p className="text-[13px] text-amber-900/80 mt-0.5">
                        這位客戶沒有出現在最新週報，可能已補繳或銷帳。核對無誤後請按確認結案。
                      </p>
                    </div>
                  </div>
                  {is2CTeam && (
                    <button
                      type="button"
                      disabled={isSavingClose}
                      onClick={async () => {
                        setIsSavingClose(true);
                        try {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          const res = await casesApi.closeCase(caseData.id, {
                            isClosed: true,
                            closedDate: today,
                          });
                          setCaseData(res.case);
                          setClosedDate(today);
                          setFeedbackMsg({ type: 'success', text: '已結案，並同步回 Google 試算表。' });
                          setResultDialog({ ok: true, text: '已同步回寫試算表' });
                          if (onCaseUpdated) onCaseUpdated(res.case);
                        } catch (err: any) {
                          showFail(errText(err, '結案失敗'));
                        } finally {
                          setIsSavingClose(false);
                        }
                      }}
                      className="btn bg-amber-900 text-white hover:bg-amber-950"
                    >
                      {isSavingClose ? '處理中' : '確認結案'}
                    </button>
                  )}
                </div>
              )}

              {/* 客戶資料 */}
              <section className="px-6 sm:px-8 py-6">
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  {infoItems.map((it) => (
                    <div key={it.label} className={it.wide ? 'col-span-2' : ''}>
                      <dt className="text-xs text-ink-500">{it.label}</dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-ink-900 break-words tabular-nums">{it.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* CS 勸導 */}
              <form onSubmit={handleSave2C} className="px-6 sm:px-8 py-7">
                {sectionHead('CS 勸導', '先用 Line 通知，聯絡不到再依序改用 Email、簡訊、電話。', is2CTeam)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {dateField('Line 通知', lineNoticeDate, setLineNoticeDate, is2CTeam)}
                  {dateField('Email 通知', emailNoticeDate, setEmailNoticeDate, is2CTeam)}
                  {dateField('簡訊通知', smsNoticeDate, setSmsNoticeDate, is2CTeam)}
                  {dateField('電話通知', phoneNoticeDate, setPhoneNoticeDate, is2CTeam)}
                  <div className="sm:col-span-2">
                    <label className="field-label">處理方式與客戶回應</label>
                    <textarea
                      rows={3}
                      disabled={!is2CTeam}
                      placeholder="例如：客戶承諾月底前繳清、需轉交 FA 處理"
                      value={twoCNotes}
                      onChange={(e) => setTwoCNotes(e.target.value)}
                      className="field resize-y"
                    />
                  </div>
                </div>
                {is2CTeam && (
                  <div className="mt-5 flex justify-end">
                    <button type="submit" disabled={isSaving2C} className="btn btn-primary">
                      {isSaving2C && <Loader2 className="w-4 h-4 animate-spin" />}
                      儲存紀錄
                    </button>
                  </div>
                )}
              </form>

              {/* 催告與終止 */}
              <form onSubmit={handleSaveFA} className="px-6 sm:px-8 py-7">
                {sectionHead('催告與終止', '滿 50 天發催告，滿 80 天發終止函；終止函寄出 15 天仍未結清即進入待 write-off。', isFATeam || is2CTeam)}

                <div className="space-y-7">
                  <div>
                    {subHead('bg-stage-2', '催告', caseData.outstandingDays >= 50, '已滿 50 天')}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">催告方式</label>
                        <select
                          disabled={!isFATeam}
                          value={demandMethod}
                          onChange={(e) => setDemandMethod(e.target.value as DemandMethod | '')}
                          className="field"
                        >
                          <option value="">請選擇</option>
                          <option value="EMAIL">Email</option>
                          <option value="CERTIFIED_LETTER">存證信函</option>
                        </select>
                      </div>
                      {dateField('催告日期', demandNoticeDate, setDemandNoticeDate, isFATeam)}
                      {dateField('催告到期日', demandDueDate, setDemandDueDate, isFATeam)}
                      {renderDocUrlField()}
                      {dateField('催告簡訊日期(CS)', demandSmsDate, setDemandSmsDate, isFATeam || is2CTeam)}
                    </div>
                  </div>

                  <div>
                    {subHead('bg-stage-3', '終止', caseData.outstandingDays >= 80, '已滿 80 天')}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {dateField('終止函寄出日期', terminationNoticeDate, setTerminationNoticeDate, isFATeam)}
                      {dateField('終止到期日', terminationDueDate, setTerminationDueDate, isFATeam)}
                      {dateField('終止簡訊日期(CS)', terminationSmsDate, setTerminationSmsDate, isFATeam || is2CTeam)}
                    </div>
                  </div>

                  <div>
                    {subHead('bg-ink-400', '存證信函', false, '')}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {dateField('寄出日期', certifiedLetterSentDate, setCertifiedLetterSentDate, isFATeam)}
                      {dateField('收件日期', certifiedLetterReceivedDate, setCertifiedLetterReceivedDate, isFATeam)}
                    </div>
                  </div>

                  <div>
                    <label className="field-label">FA 備註</label>
                    <textarea
                      rows={3}
                      disabled={!isFATeam}
                      placeholder="例如：存證信函編號、支付命令進度、沖銷評估"
                      value={faNotes}
                      onChange={(e) => setFaNotes(e.target.value)}
                      className="field resize-y"
                    />
                  </div>
                </div>

                {(isFATeam || is2CTeam) && (
                  <div className="mt-5 flex justify-end">
                    <button type="submit" disabled={isSavingFA} className="btn btn-primary">
                      {isSavingFA && <Loader2 className="w-4 h-4 animate-spin" />}
                      儲存紀錄
                    </button>
                  </div>
                )}
              </form>

              {/* 結案 */}
              <form onSubmit={handleSaveClose} className="px-6 sm:px-8 py-7">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-ink-900">結案</h3>
                    <p className="mt-0.5 text-[13px] text-ink-500">
                      {caseData.isClosed
                        ? '已結案。清空結案日期並儲存，可重新開啟案件。'
                        : '客戶繳清或完成沖銷後，選擇結案日期並儲存。'}
                    </p>
                  </div>
                  {caseData.isClosed && (
                    <span className="flex-shrink-0 text-xs font-medium text-brand-800 bg-brand-50 rounded px-2 py-0.5">已結案</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <div>
                    <label htmlFor="closed-date" className="field-label">結案日期</label>
                    <input
                      id="closed-date"
                      type="date"
                      value={closedDate}
                      onChange={(e) => setClosedDate(e.target.value)}
                      className="field tabular-nums"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={isSavingClose} className="btn btn-secondary">
                    {isSavingClose && <Loader2 className="w-4 h-4 animate-spin" />}
                    儲存結案日期
                  </button>
                </div>
              </form>

              {/* 異動紀錄 */}
              {caseData.auditLogs && caseData.auditLogs.length > 0 && (
                <section className="px-6 sm:px-8 py-7">
                  <h3 className="text-base font-bold text-ink-900 mb-4">異動紀錄</h3>
                  <ol className="space-y-4">
                    {caseData.auditLogs.map((log) => (
                      <li key={log.id} className="grid grid-cols-[5.5rem_1fr] gap-3 text-[13px]">
                        <time className="text-xs text-ink-500 tabular-nums pt-0.5">{fmt(log.createdAt, 'MM/dd HH:mm')}</time>
                        <div>
                          <div className="text-ink-900">
                            <span className="font-semibold">{log.user?.name || '使用者'}</span>
                            <span className="text-ink-500 ml-1.5">{log.action}</span>
                          </div>
                          <p className="mt-0.5 text-ink-600 line-clamp-2">{log.details}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {resultDialog && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="save-result-title"
          onClick={() => setResultDialog(null)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-xl shadow-2xl px-6 py-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {resultDialog.ok ? (
              <CheckCircle2 className="w-10 h-10 mx-auto text-brand-600" />
            ) : (
              <XCircle className="w-10 h-10 mx-auto text-red-600" />
            )}
            <h3 id="save-result-title" className="mt-3 text-lg font-bold text-ink-900">
              {resultDialog.ok ? '儲存成功' : '儲存失敗'}
            </h3>
            <p className="mt-1 text-[13px] text-ink-500 break-words">{resultDialog.text}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setResultDialog(null)}
              className={`btn mt-5 w-full justify-center ${resultDialog.ok ? 'btn-primary' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
