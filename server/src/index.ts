import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/authMiddleware';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';
import caseRoutes from './routes/caseRoutes';
import whitelistRoutes from './routes/whitelistRoutes';
import { syncFromGoogleAppsScriptUrl } from './services/whitelistService';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/whitelist', whitelistRoutes);

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || '伺服器內部錯誤',
  });
});

app.listen(config.port, () => {
  console.log(`🚀 Zealous Debt Collection Server running at http://localhost:${config.port}`);

  // 自動同步 Google 試算表白名單
  if (config.googleSheetSyncUrl) {
    console.log(`🔄 啟動 Google 試算表白名單自動同步機制...`);
    // 伺服器啟動立即在背景同步一次
    syncFromGoogleAppsScriptUrl(config.googleSheetSyncUrl)
      .then((res) => console.log(`✅ [Google Sheet Sync] 初始同步成功: 共有 ${res.successCount} 筆白名單`))
      .catch((err) => console.warn(`⚠️ [Google Sheet Sync] 初始同步略過: ${err.message}`));

    // 每 5 分鐘在背景自動更新一次
    setInterval(() => {
      syncFromGoogleAppsScriptUrl(config.googleSheetSyncUrl)
        .then((res) => console.log(`✅ [Google Sheet Sync] 定時同步成功: 共有 ${res.successCount} 筆白名單`))
        .catch((err) => console.warn(`⚠️ [Google Sheet Sync] 定時同步失敗: ${err.message}`));
    }, 5 * 60 * 1000);
  }
});

