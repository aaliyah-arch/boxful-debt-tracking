import type { StageType } from '../types';

/**
 * 催帳升級階梯：每個階段的名稱、門檻天數與代表色。
 * 全站的階段標示（看板階梯、清單、詳情）都從這裡取，確保用語與顏色一致。
 * 顏色 class 需寫成完整字串，Tailwind 才掃描得到。
 */
export interface StageMeta {
  code: StageType;
  name: string;
  /** 進入此階段的逾期天數門檻（說明用） */
  threshold: string;
  owner?: '2C' | 'FA';
  dot: string;
  bar: string;
  text: string;
}

export const STAGES: StageMeta[] = [
  { code: 'UNREACHED', name: '追蹤中', threshold: '未滿 30 天', dot: 'bg-stage-0', bar: 'bg-stage-0', text: 'text-ink-500' },
  { code: 'STAGE_1', name: '勸導期', threshold: '滿 30 天', owner: '2C', dot: 'bg-stage-1', bar: 'bg-stage-1', text: 'text-brand-800' },
  { code: 'STAGE_2', name: '催告期', threshold: '滿 50 天', owner: 'FA', dot: 'bg-stage-2', bar: 'bg-stage-2', text: 'text-[#8a5a0b]' },
  { code: 'STAGE_3', name: '終止期', threshold: '滿 80 天', owner: 'FA', dot: 'bg-stage-3', bar: 'bg-stage-3', text: 'text-[#a13e2e]' },
  { code: 'STAGE_4', name: '待 write-off', threshold: '滿 95 天', owner: 'FA', dot: 'bg-stage-4', bar: 'bg-stage-4', text: 'text-stage-4' },
  { code: 'CLOSED', name: '已結案', threshold: '已繳清或沖銷', dot: 'bg-stage-closed', bar: 'bg-stage-closed', text: 'text-stage-closed' },
];

export const stageMeta = (stage: StageType | string, isClosed = false): StageMeta => {
  if (isClosed) return STAGES[5];
  return STAGES.find((s) => s.code === stage) ?? STAGES[0];
};

/** 逾期天數對應到的顏色（用於天數進度軌） */
export const dayColor = (days: number) =>
  days >= 95 ? 'bg-stage-4' : days >= 80 ? 'bg-stage-3' : days >= 50 ? 'bg-stage-2' : days >= 30 ? 'bg-stage-1' : 'bg-stage-0';
