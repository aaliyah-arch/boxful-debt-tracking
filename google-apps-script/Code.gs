/**
 * ==============================================================================
 * 2bad-debtbackup Google 試算表自動化同步與回寫腳本 (Google Apps Script)
 * 試算表名稱: 2bad-debtbackup
 * 網址: https://docs.google.com/spreadsheets/d/1ffoagvek5LyXFv4DPQIsNzSU2FesUSZl0OF2tkLHEV4/edit?usp=sharing
 * ==============================================================================
 * 
 * 功能亮點：
 * 1. 自動建立與維護 4 個工作表分頁：
 *    - OutstandingReportValet (原始報表每週覆蓋)
 *    - OutstandingReportPepper (原始報表每週覆蓋)
 *    - Valet扣款失敗通知追蹤 (Valet 彙整與催帳/結案回寫)
 *    - Pepper扣款失敗通知追蹤 (Pepper 彙整與催帳/結案回寫)
 * 2. 智慧重複欠款支援：同一客戶若先前已結案再次欠款，保留歷史紀錄，新增一列追蹤尚未結案的那筆。
 * 3. 欄位精準區分：Valet 專屬包含「服務類型 (Type of Service)」與「地址 (Address)」，Pepper 則不含。
 * 4. 支援前端單筆即時回寫與整批報表匯入覆蓋。
 */

// 定義工作表分頁名稱
var SHEET_NAMES = {
  VALET_RAW: 'OutstandingReportValet',
  PEPPER_RAW: 'OutstandingReportPepper',
  VALET_TRACKING: 'Valet扣款失敗通知追蹤',
  PEPPER_TRACKING: 'Pepper扣款失敗通知追蹤'
};

// Valet 追蹤表欄位定義
var VALET_TRACKING_HEADERS = [
  'UID',
  'Type of Service',
  'NAME',
  'Outstanding Days',
  'Email',
  '地址',
  'Total Outstanding Amount',
  'Phone',
  '催帳階段/狀態',
  '追蹤標籤',
  '結案狀態',
  '結案日期',
  'Line通知日',
  'Line狀態',
  'Email通知日',
  'Email狀態',
  '電話通知日',
  '電話狀態',
  '2C催帳備註',
  '催告通知日',
  '催告到期日',
  '催告文件連結',
  '終止函日期',
  '終止函文件連結',
  'FA備註',
  '最後更新時間'
];

// Pepper 追蹤表欄位定義 (無 Type of Service 與 地址)
var PEPPER_TRACKING_HEADERS = [
  'UID',
  'NAME',
  'Email',
  'Outstanding Days',
  'Total Outstanding Amount',
  'Phone',
  '催帳階段/狀態',
  '追蹤標籤',
  '結案狀態',
  '結案日期',
  'Line通知日',
  'Line狀態',
  'Email通知日',
  'Email狀態',
  '電話通知日',
  '電話狀態',
  '2C催帳備註',
  '催告通知日',
  '催告到期日',
  '催告文件連結',
  '終止函日期',
  '終止函文件連結',
  'FA備註',
  '最後更新時間'
];

/**
 * 處理 POST 請求 (API 呼叫端點)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 等待最多 30 秒鎖定，避免多筆同時寫入衝突
    lock.waitLock(30000);
    
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ success: false, error: '未提供 POST 資料' });
    }

    var action = payload.action;
    var businessUnit = (payload.businessUnit || '').toUpperCase(); // 'VALET' | 'PEPPER'
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'OVERWRITE_RAW_REPORT') {
      // 覆蓋寫入原始報表
      var result = handleOverwriteRawReport(ss, businessUnit, payload.headers, payload.rows);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else if (action === 'SYNC_SUMMARY_TRACKING') {
      // 同步/彙整追蹤清單
      var result = handleSyncSummaryTracking(ss, businessUnit, payload.items);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else if (action === 'UPDATE_ROW_STATUS') {
      // 前端單筆回寫
      var result = handleUpdateRowStatus(ss, businessUnit, payload.uid, payload.fields);
      return jsonResponse({ success: true, action: action, result: result });
    } 
    else {
      return jsonResponse({ success: false, error: '未知操作: ' + action });
    }

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 處理 GET 請求 (健康檢查或測試)
 */
function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: '2bad-debtbackup Google Apps Script Web App 正常運作中',
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) { return s.getName(); })
  });
}

/**
 * 輔助：回傳 JSON 格式
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 取得或建立工作表，並設定標題樣式
 */
function getOrCreateSheet(ss, sheetName, defaultHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  if (defaultHeaders && defaultHeaders.length > 0) {
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(defaultHeaders);
      var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4F46E5');
      headerRange.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * 欄位別名：試算表表頭若使用以下寫法，也視為同一個欄位
 */
var HEADER_ALIASES = {
  'NAME': ['Name', '姓名', '客戶名稱'],
  '地址': ['Address'],
  'Type of Service': ['Service Type', '服務類型'],
  'Phone': ['電話'],
  '催帳階段/狀態': ['催帳階段', '催帳狀態'],
  '最後更新時間': ['更新時間']
};

/**
 * 正規化表頭文字（忽略大小寫、空白與全形/半形斜線差異）
 */
function normalizeHeader(h) {
  return String(h == null ? '' : h)
    .replace(/[\s　]+/g, '')
    .replace(/／/g, '/')
    .toLowerCase();
}

/**
 * 依「試算表第一列的實際表頭」建立 欄位名稱 -> 欄索引(0-based) 對照表。
 * 不再依賴程式內寫死的欄位順序，避免試算表欄位順序不同時寫錯欄。
 * 若試算表缺少某個系統欄位，會自動補在最右側（不會移動既有欄位）。
 */
function resolveColumns(sheet, canonicalHeaders) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var actual = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var lookup = {};
  for (var c = 0; c < actual.length; c++) {
    var key = normalizeHeader(actual[c]);
    if (key && lookup[key] === undefined) lookup[key] = c;
  }

  var map = {};
  var missing = [];
  for (var i = 0; i < canonicalHeaders.length; i++) {
    var name = canonicalHeaders[i];
    var candidates = [name].concat(HEADER_ALIASES[name] || []);
    var idx = -1;
    for (var j = 0; j < candidates.length; j++) {
      var k = lookup[normalizeHeader(candidates[j])];
      if (k !== undefined) { idx = k; break; }
    }
    if (idx === -1) missing.push(name);
    map[name] = idx;
  }

  if (missing.length > 0) {
    // 最右側有值的欄之後補上缺少的欄位
    var used = 0;
    for (var u = 0; u < actual.length; u++) {
      if (String(actual[u]).trim() !== '') used = u + 1;
    }
    sheet.getRange(1, used + 1, 1, missing.length)
      .setValues([missing])
      .setFontWeight('bold');
    for (var m = 0; m < missing.length; m++) {
      map[missing[m]] = used + m;
    }
  }

  var width = 0;
  for (var n in map) {
    if (map.hasOwnProperty(n) && map[n] + 1 > width) width = map[n] + 1;
  }
  width = Math.max(width, sheet.getLastColumn());

  return { map: map, width: width };
}

/**
 * 讀取資料列（第 2 列起），同時保留公式，回寫時不會把公式覆蓋成值
 */
function readDataBlock(sheet, width) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { values: [], formulas: [] };
  var range = sheet.getRange(2, 1, lastRow - 1, width);
  return { values: range.getValues(), formulas: range.getFormulas() };
}

/**
 * 將單列寫回試算表：只有實際變更過的儲存格寫新值，其餘保留原公式/原值
 */
function writeRow(sheet, sheetRowIndex, values, formulas, changed) {
  var out = [];
  for (var c = 0; c < values.length; c++) {
    if (!changed[c] && formulas && formulas[c]) {
      out.push(formulas[c]);
    } else {
      out.push(values[c]);
    }
  }
  sheet.getRange(sheetRowIndex, 1, 1, out.length).setValues([out]);
}

/**
 * 日期欄位：ISO 字串 (2026-10-07T00:00:00.000Z) 轉為 yyyy-MM-dd
 */
function normalizeDateValue(val) {
  if (val === null || val === undefined || val === '') return '';
  var s = String(val);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return val;
}

/**
 * 1. 覆蓋寫入原始報表 (OutstandingReportValet / OutstandingReportPepper)
 */
function handleOverwriteRawReport(ss, businessUnit, headers, rows) {
  var sheetName = businessUnit === 'VALET' ? SHEET_NAMES.VALET_RAW : SHEET_NAMES.PEPPER_RAW;
  var sheet = getOrCreateSheet(ss, sheetName);
  
  // 清空整張工作表內容
  sheet.clearContents();
  sheet.clearFormats();

  if (!headers || headers.length === 0) {
    headers = [
      'UID', 'Name', 'Email', 'Phone', 'Address', 'Type of Service', 
      'inv Date', 'Inv ID', 'Invoiced Amount', 'Outstanding Days', 
      'Total Outstanding Amount', 'Blue Code'
    ];
  }

  // 寫入表頭
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(businessUnit === 'VALET' ? '#DC2626' : '#059669');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows && rows.length > 0) {
    var range = sheet.getRange(2, 1, rows.length, headers.length);
    range.setValues(rows);
  }

  return {
    sheetName: sheetName,
    rowCount: rows ? rows.length : 0
  };
}

/**
 * 2. 彙整並同步至追蹤工作表 (Valet扣款失敗通知追蹤 / Pepper扣款失敗通知追蹤)
 * 核心規則：
 * - 同一客戶若先前已結案又再欠款，不覆蓋舊紀錄，新增一筆追蹤未結案的那筆。
 * - 若有未結案的紀錄，更新其最新欠款金額、逾期天數等數值，保留先前填寫的催帳備註。
 * - 所有欄位一律依試算表實際表頭名稱定位。
 */
function handleSyncSummaryTracking(ss, businessUnit, items) {
  var isValet = businessUnit === 'VALET';
  var sheetName = isValet ? SHEET_NAMES.VALET_TRACKING : SHEET_NAMES.PEPPER_TRACKING;
  var headers = isValet ? VALET_TRACKING_HEADERS : PEPPER_TRACKING_HEADERS;
  var sheet = getOrCreateSheet(ss, sheetName, headers);

  var cols = resolveColumns(sheet, headers);
  var col = cols.map;
  var width = cols.width;
  var block = readDataBlock(sheet, width);
  var existingData = block.values;

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  // 以 UID 分組現有資料列
  var uidMap = {};
  for (var i = 0; i < existingData.length; i++) {
    var r = existingData[i];
    var uidVal = String(r[col['UID']] || '').trim();
    if (!uidVal) continue;
    var closedVal = String(r[col['結案狀態']] || '').trim();
    var isRowClosed = closedVal === '已結案' || closedVal.toLowerCase() === 'true' || closedVal === '結案';
    if (!uidMap[uidVal]) uidMap[uidVal] = [];
    uidMap[uidVal].push({ dataIndex: i, sheetRowIndex: i + 2, isClosed: isRowClosed });
  }

  var updatedCount = 0;
  var newCount = 0;
  var newRows = [];

  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    var uid = String(item.uid || '').trim();
    if (!uid) continue;

    var existingEntries = uidMap[uid] || [];
    var activeEntry = null;
    for (var m = 0; m < existingEntries.length; m++) {
      if (!existingEntries[m].isClosed) { activeEntry = existingEntries[m]; break; }
    }

    var tagVal = item.statusTag === 'PENDING_CONFIRMATION' ? '待確認是否結案' : '正常追蹤';

    if (activeEntry) {
      var curRow = existingData[activeEntry.dataIndex];
      var changed = {};
      var set = function (name, val) {
        var c = col[name];
        if (c === undefined || c === -1) return;
        curRow[c] = val;
        changed[c] = true;
      };

      if (item.name) set('NAME', item.name);
      set('Outstanding Days', item.outstandingDays);
      set('Total Outstanding Amount', item.totalOutstandingAmount);
      if (item.email) set('Email', item.email);
      if (item.phone) set('Phone', item.phone);
      if (isValet) {
        if (item.serviceType) set('Type of Service', item.serviceType);
        if (item.address) set('地址', item.address);
      }
      set('追蹤標籤', item.statusTag === 'PENDING_CONFIRMATION' ? tagVal : (item.statusTag || '正常追蹤'));
      if (item.stage) set('催帳階段/狀態', item.stage);
      set('最後更新時間', nowStr);

      writeRow(sheet, activeEntry.sheetRowIndex, curRow, block.formulas[activeEntry.dataIndex], changed);
      updatedCount++;
    } else {
      // 第一次欠款，或先前已結案又再欠款 -> 新增一列（不覆蓋歷史紀錄）
      var newRow = [];
      for (var w = 0; w < width; w++) newRow.push('');
      var put = function (name, val) {
        var c = col[name];
        if (c === undefined || c === -1) return;
        newRow[c] = val;
      };
      put('UID', item.uid);
      put('NAME', item.name || '');
      put('Outstanding Days', item.outstandingDays);
      put('Total Outstanding Amount', item.totalOutstandingAmount);
      put('Email', item.email || '');
      put('Phone', item.phone || '');
      if (isValet) {
        put('Type of Service', item.serviceType || '');
        put('地址', item.address || '');
      }
      put('催帳階段/狀態', item.stage || 'STAGE_1');
      put('追蹤標籤', tagVal);
      put('結案狀態', '未結案');
      put('最後更新時間', nowStr);
      newRows.push(newRow);
      newCount++;
    }
  }

  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, width).setValues(newRows);
  }

  return {
    sheetName: sheetName,
    updatedCount: updatedCount,
    newCount: newCount,
    totalItems: items.length
  };
}

/**
 * 3. 前端單筆回寫 (當 2C/FA 在前端調整催帳狀態、備註或結案狀態時即時回寫)
 * 優先比對「尚未結案」的那一筆，以確保追蹤的是當前未結案案件！
 * 只寫入有變更的儲存格，且依試算表實際表頭定位欄位。
 */
function handleUpdateRowStatus(ss, businessUnit, uid, fields) {
  var isValet = businessUnit === 'VALET';
  var sheetName = isValet ? SHEET_NAMES.VALET_TRACKING : SHEET_NAMES.PEPPER_TRACKING;
  var headers = isValet ? VALET_TRACKING_HEADERS : PEPPER_TRACKING_HEADERS;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }
  if (sheet.getLastRow() <= 1) {
    throw new Error('工作表目前無資料列');
  }

  var cols = resolveColumns(sheet, headers);
  var col = cols.map;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, cols.width).getValues();
  var colUid = col['UID'];
  var colClosed = col['結案狀態'];

  var targetRowIdx = -1;

  // 優先找出該 UID 且「尚未結案」的列；若找不到則取最新的一列
  for (var i = data.length - 1; i >= 0; i--) {
    var r = data[i];
    if (String(r[colUid]).trim() === String(uid).trim()) {
      var closedVal = String(r[colClosed] || '').trim();
      var isClosed = closedVal === '已結案' || closedVal === '結案';
      if (!isClosed) {
        targetRowIdx = i + 2;
        break;
      }
      if (targetRowIdx === -1) {
        targetRowIdx = i + 2;
      }
    }
  }

  if (targetRowIdx === -1) {
    return { success: false, message: '在工作表中找不到 UID ' + uid + ' 的對應列' };
  }

  var fieldMapping = {
    stage: '催帳階段/狀態',
    statusTag: '追蹤標籤',
    isClosed: '結案狀態',
    closedDate: '結案日期',
    lineNoticeDate: 'Line通知日',
    lineStatus: 'Line狀態',
    emailNoticeDate: 'Email通知日',
    emailStatus: 'Email狀態',
    phoneNoticeDate: '電話通知日',
    phoneStatus: '電話狀態',
    twoCNotes: '2C催帳備註',
    demandNoticeDate: '催告通知日',
    demandDueDate: '催告到期日',
    demandDocUrl: '催告文件連結',
    terminationNoticeDate: '終止函日期',
    terminationDocUrl: '終止函文件連結',
    faNotes: 'FA備註'
  };
  var dateFields = {
    closedDate: true, lineNoticeDate: true, emailNoticeDate: true, phoneNoticeDate: true,
    demandNoticeDate: true, demandDueDate: true, terminationNoticeDate: true
  };

  var written = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key) || !fieldMapping[key]) continue;
    var headerName = fieldMapping[key];
    var colIdx = col[headerName];
    if (colIdx === undefined || colIdx === -1) continue;

    var val = fields[key];
    if (key === 'isClosed') {
      val = val ? '已結案' : '未結案';
    } else if (key === 'statusTag') {
      val = val === 'PENDING_CONFIRMATION' ? '待確認是否結案' : (val === 'NORMAL' ? '正常追蹤' : val);
    } else if (val === null || val === undefined) {
      val = '';
    } else if (dateFields[key]) {
      val = normalizeDateValue(val);
    }

    // 逐格寫入：只動這個欄位，不會影響同列其他欄
    sheet.getRange(targetRowIdx, colIdx + 1).setValue(val);
    written.push(headerName);
  }

  var colUpdatedAt = col['最後更新時間'];
  if (colUpdatedAt !== undefined && colUpdatedAt !== -1) {
    sheet.getRange(targetRowIdx, colUpdatedAt + 1)
      .setValue(Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'));
  }

  return {
    success: true,
    sheetName: sheetName,
    rowIndex: targetRowIdx,
    uid: uid,
    writtenColumns: written
  };
}

/**
 * 手動測試用：在 Apps Script 編輯器執行，檢查兩張追蹤表的欄位對應
 * （會自動補上缺少的欄位，並在執行記錄列出每個欄位對應到哪一欄）
 */
function checkColumnMapping() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[SHEET_NAMES.VALET_TRACKING, VALET_TRACKING_HEADERS],
   [SHEET_NAMES.PEPPER_TRACKING, PEPPER_TRACKING_HEADERS]].forEach(function (pair) {
    var sheet = ss.getSheetByName(pair[0]);
    if (!sheet) { Logger.log('找不到工作表: ' + pair[0]); return; }
    var map = resolveColumns(sheet, pair[1]).map;
    Logger.log('== ' + pair[0] + ' ==');
    pair[1].forEach(function (h) {
      var c = map[h];
      Logger.log(h + ' -> ' + (c === -1 ? '(無)' : columnLetter(c + 1)));
    });
  });
}

function columnLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
