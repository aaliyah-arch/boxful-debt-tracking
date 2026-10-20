/**
 * ==============================================================================
 * 2bad-debtbackup Google 試算表自動化同步與回寫腳本 (Google Apps Script)
 * 試算表名稱: 2bad-debtbackup
 * 網址: https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing
 * ==============================================================================
 *
 * 功能：
 * 1. OutstandingReportValet / OutstandingReportPepper：每週上傳的原始報表整份覆蓋。
 * 2. Valet扣款失敗通知追蹤 / Pepper扣款失敗通知追蹤：彙整與前端回寫。
 *    - 所有欄位一律「依試算表第一列的表頭名稱」定位，不依欄位順序。
 *    - 表頭重複的「到期日期」依其右側相鄰的欄位判斷用途（到期日期在左）：
 *        到期日期 ← 電子催告日期   = 催告到期日
 *        到期日期 ← 服務終止日     = 服務終止到期日期
 * 3. 同一客戶先前已結案又再欠款：保留舊列，新增一列追蹤未結案那筆。
 *    每一列有唯一的「案件ID」（格式：UID-01、UID-02…），前端回寫一律依案件ID找列，
 *    不會再寫到同 UID 的其他案件。案件ID空白的舊列會在下一次呼叫時自動補號。
 * 5. LIST_CASES：前端從試算表讀取全部案件，所有使用者看到的都是同一份資料。
 * 4. 前端上傳的電子催告檔會存到試算表所在資料夾下的「2bad-debtbackup 附件」資料夾，
 *    並立即回填到該案件的「電子催告檔」欄位：儲存格顯示「Link」，點擊即開啟檔案。
 *
 * ※ 更新本腳本後，請先在編輯器執行一次 authorizeDrive() 完成雲端硬碟授權，
 *    再到「部署 > 管理部署作業」以「新版本」重新部署，否則前端上傳會失敗。
 */

var SHEET_NAMES = {
  VALET_RAW: 'OutstandingReportValet',
  PEPPER_RAW: 'OutstandingReportPepper',
  VALET_TRACKING: 'Valet扣款失敗通知追蹤',
  PEPPER_TRACKING: 'Pepper扣款失敗通知追蹤'
};

var SCRIPT_VERSION = '2026-10-20-gas-web';
var UPLOAD_FOLDER_NAME = '2bad-debtbackup 附件';

// ==============================================================================
// 身分驗證設定：網頁改由 Apps Script 直接提供，只有公司 Google 帳號能開啟與讀寫
// ==============================================================================
var ALLOWED_DOMAIN = 'boxful.com.tw';
// 人員白名單（FA / 2C 權限）所在的 Apps Script 網址，由伺服器端讀取，不再出現在網頁程式裡
var WHITELIST_GAS_URL = 'https://script.google.com/macros/s/AKfycbx-1i9fSZXDylorowLFoQlz43aV1tlc3VxLDlDxA7jt1xZ_5z2npeP1QbHXoOyRm-8d/exec';
// 需要「可編輯」權限的操作（VIEWER 只能讀取）
var WRITE_ACTIONS = { OVERWRITE_RAW_REPORT: true, SYNC_SUMMARY_TRACKING: true, UPDATE_ROW_STATUS: true, UPLOAD_FILE: true };

/** 取得目前開啟網頁的使用者 email，不是公司帳號就丟出錯誤 */
function requireCompanyUser_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) {
    throw new Error('無法取得登入帳號。請確認此程式由公司帳號部署，且存取權設為「' + ALLOWED_DOMAIN + ' 網域內的任何人」');
  }
  if (email.slice(-(ALLOWED_DOMAIN.length + 1)) !== '@' + ALLOWED_DOMAIN) {
    throw new Error('僅限 @' + ALLOWED_DOMAIN + ' 公司帳號使用（目前為 ' + email + '）');
  }
  return email;
}

/** 從白名單 Apps Script 讀取原始資料（快取 5 分鐘） */
function fetchWhitelistText_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('whitelist_raw');
  if (cached) return cached;
  var res = UrlFetchApp.fetch(WHITELIST_GAS_URL, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('讀取人員白名單失敗 (HTTP ' + res.getResponseCode() + ')');
  var text = res.getContentText();
  if (text.length < 90000) cache.put('whitelist_raw', text, 300);
  return text;
}

/** 解析白名單成 [{email, role, note}]，與前端原本的規則相同 */
function parseWhitelist_(text) {
  var items = [];
  try {
    var data = JSON.parse(text);
    items = Array.isArray(data) ? data : (data.data || data.users || []);
  } catch (e) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var headers = (lines[0] || '').split(',').map(function (h) { return h.trim().toLowerCase(); });
    var ei = headers.findIndex(function (h) { return h.indexOf('email') >= 0 || h.indexOf('信箱') >= 0; });
    var ri = headers.findIndex(function (h) { return h.indexOf('role') >= 0 || h.indexOf('角色') >= 0; });
    var ni = headers.findIndex(function (h) { return h.indexOf('note') >= 0 || h.indexOf('備註') >= 0; });
    for (var i = 1; i < lines.length; i++) {
      var c = lines[i].split(',').map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
      items.push({ email: c[ei >= 0 ? ei : 0], role: ri >= 0 ? c[ri] : '', note: ni >= 0 ? c[ni] : '' });
    }
  }
  return items.filter(function (x) { return x && x.email; }).map(function (x) {
    var r = String(x.role || '').toUpperCase().trim();
    var n = String(x.note || '').toUpperCase().trim();
    var role = 'TWO_C_TEAM';
    if (r === 'O' && n === 'O') role = 'ADMIN';
    else if (r === 'O') role = 'FA_TEAM';
    else if (n === 'O') role = 'TWO_C_TEAM';
    else if (r === 'X' && n === 'X') role = 'VIEWER';
    else if (/ADMIN|主管|管理/.test(r)) role = 'ADMIN';
    else if (/FA|法務|財務/.test(r)) role = 'FA_TEAM';
    else if (/2C|催帳|催款/.test(r)) role = 'TWO_C_TEAM';
    else if (/VIEWER|訪客/.test(r)) role = 'VIEWER';
    return { email: String(x.email).trim().toLowerCase(), role: role };
  });
}

/** 查詢使用者角色；不在白名單的公司帳號只能檢視 */
function lookupRole_(email) {
  var list = parseWhitelist_(fetchWhitelistText_());
  var found = list.filter(function (x) { return x.email === email; })[0];
  return found ? found.role : 'VIEWER';
}

/** 在編輯器手動執行一次，完成授權並確認可以讀到白名單 */
function testSetup() {
  var list = parseWhitelist_(fetchWhitelistText_());
  Logger.log('白名單共 ' + list.length + ' 人');
  Logger.log('試算表：' + SpreadsheetApp.getActiveSpreadsheet().getName());
  Logger.log('你的帳號：' + Session.getActiveUser().getEmail());
}

/**
 * 追蹤表欄位定義
 * key       : 前端 / 程式使用的欄位代號
 * names     : 試算表表頭可接受的名稱（第一個為建議名稱，其餘為相容舊名稱）
 * dupName   : 表頭重複時使用的共用名稱（例如「到期日期」）
 * anchor    : dupName 的判斷依據：取 anchor 欄位左側最近、尚未被其他欄位認領的 dupName 欄（找不到才往右找）
 * append    : 試算表沒有這個欄位時，第一次回寫會自動補在最右側
 * valetOnly : 只有 Valet 才有的欄位
 * date      : 日期欄位（統一寫成 yyyy-MM-dd）
 * text      : 強制以文字寫入（保留電話開頭的 0）
 */
var FIELD_SPECS = [
  // ---- 報表彙整欄位 ----
  { key: 'caseId',         names: ['案件ID', '案件編號', 'Case ID'], append: true },
  { key: 'uid',            names: ['UID'] },
  { key: 'serviceType',    names: ['Type of Service', 'Service Type', '服務類型'], valetOnly: true },
  { key: 'name',           names: ['NAME', 'Name', '姓名', '客戶名稱'] },
  { key: 'outstandingDays',names: ['Outstanding Days', '逾期天數'] },
  { key: 'email',          names: ['Email', 'E-mail', '信箱'] },
  { key: 'address',        names: ['地址', 'Address'], valetOnly: true },
  { key: 'amount',         names: ['Total Outstanding Amount', '欠款金額'] },
  { key: 'phone',          names: ['Phone', '電話', '手機'], text: true },
  { key: 'stage',          names: ['催帳階段/狀態', '催帳階段', '催帳狀態'] },
  { key: 'statusTag',      names: ['追蹤標籤'] },
  { key: 'isClosed',       names: ['結案狀態'] },

  // ---- 2C 催帳 ----
  { key: 'lineNoticeDate', names: ['LINE日期', 'Line通知日', 'LINE通知日期'], date: true, append: true },
  { key: 'emailNoticeDate',names: ['寄信日期', 'Email通知日'], date: true, append: true },
  { key: 'smsNoticeDate',  names: ['寄簡訊日期', '簡訊通知日'], date: true, append: true },
  { key: 'phoneNoticeDate',names: ['電話日期', '電話通知日'], date: true },
  { key: 'twoCNotes',      names: ['處理方式/客人回應', '2C催帳備註'], append: true },
  { key: 'closedDate',     names: ['結案日期'], date: true, append: true },
  { key: 'billDate',       names: ['帳單日', '帳單日期'], date: true, append: true },
  { key: 'collectionStartDate', names: ['開始催帳日', '開始催帳日期'], date: true, append: true },

  // ---- 催告與終止 ----
  { key: 'demandMethod',          names: ['催告方式'], append: true },
  { key: 'demandSmsDate',         names: ['電子催告簡訊日期'], date: true, append: true },
  { key: 'demandDocUrl',          names: ['電子催告檔', '催告文件連結'], append: true },
  { key: 'demandNoticeDate',      names: ['電子催告日期', '催告通知日'], date: true, append: true },
  { key: 'demandDueDate',         names: ['催告到期日', '電子催告到期日期'], dupName: '到期日期', anchor: 'demandNoticeDate', date: true },
  { key: 'terminationSmsDate',    names: ['終止簡訊通知'], date: true, append: true },
  { key: 'terminationNoticeDate', names: ['服務終止日', '終止函日期'], date: true, append: true },
  { key: 'terminationDueDate',    names: ['服務終止到期日期', '終止到期日期'], dupName: '到期日期', anchor: 'terminationNoticeDate', date: true },
  { key: 'certifiedLetterSentDate',names: ['存證信函', '存證信函發送日期'], date: true, append: true },
  { key: 'certifiedLetterReceivedDate', names: ['收件日期'], date: true, append: true },
  { key: 'faNotes',               names: ['FA備註'] },

  { key: 'updatedAt',      names: ['最後更新時間', '更新時間'] }
];

// 新建立追蹤表時使用的預設表頭（已存在的工作表不會被改動）
var DEFAULT_TRACKING_HEADERS = {
  VALET: ['案件ID', 'UID', 'Type of Service', 'NAME', 'Outstanding Days', 'Email', '地址', 'Total Outstanding Amount', 'Phone',
          '催帳階段/狀態', '追蹤標籤', '結案狀態', 'LINE日期', '寄信日期', '寄簡訊日期', '處理方式/客人回應', '結案日期',
          '催告方式', '電子催告簡訊日期', '電子催告檔', '到期日期', '電子催告日期', '終止簡訊通知',
          '到期日期', '服務終止日', '存證信函', '收件日期', '最後更新時間'],
  PEPPER: ['案件ID', 'UID', 'NAME', 'Email', 'Outstanding Days', 'Total Outstanding Amount', 'Phone',
           '催帳階段/狀態', '追蹤標籤', '結案狀態', 'LINE日期', '寄信日期', '寄簡訊日期', '處理方式/客人回應', '結案日期',
           '催告方式', '電子催告簡訊日期', '電子催告檔', '到期日期', '電子催告日期', '終止簡訊通知',
           '到期日期', '服務終止日', '存證信函', '收件日期', '最後更新時間']
};

// ==============================================================================
// Web App 入口：開啟網址時直接顯示網頁（index.html），資料一律透過 google.script.run 讀寫
// ==============================================================================

function doGet(e) {
  try {
    requireCompanyUser_();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:40px;text-align:center"><h2>無法開啟</h2><p>' +
      String(err.message).replace(/</g, '&lt;') + '</p></div>'
    ).setTitle('呆帳催款追蹤系統');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('呆帳催款追蹤系統 · Boxful')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 前端取得目前登入者 */
function getCurrentUser() {
  var email = requireCompanyUser_();
  var role = 'VIEWER';
  try { role = lookupRole_(email); } catch (e) { /* 白名單讀不到時先給檢視權限 */ }
  return JSON.stringify({ id: 'usr-' + email, email: email, name: email.split('@')[0], role: role });
}

/** 前端讀取白名單原始資料（白名單頁面同步用） */
function fetchWhitelistRaw() {
  requireCompanyUser_();
  return fetchWhitelistText_();
}

/** 前端讀寫案件的唯一入口；payloadJson 為 JSON 字串，回傳 JSON 字串 */
function api(action, payloadJson) {
  var email, payload;
  try {
    email = requireCompanyUser_();
    payload = JSON.parse(payloadJson || '{}');
    if (WRITE_ACTIONS[action] && lookupRole_(email) === 'VIEWER') {
      throw new Error('你的帳號只有檢視權限，無法修改資料');
    }
  } catch (authErr) {
    return JSON.stringify({ success: false, code: 'UNAUTHORIZED', error: authErr.message });
  }

  var lock = LockService.getScriptLock();
  try {
    // 報表回寫可能需要較長時間，最多等候 2 分鐘取得鎖定
    lock.waitLock(120000);

    var businessUnit = (payload.businessUnit || '').toUpperCase(); // 'VALET' | 'PEPPER'
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result;

    if (action === 'OVERWRITE_RAW_REPORT') {
      result = handleOverwriteRawReport(ss, businessUnit, payload.headers, payload.rows);
    } else if (action === 'SYNC_SUMMARY_TRACKING') {
      result = handleSyncSummaryTracking(ss, businessUnit, payload.items || [], payload.markMissingAsPending === true);
    } else if (action === 'UPDATE_ROW_STATUS') {
      result = handleUpdateRowStatus(ss, businessUnit, payload.uid, payload.fields || {}, payload.caseId);
    } else if (action === 'LIST_CASES') {
      result = handleListCases(ss, payload.businessUnit ? [businessUnit] : ['VALET', 'PEPPER']);
    } else if (action === 'UPLOAD_FILE') {
      result = handleUploadFile(ss, payload);
    } else {
      return JSON.stringify({ success: false, error: '未知操作: ' + action });
    }
    return JSON.stringify({ success: true, version: SCRIPT_VERSION, action: action, result: result });
  } catch (err) {
    return JSON.stringify({ success: false, version: SCRIPT_VERSION, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 欄位對應工具
// ==============================================================================

function getOrCreateSheet(ss, sheetName, defaultHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (defaultHeaders && defaultHeaders.length > 0 && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders])
      .setFontWeight('bold').setBackground('#4F46E5').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function trackingSheetName(businessUnit) {
  return businessUnit === 'VALET' ? SHEET_NAMES.VALET_TRACKING : SHEET_NAMES.PEPPER_TRACKING;
}

/** 正規化表頭：忽略大小寫、空白、全形斜線 */
function normalizeHeader(h) {
  return String(h == null ? '' : h)
    .replace(/[\s　]+/g, '')
    .replace(/／/g, '/')
    .toLowerCase();
}

function specsFor(businessUnit) {
  var isValet = businessUnit === 'VALET';
  return FIELD_SPECS.filter(function (s) { return isValet || !s.valetOnly; });
}

/**
 * 讀取第一列表頭，回傳 { col: {key: 0-based index 或 -1}, headers: [...], width }
 */
function resolveColumns(sheet, businessUnit) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });

  // 表頭名稱 -> 所有出現位置
  var positions = {};
  headers.forEach(function (h, i) {
    var k = normalizeHeader(h);
    if (!k) return;
    (positions[k] = positions[k] || []).push(i);
  });

  var specs = specsFor(businessUnit);
  var col = {};
  var claimed = {};

  // 第一輪：唯一名稱直接比對（每個名稱取第一個出現位置）
  specs.forEach(function (s) {
    col[s.key] = -1;
    for (var j = 0; j < s.names.length; j++) {
      var p = positions[normalizeHeader(s.names[j])];
      if (p && p.length) {
        for (var q = 0; q < p.length; q++) {
          if (!claimed[p[q]]) { col[s.key] = p[q]; claimed[p[q]] = true; break; }
        }
        if (col[s.key] !== -1) break;
      }
    }
  });

  // 第二輪：重複名稱（到期日期）依錨點欄位判斷：先取錨點「左側」最近的，找不到再往右找
  var dupSpecs = specs.filter(function (s) { return s.dupName && col[s.key] === -1; });
  var pickDup = function (s, leftSide) {
    if (col[s.key] !== -1) return;
    var anchorIdx = col[s.anchor];
    if (anchorIdx === undefined || anchorIdx === -1) return;
    var p = positions[normalizeHeader(s.dupName)] || [];
    var best = -1;
    for (var i = 0; i < p.length; i++) {
      if (claimed[p[i]]) continue;
      if (leftSide && p[i] < anchorIdx && (best === -1 || p[i] > best)) best = p[i];
      if (!leftSide && p[i] > anchorIdx && (best === -1 || p[i] < best)) best = p[i];
    }
    if (best !== -1) { col[s.key] = best; claimed[best] = true; }
  };
  dupSpecs.forEach(function (s) { pickDup(s, true); });
  dupSpecs.forEach(function (s) { pickDup(s, false); });

  var nonEmpty = 0;
  headers.forEach(function (h, i) { if (h !== '') nonEmpty = i + 1; });

  return { col: col, headers: headers, width: Math.max(nonEmpty, 1) };
}

/** 試算表缺少的欄位補在最右側（只限 append: true 的欄位） */
function ensureColumn(sheet, cols, key) {
  if (cols.col[key] !== undefined && cols.col[key] !== -1) return cols.col[key];
  var spec = FIELD_SPECS.filter(function (s) { return s.key === key; })[0];
  if (!spec || !spec.append) return -1;
  var idx = cols.width;
  sheet.getRange(1, idx + 1).setValue(spec.names[0]).setFontWeight('bold');
  cols.col[key] = idx;
  cols.headers[idx] = spec.names[0];
  cols.width = idx + 1;
  return idx;
}

function specOf(key) {
  return FIELD_SPECS.filter(function (s) { return s.key === key; })[0] || {};
}

/** 日期統一為 yyyy-MM-dd */
function normalizeDateValue(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return s;
}

/** 電話：保留開頭 0，並強制以文字寫入 */
function normalizePhone(val) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim();
  if (!s) return '';
  if (/^9\d{8}$/.test(s)) s = '0' + s; // Excel 數字格式吃掉的 0
  return s;
}

function asText(val) {
  var s = String(val == null ? '' : val);
  return s === '' ? '' : "'" + s;
}

function isClosedRow(row, col) {
  if (col.isClosed !== -1) {
    var v = String(row[col.isClosed] == null ? '' : row[col.isClosed]).trim();
    if (v === '已結案' || v === '結案' || v.toLowerCase() === 'true') return true;
    if (v !== '') return false; // 明確填了其他值（例如「未結案」）
  }
  // 「結案狀態」欄不存在或空白時，以「結案日期」有值視為已結案
  if (col.closedDate !== -1) {
    return String(row[col.closedDate] == null ? '' : row[col.closedDate]).trim() !== '';
  }
  return false;
}

/**
 * 為「案件ID」空白的列補號（格式：UID-01、UID-02…，依列的先後順序）
 * values 為第 2 列起的資料（會直接修改），回傳是否有補號
 */
function assignCaseIds(sheet, cols, values) {
  var col = cols.col;
  if (col.caseId === -1) ensureColumn(sheet, cols, 'caseId');
  var c = col.caseId;
  if (c === -1 || values.length === 0) return false;
  values.forEach(function (r) { while (r.length <= c) r.push(''); });

  // 有效的案件ID：文字、且以「UID-」開頭。
  // 試算表會把「2297-01」自動轉成日期，這類儲存格視為無效，重新編號並以純文字寫回。
  var isValid = function (r) {
    var v = r[c];
    var uid = String(r[col.uid] || '').trim();
    return typeof v === 'string' && uid !== '' && v.trim().indexOf(uid + '-') === 0;
  };

  var maxSeq = {};
  values.forEach(function (r) {
    if (!isValid(r)) return;
    var m = String(r[c]).trim().match(/^(.*)-(\d+)$/);
    if (m) maxSeq[m[1]] = Math.max(maxSeq[m[1]] || 0, Number(m[2]));
  });

  var changed = false;
  values.forEach(function (r) {
    var uid = String(r[col.uid] || '').trim();
    if (!uid || isValid(r)) return;
    r[c] = nextCaseId(maxSeq, uid);
    changed = true;
  });

  if (changed) {
    var range = sheet.getRange(2, c + 1, values.length, 1);
    range.setNumberFormat('@'); // 純文字格式，避免再被轉成日期
    range.setValues(values.map(function (r) { return [String(r[c] == null ? '' : r[c])]; }));
  }
  return changed;
}

function nextCaseId(maxSeq, uid) {
  maxSeq[uid] = (maxSeq[uid] || 0) + 1;
  var n = maxSeq[uid];
  return uid + '-' + (n < 10 ? '0' + n : String(n));
}

/** 讀取追蹤表全部資料列（第 2 列起），並補齊空白的案件ID */
function readTrackingRows(sheet, cols) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, cols.width).getValues();
  assignCaseIds(sheet, cols, values);
  return values;
}

function nowString() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
}

// ==============================================================================
// 1. 覆蓋寫入原始報表
// ==============================================================================

function handleOverwriteRawReport(ss, businessUnit, headers, rows) {
  var sheetName = businessUnit === 'VALET' ? SHEET_NAMES.VALET_RAW : SHEET_NAMES.PEPPER_RAW;
  var sheet = getOrCreateSheet(ss, sheetName);
  sheet.clearContents();
  sheet.clearFormats();

  if (!headers || headers.length === 0) {
    headers = ['UID', 'Name', 'Email', 'Phone', 'Address', 'Type of Service',
      'inv Date', 'Inv ID', 'Invoiced Amount', 'Outstanding Days', 'Total Outstanding Amount', 'Blue Code'];
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground(businessUnit === 'VALET' ? '#DC2626' : '#059669')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows && rows.length > 0) {
    var phoneIdx = -1;
    headers.forEach(function (h, i) { if (normalizeHeader(h) === 'phone') phoneIdx = i; });
    var data = rows.map(function (r) {
      var row = [];
      for (var i = 0; i < headers.length; i++) row.push(r[i] === undefined ? '' : r[i]);
      if (phoneIdx !== -1) row[phoneIdx] = asText(normalizePhone(row[phoneIdx]));
      return row;
    });
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }

  return { sheetName: sheetName, rowCount: rows ? rows.length : 0 };
}

// ==============================================================================
// 2. 彙整並同步至追蹤工作表
// ==============================================================================

function handleSyncSummaryTracking(ss, businessUnit, items, markMissingAsPending) {
  var isValet = businessUnit === 'VALET';
  var sheetName = trackingSheetName(businessUnit);
  var sheet = getOrCreateSheet(ss, sheetName, DEFAULT_TRACKING_HEADERS[isValet ? 'VALET' : 'PEPPER']);
  var cols = resolveColumns(sheet, businessUnit);
  var col = cols.col;
  if (col.uid === -1) throw new Error('工作表「' + sheetName + '」找不到 UID 欄位，請確認第一列表頭有「UID」');

  // 補齊會用到的欄位（案件ID、帳單日、開始催帳日）
  ['caseId', 'billDate', 'collectionStartDate'].forEach(function (k) { ensureColumn(sheet, cols, k); });
  var width = cols.width;
  var lastRow = sheet.getLastRow();
  var values = [], formulas = [];
  if (lastRow > 1) {
    var range = sheet.getRange(2, 1, lastRow - 1, width);
    values = range.getValues();
    formulas = range.getFormulas();
    assignCaseIds(sheet, cols, values);
  }

  var maxSeq = {};
  values.forEach(function (r) {
    var m = String(r[col.caseId] || '').trim().match(/^(.*)-(\d+)$/);
    if (m) maxSeq[m[1]] = Math.max(maxSeq[m[1]] || 0, Number(m[2]));
  });

  var uidMap = {};
  values.forEach(function (r, i) {
    var u = String(r[col.uid] || '').trim();
    if (!u) return;
    (uidMap[u] = uidMap[u] || []).push({ index: i, isClosed: isClosedRow(r, col) });
  });

  var nowStr = nowString();
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var updatedCount = 0, newCount = 0, pendingCount = 0, newRows = [];
  var seenUids = {};
  var touchedCols = {}; // 有更新的欄位，最後整欄一次寫回（避免逐列寫入造成逾時）

  items.forEach(function (item) {
    var uid = String(item.uid || '').trim();
    if (!uid) return;
    seenUids[uid] = true;
    var tag = item.statusTag === 'PENDING_CONFIRMATION' ? '待確認是否結案' : '正常追蹤';
    var phone = normalizePhone(item.phone);

    var active = (uidMap[uid] || []).filter(function (e) { return !e.isClosed; })[0];

    if (active) {
      var row = values[active.index];
      var set = function (key, val) {
        var c = col[key];
        if (c === undefined || c === -1) return;
        row[c] = val;
        touchedCols[c] = true;
        formulas[active.index][c] = ''; // 已改為新值，不再保留舊公式
      };
      if (item.name) set('name', item.name);
      set('outstandingDays', item.outstandingDays);
      set('amount', item.totalOutstandingAmount);
      if (item.email) set('email', item.email);
      if (phone) set('phone', phone);
      if (isValet) {
        if (item.serviceType) set('serviceType', item.serviceType);
        if (item.address) set('address', item.address);
      }
      set('statusTag', tag);
      if (item.stage) set('stage', item.stage);
      if (item.billDate && col.billDate !== -1 && !row[col.billDate]) set('billDate', normalizeDateValue(item.billDate));
      set('updatedAt', nowStr);
      updatedCount++;
    } else {
      var newRow = [];
      for (var w = 0; w < width; w++) newRow.push('');
      var put = function (key, val) {
        var c = col[key];
        if (c === undefined || c === -1) return;
        newRow[c] = val;
      };
      put('caseId', asText(nextCaseId(maxSeq, uid)));
      put('uid', uid);
      put('name', item.name || '');
      put('outstandingDays', item.outstandingDays);
      put('amount', item.totalOutstandingAmount);
      put('email', item.email || '');
      put('phone', asText(phone));
      if (isValet) {
        put('serviceType', item.serviceType || '');
        put('address', item.address || '');
      }
      put('stage', item.stage || 'STAGE_1');
      put('statusTag', tag);
      put('isClosed', '未結案');
      put('billDate', normalizeDateValue(item.billDate || ''));
      put('collectionStartDate', today);
      put('updatedAt', nowStr);
      newRows.push(newRow);
      newCount++;
    }
  });

  // 本次報表沒有出現、且尚未結案的列 → 待確認是否結案（客人可能已付款）
  if (markMissingAsPending && col.statusTag !== -1) {
    values.forEach(function (r, i) {
      var u = String(r[col.uid] || '').trim();
      if (!u || seenUids[u] || isClosedRow(r, col)) return;
      if (String(r[col.statusTag] || '').trim() === '待確認是否結案') return;
      r[col.statusTag] = '待確認是否結案';
      formulas[i][col.statusTag] = '';
      touchedCols[col.statusTag] = true;
      if (col.updatedAt !== -1) { r[col.updatedAt] = nowStr; formulas[i][col.updatedAt] = ''; touchedCols[col.updatedAt] = true; }
      pendingCount++;
    });
  }

  // 既有列：只回寫有異動的欄位，每欄一次寫入；保留原公式，電話以文字寫入
  if (values.length > 0) {
    Object.keys(touchedCols).forEach(function (k) {
      var c = Number(k);
      var colValues = values.map(function (r, i) {
        if (formulas[i][c]) return [formulas[i][c]];
        var v = r[c];
        if (c === col.phone) return [asText(normalizePhone(v))];
        return [v];
      });
      sheet.getRange(2, c + 1, colValues.length, 1).setValues(colValues);
    });
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, width).setValues(newRows);
  }

  return { sheetName: sheetName, updatedCount: updatedCount, newCount: newCount, pendingCount: pendingCount, totalItems: items.length };
}

// ==============================================================================
// 3. 前端單筆回寫
// ==============================================================================

function handleUpdateRowStatus(ss, businessUnit, uid, fields, caseId) {
  var sheetName = trackingSheetName(businessUnit);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('找不到工作表: ' + sheetName);
  if (sheet.getLastRow() <= 1) throw new Error('工作表目前無資料列');

  var cols = resolveColumns(sheet, businessUnit);
  var col = cols.col;
  if (col.uid === -1) throw new Error('工作表「' + sheetName + '」找不到 UID 欄位');

  var data = readTrackingRows(sheet, cols);
  var targetRow = -1;
  if (caseId) {
    // 依案件ID精準找列（同 UID 的其他案件不會被動到）
    for (var k = 0; k < data.length; k++) {
      if (String(data[k][col.caseId]).trim() === String(caseId).trim()) { targetRow = k + 2; break; }
    }
  }
  // 沒有案件ID，或前端還拿著舊的、被轉成日期的案件ID 時，改依 UID 找未結案的列
  var staleId = caseId && String(caseId).trim().indexOf(String(uid).trim() + '-') !== 0;
  if (targetRow === -1 && uid && (!caseId || staleId)) {
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][col.uid]).trim() !== String(uid).trim()) continue;
      if (!isClosedRow(data[i], col)) { targetRow = i + 2; break; }
      if (targetRow === -1) targetRow = i + 2; // 全部都已結案時取最新一列
    }
  }
  if (targetRow === -1) {
    throw new Error('在工作表「' + sheetName + '」找不到案件' + (caseId ? 'ID ' + caseId : ' UID ' + uid) + '，請重新整理頁面後再試');
  }

  var written = [], skipped = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    var spec = specOf(key);
    if (!spec.key || key === 'uid' || key === 'caseId') continue;

    var c = ensureColumn(sheet, cols, key);
    if (c === -1) { skipped.push(key); continue; }

    var val = fields[key];
    if (key === 'isClosed') {
      val = val ? '已結案' : '未結案';
    } else if (key === 'statusTag') {
      val = val === 'PENDING_CONFIRMATION' ? '待確認是否結案' : (val === 'NORMAL' ? '正常追蹤' : (val || ''));
    } else if (val === null || val === undefined) {
      val = '';
    } else if (spec.date) {
      val = normalizeDateValue(val);
    } else if (key === 'demandMethod') {
      val = val === 'EMAIL' ? 'Email' : (val === 'CERTIFIED_LETTER' ? '存證信函' : val);
    }
    if (spec.text) val = asText(val);

    if (key === 'demandDocUrl') {
      writeLinkCell(sheet.getRange(targetRow, c + 1), val);
    } else {
      sheet.getRange(targetRow, c + 1).setValue(val);
    }
    written.push(cols.headers[c] + '(' + columnLetter(c + 1) + ')');
  }

  if (col.updatedAt !== -1) {
    sheet.getRange(targetRow, col.updatedAt + 1).setValue(nowString());
  }

  return {
    success: true,
    sheetName: sheetName,
    rowIndex: targetRow,
    caseId: caseId || String(data[targetRow - 2][col.caseId] || ''),
    uid: uid,
    writtenColumns: written,
    skippedFields: skipped
  };
}

// ==============================================================================
// 4. 前端讀取全部案件（所有使用者共用同一份資料）
// ==============================================================================

function handleListCases(ss, businessUnits) {
  var cases = [];
  businessUnits.forEach(function (bu) {
    var sheet = ss.getSheetByName(trackingSheetName(bu));
    if (!sheet) return;
    var cols = resolveColumns(sheet, bu);
    var col = cols.col;
    if (col.uid === -1) return;
    var values = readTrackingRows(sheet, cols);
    var specs = specsFor(bu);
    var docLinks = readLinkColumn(sheet, col.demandDocUrl, values.length);
    values.forEach(function (r, rowIdx) {
      var uid = String(r[col.uid] || '').trim();
      if (!uid) return;
      var obj = { businessUnit: bu };
      specs.forEach(function (s) {
        var c = col[s.key];
        if (c === undefined || c === -1) return;
        var v = r[c];
        if (v instanceof Date) v = s.date ? normalizeDateValue(v) : Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
        else if (s.date) v = normalizeDateValue(v);
        obj[s.key] = v === null || v === undefined ? '' : v;
      });
      if (docLinks) obj.demandDocUrl = docLinks[rowIdx] || String(obj.demandDocUrl || '').trim();
      obj.uid = uid;
      obj.caseId = String(obj.caseId || '').trim();
      obj.isClosed = isClosedRow(r, col);
      obj.statusTag = String(obj.statusTag || '').trim() === '待確認是否結案' ? 'PENDING_CONFIRMATION' : 'NORMAL';
      var dm = String(obj.demandMethod || '').trim();
      obj.demandMethod = dm === 'Email' || dm.toUpperCase() === 'EMAIL' ? 'EMAIL' : (dm === '存證信函' ? 'CERTIFIED_LETTER' : '');
      if (obj.phone) obj.phone = normalizePhone(obj.phone);
      cases.push(obj);
    });
  });
  return { cases: cases, fetchedAt: nowString() };
}

// ==============================================================================
// 5. 檔案上傳（電子催告檔）
// ==============================================================================

function handleUploadFile(ss, payload) {
  if (!payload.base64) throw new Error('未提供檔案內容');
  var bytes = Utilities.base64Decode(payload.base64);
  var name = [payload.businessUnit || '', payload.uid || '', payload.kind || '', payload.fileName || 'file']
    .filter(function (s) { return s; }).join('_');
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', name);

  var file;
  try {
    file = getUploadFolder(ss).createFile(blob);
  } catch (err) {
    throw new Error('無法存入 Google 雲端：' + err.message +
      '。請在 Apps Script 編輯器執行一次 authorizeDrive() 完成授權，再以「新版本」重新部署');
  }
  // 讓有連結的同事都能開啟（網域政策不允許時沿用資料夾權限）
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  var url = file.getUrl();
  var sheetResult = null;
  // 帶了案件ID就直接回填「電子催告檔」欄位（顯示 Link）
  if (payload.caseId && payload.businessUnit) {
    try {
      sheetResult = handleUpdateRowStatus(ss, String(payload.businessUnit).toUpperCase(), payload.uid,
        { demandDocUrl: url }, payload.caseId);
    } catch (e) {
      sheetResult = { success: false, message: e.message };
    }
  }
  return { url: url, id: file.getId(), name: file.getName(), sheet: sheetResult };
}

/** 試算表所在資料夾下的附件資料夾；沒有權限在該資料夾建立時，改存到部署者的雲端硬碟根目錄 */
function getUploadFolder(ss) {
  var parent;
  try {
    var parents = DriveApp.getFileById(ss.getId()).getParents();
    parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    var it = parent.getFoldersByName(UPLOAD_FOLDER_NAME);
    return it.hasNext() ? it.next() : parent.createFolder(UPLOAD_FOLDER_NAME);
  } catch (e) {
    var root = DriveApp.getRootFolder();
    var it2 = root.getFoldersByName(UPLOAD_FOLDER_NAME);
    return it2.hasNext() ? it2.next() : root.createFolder(UPLOAD_FOLDER_NAME);
  }
}

/** 寫入連結儲存格：顯示「Link」，點擊開啟網址；空值則清空 */
function writeLinkCell(range, url) {
  url = String(url == null ? '' : url).trim();
  if (!url) { range.clearContent(); return; }
  if (!/^https?:\/\//i.test(url)) { range.setValue(url); return; }
  var rich = SpreadsheetApp.newRichTextValue().setText('Link').setLinkUrl(url).build();
  range.setRichTextValue(rich);
}

/**
 * 讀取連結欄位的實際網址（儲存格顯示「Link」時，網址在超連結裡）
 * 支援：超連結文字、=HYPERLINK("網址","Link") 公式、直接貼上的網址
 */
function readLinkColumn(sheet, c, rowCount) {
  if (c === undefined || c === -1 || rowCount === 0) return null;
  var range = sheet.getRange(2, c + 1, rowCount, 1);
  var rich = range.getRichTextValues();
  var formulas = range.getFormulas();
  var out = [];
  for (var i = 0; i < rowCount; i++) {
    var url = '';
    var rt = rich[i][0];
    if (rt) {
      url = rt.getLinkUrl() || '';
      if (!url) {
        var runs = rt.getRuns();
        for (var k = 0; k < runs.length && !url; k++) url = runs[k].getLinkUrl() || '';
      }
      if (!url) url = rt.getText();
    }
    var f = formulas[i][0];
    if (f) {
      var m = f.match(/HYPERLINK\(\s*"([^"]+)"/i);
      if (m) url = m[1];
    }
    out.push(String(url || '').trim());
  }
  return out;
}

/**
 * 在 Apps Script 編輯器手動執行一次，完成雲端硬碟授權（上傳電子催告檔需要）
 */
function authorizeDrive() {
  var folder = getUploadFolder(SpreadsheetApp.getActiveSpreadsheet());
  Logger.log('雲端硬碟授權完成，附件資料夾：' + folder.getName() + ' ' + folder.getUrl());
}

// ==============================================================================
// 手動補號：在 Apps Script 編輯器執行一次，為兩張追蹤表空白的「案件ID」補號
// （平常不需要手動執行，任何一次回寫或前端讀取都會自動補號）
// ==============================================================================

function backfillCaseIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['VALET', 'PEPPER'].forEach(function (bu) {
    var sheet = ss.getSheetByName(trackingSheetName(bu));
    if (!sheet) return;
    var cols = resolveColumns(sheet, bu);
    readTrackingRows(sheet, cols);
    Logger.log(trackingSheetName(bu) + '：案件ID 已補齊');
  });
}

// ==============================================================================
// 手動檢查：在 Apps Script 編輯器執行，於「執行記錄」查看每個欄位對應到哪一欄
// ==============================================================================

function checkColumnMapping() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['VALET', 'PEPPER'].forEach(function (bu) {
    var name = trackingSheetName(bu);
    var sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log('找不到工作表: ' + name); return; }
    var cols = resolveColumns(sheet, bu);
    Logger.log('== ' + name + ' ==');
    specsFor(bu).forEach(function (s) {
      var c = cols.col[s.key];
      Logger.log(s.names[0] + ' -> ' + (c === -1 ? '(試算表沒有此欄' + (s.append ? '，第一次回寫時會自動新增)' : ')') : columnLetter(c + 1) + ' 欄「' + cols.headers[c] + '」'));
    });
  });
}

function columnLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
