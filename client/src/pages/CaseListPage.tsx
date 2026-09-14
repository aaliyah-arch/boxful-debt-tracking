import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import type { BusinessUnit } from '../types';
import { casesApi } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { CaseDetailDrawer } from '../components/CaseDetailDrawer';

interface CaseListPageProps {
  businessUnit: BusinessUnit;
  onSelectBusinessUnit: (unit: BusinessUnit) => void;
  initialStage?: string;
  initialMonthBucket?: string;
  onOpenUpload: () => void;
}

export const CaseListPage: React.FC<CaseListPageProps> = ({
  businessUnit,
  onSelectBusinessUnit,
  initialStage = '',
}) => {
  const [stageFilter, setStageFilter] = useState<string>(initialStage);
  const [search, setSearch] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [minDays, setMinDays] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState('outstandingDays');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'cases-list',
      businessUnit,
      stageFilter,
      search,
      contactStatus,
      minDays,
      page,
      pageSize,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      casesApi.list({
        businessUnit,
        stage: stageFilter || undefined,
        search: search || undefined,
        contactStatus: contactStatus || undefined,
        minDays: minDays,
        page,
        pageSize,
        sortBy,
        sortOrder,
      }),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await casesApi.exportExcel({
        businessUnit,
        stage: stageFilter || undefined,
        search: search || undefined,
        contactStatus: contactStatus || undefined,
        minDays: minDays,
      });

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${businessUnit}_Outstanding_Cases_${format(new Date(), 'yyyyMMdd')}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('匯出 Excel 失敗: ' + (err.message || '未知錯誤'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const clearFilters = () => {
    setStageFilter('');
    setSearch('');
    setContactStatus('');
    setMinDays(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                onSelectBusinessUnit('VALET');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                businessUnit === 'VALET'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Valet 欠款案件
            </button>
            <button
              onClick={() => {
                onSelectBusinessUnit('PEPPER');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                businessUnit === 'PEPPER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pepper 欠款案件
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="重新載入"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            disabled={isExporting || !data?.items?.length}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {isExporting ? '匯出中...' : '匯出 Excel 報表'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋 UID / 姓名 / 電話 / Email / 備註..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 pl-9 pr-3 py-2.5 border focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Stage Filter */}
          <div>
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 px-3 py-2.5 border focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部階段 (All Stages)</option>
              <option value="STAGE_1">1. 第一階段：勸導期 (≥30天)</option>
              <option value="STAGE_2">2. 第二階段：催告期 (≥50天)</option>
              <option value="STAGE_3">3. 第三階段：終止期 (≥80天)</option>
              <option value="STAGE_4">4. 待write-off (≥95天/終止滿15天)</option>
              <option value="CLOSED">5. 已結案</option>
              <option value="UNREACHED">追蹤中 (未滿30天)</option>
            </select>
          </div>

          {/* Contact Status */}
          <div>
            <select
              value={contactStatus}
              onChange={(e) => {
                setContactStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 px-3 py-2.5 border focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部聯絡狀態</option>
              <option value="line_contacted">🟢 Line 已通知</option>
              <option value="email_contacted">📧 Email 已通知</option>
              <option value="phone_contacted">📞 電話已通話</option>
              <option value="uncontacted">⚪ 尚未進行 2C 通知</option>
            </select>
          </div>

          {/* Overdue Days threshold */}
          <div>
            <select
              value={minDays !== undefined ? String(minDays) : ''}
              onChange={(e) => {
                setMinDays(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 px-3 py-2.5 border focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">全部逾期天數</option>
              <option value="30">逾期 30 天以上 (勸導標準)</option>
              <option value="50">逾期 50 天以上 (催告標準)</option>
              <option value="80">逾期 80 天以上 (終止標準)</option>
              <option value="95">逾期 95 天以上 (待write-off)</option>
            </select>
          </div>
        </div>

        {/* Filter Results Summary */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500 border-t border-slate-100">
          <div>
            共找到 <strong className="text-slate-800">{data?.pagination.totalCount || 0}</strong> 筆案件，
            篩選總欠款金額: <strong className="text-red-600 font-semibold">${(data?.totalAmountSum || 0).toLocaleString()}</strong>
          </div>
          {(stageFilter || search || contactStatus || minDays !== undefined) && (
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              重設所有篩選
            </button>
          )}
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-4 w-32">客戶 UID</th>
                <th className="py-3 px-3 w-36">姓名</th>
                <th
                  onClick={() => handleSort('outstandingAmount')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none w-28"
                >
                  <div className="flex items-center justify-end gap-1">
                    欠款金額
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outstandingDays')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none w-24"
                >
                  <div className="flex items-center justify-center gap-1">
                    逾期天數
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 w-48">當前階段</th>
                <th className="py-3 px-3 w-40">2C 催帳進度</th>
                <th className="py-3 px-3 w-44">FA 催告 / 終止</th>
                <th className="py-3 px-3 text-center w-24">結案狀態</th>
                <th className="py-3 px-4 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    載入中...
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    查無符合條件的欠款案件
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedCaseId(item.id)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    {/* UID */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {item.uid}
                    </td>

                    {/* Name & Contact Info */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.phone || item.email || '-'}</div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-red-600">
                      ${item.outstandingAmount.toLocaleString()}
                    </td>

                    {/* Outstanding Days */}
                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold ${
                          item.outstandingDays >= 80
                            ? 'bg-rose-100 text-rose-700'
                            : item.outstandingDays >= 50
                            ? 'bg-amber-100 text-amber-700'
                            : item.outstandingDays >= 30
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.outstandingDays} 天
                      </span>
                    </td>

                    {/* Stage Badge */}
                    <td className="py-3 px-3">
                      <StatusBadge stage={item.stage} isClosed={item.isClosed} />
                    </td>

                    {/* 2C Contact Progress */}
                    <td className="py-3 px-3 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {item.lineNoticeDate ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Line: {format(new Date(item.lineNoticeDate), 'MM/dd')}
                          </span>
                        ) : (
                          <span className="text-slate-300">Line未通</span>
                        )}
                        {item.emailNoticeDate && (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            信
                          </span>
                        )}
                        {item.phoneNoticeDate && (
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            電
                          </span>
                        )}
                      </div>
                      {item.twoCNotes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5">
                          {item.twoCNotes}
                        </p>
                      )}
                    </td>

                    {/* FA Legal Progress */}
                    <td className="py-3 px-3 text-[11px]">
                      {item.demandNoticeDate && (
                        <div className="flex items-center gap-1 text-amber-700 font-medium">
                          <span>催告: {format(new Date(item.demandNoticeDate), 'MM/dd')}</span>
                          {item.demandDocUrl && (
                            <ExternalLink className="w-3 h-3 text-amber-600" />
                          )}
                        </div>
                      )}
                      {item.terminationNoticeDate && (
                        <div className="flex items-center gap-1 text-rose-700 font-medium mt-0.5">
                          <span>終止: {format(new Date(item.terminationNoticeDate), 'MM/dd')}</span>
                          {item.terminationDocUrl && (
                            <ExternalLink className="w-3 h-3 text-rose-600" />
                          )}
                        </div>
                      )}
                      {!item.demandNoticeDate && !item.terminationNoticeDate && (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Closed Status */}
                    <td className="py-3 px-3 text-center">
                      {item.isClosed ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          已結案
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-slate-400">
                          處理中
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseId(item.id);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        編輯
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <div>
              頁次 {data.pagination.page} / {data.pagination.totalPages}（每頁 {data.pagination.pageSize} 筆）
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Case Detail Slide-over Drawer */}
      <CaseDetailDrawer
        caseId={selectedCaseId}
        onClose={() => setSelectedCaseId(null)}
        onCaseUpdated={() => {
          refetch();
        }}
      />
    </div>
  );
};
