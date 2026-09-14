import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'zealous-pascal-super-secret-jwt-key-2026',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  allowedDomain: process.env.ALLOWED_DOMAIN || '', // optional: e.g. "company.com"
  syncSecret: process.env.SYNC_SECRET || 'boxful-whitelist-sync-key-2026',
  googleSheetSyncUrl: process.env.GOOGLE_SHEET_SYNC_URL || 'https://script.google.com/macros/s/AKfycbx-1i9fSZXDylorowLFoQlz43aV1tlc3VxLDlDxA7jt1xZ_5z2npeP1QbHXoOyRm-8d/exec',
  nodeEnv: process.env.NODE_ENV || 'development',
};
