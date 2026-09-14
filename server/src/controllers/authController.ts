import { Request, Response } from 'express';
import { authenticateGoogleCredential, mockDevLogin } from '../services/authService';
import prisma from '../prisma';

export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential, email, name, avatarUrl } = req.body;
    if (!credential && !email) {
      return res.status(400).json({ error: '缺少 Google 憑證或使用者資訊' });
    }

    const result = await authenticateGoogleCredential(credential, { email, name, avatarUrl });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '登入失敗' });
  }
}

export async function devLogin(req: Request, res: Response) {
  try {
    const { role } = req.body;
    const allowed = ['TWO_C_TEAM', 'FA_TEAM', 'ADMIN', 'VIEWER'];
    const targetRole = allowed.includes(role) ? role : 'TWO_C_TEAM';

    const result = await mockDevLogin(targetRole as any);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || '測試登入失敗' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未登入' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: '找不到使用者資料' });
    }

    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
