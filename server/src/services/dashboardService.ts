import { format, subMonths, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import prisma from '../prisma';

export interface CellMetric {
  amount: number;
  count: number;
  percentage: number; // e.g. 96.53
  percentageStr: string; // e.g. "96.53%"
}

export interface MatrixRow {
  key: string;
  stageCode: string;
  label: string;
  buckets: Record<string, CellMetric>; // bucketKey -> metric
}

export interface TimeBucket {
  key: string;
  label: string;
  isTotal?: boolean;
}

export interface DashboardOverviewResult {
  businessUnit: string;
  referenceDate: string;
  timeBuckets: TimeBucket[];
  rows: MatrixRow[];
  totalsRow: MatrixRow;
  kpiSummary: {
    totalOutstandingAmount: number;
    totalClosedAmount: number;
    totalCases: number;
    activeCases: number;
    closedCases: number;
    stageBreakdown: Record<string, { count: number; amount: number }>;
  };
}

export async function getDashboardOverview(
  businessUnit: 'VALET' | 'PEPPER',
  refDate: Date = new Date()
): Promise<DashboardOverviewResult> {
  const currentMonthDate = startOfMonth(refDate);
  const mMinus1Date = startOfMonth(subMonths(refDate, 1));
  const mMinus2Date = startOfMonth(subMonths(refDate, 2));
  const mMinus3Date = startOfMonth(subMonths(refDate, 3));

  const currentLabel = format(currentMonthDate, 'yyyy/MM');
  const mMinus1Label = format(mMinus1Date, 'yyyy/MM');
  const mMinus2Label = format(mMinus2Date, 'yyyy/MM');
  const olderLabel = `${format(mMinus3Date, 'yyyy/MM')}前`;

  const timeBuckets: TimeBucket[] = [
    { key: 'older', label: olderLabel },
    { key: 'm_minus_2', label: mMinus2Label },
    { key: 'm_minus_1', label: mMinus1Label },
    { key: 'current', label: currentLabel },
    { key: 'total', label: '當前總計', isTotal: true },
  ];

  // Fetch all cases for this business unit
  const cases = await prisma.caseRecord.findMany({
    where: { businessUnit },
  });

  const rowDefinitions = [
    { key: 'STAGE_1', stageCode: 'STAGE_1', label: '1. 第一階段：勸導期' },
    { key: 'STAGE_2', stageCode: 'STAGE_2', label: '2. 第二階段：催告期' },
    { key: 'STAGE_3', stageCode: 'STAGE_3', label: '3. 第三階段：終止期' },
    { key: 'STAGE_4', stageCode: 'STAGE_4', label: '4. 待write-off' },
    { key: 'CLOSED', stageCode: 'CLOSED', label: '5. 已結案' },
  ];

  // Bucket assignment helper
  function getBucketKey(record: {
    collectionStartDate?: Date | null;
    billDate?: Date | null;
    createdAt: Date;
    outstandingDays: number;
  }): string {
    let dateToUse = record.collectionStartDate || record.billDate;
    if (!dateToUse) {
      // Estimate based on createdAt or days
      dateToUse = record.createdAt;
    }

    const recMonth = format(startOfMonth(new Date(dateToUse)), 'yyyy/MM');

    if (recMonth === currentLabel) return 'current';
    if (recMonth === mMinus1Label) return 'm_minus_1';
    if (recMonth === mMinus2Label) return 'm_minus_2';

    if (isBefore(new Date(dateToUse), mMinus2Date)) {
      return 'older';
    }

    return 'current';
  }

  // Raw aggregation matrix: rowKey -> bucketKey -> { amount, count }
  const matrixData: Record<string, Record<string, { amount: number; count: number }>> = {};
  for (const row of rowDefinitions) {
    matrixData[row.key] = {};
    for (const b of timeBuckets) {
      matrixData[row.key][b.key] = { amount: 0, count: 0 };
    }
  }

  const columnTotals: Record<string, { amount: number; count: number }> = {};
  for (const b of timeBuckets) {
    columnTotals[b.key] = { amount: 0, count: 0 };
  }

  let totalOutstandingAmount = 0;
  let totalClosedAmount = 0;
  let activeCases = 0;
  let closedCases = 0;

  const stageBreakdown: Record<string, { count: number; amount: number }> = {
    UNREACHED: { count: 0, amount: 0 },
    STAGE_1: { count: 0, amount: 0 },
    STAGE_2: { count: 0, amount: 0 },
    STAGE_3: { count: 0, amount: 0 },
    STAGE_4: { count: 0, amount: 0 },
    CLOSED: { count: 0, amount: 0 },
  };

  for (const c of cases) {
    const bucketKey = getBucketKey(c);
    const stage = c.isClosed ? 'CLOSED' : c.stage;
    const amt = Number(c.outstandingAmount) || 0;

    // KPI stats
    if (c.isClosed) {
      totalClosedAmount += amt;
      closedCases++;
    } else {
      totalOutstandingAmount += amt;
      activeCases++;
    }

    if (stageBreakdown[stage]) {
      stageBreakdown[stage].count++;
      stageBreakdown[stage].amount += amt;
    }

    // Populate matrix (only defined rows)
    if (matrixData[stage]) {
      matrixData[stage][bucketKey].amount += amt;
      matrixData[stage][bucketKey].count += 1;

      // Total bucket
      matrixData[stage]['total'].amount += amt;
      matrixData[stage]['total'].count += 1;

      // Column totals
      columnTotals[bucketKey].amount += amt;
      columnTotals[bucketKey].count += 1;

      columnTotals['total'].amount += amt;
      columnTotals['total'].count += 1;
    }
  }

  // Construct formatted matrix rows with percentages
  const rows: MatrixRow[] = rowDefinitions.map((def) => {
    const buckets: Record<string, CellMetric> = {};

    for (const b of timeBuckets) {
      const cell = matrixData[def.key][b.key];
      const colTotalAmt = columnTotals[b.key].amount;
      const pct = colTotalAmt > 0 ? (cell.amount / colTotalAmt) * 100 : 0;

      buckets[b.key] = {
        amount: Math.round(cell.amount * 100) / 100,
        count: cell.count,
        percentage: Math.round(pct * 100) / 100,
        percentageStr: `${pct.toFixed(2)}%`,
      };
    }

    return {
      key: def.key,
      stageCode: def.stageCode,
      label: def.label,
      buckets,
    };
  });

  // Construct Totals row
  const totalRowBuckets: Record<string, CellMetric> = {};
  for (const b of timeBuckets) {
    const colTotal = columnTotals[b.key];
    totalRowBuckets[b.key] = {
      amount: Math.round(colTotal.amount * 100) / 100,
      count: colTotal.count,
      percentage: colTotal.amount > 0 ? 100 : 0,
      percentageStr: colTotal.amount > 0 ? '100.00%' : '0.00%',
    };
  }

  const totalsRow: MatrixRow = {
    key: 'TOTAL',
    stageCode: 'TOTAL',
    label: '總和',
    buckets: totalRowBuckets,
  };

  return {
    businessUnit,
    referenceDate: format(refDate, 'yyyy-MM-dd'),
    timeBuckets,
    rows,
    totalsRow,
    kpiSummary: {
      totalOutstandingAmount: Math.round(totalOutstandingAmount * 100) / 100,
      totalClosedAmount: Math.round(totalClosedAmount * 100) / 100,
      totalCases: cases.length,
      activeCases,
      closedCases,
      stageBreakdown,
    },
  };
}
