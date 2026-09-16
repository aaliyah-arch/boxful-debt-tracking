import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">上傳每週 Outstanding Report</h3>
              <p className="text-xs text-slate-500">支援 Excel (.xlsx, .xls) 及 CSV 檔案</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Business Unit Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              選擇事業體 (Business Unit)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBusinessUnit('VALET');
                  setResult(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  businessUnit === 'VALET'
                    ? 'border-red-500 bg-red-50/80 text-red-700 shadow-sm ring-2 ring-red-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${businessUnit === 'VALET' ? 'bg-red-500' : 'bg-slate-300'}`}></span>
                Valet
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusinessUnit('PEPPER');
                  setResult(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  businessUnit === 'PEPPER'
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-700 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${businessUnit === 'PEPPER' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                Pepper
              </button>
            </div>
          </div>

          {/* File Upload Area */}
          {!result && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-indigo-400 bg-indigo-50/30'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">拖曳檔案至此或點擊瀏覽</p>
                    <p className="text-xs text-slate-500 mt-1">
                      支援 .xlsx, .csv 檔案（必須包含 UID 與 逾期天數/金額 欄位）
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  下載標準格式範本
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    清除選擇
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">匯入發生錯誤</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Success summary */}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>{result.message}</span>
              </div>
              <p className="text-xs text-emerald-700">
                ✨ 系統已完成人名/UID 金額加總彙整，並自動非同步回寫 Google 試算表（2bad-debtbackup）對應原始與追蹤分頁。
              </p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-slate-500 block">總解析筆數</span>
                  <span className="font-bold text-slate-800 text-base">{result.result.totalCount}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-emerald-600 block">新進案件</span>
                  <span className="font-bold text-emerald-700 text-base">{result.result.newCount}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <span className="text-indigo-600 block">更新既有案件</span>
                  <span className="font-bold text-indigo-700 text-base">{result.result.updatedCount}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200 bg-amber-50/50">
                  <span className="text-amber-700 block font-medium">待確認結案</span>
                  <span className="font-bold text-amber-800 text-base">{result.result.pendingConfirmationCount ?? 0}</span>
                </div>
              </div>
              {result.result.errorCount > 0 && (
                <div className="text-xs text-amber-700 mt-2">
                  <p className="font-medium">部分資料略過 ({result.result.errorCount} 筆)：</p>
                  <ul className="list-disc pl-4 mt-1 max-h-20 overflow-y-auto space-y-0.5">
                    {result.result.errors.map((e: string, idx: number) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {result ? '完成並關閉' : '取消'}
            </button>
            {!result && (
              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    解析匯入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    開始匯入
                  </>
                )}
              </button>
            )}
            {result && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              >
                再上傳一筆
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
