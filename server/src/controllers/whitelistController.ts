import { Request, Response } from 'express';
import {
  getWhitelist,
  addToWhitelist,
  updateWhitelistEntry,
  deleteFromWhitelist,
  syncWhitelistBatch,
  syncFromGoogleAppsScriptUrl,
} from '../services/whitelistService';
import { config } from '../config';

export async function listWhitelist(req: Request, res: Response) {
  try {
    const list = await getWhitelist();
    return res.json({ whitelist: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createWhitelist(req: Request, res: Response) {
  try {
    const { email, role, note } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: '請提供完整的信箱與角色權限' });
    }
    const created = await addToWhitelist({ email, role, note });
    return res.status(201).json({ message: '已成功新增至白名單', item: created });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function updateWhitelist(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { role, note } = req.body;
    const updated = await updateWhitelistEntry(id, { role, note });
    return res.json({ message: '白名單已更新', item: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function deleteWhitelist(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await deleteFromWhitelist(id);
    return res.json({ message: '已自白名單移除' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function syncWhitelist(req: Request, res: Response) {
  try {
    const syncSecretHeader = req.headers['x-sync-secret'];
    const isAuthorizedViaSecret =
      syncSecretHeader &&
      syncSecretHeader === config.syncSecret;
    const isAuthorizedViaUser = (req as any).user?.role === 'ADMIN';

    if (!isAuthorizedViaSecret && !isAuthorizedViaUser) {
      return res.status(403).json({ error: '無權限執行試算表同步' });
    }

    const { items, gasUrl } = req.body;

    let result;
    if (gasUrl) {
      result = await syncFromGoogleAppsScriptUrl(gasUrl);
    } else if (items && Array.isArray(items)) {
      result = await syncWhitelistBatch(items);
    } else {
      return res.status(400).json({ error: '請提供 items 資料陣列或 gasUrl' });
    }

    return res.json({
      message: `同步完成！成功更新/新增 ${result.successCount} 筆資料`,
      result,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}
