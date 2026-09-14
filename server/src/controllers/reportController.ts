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
        'Outstanding Amount': 15000,
        'Outstanding Days': 35,
        'Bill Date': '2026-08-05',
      },
      {
        UID: 'CUST-002',
        Name: '李小美',
        Email: 'xiaomei.li@example.com',
        Phone: '0922-111-222',
        'Outstanding Amount': 28500,
        'Outstanding Days': 55,
        'Bill Date': '2026-07-15',
      },
      {
        UID: 'CUST-003',
        Name: '張志豪',
        Email: 'zhihao.zhang@example.com',
        Phone: '0933-444-555',
        'Outstanding Amount': 42000,
        'Outstanding Days': 85,
        'Bill Date': '2026-06-15',
      },
      {
        UID: 'CUST-004',
        Name: '陳雅婷',
        Email: 'yating.chen@example.com',
        Phone: '0955-666-777',
        'Outstanding Amount': 60000,
        'Outstanding Days': 100,
        'Bill Date': '2026-05-30',
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
