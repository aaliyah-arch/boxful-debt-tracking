import * as xlsx from 'xlsx';
import { differenceInCalendarDays } from 'date-fns';
import type { StageType } from '../types';

export interface RawRowData {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceType?: string;
  invDate?: string | null;
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
  billDate?: string | null;
  invId?: string;
  blueCode?: string;
  invoiceCount: number;
  stage?: StageType;
}

export interface ParseResult {
  totalCount: number;
  newCount: number;
  updatedCount: number;
  pendingConfirmationCount: number;
  errorCount: number;
  errors: string[];
}

export function computeStage(input: {
  isClosed?: boolean;
  outstandingDays: number;
  terminationNoticeDate?: string | Date | null;
  referenceDate?: Date;
}): StageType {
  if (input.isClosed) {
    return 'CLOSED';
  }

  const refDate = input.referenceDate || new Date();

  if (input.terminationNoticeDate) {
    const termDate = new Date(input.terminationNoticeDate);
    const elapsedDays = differenceInCalendarDays(refDate, termDate);
    if (elapsedDays >= 15) {
      return 'STAGE_4';
    }
  }

  const days = Number(input.outstandingDays) || 0;
  if (days >= 95) return 'STAGE_4';
  if (days >= 80) return 'STAGE_3';
  if (days >= 50) return 'STAGE_2';
  if (days >= 30) return 'STAGE_1';

  return 'UNREACHED';
}

function parseDateValue(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + val * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const parsed = new Date(val.trim());
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return null;
}

export async function parseSpreadsheetFile(file: File): Promise<{
  rawHeaders: string[];
  rawRows: any[][];
  parsedRawRows: RawRowData[];
  aggregatedMap: Map<string, AggregatedCustomer>;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('報表檔案中無任何工作表 (Sheet)');
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  // Extract raw headers and 2D array for Google Sheet overwrite
  const rawDataWithHeader = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  const rawHeaders: string[] = (rawDataWithHeader[0] || []).map((h: any) => String(h || '').trim());
  const rawRows: any[][] = rawDataWithHeader.slice(1);

  const parsedRawRows: RawRowData[] = [];
  const aggregatedMap = new Map<string, AggregatedCustomer>();

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const normalized: Record<string, any> = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[cleanKey] = val;
    }

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
      continue;
    }

    const uid = String(rawUid).trim();

    const rawName =
      normalized['name'] ||
      normalized['姓名'] ||
      normalized['客戶姓名'] ||
      normalized['客戶名稱'] ||
      normalized['customer_name'] ||
      normalized['customer'] ||
      `客戶-${uid}`;
    const name = String(rawName).trim();

    const rawEmail =
      normalized['email'] ||
      normalized['信箱'] ||
      normalized['電子信箱'] ||
      normalized['mail'] ||
      '';
    const email = rawEmail ? String(rawEmail).trim() : undefined;

    const rawPhone =
      normalized['phone'] ||
      normalized['電話'] ||
      normalized['手機'] ||
      normalized['聯絡電話'] ||
      normalized['mobile'] ||
      '';
    const phone = rawPhone ? String(rawPhone).trim() : undefined;

    const rawAddress =
      normalized['address'] ||
      normalized['地址'] ||
      normalized['服務地址'] ||
      normalized['配送地址'] ||
      '';
    const address = rawAddress ? String(rawAddress).trim() : undefined;

    const rawServiceType =
      normalized['type_of_service'] ||
      normalized['service_type'] ||
      normalized['服務類型'] ||
      normalized['業務類型'] ||
      normalized['type'] ||
      '';
    const serviceType = rawServiceType ? String(rawServiceType).trim() : undefined;

    const rawInvDate =
      normalized['inv_date'] ||
      normalized['invdate'] ||
      normalized['invoicedate'] ||
      normalized['invoice_date'] ||
      normalized['帳單日期'] ||
      normalized['應繳日'] ||
      normalized['bill_date'];
    const invDate = parseDateValue(rawInvDate);

    const rawInvId =
      normalized['inv_id'] ||
      normalized['invid'] ||
      normalized['invoice_id'] ||
      normalized['發票編號'] ||
      normalized['發票號碼'] ||
      '';
    const invId = rawInvId ? String(rawInvId).trim() : undefined;

    const rawInvAmount =
      normalized['invoiced_amount'] ||
      normalized['invoicedamount'] ||
      normalized['invoice_amount'] ||
      normalized['應收金額'] ||
      0;
    const cleanInvAmount = String(rawInvAmount).replace(/[^0-9.-]+/g, '');
    const invoicedAmount = parseFloat(cleanInvAmount) || 0;

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

    parsedRawRows.push(rowObj);

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
      existing.totalOutstandingAmount = Math.max(existing.totalOutstandingAmount,totalOutstandingAmount);
      existing.outstandingDays = Math.max(existing.outstandingDays, outstandingDays);
      existing.invoiceCount += 1;
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.address && address) existing.address = address;
      if (!existing.serviceType && serviceType) existing.serviceType = serviceType;
      if (!existing.billDate && invDate) existing.billDate = invDate;
      if (!existing.blueCode && blueCode) existing.blueCode = blueCode;
      if (name && !existing.name.includes(name)) existing.name = name;
    }
  }

  return { rawHeaders, rawRows, parsedRawRows, aggregatedMap };
}

export function generateSampleExcelBlob(): Blob {
  const sampleData = [
    {
      UID: 'CUST-001',
      Name: '王大明',
      Email: 'daming.wang@example.com',
      Phone: '0912-345-678',
      Address: '台北市大安區忠孝東路四段100號5樓',
      'Type of Service': 'Monthly Storage',
      'inv Date': '2026-08-05',
      'Inv ID': 'INV-202608-001',
      'Invoiced Amount': 15000,
      'Outstanding Days': 35,
      'Total Outstanding Amount': 15000,
      'Blue Code': 'BC-8891',
    },
    {
      UID: 'CUST-002',
      Name: '李小美',
      Email: 'xiaomei.li@example.com',
      Phone: '0922-111-222',
      Address: '新北市板橋區縣民大道二段7號',
      'Type of Service': 'Valet Plus',
      'inv Date': '2026-07-15',
      'Inv ID': 'INV-202607-042',
      'Invoiced Amount': 14000,
      'Outstanding Days': 55,
      'Total Outstanding Amount': 28500,
      'Blue Code': 'BC-9012',
    },
    {
      UID: 'CUST-002',
      Name: '李小美',
      Email: 'xiaomei.li@example.com',
      Phone: '0922-111-222',
      Address: '新北市板橋區縣民大道二段7號',
      'Type of Service': 'Valet Plus',
      'inv Date': '2026-06-15',
      'Inv ID': 'INV-202606-033',
      'Invoiced Amount': 14500,
      'Outstanding Days': 55,
      'Total Outstanding Amount': 28500,
      'Blue Code': 'BC-9012',
    },
    {
      UID: 'CUST-003',
      Name: '張志豪',
      Email: 'zhihao.zhang@example.com',
      Phone: '0933-444-555',
      Address: '台北市信義區松仁路105號',
      'Type of Service': 'Standard',
      'inv Date': '2026-06-15',
      'Inv ID': 'INV-202606-112',
      'Invoiced Amount': 42000,
      'Outstanding Days': 85,
      'Total Outstanding Amount': 42000,
      'Blue Code': 'BC-7723',
    },
  ];

  const worksheet = xlsx.utils.json_to_sheet(sampleData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Outstanding_Report');

  const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
