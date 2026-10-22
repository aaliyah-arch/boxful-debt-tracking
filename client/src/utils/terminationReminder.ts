import { differenceInCalendarDays, addDays, format, startOfDay } from 'date-fns';
import type { CaseRecord } from '../types';
import { parseDateLoose } from './dateUtils';

/** 催告日期之後幾天可發終止函（「催告到期日」沒填時使用） */
export const DEMAND_TO_TERMINATION_DAYS = 30;
/** 到期前幾天開始顯示「即將到期」 */
export const DUE_SOON_DAYS = 5;

export type TerminationReminderStatus = 'DUE' | 'DUE_SOON';

export interface TerminationReminder {
  status: TerminationReminderStatus;
  /** 可發終止函的日期（yyyy-MM-dd） */
  dueDate: string;
  /** 距離可發日還有幾天；0 或負數代表已可發（負數 = 已超過幾天） */
  daysLeft: number;
}

/**
 * 終止函提醒規則：
 * 已發催告、尚未發終止函、未結案；
 * 可發日 = 「催告到期日」，沒填則為「催告日期 + 30 天」。
 */
export function getTerminationReminder(
  c: Pick<CaseRecord, 'isClosed' | 'demandNoticeDate' | 'demandDueDate' | 'terminationNoticeDate'>,
  today: Date = new Date()
): TerminationReminder | null {
  if (c.isClosed) return null;
  if (c.terminationNoticeDate && String(c.terminationNoticeDate).trim()) return null;

  const notice = parseDateLoose(c.demandNoticeDate);
  const explicitDue = parseDateLoose(c.demandDueDate);
  const due = explicitDue ?? (notice ? addDays(notice, DEMAND_TO_TERMINATION_DAYS) : null);
  if (!due) return null;

  const daysLeft = differenceInCalendarDays(startOfDay(due), startOfDay(today));
  if (daysLeft > DUE_SOON_DAYS) return null;
  return {
    status: daysLeft <= 0 ? 'DUE' : 'DUE_SOON',
    dueDate: format(due, 'yyyy-MM-dd'),
    daysLeft,
  };
}

/** 給畫面用的簡短文字 */
export function reminderLabel(r: TerminationReminder): string {
  if (r.status === 'DUE_SOON') return `終止函 ${r.daysLeft} 天後可發`;
  if (r.daysLeft === 0) return '今天可發終止函';
  return `可發終止函（已過 ${-r.daysLeft} 天）`;
}
