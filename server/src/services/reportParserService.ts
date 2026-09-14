import * as xlsx from 'xlsx';
import prisma from '../prisma';
import { computeStage } from './stageService';

export interface ParseResult {
  totalCount: number;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  errors: string[];
}

export interface RawRowData {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  outstandingAmount: number;
  outstandingDays: number;
  billDate?: Date | null;
}

function parseDateValue(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }
  if (typeof val === 'string') {
    const parsed = new Date(val.trim());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function parseSpreadsheetBuffer(buffer: Buffer): RawRowData[] {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('報表檔案中無任何工作表 (Sheet)');
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  const rows: RawRowData[] = [];

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const normalized: Record<string, any> = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[cleanKey] = val;
    }

    // UID resolution
    const rawUid =
      normalized['uid'] ||
      normalized['客戶編號'] ||
      normalized['客戶代號'] ||
      normalized['user_id'] ||
      normalized['userid'] ||
      normalized['id'] ||
      normalized['案件編號'] ||
      normalized['合約編號'];

    if (!rawUid) {
      continue; // skip empty rows without UID
    }

    const uid = String(rawUid).trim();

    // Name resolution
    const rawName =
      normalized['name'] ||
      normalized['姓名'] ||
      normalized['客戶姓名'] ||
      normalized['客戶名稱'] ||
      normalized['customer_name'] ||
      normalized['customer'] ||
      `客戶-${uid}`;
    const name = String(rawName).trim();

    // Email resolution
    const rawEmail =
      normalized['email'] ||
      normalized['信箱'] ||
      normalized['電子信箱'] ||
      normalized['mail'] ||
      '';
    const email = rawEmail ? String(rawEmail).trim() : undefined;

    // Phone resolution
    const rawPhone =
      normalized['phone'] ||
      normalized['電話'] ||
      normalized['手機'] ||
      normalized['聯絡電話'] ||
      normalized['mobile'] ||
      '';
    const phone = rawPhone ? String(rawPhone).trim() : undefined;

    // Outstanding Amount resolution
    const rawAmount =
      normalized['amount'] ||
      normalized['outstanding_amount'] ||
      normalized['欠款金額'] ||
      normalized['呆帳金額'] ||
      normalized['未繳金額'] ||
      normalized['總額'] ||
      normalized['金額'] ||
      normalized['balance'] ||
      0;
    const cleanAmountStr = String(rawAmount).replace(/[^0-9.-]+/g, '');
    const outstandingAmount = parseFloat(cleanAmountStr) || 0;

    // Outstanding Days resolution
    const rawDays =
      normalized['outstanding_day'] ||
      normalized['outstanding_days'] ||
      normalized['outstandingday'] ||
      normalized['outstandingdays'] ||
      normalized['逾期天數'] ||
      normalized['欠款天數'] ||
      normalized['天數'] ||
      normalized['days'] ||
      0;
    const outstandingDays = parseInt(String(rawDays).replace(/[^0-9-]+/g, ''), 10) || 0;

    // Bill Date resolution
    const rawBillDate =
      normalized['bill_date'] ||
      normalized['billdate'] ||
      normalized['帳單日期'] ||
      normalized['應繳日'] ||
      normalized['到期日'] ||
      normalized['due_date'];
    const billDate = parseDateValue(rawBillDate);

    rows.push({
      uid,
      name,
      email,
      phone,
      outstandingAmount,
      outstandingDays,
      billDate,
    });
  }

  return rows;
}

export async function importReportData(
  businessUnit: 'VALET' | 'PEPPER',
  fileName: string,
  buffer: Buffer,
  uploadedBy: string,
  userId?: string
): Promise<ParseResult> {
  const rows = parseSpreadsheetBuffer(buffer);
  if (rows.length === 0) {
    throw new Error('檔案中未能解析出有效資料，請確認欄位包含 UID/客戶編號 及 逾期天數/金額');
  }

  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const existing = await prisma.caseRecord.findUnique({
        where: {
          businessUnit_uid: {
            businessUnit,
            uid: row.uid,
          },
        },
      });

      if (existing) {
        // Calculate new stage based on updated days unless already closed
        const stage = existing.isClosed
          ? 'CLOSED'
          : computeStage({
              isClosed: false,
              outstandingDays: row.outstandingDays,
              terminationNoticeDate: existing.terminationNoticeDate,
            });

        await prisma.caseRecord.update({
          where: { id: existing.id },
          data: {
            name: row.name || existing.name,
            email: row.email || existing.email,
            phone: row.phone || existing.phone,
            outstandingAmount: row.outstandingAmount,
            outstandingDays: row.outstandingDays,
            billDate: row.billDate || existing.billDate,
            stage,
            lastImportedAt: new Date(),
          },
        });
        updatedCount++;
      } else {
        // New record
        const initialStage = computeStage({
          isClosed: false,
          outstandingDays: row.outstandingDays,
        });

        await prisma.caseRecord.create({
          data: {
            uid: row.uid,
            name: row.name,
            email: row.email,
            phone: row.phone,
            businessUnit,
            outstandingAmount: row.outstandingAmount,
            outstandingDays: row.outstandingDays,
            billDate: row.billDate,
            stage: initialStage,
            lastImportedAt: new Date(),
          },
        });
        newCount++;
      }
    } catch (err: any) {
      errorCount++;
      errors.push(`UID ${row.uid}: ${err.message || '匯入失敗'}`);
    }
  }

  // Save import history
  await prisma.importHistory.create({
    data: {
      fileName,
      businessUnit,
      totalCount: rows.length,
      newCount,
      updatedCount,
      uploadedBy,
    },
  });

  // Audit log if user is logged in
  if (userId) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'IMPORT_REPORT',
        details: JSON.stringify({
          businessUnit,
          fileName,
          totalCount: rows.length,
          newCount,
          updatedCount,
          errorCount,
        }),
      },
    });
  }

  return {
    totalCount: rows.length,
    newCount,
    updatedCount,
    errorCount,
    errors,
  };
}
