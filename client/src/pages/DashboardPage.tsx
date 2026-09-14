import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { BusinessUnit } from '../types';
import { dashboardApi } from '../api';
import { MetricCard } from '../components/MetricCard';

interface DashboardPageProps {
  businessUnit: BusinessUnit;
  onSelectBusinessUnit: (unit: BusinessUnit) => void;
  onNavigateToCases: (filters?: { stage?: string; monthBucket?: string }) => void;
  onOpenUpload: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  businessUnit,
  onSelectBusinessUnit,
  onNavigateToCases,
  onOpenUpload,
}) => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview', businessUnit],
    queryFn: () => dashboardApi.getOverview(businessUnit),
  });

  const isValet = businessUnit === 'VALET';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xl font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                isValet
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {businessUnit}
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              呆帳催款總覽看板
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            依照每週 Outstanding Report 匯入天數與催帳開始月份自動彙整（追蹤近 3 個月與歷史累計數據）
          </p>
        </div>

        {/* Business Unit Segmented Control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onSelectBusinessUnit('VALET')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                isValet
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Valet 總覽
            </button>
            <button
              onClick={() => onSelectBusinessUnit('PEPPER')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                !isValet
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pepper 總覽
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="重新整理資料"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="當前未結案呆帳總額"
            value={`$${data.kpiSummary.totalOutstandingAmount.toLocaleString()}`}
            subValue={`${data.kpiSummary.activeCases} 人欠款中`}
            icon={<DollarSign className="w-5 h-5 text-red-600" />}
            colorClass="text-red-600"
            badge="進行中"
          />

          <MetricCard
            title="第二/三/四階段 催告與終止"
            value={`${(data.kpiSummary.stageBreakdown['STAGE_2']?.count || 0) + (data.kpiSummary.stageBreakdown['STAGE_3']?.count || 0) + (data.kpiSummary.stageBreakdown['STAGE_4']?.count || 0)} 人`}
            subValue={`$${((data.kpiSummary.stageBreakdown['STAGE_2']?.amount || 0) + (data.kpiSummary.stageBreakdown['STAGE_3']?.amount || 0) + (data.kpiSummary.stageBreakdown['STAGE_4']?.amount || 0)).toLocaleString()}`}
            icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
            colorClass="text-amber-600"
            badge="FA 重點處理"
          />

          <MetricCard
            title="待 Write-off 案件"
            value={`${data.kpiSummary.stageBreakdown['STAGE_4']?.count || 0} 人`}
            subValue={`$${(data.kpiSummary.stageBreakdown['STAGE_4']?.amount || 0).toLocaleString()}`}
            icon={<Clock className="w-5 h-5 text-purple-600" />}
            colorClass="text-purple-600"
            badge="逾期滿95天/終止滿15天"
          />

          <MetricCard
            title="已結案金額 (歷史+近期)"
            value={`$${data.kpiSummary.totalClosedAmount.toLocaleString()}`}
            subValue={`${data.kpiSummary.closedCases} 人已結案`}
            icon={<FileCheck className="w-5 h-5 text-emerald-600" />}
            colorClass="text-emerald-700"
            badge="回收成功"
          />
        </div>
      )}

      {/* Matrix Dashboard Table (Matching User Screenshot Layout) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        {/* Table Title Bar */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isValet ? 'bg-red-50/70 border-red-200' : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xl font-extrabold lowercase tracking-tight ${
                isValet ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {businessUnit.toLowerCase()}
            </span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              呆帳統計矩陣 (點擊任一數值可直接跳轉篩選清單)
            </span>
          </div>

          <button
            onClick={() => onNavigateToCases()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"
          >
            檢視全部案件清單
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-24 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
              <p className="text-sm">載入總覽統計數據中...</p>
            </div>
          ) : data ? (
            <table className="w-full text-left border-collapse">
              {/* Table Header */}
              <thead>
                {/* Top header row with Month Buckets */}
                <tr className="bg-[#cca87e] text-slate-900 text-xs font-bold border-b border-slate-300">
                  <th className="py-3 px-4 w-56 italic font-bold text-slate-900 border-r-2 border-slate-400">
                    status
                  </th>
                  {data.timeBuckets.map((bucket) => (
                    <th
                      key={bucket.key}
                      colSpan={3}
                      className={`py-2 px-3 text-center border-r border-slate-400/80 ${
                        bucket.isTotal ? 'bg-[#b89569] text-slate-950 font-extrabold' : ''
                      }`}
                    >
                      <span className="text-sm font-bold block">{bucket.label}</span>
                    </th>
                  ))}
                </tr>

                {/* Sub-header row with metrics ($總額, 人數, ttl. %) */}
                <tr className="bg-[#dcc09b] text-slate-900 text-xs font-bold border-b-2 border-slate-400">
                  <th className="py-2 px-4 border-r-2 border-slate-400 bg-[#d5b58d]"></th>
                  {data.timeBuckets.map((bucket) => (
                    <React.Fragment key={bucket.key}>
                      <th className="py-2 px-3 text-right font-bold w-28">
                        $總額
                      </th>
                      <th className="py-2 px-2 text-center font-bold w-16">
                        人數
                      </th>
                      <th className="py-2 px-2 text-right font-bold w-16 border-r border-slate-400/80">
                        ttl. %
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                {data.rows.map((row, rIdx) => (
                  <tr
                    key={row.key}
                    className={`transition-colors ${
                      rIdx % 2 === 0 ? 'bg-[#faf6f0]' : 'bg-[#f4ebe1]'
                    } hover:bg-amber-100/50`}
                  >
                    {/* Row Label */}
                    <td className="py-3 px-4 font-semibold text-slate-900 border-r-2 border-slate-400 whitespace-nowrap">
                      {row.label}
                    </td>

                    {/* Bucket Columns */}
                    {data.timeBuckets.map((bucket) => {
                      const metric = row.buckets[bucket.key] || {
                        amount: 0,
                        count: 0,
                        percentage: 0,
                        percentageStr: '0.00%',
                      };
                      const hasValue = metric.count > 0 || metric.amount > 0;

                      return (
                        <React.Fragment key={bucket.key}>
                          <td
                            onClick={() =>
                              hasValue &&
                              onNavigateToCases({
                                stage: row.stageCode,
                                monthBucket: bucket.key !== 'total' ? bucket.key : undefined,
                              })
                            }
                            className={`py-3 px-3 text-right font-mono ${
                              hasValue
                                ? 'cursor-pointer font-semibold text-slate-900 hover:text-indigo-600 hover:underline'
                                : 'text-slate-400'
                            }`}
                          >
                            {hasValue ? metric.amount.toLocaleString() : ''}
                          </td>
                          <td
                            onClick={() =>
                              hasValue &&
                              onNavigateToCases({
                                stage: row.stageCode,
                                monthBucket: bucket.key !== 'total' ? bucket.key : undefined,
                              })
                            }
                            className={`py-3 px-2 text-center ${
                              hasValue
                                ? 'cursor-pointer font-semibold text-slate-900 hover:text-indigo-600 hover:underline'
                                : 'text-slate-400'
                            }`}
                          >
                            {hasValue ? metric.count : ''}
                          </td>
                          <td
                            className={`py-3 px-2 text-right font-mono border-r border-slate-300 ${
                              hasValue ? 'font-semibold text-slate-700' : 'text-slate-400'
                            }`}
                          >
                            {hasValue ? metric.percentageStr : ''}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}

                {/* Totals Row (Matching image double bottom border & bold total) */}
                <tr className="bg-[#ede1d0] text-slate-950 font-bold border-t-2 border-b-4 border-slate-900 text-xs">
                  <td className="py-3 px-4 font-black text-slate-950 border-r-2 border-slate-400 text-sm">
                    {data.totalsRow.label}
                  </td>
                  {data.timeBuckets.map((bucket) => {
                    const metric = data.totalsRow.buckets[bucket.key] || {
                      amount: 0,
                      count: 0,
                      percentage: 0,
                      percentageStr: '0.00%',
                    };

                    return (
                      <React.Fragment key={bucket.key}>
                        <td className="py-3 px-3 text-right font-mono font-black text-sm">
                          {metric.amount > 0 ? metric.amount.toLocaleString() : '0'}
                        </td>
                        <td className="py-3 px-2 text-center font-black text-sm">
                          {metric.count > 0 ? metric.count : '0'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-black text-xs border-r border-slate-400">
                          {metric.amount > 0 ? '100.00%' : '0.00%'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>

        {/* Footer info & stages explanation */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-700">催帳階段定義：</span>
            <span>• <strong>滿 30 天</strong>：第 1 階段 勸導期 (2C)</span>
            <span>• <strong>滿 50 天</strong>：第 2 階段 催告期 (FA)</span>
            <span>• <strong>滿 80 天</strong>：第 3 階段 終止期 (FA)</span>
            <span>• <strong>滿 95 天/終止函發送滿15天</strong>：第 4 階段 待 write-off</span>
          </div>

          <button
            onClick={onOpenUpload}
            className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
          >
            上傳最新週報更新數據 ➜
          </button>
        </div>
      </div>
    </div>
  );
};
