import { Request, Response } from 'express';
import { getDashboardOverview } from '../services/dashboardService';

export async function getOverview(req: Request, res: Response) {
  try {
    const businessUnit = (req.query.businessUnit as string)?.toUpperCase() === 'PEPPER' ? 'PEPPER' : 'VALET';
    const refDateStr = req.query.refDate as string;
    const refDate = refDateStr ? new Date(refDateStr) : new Date();

    const overview = await getDashboardOverview(businessUnit, refDate);
    return res.json(overview);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '取得總覽資料失敗' });
  }
}
