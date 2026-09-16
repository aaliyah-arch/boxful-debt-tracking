import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import prisma from '../prisma';
import { importReportData } from '../services/reportParserService';

export async function uploadReport(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇要上傳的報表檔案 (.xlsx 或 .csv)' });
    }

    const rawUnit = (req.body.businessUnit as string)?.toUpperCase();
    if (rawUnit !== 'VALET' && rawUnit !== 'PEPPER') {
      return res.status(400).json({ error: '請指定正確的事業體 (VALET 或 PEPPER)' });
    }

    const businessUnit = rawUnit as 'VALET' | 'PEPPER';
    const uploadedBy = req.user?.name || req.user?.email || 'System';
    const userId = req.user?.id;

    const result = await importReportData(
      businessUnit,
      req.file.originalname,
      req.file.buffer,
      uploadedBy,
      userId
    );

    return res.json({
      message: `成功匯入 ${businessUnit} 報表！新增 ${result.newCount} 筆，更新 ${result.updatedCount} 筆`,
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '報表匯入失敗' });
  }
}

export async function getUploadHistory(req: Request, res: Response) {
  try {
    const history = await prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '取得匯入紀錄失敗' });
  }
}

export async function downloadSampleTemplate(req: Request, res: Response) {
  try {
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

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Outstanding_Report_Sample.xlsx"'
    );
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
