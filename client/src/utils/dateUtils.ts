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
