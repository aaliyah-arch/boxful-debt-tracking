import prisma from '../prisma';
import { config } from '../config';
import * as xlsx from 'xlsx';

export async function getWhitelist() {
  return prisma.whitelistConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function addToWhitelist(data: { email: string; role: string; note?: string }) {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.whitelistConfig.findUnique({ where: { email } });
  if (existing) {
    throw new Error('此信箱已存在於白名單中');
  }

  const created = await prisma.whitelistConfig.create({
    data: {
      email,
      role: data.role,
      note: data.note,
    },
  });

  // Also update existing user role if user already exists
  await prisma.user.updateMany({
    where: { email },
    data: { role: data.role },
  });

  return created;
}

export async function updateWhitelistEntry(
  id: string,
  data: { role?: string; note?: string }
) {
  const existing = await prisma.whitelistConfig.findUnique({ where: { id } });
  if (!existing) throw new Error('白名單項目不存在');

  const updated = await prisma.whitelistConfig.update({
    where: { id },
    data: {
      role: data.role !== undefined ? data.role : existing.role,
      note: data.note !== undefined ? data.note : existing.note,
    },
  });

  if (data.role) {
    await prisma.user.updateMany({
      where: { email: existing.email },
      data: { role: data.role },
    });
  }

  return updated;
}

export async function deleteFromWhitelist(id: string) {
  const existing = await prisma.whitelistConfig.findUnique({ where: { id } });
  if (!existing) throw new Error('白名單項目不存在');

  return prisma.whitelistConfig.delete({ where: { id } });
}

export function normalizeRole(inputRole?: string): string {
  if (!inputRole) return 'VIEWER';
  const clean = inputRole.trim().toUpperCase();

  if (
    clean === 'ADMIN' ||
    clean.includes('管理') ||
    clean.includes('主管')
  ) {
    return 'ADMIN';
  }

  if (
    clean === 'TWO_C_TEAM' ||
    clean.includes('2C') ||
    clean.includes('催帳')
  ) {
    return 'TWO_C_TEAM';
  }

  if (
    clean === 'FA_TEAM' ||
    clean.includes('FA') ||
    clean.includes('法務') ||
    clean.includes('財務')
  ) {
    return 'FA_TEAM';
  }

  return 'VIEWER';
}

export async function syncWhitelistBatch(
  entries: Array<{ email: string; role?: string; note?: string }>
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('未提供有效的試算表資料清單');
  }

  const results = {
    total: entries.length,
    successCount: 0,
    skippedCount: 0,
    errors: [] as string[],
  };

  for (const entry of entries) {
    if (!entry.email || typeof entry.email !== 'string') {
      results.skippedCount++;
      continue;
    }

    const email = entry.email.trim().toLowerCase();
    if (!email.includes('@')) {
      results.skippedCount++;
      continue;
    }

    // Check domain if configured
    if (config.allowedDomain) {
      const domain = email.split('@')[1];
      if (domain !== config.allowedDomain.toLowerCase()) {
        results.errors.push(`${email}: 非 @${config.allowedDomain} 網域，已略過`);
        results.skippedCount++;
        continue;
      }
    }

    const role = normalizeRole(entry.role);
    const note = entry.note ? String(entry.note).trim() : undefined;

    try {
      await prisma.whitelistConfig.upsert({
        where: { email },
        update: {
          role,
          note: note !== undefined ? note : undefined,
        },
        create: {
          email,
          role,
          note,
        },
      });

      // Sync existing user role in users table
      await prisma.user.updateMany({
        where: { email },
        data: { role },
      });

      results.successCount++;
    } catch (err: any) {
      results.errors.push(`${email}: 更新失敗 (${err.message})`);
    }
  }

  return results;
}

export async function syncFromGoogleAppsScriptUrl(gasUrl: string) {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    throw new Error('請提供有效的 Google 試算表或 Apps Script 網址');
  }

  const response = await fetch(gasUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/csv, text/plain, */*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`無法連線至 Google Apps Script (HTTP ${response.status})`);
  }

  const rawText = (await response.text()).trim();

  // 1. 檢查是否回傳了 HTML 錯誤頁面或 Google 登入跳轉頁
  if (rawText.startsWith('<!doctype') || rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html')) {
    if (rawText.includes('accounts.google.com') || rawText.includes('Sign in')) {
      throw new Error(
        'Google 要求登入驗證（權限不足）：請至 Google Apps Script 的「部署」>「管理部署作業」> 編輯，將「誰可以存取 (Who has access)」改為「任何人 (Anyone)」，並選擇「新版本」後重新部署。'
      );
    }
    if (rawText.includes('找不到以下指令碼函式') || rawText.includes('doGet')) {
      throw new Error(
        'Google Apps Script 找不到 doGet 函式：請確認已貼上包含 doGet(e) 的程式碼，並在「管理部署作業」中選擇「新版本」重新部署。'
      );
    }
    throw new Error('Google Apps Script 回傳了 HTML 網頁而非名單資料，請確認部署設定。');
  }

  // 2. 嘗試解析為 JSON 格式
  let items: any[] = [];
  try {
    const data = JSON.parse(rawText);
    items = Array.isArray(data) ? data : data.items || data.data || [];
  } catch (jsonErr) {
    // 3. 若非 JSON，嘗試以 CSV 格式解析 (例如 Google 試算表發布至網路的 CSV 網址)
    try {
      const workbook = xlsx.read(rawText, { type: 'string' });
      const firstSheet = workbook.SheetNames[0];
      if (firstSheet) {
        const rows: any[][] = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
        if (rows.length >= 2) {
          const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
          let emailIdx = headers.findIndex((h: string) => h.includes('email') || h.includes('信箱') || h.includes('帳號'));
          let roleIdx = headers.findIndex((h: string) => h.includes('role') || h.includes('角色') || h.includes('權限'));
          let noteIdx = headers.findIndex((h: string) => h.includes('note') || h.includes('備註') || h.includes('姓名'));

          if (emailIdx === -1) emailIdx = 0;
          if (roleIdx === -1) roleIdx = 1;
          if (noteIdx === -1) noteIdx = 2;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const email = row[emailIdx] ? String(row[emailIdx]).trim() : '';
            const role = row[roleIdx] ? String(row[roleIdx]).trim() : '';
            const note = noteIdx !== -1 && row[noteIdx] ? String(row[noteIdx]).trim() : '';
            if (email && email.includes('@')) {
              items.push({ email, role, note });
            }
          }
        }
      }
    } catch (csvErr) {
      throw new Error(`回傳內容既非有效 JSON 也非 CSV 格式: ${rawText.slice(0, 100)}`);
    }
  }

  if (items.length === 0) {
    throw new Error('未從試算表中讀取到任何白名單資料，請確認試算表第 1 列為表頭、第 2 列起有 Email。');
  }

  return syncWhitelistBatch(items);
}

