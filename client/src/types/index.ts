export type BusinessUnit = 'VALET' | 'PEPPER';

export type Role = 'TWO_C_TEAM' | 'FA_TEAM' | 'ADMIN' | 'VIEWER';

export type DemandMethod = 'EMAIL' | 'CERTIFIED_LETTER';

export type StageType = 'UNREACHED' | 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'CLOSED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
}

export interface AuditLog {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  action: string;
  details: string;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  uid: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  businessUnit: BusinessUnit;
  outstandingAmount: number;
  outstandingDays: number;
  billDate?: string | null;
  address?: string | null;
  serviceType?: string | null;
  invId?: string | null;
  invoicedAmount?: number | null;
  blueCode?: string | null;
  statusTag?: string; // 'NORMAL' | 'PENDING_CONFIRMATION' (待確認是否結案)
  stage: StageType;
  isClosed: boolean;
  closedDate?: string | null;
  collectionStartDate?: string | null;
  lineNoticeDate?: string | null;
  lineStatus?: string | null;
  emailNoticeDate?: string | null;
  emailStatus?: string | null;
  phoneNoticeDate?: string | null;
  phoneStatus?: string | null;
  smsNoticeDate?: string | null; // 簡訊通知日期 -> 試算表「寄簡訊日期」
  twoCNotes?: string | null; // -> 試算表「處理方式/客人回應」
  demandNoticeDate?: string | null;
  demandDueDate?: string | null;
  demandDocUrl?: string | null; // -> 試算表「電子催告檔」
  demandMethod?: DemandMethod | null; // 催告方式 -> 試算表「催告方式」
  demandSmsDate?: string | null; // -> 試算表「電子催告簡訊日期」
  terminationNoticeDate?: string | null; // 終止函發送日期 -> 試算表「服務終止日」
  terminationDueDate?: string | null; // -> 試算表「服務終止日」後的「到期日期」
  terminationSmsDate?: string | null; // -> 試算表「終止簡訊通知」
  terminationDocUrl?: string | null;
  certifiedLetterUrl?: string | null; // -> 試算表「存證信函」
  certifiedLetterReceivedDate?: string | null; // -> 試算表「收件日期」
  certifiedLetterDueDate?: string | null; // -> 試算表「收件日期」後的「到期日期」
  faNotes?: string | null;
  lastImportedAt: string;
  createdAt: string;
  updatedAt: string;
  auditLogs?: AuditLog[];
}

export interface CellMetric {
  amount: number;
  count: number;
  percentage: number;
  percentageStr: string;
}

export interface MatrixRow {
  key: string;
  stageCode: string;
  label: string;
  buckets: Record<string, CellMetric>;
}

export interface TimeBucket {
  key: string;
  label: string;
  isTotal?: boolean;
}

export interface DashboardOverview {
  businessUnit: BusinessUnit;
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

export interface WhitelistItem {
  id: string;
  email: string;
  role: Role;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}
