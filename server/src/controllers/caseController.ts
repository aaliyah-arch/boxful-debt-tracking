import { Request, Response } from 'express';
import {
  getCases,
  getCaseById,
  update2CFields,
  updateFAFields,
  updateCaseClose,
} from '../services/caseService';
import { exportCasesToExcel } from '../services/exportService';

export async function listCases(req: Request, res: Response) {
  try {
    const {
      businessUnit,
      stage,
      monthBucket,
      isClosed,
      search,
      minDays,
      maxDays,
      contactStatus,
      statusTag,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await getCases({
      businessUnit: businessUnit as any,
      stage: stage as string,
      monthBucket: monthBucket as string,
      isClosed: isClosed !== undefined ? isClosed === 'true' : undefined,
      search: search as string,
      statusTag: statusTag as string,
      minDays: minDays ? Number(minDays) : undefined,
      maxDays: maxDays ? Number(maxDays) : undefined,
      contactStatus: contactStatus as string,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as any) || 'desc',
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '取得案件清單失敗' });
  }
}

export async function getCase(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const caseRecord = await getCaseById(id);
    return res.json({ case: caseRecord });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || '案件不存在' });
  }
}

export async function update2C(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const updated = await update2CFields(id, req.body, userId);
    return res.json({ message: '2C 催帳紀錄更新成功', case: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '更新失敗' });
  }
}

export async function updateFA(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const updated = await updateFAFields(id, req.body, userId);
    return res.json({ message: 'FA 催告/終止紀錄更新成功', case: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '更新失敗' });
  }
}

export async function closeCase(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { isClosed, closedDate } = req.body;
    const updated = await updateCaseClose(id, { isClosed, closedDate }, userId);
    return res.json({ message: isClosed ? '案件已成功結案' : '案件已重新開啟', case: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '結案操作失敗' });
  }
}

export async function exportCases(req: Request, res: Response) {
  try {
    const {
      businessUnit,
      stage,
      monthBucket,
      isClosed,
      search,
      minDays,
      maxDays,
      contactStatus,
    } = req.query;

    const buffer = await exportCasesToExcel({
      businessUnit: businessUnit as any,
      stage: stage as string,
      monthBucket: monthBucket as string,
      isClosed: isClosed !== undefined ? isClosed === 'true' : undefined,
      search: search as string,
      minDays: minDays ? Number(minDays) : undefined,
      maxDays: maxDays ? Number(maxDays) : undefined,
      contactStatus: contactStatus as string,
    });

    const filename = `${businessUnit || 'ALL'}_Outstanding_Cases_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '匯出失敗' });
  }
}
