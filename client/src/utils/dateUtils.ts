import { format } from 'date-fns';

/**
 * 寬鬆解析日期：支援 Date、yyyy-MM-dd、yyyy/M/d、ISO 字串
 * 試算表手動輸入的文字（例如「10/3 已寄」）無法解析時回傳 null，不會丟出錯誤
 */
export function parseDateLoose(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 轉成 yyyy-MM-dd；無法解析時原樣回傳文字（避免資料遺失） */
export function normalizeDateString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = parseDateLoose(s);
  return d ? format(d, 'yyyy-MM-dd') : s;
}

/** 安全格式化：無法解析的值回傳 fallback（預設為原文字），絕不丟出錯誤 */
export function safeFormat(v: unknown, fmt: string, fallback?: string): string {
  const d = parseDateLoose(v);
  if (d) return format(d, fmt);
  if (fallback !== undefined) return fallback;
  return v === null || v === undefined ? '' : String(v);
}

/** 是否為「有值但不是日期」的文字 */
export function isNonDateText(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== '' && parseDateLoose(v) === null;
}

// ---------------------------------------------------------------------------
// 總覽表的帳單月份分組
// 依「今天」自動往前推：當月 + 前兩個月各一欄，再更早（含前第三個月）合併為「YYYY/MM前」
// 例：今天 2026/10/19 → 2026/07前、2026/08、2026/09、2026/10
// 分類依據為案件的帳單日（報表 inv Date 中最早的一張）；帳單日空白也歸在「YYYY/MM前」
// ---------------------------------------------------------------------------

export const OLDER_BUCKET_KEY = 'older';
export const TOTAL_BUCKET_KEY = 'total';

export interface MonthBucketDef {
  key: string;
  label: string;
  isTotal?: boolean;
}

function monthStart(ref: Date, offset: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
}

/** 「YYYY/MM前」欄位的標題，例如今天 10 月 → 2026/07前 */
export function olderBucketLabel(ref: Date = new Date()): string {
  return `${format(monthStart(ref, -3), 'yyyy/MM')}前`;
}

/** 總覽表的月份欄位（含總計） */
export function getMonthBuckets(ref: Date = new Date()): MonthBucketDef[] {
  const recent = [-2, -1, 0].map((offset) => {
    const label = format(monthStart(ref, offset), 'yyyy/MM');
    return { key: label, label };
  });
  return [
    { key: OLDER_BUCKET_KEY, label: olderBucketLabel(ref) },
    ...recent,
    { key: TOTAL_BUCKET_KEY, label: '總計', isTotal: true },
  ];
}

/** 案件屬於哪一個月份欄位：回傳 'older' 或 'yyyy/MM' */
export function monthBucketOf(billDate: unknown, ref: Date = new Date()): string {
  const d = parseDateLoose(billDate);
  if (!d) return OLDER_BUCKET_KEY; // 帳單日空白或無法辨識
  if (d < monthStart(ref, -2)) return OLDER_BUCKET_KEY;
  // 帳單日在未來月份（資料異常）時，歸在當月，避免各欄加總與總計對不上
  if (d >= monthStart(ref, 1)) return format(monthStart(ref, 0), 'yyyy/MM');
  return format(d, 'yyyy/MM');
}

/** 篩選標籤用的文字：'older' 轉成「YYYY/MM前」，其餘原樣顯示 */
export function monthBucketLabel(key: string, ref: Date = new Date()): string {
  return key === OLDER_BUCKET_KEY ? olderBucketLabel(ref) : key;
}
