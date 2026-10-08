import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  RefreshCw,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { BusinessUnit } from '../types';
import { casesApi } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { CaseDetailDrawer } from '../components/CaseDetailDrawer';
import { AgingBar } from '../components/AgingBar';
import type { CaseRecord } from '../types';

interface CaseListPageProps {
  businessUnit: BusinessUnit;
  onSelectBusinessUnit: (unit: BusinessUnit) => void;
  initialStage?: string;
  initialMonthBucket?: string;
  onOpenUpload: () => void;
}

export const CaseListPage: React.FC<CaseListPageProps> = ({
  businessUnit,
  initialStage = '',
}) => {
  const [stageFilter, setStageFilter] = useState<string>(initialStage);
  const [statusTagFilter, setStatusTagFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [minDays, setMinDays] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState('outstandingDays');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 從導覽列切換事業體時回到第一頁
  const prevUnit = useRef(businessUnit);
  useEffect(() => {
    if (prevUnit.current !== businessUnit) {
      prevUnit.current = businessUnit;
      setPage(1);
    }
  }, [businessUnit]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'cases-list',
      businessUnit,
      stageFilter,
      statusTagFilter,
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
        statusTag: statusTagFilter || undefined,
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

  const unitName = businessUnit === 'VALET' ? 'Valet' : 'Pepper';
  const hasFilters = !!(stageFilter || search || contactStatus || minDays !== undefined);
  const pendingCount = data?.pendingConfirmationCount ?? 0;
  const pendingActive = statusTagFilter === 'PENDING_CONFIRMATION';

  const md = (d?: string | null) => (d ? format(new Date(d), 'MM/dd') : '');

  const sortIcon = (field: string) => {
    if (sortBy !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-ink-300" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
    );
  };

  const channels = (item: CaseRecord) => [
    { label: 'Line', date: item.lineNoticeDate },
    { label: 'Email', date: item.emailNoticeDate },
    { label: '簡訊', date: item.smsNoticeDate },
    { label: '電話', date: item.phoneNoticeDate },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 頁首 */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{unitName} 案件清單</h1>
          <p className="mt-1 text-sm text-ink-500 tabular-nums">
            {data
              ? `${data.pagination.totalCount} 筆案件，欠款合計 $${(data.totalAmountSum || 0).toLocaleString()}`
              : '載入中'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-ghost" aria-label="重新整理">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} disabled={isExporting || !data?.items?.length} className="btn btn-secondary">
            <Download className="w-4 h-4" />
            {isExporting ? '匯出中' : '匯出 Excel'}
          </button>
        </div>
      </header>

      {/* 待確認結案提醒 */}
      {(pendingCount > 0 || pendingActive) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong className="font-semibold tabular-nums">{pendingCount} 位客戶</strong>
            沒有出現在最新週報，可能已經繳清，請核對後結案。
          </p>
          <button
            onClick={() => {
              if (pendingActive) {
                setStatusTagFilter('');
              } else {
                setStatusTagFilter('PENDING_CONFIRMATION');
                setStageFilter('');
              }
              setPage(1);
            }}
            className={`btn !py-1.5 ${pendingActive ? 'bg-amber-900 text-white hover:bg-amber-950' : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'}`}
          >
            {pendingActive ? '顯示全部案件' : '只看待確認'}
          </button>
        </div>
      )}

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-60">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="搜尋姓名、UID、電話、Email 或備註"
            aria-label="搜尋案件"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="field !pl-9"
          />
        </div>

        <select
          aria-label="階段"
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value);
            setPage(1);
          }}
          className="field !w-auto min-w-36"
        >
          <option value="">所有階段</option>
          <option value="UNREACHED">追蹤中（未滿 30 天）</option>
          <option value="STAGE_1">勸導期（滿 30 天）</option>
          <option value="STAGE_2">催告期（滿 50 天）</option>
          <option value="STAGE_3">終止期（滿 80 天）</option>
          <option value="STAGE_4">待 write-off（滿 95 天）</option>
          <option value="CLOSED">已結案</option>
        </select>

        <select
          aria-label="聯絡狀態"
          value={contactStatus}
          onChange={(e) => {
            setContactStatus(e.target.value);
            setPage(1);
          }}
          className="field !w-auto min-w-36"
        >
          <option value="">所有聯絡狀態</option>
          <option value="line_contacted">已用 Line 通知</option>
          <option value="email_contacted">已寄 Email</option>
          <option value="phone_contacted">已電話聯絡</option>
          <option value="uncontacted">尚未通知</option>
        </select>

        <select
          aria-label="逾期天數"
          value={minDays !== undefined ? String(minDays) : ''}
          onChange={(e) => {
            setMinDays(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className="field !w-auto min-w-36"
        >
          <option value="">任何逾期天數</option>
          <option value="30">逾期 30 天以上</option>
          <option value="50">逾期 50 天以上</option>
          <option value="80">逾期 80 天以上</option>
          <option value="95">逾期 95 天以上</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="btn btn-ghost !px-2.5">
            <X className="w-4 h-4" />
            清除篩選
          </button>
        )}
      </div>

      {/* 案件表格 */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="text-xs text-ink-500 border-b border-ink-200 bg-ink-50/60">
                <th className="py-3 pl-5 pr-3 font-semibold">客戶</th>
                <th className="py-3 px-3 font-semibold text-right">
                  <button onClick={() => handleSort('outstandingAmount')} className="inline-flex items-center gap-1 hover:text-ink-900">
                    欠款
                    {sortIcon('outstandingAmount')}
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold">
                  <button onClick={() => handleSort('outstandingDays')} className="inline-flex items-center gap-1 hover:text-ink-900">
                    逾期
                    {sortIcon('outstandingDays')}
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold">階段</th>
                <th className="py-3 px-3 font-semibold">2C 通知</th>
                <th className="py-3 pl-3 pr-5 font-semibold">催告 / 終止</th>
              </tr>
            </thead>
            <tbody className="text-ink-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-sm text-ink-500">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2 -mt-0.5" />
                    載入案件
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <p className="text-sm font-semibold text-ink-800">沒有符合條件的案件</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="mt-2 text-sm font-semibold text-brand-700 hover:underline underline-offset-4">
                        清除篩選
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => {
                  const pending = item.statusTag === 'PENDING_CONFIRMATION' && !item.isClosed;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCaseId(item.id)}
                      className="group border-b border-ink-100 last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer"
                    >
                      {/* 客戶 */}
                      <td className="py-3.5 pl-5 pr-3 min-w-56">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCaseId(item.id);
                            }}
                            className="font-semibold text-ink-900 group-hover:text-brand-800 text-left"
                          >
                            {item.name}
                          </button>
                          {pending && (
                            <span className="text-2xs font-semibold text-amber-800 bg-amber-100 rounded px-1.5">待確認</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-500 tabular-nums">
                          <span>{item.uid}</span>
                          <span>{item.phone || item.email || ''}</span>
                        </div>
                        {businessUnit === 'VALET' && (item.serviceType || item.address) && (
                          <div className="mt-0.5 text-xs text-ink-400 truncate max-w-64">
                            {[item.serviceType, item.address].filter(Boolean).join('，')}
                          </div>
                        )}
                      </td>

                      {/* 欠款 */}
                      <td className="py-3.5 px-3 text-right font-semibold text-ink-900 tabular-nums whitespace-nowrap">
                        ${item.outstandingAmount.toLocaleString()}
                      </td>

                      {/* 逾期 */}
                      <td className="py-3.5 px-3 min-w-36">
                        <div className="text-[13px] font-semibold text-ink-900 tabular-nums">
                          {item.outstandingDays}
                          <span className="font-normal text-ink-500 ml-0.5">天</span>
                        </div>
                        <AgingBar days={item.outstandingDays} isClosed={item.isClosed} className="mt-1.5 w-28" />
                      </td>

                      {/* 階段 */}
                      <td className="py-3.5 px-3">
                        <StatusBadge stage={item.stage} isClosed={item.isClosed} />
                      </td>

                      {/* 2C 通知 */}
                      <td className="py-3.5 px-3 min-w-48">
                        <div className="flex gap-1">
                          {channels(item).map((c) => (
                            <span
                              key={c.label}
                              title={c.date ? `${c.label} ${md(c.date)}` : `${c.label} 尚未通知`}
                              className={`text-2xs font-semibold rounded px-1.5 py-px ${
                                c.date ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-400'
                              }`}
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                        {item.twoCNotes && (
                          <p className="mt-1 text-xs text-ink-500 truncate max-w-52" title={item.twoCNotes}>
                            {item.twoCNotes}
                          </p>
                        )}
                      </td>

                      {/* 催告 / 終止 */}
                      <td className="py-3.5 pl-3 pr-5 text-xs text-ink-600 tabular-nums whitespace-nowrap">
                        {item.demandNoticeDate || item.terminationNoticeDate ? (
                          <div className="space-y-0.5">
                            {item.demandNoticeDate && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-sm bg-stage-2" />
                                催告 {md(item.demandNoticeDate)}
                                {item.demandDocUrl && <Paperclip className="w-3 h-3 text-ink-400" aria-label="有附件" />}
                              </div>
                            )}
                            {item.terminationNoticeDate && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-sm bg-stage-3" />
                                終止 {md(item.terminationNoticeDate)}
                                {item.terminationDocUrl && <Paperclip className="w-3 h-3 text-ink-400" aria-label="有附件" />}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-300">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-between text-[13px] text-ink-500 tabular-nums">
            <div>
              第 {data.pagination.page} 頁，共 {data.pagination.totalPages} 頁
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-ghost !p-1.5" aria-label="上一頁">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="btn btn-ghost !p-1.5"
                aria-label="下一頁"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
