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
 *    - 表頭重複的「到期日期」依其左側最近的欄位判斷用途：
 *        電子催告日期 → 到期日期   = 催告到期日
 *        收件日期     → 到期日期   = 存證信函到期日期
 *        服務終止日   → 到期日期   = 服務終止到期日期
 * 3. 同一客戶先前已結案又再欠款：保留舊列，新增一列追蹤未結案那筆。
 * 4. 前端上傳的電子催告檔 / 存證信函會存到試算表所在資料夾下的「2bad-debtbackup 附件」資料夾，
 *    並把檔案連結回填到對應欄位。
 */

var SHEET_NAMES = {
  VALET_RAW: 'OutstandingReportValet',
  PEPPER_RAW: 'OutstandingReportPepper',
  VALET_TRACKING: 'Valet扣款失敗通知追蹤',
  PEPPER_TRACKING: 'Pepper扣款失敗通知追蹤'
};

var UPLOAD_FOLDER_NAME = '2bad-debtbackup 附件';

/**
 * 追蹤表欄位定義
 * key       : 前端 / 程式使用的欄位代號
 * names     : 試算表表頭可接受的名稱（第一個為建議名稱，其餘為相容舊名稱）
 * dupName   : 表頭重複時使用的共用名稱（例如「到期日期」）
 * anchor    : dupName 的判斷依據：取 anchor 欄位右側最近、尚未被其他欄位認領的 dupName 欄
 * append    : 試算表沒有這個欄位時，第一次回寫會自動補在最右側
 * valetOnly : 只有 Valet 才有的欄位
 * date      : 日期欄位（統一寫成 yyyy-MM-dd）
 * text      : 強制以文字寫入（保留電話開頭的 0）
 */
var FIELD_SPECS = [
  // ---- 報表彙整欄位 ----
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

  // ---- 催告與終止 ----
  { key: 'demandMethod',          names: ['催告方式'], append: true },
  { key: 'demandSmsDate',         names: ['電子催告簡訊日期'], date: true, append: true },
  { key: 'demandDocUrl',          names: ['電子催告檔', '催告文件連結'], append: true },
  { key: 'demandNoticeDate',      names: ['電子催告日期', '催告通知日'], date: true, append: true },
  { key: 'demandDueDate',         names: ['催告到期日', '電子催告到期日期'], dupName: '到期日期', anchor: 'demandNoticeDate', date: true },
  { key: 'terminationSmsDate',    names: ['終止簡訊通知'], date: true, append: true },
  { key: 'terminationNoticeDate', names: ['服務終止日', '終止函日期'], date: true, append: true },
  { key: 'terminationDueDate',    names: ['服務終止到期日期', '終止到期日期'], dupName: '到期日期', anchor: 'terminationNoticeDate', date: true },
  { key: 'certifiedLetterUrl',    names: ['存證信函'], append: true },
  { key: 'certifiedLetterReceivedDate', names: ['收件日期'], date: true, append: true },
  { key: 'certifiedLetterDueDate',names: ['存證信函到期日期'], dupName: '到期日期', anchor: 'certifiedLetterReceivedDate', date: true },
  { key: 'faNotes',               names: ['FA備註'] },

  { key: 'updatedAt',      names: ['最後更新時間', '更新時間'] }
];

// 新建立追蹤表時使用的預設表頭（已存在的工作表不會被改動）
var DEFAULT_TRACKING_HEADERS = {
  VALET: ['UID', 'Type of Service', 'NAME', 'Outstanding Days', 'Email', '地址', 'Total Outstanding Amount', 'Phone',
          '催帳階段/狀態', '追蹤標籤', '結案狀態', 'LINE日期', '寄信日期', '寄簡訊日期', '處理方式/客人回應', '結案日期',
          '催告方式', '電子催告簡訊日期', '電子催告檔', '電子催告日期', '到期日期', '終止簡訊通知',
          '服務終止日', '到期日期', '存證信函', '收件日期', '到期日期', '最後更新時間'],
  PEPPER: ['UID', 'NAME', 'Email', 'Outstanding Days', 'Total Outstanding Amount', 'Phone',
           '催帳階段/狀態', '追蹤標籤', '結案狀態', 'LINE日期', '寄信日期', '寄簡訊日期', '處理方式/客人回應', '結案日期',
           '催告方式', '電子催告簡訊日期', '電子催告檔', '電子催告日期', '到期日期', '終止簡訊通知',
           '服務終止日', '到期日期', '存證信函', '收件日期', '到期日期', '最後更新時間']
};

// ==============================================================================
// Web App 入口
// ==============================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: '未提供 POST 資料' });
    }
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var businessUnit = (payload.businessUnit || '').toUpperCase(); // 'VALET' | 'PEPPER'
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result;

    if (action === 'OVERWRITE_RAW_REPORT') {
      result = handleOverwriteRawReport(ss, businessUnit, payload.headers, payload.rows);
    } else if (action === 'SYNC_SUMMARY_TRACKING') {
      result = handleSyncSummaryTracking(ss, businessUnit, payload.items || []);
    } else if (action === 'UPDATE_ROW_STATUS') {
      result = handleUpdateRowStatus(ss, businessUnit, payload.uid, payload.fields || {});
    } else if (action === 'UPLOAD_FILE') {
      result = handleUploadFile(ss, payload);
    } else {
      return jsonResponse({ success: false, error: '未知操作: ' + action });
    }
    return jsonResponse({ success: true, action: action, result: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: '2bad-debtbackup Google Apps Script Web App 正常運作中',
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); })
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

  // 第二輪：重複名稱（到期日期）依錨點欄位判斷，錨點靠左的先認領
  var dupSpecs = specs.filter(function (s) { return s.dupName && col[s.key] === -1; });
  dupSpecs.sort(function (a, b) { return (col[a.anchor] === undefined ? 9999 : col[a.anchor]) - (col[b.anchor] === undefined ? 9999 : col[b.anchor]); });
  dupSpecs.forEach(function (s) {
    var anchorIdx = col[s.anchor];
    if (anchorIdx === undefined || anchorIdx === -1) return;
    var p = positions[normalizeHeader(s.dupName)] || [];
    for (var i = 0; i < p.length; i++) {
      if (p[i] > anchorIdx && !claimed[p[i]]) {
        col[s.key] = p[i];
        claimed[p[i]] = true;
        break;
      }
    }
  });

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
    var v = String(row[col.isClosed] || '').trim();
    return v === '已結案' || v === '結案' || v.toLowerCase() === 'true';
  }
  // 沒有「結案狀態」欄時，以「結案日期」有值視為已結案
  if (col.closedDate !== -1) {
    return String(row[col.closedDate] || '').trim() !== '';
  }
  return false;
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

function handleSyncSummaryTracking(ss, businessUnit, items) {
  var isValet = businessUnit === 'VALET';
  var sheetName = trackingSheetName(businessUnit);
  var sheet = getOrCreateSheet(ss, sheetName, DEFAULT_TRACKING_HEADERS[isValet ? 'VALET' : 'PEPPER']);
  var cols = resolveColumns(sheet, businessUnit);
  var col = cols.col;
  if (col.uid === -1) throw new Error('工作表「' + sheetName + '」找不到 UID 欄位');

  var width = cols.width;
  var lastRow = sheet.getLastRow();
  var values = [], formulas = [];
  if (lastRow > 1) {
    var range = sheet.getRange(2, 1, lastRow - 1, width);
    values = range.getValues();
    formulas = range.getFormulas();
  }

  var uidMap = {};
  values.forEach(function (r, i) {
    var u = String(r[col.uid] || '').trim();
    if (!u) return;
    (uidMap[u] = uidMap[u] || []).push({ index: i, isClosed: isClosedRow(r, col) });
  });

  var nowStr = nowString();
  var updatedCount = 0, newCount = 0, newRows = [];

  items.forEach(function (item) {
    var uid = String(item.uid || '').trim();
    if (!uid) return;
    var tag = item.statusTag === 'PENDING_CONFIRMATION' ? '待確認是否結案' : '正常追蹤';
    var phone = normalizePhone(item.phone);

    var active = (uidMap[uid] || []).filter(function (e) { return !e.isClosed; })[0];

    if (active) {
      var row = values[active.index];
      var changed = {};
      var set = function (key, val) {
        var c = col[key];
        if (c === undefined || c === -1) return;
        row[c] = val;
        changed[c] = true;
      };
      if (item.name) set('name', item.name);
      set('outstandingDays', item.outstandingDays);
      set('amount', item.totalOutstandingAmount);
      if (item.email) set('email', item.email);
      if (phone) set('phone', asText(phone));
      if (isValet) {
        if (item.serviceType) set('serviceType', item.serviceType);
        if (item.address) set('address', item.address);
      }
      set('statusTag', tag);
      if (item.stage) set('stage', item.stage);
      set('updatedAt', nowStr);

      var out = row.map(function (v, c) {
        if (!changed[c] && formulas[active.index] && formulas[active.index][c]) return formulas[active.index][c];
        // 未變動的電話欄重新以文字寫回，避免被轉成數字
        if (!changed[c] && c === col.phone && v !== '') return asText(normalizePhone(v));
        return v;
      });
      sheet.getRange(active.index + 2, 1, 1, width).setValues([out]);
      updatedCount++;
    } else {
      var newRow = [];
      for (var w = 0; w < width; w++) newRow.push('');
      var put = function (key, val) {
        var c = col[key];
        if (c === undefined || c === -1) return;
        newRow[c] = val;
      };
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
      put('updatedAt', nowStr);
      newRows.push(newRow);
      newCount++;
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, width).setValues(newRows);
  }

  return { sheetName: sheetName, updatedCount: updatedCount, newCount: newCount, totalItems: items.length };
}

// ==============================================================================
// 3. 前端單筆回寫
// ==============================================================================

function handleUpdateRowStatus(ss, businessUnit, uid, fields) {
  var sheetName = trackingSheetName(businessUnit);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('找不到工作表: ' + sheetName);
  if (sheet.getLastRow() <= 1) throw new Error('工作表目前無資料列');

  var cols = resolveColumns(sheet, businessUnit);
  var col = cols.col;
  if (col.uid === -1) throw new Error('工作表「' + sheetName + '」找不到 UID 欄位');

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, cols.width).getValues();
  var targetRow = -1;
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][col.uid]).trim() !== String(uid).trim()) continue;
    if (!isClosedRow(data[i], col)) { targetRow = i + 2; break; }
    if (targetRow === -1) targetRow = i + 2; // 全部都已結案時取最新一列
  }
  if (targetRow === -1) {
    return { success: false, message: '在工作表中找不到 UID ' + uid + ' 的對應列' };
  }

  var written = [], skipped = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    var spec = specOf(key);
    if (!spec.key || key === 'uid') continue;

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

    sheet.getRange(targetRow, c + 1).setValue(val);
    written.push(cols.headers[c] + '(' + columnLetter(c + 1) + ')');
  }

  if (col.updatedAt !== -1) {
    sheet.getRange(targetRow, col.updatedAt + 1).setValue(nowString());
  }

  return {
    success: true,
    sheetName: sheetName,
    rowIndex: targetRow,
    uid: uid,
    writtenColumns: written,
    skippedFields: skipped
  };
}

// ==============================================================================
// 4. 檔案上傳（電子催告檔 / 存證信函）
// ==============================================================================

function handleUploadFile(ss, payload) {
  if (!payload.base64) throw new Error('未提供檔案內容');
  var bytes = Utilities.base64Decode(payload.base64);
  var name = [payload.businessUnit || '', payload.uid || '', payload.kind || '', payload.fileName || 'file']
    .filter(function (s) { return s; }).join('_');
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', name);
  var file = getUploadFolder(ss).createFile(blob);
  return { url: file.getUrl(), id: file.getId(), name: file.getName() };
}

/** 試算表所在資料夾下的附件資料夾（檔案沿用該資料夾的共用權限） */
function getUploadFolder(ss) {
  var parents = DriveApp.getFileById(ss.getId()).getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var it = parent.getFoldersByName(UPLOAD_FOLDER_NAME);
  return it.hasNext() ? it.next() : parent.createFolder(UPLOAD_FOLDER_NAME);
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
