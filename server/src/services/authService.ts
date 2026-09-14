import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { config } from '../config';
import { syncFromGoogleAppsScriptUrl } from './whitelistService';

const googleClient = new OAuth2Client(config.googleClientId);

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

export function generateJwt(user: TokenPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export async function authenticateGoogleCredential(
  credential?: string,
  fallbackUser?: { email?: string; name?: string; avatarUrl?: string }
): Promise<{ token: string; user: any }> {
  let email = '';
  let name = '';
  let avatarUrl = '';

  if (credential) {
    try {
      // 1. Try Google Client ID token verification
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId || undefined,
      });
      const payload = ticket.getPayload();
      if (payload && payload.email) {
        email = payload.email.toLowerCase();
        name = payload.name || payload.email.split('@')[0];
        avatarUrl = payload.picture || '';
      }
    } catch (err: any) {
      // 2. Check if it is a Firebase ID Token (JWT from securetoken.google.com)
      const decoded = jwt.decode(credential) as any;
      if (decoded && decoded.email) {
        email = decoded.email.toLowerCase();
        name = decoded.name || decoded.email.split('@')[0];
        avatarUrl = decoded.picture || '';
      } else if (!fallbackUser?.email) {
        throw new Error(`Google / Firebase 認證失敗: ${err.message || '無效的 Token'}`);
      }
    }
  }

  if (!email && fallbackUser?.email) {
    email = fallbackUser.email.toLowerCase();
    name = fallbackUser.name || email.split('@')[0];
    avatarUrl = fallbackUser.avatarUrl || '';
  }

  if (!email) {
    throw new Error('無法從認證資訊中取得電子郵件');
  }

  return processUserLogin(email, name, avatarUrl);
}

export async function processUserLogin(
  email: string,
  name: string,
  avatarUrl?: string
): Promise<{ token: string; user: any }> {
  email = email.toLowerCase().trim();

  // Check domain if configured
  if (config.allowedDomain) {
    const domain = email.split('@')[1];
    if (domain !== config.allowedDomain.toLowerCase()) {
      throw new Error(`僅限 @${config.allowedDomain} 網域帳號登入`);
    }
  }

  // Check whitelist
  let whitelistEntry = await prisma.whitelistConfig.findUnique({
    where: { email },
  });

  // If not found in whitelist, auto-sync from Google Sheet in real time
  if (!whitelistEntry && config.googleSheetSyncUrl) {
    try {
      await syncFromGoogleAppsScriptUrl(config.googleSheetSyncUrl);
      whitelistEntry = await prisma.whitelistConfig.findUnique({
        where: { email },
      });
    } catch (err: any) {
      console.warn('[Auto-Sync on Login] 無法自 Google 試算表即時同步:', err.message);
    }
  }

  // Check if first user
  const userCount = await prisma.user.count();
  let assignedRole = 'VIEWER';

  if (whitelistEntry) {
    assignedRole = whitelistEntry.role;
  } else if (userCount === 0) {
    // First user gets ADMIN
    assignedRole = 'ADMIN';
    await prisma.whitelistConfig.create({
      data: {
        email,
        role: 'ADMIN',
        note: '系統初始化首位管理員',
      },
    });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      avatarUrl: avatarUrl || undefined,
      role: whitelistEntry ? whitelistEntry.role : undefined,
    },
    create: {
      email,
      name,
      avatarUrl,
      role: assignedRole,
    },
  });

  const token = generateJwt({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  });

  return { token, user };
}

/**
 * Dev / Quick Login helper for testing different roles
 */
export async function mockDevLogin(role: 'TWO_C_TEAM' | 'FA_TEAM' | 'ADMIN' | 'VIEWER') {
  const roleEmails: Record<string, { email: string; name: string }> = {
    TWO_C_TEAM: { email: '2c.specialist@boxful.com.tw', name: '2C 催帳專員 (Alice)' },
    FA_TEAM: { email: 'fa.specialist@boxful.com.tw', name: 'FA 法務財務專員 (Bob)' },
    ADMIN: { email: 'admin@boxful.com.tw', name: '系統管理員 (Admin)' },
    VIEWER: { email: 'viewer@boxful.com.tw', name: '訪客唯讀 (Viewer)' },
  };

  const { email, name } = roleEmails[role] || roleEmails.TWO_C_TEAM;

  // Ensure whitelist has this role
  await prisma.whitelistConfig.upsert({
    where: { email },
    update: { role },
    create: { email, role, note: '測試快速登入帳號' },
  });

  return processUserLogin(email, name);
}
