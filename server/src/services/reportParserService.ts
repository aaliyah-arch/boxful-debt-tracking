import * as xlsx from 'xlsx';
import prisma from '../prisma';
import { computeStage } from './stageService';
import { overwriteRawReportInSheet, syncSummaryTrackingToSheet } from './googleSheetService';

export interface ParseResult {
  totalCount: number;
  newCount: number;
  updatedCount: number;
  pendingConfirmationCount: number;
  errorCount: number;
  errors: string[];
}

export interface RawRowData {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  invDate?: Date | null;
  invId?: string;
  invoicedAmount?: number;
  outstandingDays: number;
  totalOutstandingAmount: number;
  blueCode?: string;
}

export interface AggregatedCustomer {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  outstandingDays: number;
  totalOutstandingAmount: number;
  billDate?: Date | null;
  invId?: string;
  blueCode?: string;
  invoiceCount: number;
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

function formatDateString(d?: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseSpreadsheetBuffer(buffer: Buffer): {
  rawRows: RawRowData[];
  aggregatedMap: Map<string, AggregatedCustomer>;
} {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('報表檔案中無任何工作表 (Sheet)');
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  const rawRows: RawRowData[] = [];
  const aggregatedMap = new Map<string, AggregatedCustomer>();

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const normalized: Record<string, any> = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[cleanKey] = val;
    }

    // 1. UID resolution
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
      continue; // 略過無 UID 的空列
    }

    const uid = String(rawUid).trim();

    // 2. Name resolution
    const rawName =
      normalized['name'] ||
      normalized['姓名'] ||
      normalized['客戶姓名'] ||
      normalized['客戶名稱'] ||
      normalized['customer_name'] ||
      normalized['customer'] ||
      `客戶-${uid}`;
    const name = String(rawName).trim();

    // 3. Email resolution
    const rawEmail =
      normalized['email'] ||
      normalized['信箱'] ||
      normalized['電子信箱'] ||
      normalized['mail'] ||
      '';
    const email = rawEmail ? String(rawEmail).trim() : undefined;

    // 4. Phone resolution
    const rawPhone =
      normalized['phone'] ||
      normalized['電話'] ||
      normalized['手機'] ||
      normalized['聯絡電話'] ||
      normalized['mobile'] ||
      '';
    const phone = rawPhone ? String(rawPhone).trim() : undefined;

    // 5. Address (地址，Valet 專屬)
    const rawAddress =
      normalized['address'] ||
      normalized['地址'] ||
      normalized['服務地址'] ||
      normalized['配送地址'] ||
      '';
    const address = rawAddress ? String(rawAddress).trim() : undefined;

    // 6. Type of Service (服務類型，Valet 專屬)
    const rawServiceType =
      normalized['type_of_service'] ||
      normalized['service_type'] ||
      normalized['服務類型'] ||
      normalized['業務類型'] ||
      normalized['type'] ||
      '';
    const serviceType = rawServiceType ? String(rawServiceType).trim() : undefined;

    // 7. inv Date (發票日期)
    const rawInvDate =
      normalized['inv_date'] ||
      normalized['invdate'] ||
      normalized['invoicedate'] ||
      normalized['invoice_date'] ||
      normalized['帳單日期'] ||
      normalized['應繳日'] ||
      normalized['bill_date'];
    const invDate = parseDateValue(rawInvDate);

    // 8. Inv ID (發票編號)
    const rawInvId =
      normalized['inv_id'] ||
      normalized['invid'] ||
      normalized['invoice_id'] ||
      normalized['發票編號'] ||
      normalized['發票號碼'] ||
      '';
    const invId = rawInvId ? String(rawInvId).trim() : undefined;

    // 9. Invoiced Amount (發票金額)
    const rawInvAmount =
      normalized['invoiced_amount'] ||
      normalized['invoicedamount'] ||
      normalized['invoice_amount'] ||
      normalized['應收金額'] ||
      0;
    const cleanInvAmount = String(rawInvAmount).replace(/[^0-9.-]+/g, '');
    const invoicedAmount = parseFloat(cleanInvAmount) || 0;

    // 10. Outstanding Days (逾期天數)
    const rawDays =
      normalized['outstanding_days'] ||
      normalized['outstanding_day'] ||
      normalized['outstandingdays'] ||
      normalized['outstandingday'] ||
      normalized['逾期天數'] ||
      normalized['欠款天數'] ||
      normalized['天數'] ||
      normalized['days'] ||
      0;
    const outstandingDays = parseInt(String(rawDays).replace(/[^0-9-]+/g, ''), 10) || 0;

    // 11. Total Outstanding Amount (總欠款金額)
    const rawAmount =
      normalized['total_outstanding_amount'] ||
      normalized['totaloutstandingamount'] ||
      normalized['total_amount'] ||
      normalized['outstanding_amount'] ||
      normalized['amount'] ||
      normalized['欠款金額'] ||
      normalized['呆帳金額'] ||
      normalized['總欠款'] ||
      normalized['總額'] ||
      0;
    const cleanAmountStr = String(rawAmount).replace(/[^0-9.-]+/g, '');
    const totalOutstandingAmount = parseFloat(cleanAmountStr) || invoicedAmount || 0;

    // 12. Blue Code
    const rawBlueCode =
      normalized['blue_code'] ||
      normalized['bluecode'] ||
      normalized['藍碼'] ||
      '';
    const blueCode = rawBlueCode ? String(rawBlueCode).trim() : undefined;

    const rowObj: RawRowData = {
      uid,
      name,
      email,
      phone,
      address,
      serviceType,
      invDate,
      invId,
      invoicedAmount,
      outstandingDays,
      totalOutstandingAmount,
      blueCode,
    };

    rawRows.push(rowObj);

    // 依照人名/UID 彙整
    if (!aggregatedMap.has(uid)) {
      aggregatedMap.set(uid, {
        uid,
        name,
        email,
        phone,
        address,
        serviceType,
        outstandingDays,
        totalOutstandingAmount,
        billDate: invDate,
        invId,
        blueCode,
        invoiceCount: 1,
      });
    } else {
      const existing = aggregatedMap.get(uid)!;
      // 欠款金額加總（客人可能不只欠一個月的款項）
      existing.totalOutstandingAmount += totalOutstandingAmount;
      // 取最大逾期天數
      existing.outstandingDays = Math.max(existing.outstandingDays, outstandingDays);
      existing.invoiceCount += 1;
      // 補充空欄位
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.address && address) existing.address = address;
      if (!existing.serviceType && serviceType) existing.serviceType = serviceType;
      if (!existing.billDate && invDate) existing.billDate = invDate;
      if (!existing.blueCode && blueCode) existing.blueCode = blueCode;
      if (name && !existing.name.includes(name)) existing.name = name;
    }
  }

  return { rawRows, aggregatedMap };
}

export async function importReportData(
  businessUnit: 'VALET' | 'PEPPER',
  fileName: string,
  buffer: Buffer,
  uploadedBy: string,
  userId?: string
): Promise<ParseResult> {
  const { rawRows, aggregatedMap } = parseSpreadsheetBuffer(buffer);
  if (rawRows.length === 0) {
    throw new Error('檔案中未能解析出有效資料，請確認欄位包含 UID/客戶編號 及 逾期天數/金額');
  }

  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const currentBatchUids = new Set<string>();

  // 1. 處理當前報表中的所有客戶
  for (const [uid, item] of aggregatedMap.entries()) {
    currentBatchUids.add(uid);
    try {
      // 搜尋資料庫中該 businessUnit + uid 且「尚未結案」的案件
      const existingActive = await prisma.caseRecord.findFirst({
        where: {
          businessUnit,
          uid,
          isClosed: false,
        },
      });

      if (existingActive) {
        // 已有未結案案件：更新欠款數值與基本資訊，恢復 normal 追蹤狀態
        const stage = computeStage({
          isClosed: false,
          outstandingDays: item.outstandingDays,
          terminationNoticeDate: existingActive.terminationNoticeDate,
        });

        await prisma.caseRecord.update({
          where: { id: existingActive.id },
          data: {
            name: item.name || existingActive.name,
            email: item.email || existingActive.email,
            phone: item.phone || existingActive.phone,
            address: item.address || existingActive.address,
            serviceType: item.serviceType || existingActive.serviceType,
            outstandingAmount: item.totalOutstandingAmount,
            outstandingDays: item.outstandingDays,
            billDate: item.billDate || existingActive.billDate,
            invId: item.invId || existingActive.invId,
            blueCode: item.blueCode || existingActive.blueCode,
            stage,
            statusTag: 'NORMAL', // 再次出現在報表中，確認仍在欠款，標籤恢復 NORMAL
            lastImportedAt: new Date(),
          },
        });
        updatedCount++;
      } else {
        // 沒有未結案案件：可能第一次欠款，或先前已經結案了又再次欠款！
        // 依據使用者指引：「如果已經結案如又再欠款，不會覆蓋前面欠款的紀錄，到時候追蹤的會是還沒結案的那筆」
        // -> 新增一筆全新的未結案案件記錄！
        const initialStage = computeStage({
          isClosed: false,
          outstandingDays: item.outstandingDays,
        });

        await prisma.caseRecord.create({
          data: {
            uid: item.uid,
            name: item.name,
            email: item.email,
            phone: item.phone,
            address: item.address,
            serviceType: item.serviceType,
            businessUnit,
            outstandingAmount: item.totalOutstandingAmount,
            outstandingDays: item.outstandingDays,
            billDate: item.billDate,
            invId: item.invId,
            blueCode: item.blueCode,
            stage: initialStage,
            statusTag: 'NORMAL',
            isClosed: false,
            lastImportedAt: new Date(),
          },
        });
        newCount++;
      }
    } catch (err: any) {
      errorCount++;
      errors.push(`UID ${uid}: ${err.message || '匯入失敗'}`);
    }
  }

  // 2. 比對未入榜名單（已付款客人 -> 轉「待確認是否結案」狀態）
  // 需求：「2C team每週會上傳一次OutstandingReport，屆時已經付款的客人會不在名單裡，接著這個客人的狀態會轉到『待確認是否結案』狀態，再由2C team去調整『結案狀態』」
  let pendingConfirmationCount = 0;
  try {
    const activeCases = await prisma.caseRecord.findMany({
      where: {
        businessUnit,
        isClosed: false,
      },
    });

    for (const c of activeCases) {
      if (!currentBatchUids.has(c.uid)) {
        // 不在本次新報表的名單裡，且目前尚未結案
        if (c.statusTag !== 'PENDING_CONFIRMATION') {
          await prisma.caseRecord.update({
            where: { id: c.id },
            data: {
              statusTag: 'PENDING_CONFIRMATION',
            },
          });
          pendingConfirmationCount++;
        }
      }
    }
  } catch (err: any) {
    console.warn('[ReportImport] 更新待確認是否結案狀態失敗:', err.message);
  }

  // 3. 儲存匯入歷史記錄
  await prisma.importHistory.create({
    data: {
      fileName,
      businessUnit,
      totalCount: rawRows.length,
      newCount,
      updatedCount,
      uploadedBy,
    },
  });

  // 4. 記錄審計日誌
  if (userId) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'IMPORT_REPORT',
        details: JSON.stringify({
          businessUnit,
          fileName,
          totalCount: rawRows.length,
          aggregatedCount: aggregatedMap.size,
          newCount,
          updatedCount,
          pendingConfirmationCount,
          errorCount,
        }),
      },
    });
  }

  // 5. 非同步回寫 Google 試算表（2bad-debtbackup）
  // 包含覆蓋原始報表分頁與更新追蹤分頁
  triggerGoogleSheetSync(businessUnit, rawRows, aggregatedMap).catch((sheetErr) => {
    console.error('[GoogleSheetSync] 非同步試算表同步失敗:', sheetErr.message);
  });

  return {
    totalCount: rawRows.length,
    newCount,
    updatedCount,
    pendingConfirmationCount,
    errorCount,
    errors,
  };
}

/**
 * 觸發 Google 試算表 (2bad-debtbackup) 的覆蓋與追蹤分頁回寫
 */
async function triggerGoogleSheetSync(
  businessUnit: 'VALET' | 'PEPPER',
  rawRows: RawRowData[],
  aggregatedMap: Map<string, AggregatedCustomer>
) {
  // 1. 整理 12 個欄位的 Raw 表頭與二維陣列
  const rawHeaders = [
    'UID',
    'Name',
    'Email',
    'Phone',
    'Address',
    'Type of Service',
    'inv Date',
    'Inv ID',
    'Invoiced Amount',
    'Outstanding Days',
    'Total Outstanding Amount',
    'Blue Code',
  ];

  const rawMatrix = rawRows.map((r) => [
    r.uid,
    r.name,
    r.email || '',
    r.phone || '',
    r.address || '',
    r.serviceType || '',
    formatDateString(r.invDate),
    r.invId || '',
    r.invoicedAmount ?? '',
    r.outstandingDays,
    r.totalOutstandingAmount,
    r.blueCode || '',
  ]);

  // 覆蓋寫入 OutstandingReportValet / OutstandingReportPepper
  await overwriteRawReportInSheet(businessUnit, rawHeaders, rawMatrix);

  // 2. 取得資料庫中該事業體目前所有未結案案件（包含正常追蹤與待確認是否結案），整理寫入追蹤表
  const currentActiveCases = await prisma.caseRecord.findMany({
    where: {
      businessUnit,
      isClosed: false,
    },
    orderBy: { outstandingDays: 'desc' },
  });

  const summaryPayload = currentActiveCases.map((c) => ({
    uid: c.uid,
    name: c.name,
    email: c.email || undefined,
    phone: c.phone || undefined,
    serviceType: c.serviceType || undefined,
    address: c.address || undefined,
    outstandingDays: c.outstandingDays,
    totalOutstandingAmount: c.outstandingAmount,
    stage: c.stage,
    statusTag: c.statusTag,
  }));

  // 同步回寫 Valet扣款失敗通知追蹤 / Pepper扣款失敗通知追蹤
  await syncSummaryTrackingToSheet(businessUnit, summaryPayload);
}
