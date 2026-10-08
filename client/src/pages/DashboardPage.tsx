import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Upload } from 'lucide-react';
import type { BusinessUnit } from '../types';
import { dashboardApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { STAGES, stageMeta } from '../components/stage';

interface DashboardPageProps {
  businessUnit: BusinessUnit;
  onSelectBusinessUnit: (unit: BusinessUnit) => void;
  onNavigateToCases: (filters?: { stage?: string; monthBucket?: string }) => void;
  onOpenUpload: () => void;
}

const money = (n: number) => `$${n.toLocaleString()}`;

/** 升級階梯只顯示未結案的五個階段 */
const LADDER = STAGES.filter((s) => s.code !== 'CLOSED');

export const DashboardPage: React.FC<DashboardPageProps> = ({
  businessUnit,
  onNavigateToCases,
  onOpenUpload,
}) => {
  const { is2CTeam } = useAuth();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview', businessUnit],
    queryFn: () => dashboardApi.getOverview(businessUnit),
  });

  const unitName = businessUnit === 'VALET' ? 'Valet' : 'Pepper';
  const kpi = data?.kpiSummary;
  const breakdown = kpi?.stageBreakdown ?? {};
  const outstanding = kpi?.totalOutstandingAmount ?? 0;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* 頁首 */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{unitName} 呆帳總覽</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data?.referenceDate ? `依 ${data.referenceDate} 匯入的週報計算` : '依最新匯入的週報計算'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-ghost">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            重新整理
          </button>
          {is2CTeam && (
            <button onClick={onOpenUpload} className="btn btn-secondary sm:hidden">
              <Upload className="w-4 h-4" />
              上傳週報
            </button>
          )}
        </div>
      </header>

      {/* 總額 + 升級階梯 */}
      <section className="panel overflow-hidden" aria-label="各階段欠款">
        <div className="p-6 sm:p-8 flex flex-wrap items-end gap-x-14 gap-y-6">
          <div>
            <div className="text-sm font-medium text-ink-500">未結案欠款</div>
            <div className="mt-1 text-[40px] leading-none font-bold tracking-tight text-ink-900 tabular-nums">
              {isLoading ? '—' : money(outstanding)}
            </div>
            <div className="mt-2 text-sm text-ink-500">{kpi ? `${kpi.activeCases} 位客戶尚未結清` : ' '}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-ink-500">已回收</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-brand-700 tabular-nums">
              {isLoading ? '—' : money(kpi?.totalClosedAmount ?? 0)}
            </div>
            <div className="mt-1.5 text-sm text-ink-500">{kpi ? `${kpi.closedCases} 位已結案` : ' '}</div>
          </div>
        </div>

        {/* 欠款分布：依金額比例 */}
        <div className="px-6 sm:px-8">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-ink-100 gap-px">
            {outstanding > 0 &&
              LADDER.map((s) => {
                const amt = breakdown[s.code]?.amount ?? 0;
                if (!amt) return null;
                return (
                  <div
                    key={s.code}
                    className={s.bar}
                    style={{ width: `${(amt / outstanding) * 100}%` }}
                    title={`${s.name} ${money(amt)}`}
                  />
                );
              })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1 gap-px bg-ink-200 border-t border-ink-200">
          {LADDER.map((s) => {
            const b = breakdown[s.code] ?? { count: 0, amount: 0 };
            const empty = b.count === 0;
            return (
              <button
                key={s.code}
                onClick={() => onNavigateToCases({ stage: s.code })}
                className="group text-left p-5 sm:p-6 bg-white hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-[3px] ${s.dot}`} />
                  <span className="text-sm font-semibold text-ink-900 whitespace-nowrap">{s.name}</span>
                  {s.owner && <span className="ml-auto text-xs font-medium text-ink-400">{s.owner}</span>}
                </div>
                <div className="mt-0.5 text-xs text-ink-500">{s.threshold}</div>
                <div className={`mt-4 text-2xl font-bold tabular-nums ${empty ? 'text-ink-300' : 'text-ink-900'}`}>
                  {b.count}
                  <span className="text-sm font-medium text-ink-400 ml-1">人</span>
                </div>
                <div className={`text-[13px] tabular-nums ${empty ? 'text-ink-300' : 'text-ink-600'}`}>{money(b.amount)}</div>
                <div className="mt-3 text-xs font-semibold text-brand-700 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  查看案件
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 月份明細 */}
      <section className="space-y-4" aria-labelledby="matrix-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="matrix-title" className="text-lg font-bold tracking-tight text-ink-900">依催帳開始月份</h2>
            <p className="mt-0.5 text-sm text-ink-500">點擊金額或人數，查看該月份、該階段的案件。</p>
          </div>
          <button onClick={() => onNavigateToCases()} className="btn btn-secondary">
            查看全部案件
          </button>
        </div>

        <div className="panel overflow-x-auto">
          {isLoading ? (
            <div className="py-20 flex items-center justify-center gap-2 text-sm text-ink-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              載入統計資料
            </div>
          ) : data ? (
            <table className="w-full text-[13px] border-collapse tabular-nums">
              <thead>
                <tr className="text-ink-900">
                  <th rowSpan={2} className="sticky left-0 z-10 bg-white text-left align-bottom font-semibold py-3 px-5 min-w-52 border-b border-ink-200">
                    階段
                  </th>
                  {data.timeBuckets.map((bucket) => (
                    <th
                      key={bucket.key}
                      colSpan={3}
                      className={`pt-4 pb-1 px-3 text-center font-semibold whitespace-nowrap border-l border-ink-100 ${
                        bucket.isTotal ? 'bg-ink-50' : ''
                      }`}
                    >
                      {bucket.label}
                    </th>
                  ))}
                </tr>
                <tr className="text-xs text-ink-500 border-b border-ink-200 whitespace-nowrap">
                  {data.timeBuckets.map((bucket) => (
                    <React.Fragment key={bucket.key}>
                      <th className={`pb-2.5 px-3 text-right font-medium border-l border-ink-100 ${bucket.isTotal ? 'bg-ink-50' : ''}`}>金額</th>
                      <th className={`pb-2.5 px-2 text-right font-medium ${bucket.isTotal ? 'bg-ink-50' : ''}`}>人數</th>
                      <th className={`pb-2.5 pl-2 pr-3 text-right font-medium ${bucket.isTotal ? 'bg-ink-50' : ''}`}>占比</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody className="text-ink-800">
                {data.rows.map((row) => {
                  const meta = stageMeta(row.stageCode);
                  return (
                    <tr key={row.key} className="border-b border-ink-100 hover:bg-ink-50/60 transition-colors">
                      <td className="sticky left-0 z-10 bg-white py-3 px-5 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-[3px] ${meta.dot}`} />
                          <span className="font-semibold text-ink-900">{meta.name}</span>
                          <span className="text-xs text-ink-400">{meta.threshold}</span>
                        </span>
                      </td>

                      {data.timeBuckets.map((bucket) => {
                        const metric = row.buckets[bucket.key] || { amount: 0, count: 0, percentage: 0, percentageStr: '0.00%' };
                        const hasValue = metric.count > 0 || metric.amount > 0;
                        const go = () =>
                          hasValue &&
                          onNavigateToCases({
                            stage: row.stageCode,
                            monthBucket: bucket.key !== 'total' ? bucket.key : undefined,
                          });
                        const linkCls = hasValue
                          ? 'cursor-pointer font-semibold text-ink-900 hover:text-brand-700 hover:underline underline-offset-4 decoration-brand-300'
                          : 'text-ink-300';
                        const bg = bucket.isTotal ? 'bg-ink-50/70' : '';

                        return (
                          <React.Fragment key={bucket.key}>
                            <td onClick={go} className={`py-3 px-3 text-right border-l border-ink-100 ${linkCls} ${bg}`}>
                              {hasValue ? metric.amount.toLocaleString() : '–'}
                            </td>
                            <td onClick={go} className={`py-3 px-2 text-right ${linkCls} ${bg}`}>
                              {hasValue ? metric.count : '–'}
                            </td>
                            <td className={`py-3 pl-2 pr-3 text-right text-xs ${hasValue ? 'text-ink-500' : 'text-ink-300'} ${bg}`}>
                              {hasValue ? metric.percentageStr : ''}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr className="font-bold text-ink-900 border-t-2 border-ink-300">
                  <td className="sticky left-0 z-10 bg-white py-3.5 px-5">合計</td>
                  {data.timeBuckets.map((bucket) => {
                    const metric = data.totalsRow.buckets[bucket.key] || { amount: 0, count: 0, percentage: 0, percentageStr: '0.00%' };
                    const bg = bucket.isTotal ? 'bg-ink-50/70' : '';
                    return (
                      <React.Fragment key={bucket.key}>
                        <td className={`py-3.5 px-3 text-right border-l border-ink-100 ${bg}`}>{metric.amount.toLocaleString()}</td>
                        <td className={`py-3.5 px-2 text-right ${bg}`}>{metric.count}</td>
                        <td className={`py-3.5 pl-2 pr-3 text-right text-xs font-medium text-ink-500 ${bg}`}>
                          {metric.amount > 0 ? '100%' : ''}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center text-sm text-ink-500">
              尚無資料。上傳第一份週報後，這裡會依月份列出各階段的欠款。
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
