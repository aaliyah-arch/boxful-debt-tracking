import { differenceInCalendarDays } from 'date-fns';

export type StageType = 'UNREACHED' | 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'CLOSED';

export interface StageComputationInput {
  isClosed: boolean;
  outstandingDays: number;
  terminationNoticeDate?: Date | string | null;
  referenceDate?: Date;
}

export const STAGE_CONFIG = {
  UNREACHED: { code: 'UNREACHED', name: '未滿30天 (追蹤中)', order: 0 },
  STAGE_1: { code: 'STAGE_1', name: '1. 第一階段：勸導期', minDays: 30, order: 1 },
  STAGE_2: { code: 'STAGE_2', name: '2. 第二階段：催告期', minDays: 50, order: 2 },
  STAGE_3: { code: 'STAGE_3', name: '3. 第三階段：終止期', minDays: 80, order: 3 },
  STAGE_4: { code: 'STAGE_4', name: '4. 待write-off', minDays: 95, order: 4 },
  CLOSED: { code: 'CLOSED', name: '5. 已結案', order: 5 },
};

/**
 * Computes the stage of a customer case based on business logic:
 * - isClosed == true -> CLOSED
 * - terminationNoticeDate != null && daysSinceTermination >= 15 -> STAGE_4
 * - outstandingDays >= 95 -> STAGE_4
 * - outstandingDays >= 80 -> STAGE_3
 * - outstandingDays >= 50 -> STAGE_2
 * - outstandingDays >= 30 -> STAGE_1
 * - outstandingDays < 30 -> UNREACHED
 */
export function computeStage(input: StageComputationInput): StageType {
  if (input.isClosed) {
    return 'CLOSED';
  }

  const refDate = input.referenceDate || new Date();

  // Rule: If termination letter was sent and 15 days have elapsed without closure
  if (input.terminationNoticeDate) {
    const termDate = new Date(input.terminationNoticeDate);
    const elapsedDays = differenceInCalendarDays(refDate, termDate);
    if (elapsedDays >= 15) {
      return 'STAGE_4';
    }
  }

  const days = Number(input.outstandingDays) || 0;

  if (days >= 95) {
    return 'STAGE_4';
  }
  if (days >= 80) {
    return 'STAGE_3';
  }
  if (days >= 50) {
    return 'STAGE_2';
  }
  if (days >= 30) {
    return 'STAGE_1';
  }

  return 'UNREACHED';
}
