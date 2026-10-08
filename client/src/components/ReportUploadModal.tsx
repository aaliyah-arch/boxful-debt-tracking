import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Download, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import type { BusinessUnit } from '../types';
import { reportsApi } from '../api';

interface ReportUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBusinessUnit?: BusinessUnit;
  onUploadSuccess?: () => void;
}

export const ReportUploadModal: React.FC<ReportUploadModalProps> = ({
  isOpen,
  onClose,
  defaultBusinessUnit = 'VALET',
  onUploadSuccess,
}) => {
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit>(defaultBusinessUnit);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('請選擇要上傳的報表檔案 (.xlsx, .xls 或 .csv)');
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const res = await reportsApi.upload(selectedFile, businessUnit);
      setResult(res);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '匯入失敗，請檢查檔案格式');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const blob = await reportsApi.downloadSample();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Outstanding_Report_Sample.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('下載範例檔案失敗: ' + (err.message || '未知錯誤'));
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = result
    ? [
        { label: '解析筆數', value: result.result.totalCount },
        { label: '新案件', value: result.result.newCount },
        { label: '更新案件', value: result.result.updatedCount },
        { label: '待確認結案', value: result.result.pendingConfirmationCount ?? 0 },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={onClose} aria-hidden />

      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-fade-in">
        <div className="px-6 pt-6 flex items-start justify-between gap-4">
          <div>
            <h3 id="upload-title" className="text-lg font-bold tracking-tight text-ink-900">上傳每週 Outstanding Report</h3>
            <p className="mt-0.5 text-[13px] text-ink-500">系統會依 UID 合併金額，並同步回 Google 試算表。</p>
          </div>
          <button onClick={onClose} aria-label="關閉" className="btn btn-ghost !p-1.5 -mr-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 事業體 */}
          <div>
            <span className="field-label">事業體</span>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['VALET', 'PEPPER'] as BusinessUnit[]).map((unit) => {
                const active = businessUnit === unit;
                return (
                  <button
                    key={unit}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setBusinessUnit(unit);
                      setResult(null);
                    }}
                    className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    {unit === 'VALET' ? 'Valet' : 'Pepper'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 檔案 */}
          {!result && (
            <div>
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                className={`border border-dashed rounded-xl px-6 py-8 text-center transition-colors ${
                  selectedFile ? 'border-brand-500 bg-brand-50/50' : 'border-ink-300 hover:border-brand-500 hover:bg-ink-50'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-7 h-7 text-brand-600 flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate max-w-64">{selectedFile.name}</p>
                      <p className="text-xs text-ink-500 tabular-nums">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet className="w-8 h-8 text-ink-300 mx-auto" />
                    <p className="mt-2 text-sm font-semibold text-ink-800">拖曳檔案到這裡，或點擊選擇</p>
                    <p className="mt-1 text-xs text-ink-500">.xlsx、.xls 或 .csv，需包含 UID、逾期天數與金額欄位</p>
                  </>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-900"
                >
                  <Download className="w-4 h-4" />
                  下載範本
                </button>
                {selectedFile && (
                  <button type="button" onClick={handleReset} className="text-[13px] text-ink-500 hover:text-ink-800">
                    換一個檔案
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-[13px]">
                <p className="font-semibold">匯入失敗</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-brand-800">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{result.message}</p>
                  <p className="mt-0.5 text-[13px] text-ink-500">資料已同步回 Google 試算表。</p>
                </div>
              </div>
              <dl className="grid grid-cols-4 divide-x divide-ink-200 border-y border-ink-200 py-3">
                {stats.map((st) => (
                  <div key={st.label} className="px-3 first:pl-0">
                    <dt className="text-xs text-ink-500">{st.label}</dt>
                    <dd className="mt-0.5 text-xl font-bold text-ink-900 tabular-nums">{st.value}</dd>
                  </div>
                ))}
              </dl>
              {result.result.errorCount > 0 && (
                <div className="text-[13px] text-amber-900">
                  <p className="font-semibold">有 {result.result.errorCount} 筆資料被略過：</p>
                  <ul className="list-disc pl-5 mt-1 max-h-24 overflow-y-auto space-y-0.5 text-xs">
                    {result.result.errors.map((e: string, idx: number) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              {result ? '完成' : '取消'}
            </button>
            {!result && (
              <button type="submit" disabled={!selectedFile || isUploading} className="btn btn-primary">
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isUploading ? '匯入中' : '開始匯入'}
              </button>
            )}
            {result && (
              <button type="button" onClick={handleReset} className="btn btn-secondary">
                再上傳一份
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
